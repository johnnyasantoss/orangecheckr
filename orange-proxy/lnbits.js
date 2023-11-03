const axios = require("axios");
const { processInvoice } = require("./queue");
const { proxyUrl, invoiceExpirySecs } = require("./config");
const { URL } = require("url");
const {
  managerUser,
  adminKey,
  lnbitsUrl,
  collateralRequired,
  relayId,
  relayInvoiceKey,
} = require("./config");

// Create an Axios instance
/** @type {axios.Axios} */
const api = axios.create({
  baseURL: lnbitsUrl,
  timeout: 10000, // Set your timeout value (in milliseconds)
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Api-Key": adminKey,
  },
});

// Get user
async function getUser() {
  const response = await api.get(`/usermanager/api/v1/users/${managerUser}`);
  return response.data;
}

async function getInvoice(paymentHash, apiKey) {
  const response = await api.get(`/api/v1/payments/${paymentHash}`, {
    headers: {
      "X-Api-Key": apiKey,
    },
  });
  return response.data;
}

// Delete wallet
async function deleteWallet(walletId) {
  const response = await api.delete(`/usermanager/api/v1/wallets/${walletId}`);

  return response.data;
}

// Get wallet
async function getWallet(pubkey) {
  const wallets = await getWallets();

  // Filter response where data.name == pubkey
  const wallet = wallets.find((wallet) => wallet.name === pubkey);

  return wallet;
}

async function getWallets() {
  const response = await api.get(`/usermanager/api/v1/wallets`);

  return response.data;
}

async function getWalletDetails(pubKey, adminKey) {
  if (!adminKey) {
    ({ adminkey: adminKey } = await getWallet(pubKey));
  }
  const response = await api.get(`/api/v1/wallet`, {
    headers: {
      "X-Api-Key": adminKey,
    },
  });

  return response.data;
}

async function getBalanceInSats(pubKey) {
  const { balance } = await getWalletDetails(pubKey);
  const balanceSats = Math.floor(balance / 1000);

  return balanceSats;
}

// Create wallet
async function createWallet(pubKey) {
  const userData = {
    admin_id: managerUser,
    wallet_name: pubKey,
    user_id: relayId,
  };

  const response = await api.post("/usermanager/api/v1/wallets", userData);
  return response.data;
}

// Seizure wallet
async function seizeWallet(pubKey) {
  const response = await getWallet(pubKey);
  const client_adminkey = response.adminkey;
  const client_inkey = response.inkey;

  // Client wallet details
  const client_wallet = await api.get(`/api/v1/wallet`, {
    headers: {
      "X-Api-Key": client_inkey,
    },
  });

  // Create seizure invoice
  const seizure_invoice = await createInvoice(
    collateralRequired,
    `Seizure of wallet ${pubKey}`,
    true,
    relayInvoiceKey,
    pubKey
  );
  const invoice = seizure_invoice.payment_request;

  // Pay seizure invoice
  const seizure_payment = await newFunction(invoice, client_adminkey);

  console.debug(`Confiscado saldo do ${pubKey}`, seizure_payment.data);
  return true;
}

function newFunction(invoice, client_adminkey) {
  return api.post(
    `/api/v1/payments`,
    {
      out: true,
      bolt11: invoice,
    },
    {
      headers: {
        "X-Api-Key": client_adminkey,
      },
    }
  );
}

// Withdraw collateral
async function withdrawCollateral(pubKey, lnurl) {
  const seize = await seizeWallet(pubKey);
}

async function createInvoice(amount, memo, internal = false, apiKey, pubKey) {
  const webhookUrl = new URL(
    `/webhooks/lnbits/paid/${pubKey}`,
    proxyUrl.toString()
  );
  webhookUrl.protocol = "https";

  const res = await api.post(
    `/api/v1/payments`,
    {
      out: false,
      amount,
      memo,
      internal,
      expiry: invoiceExpirySecs,
      webhook: internal ? undefined : webhookUrl.toString(),
    },
    {
      headers: {
        "X-Api-Key": apiKey,
      },
    }
  );

  await processInvoice(pubKey, {
    paymentHash: res.data.payment_hash,
    apiKey: apiKey,
  });

  return res.data;
}

async function fundCollateral(pubKey) {
  let walletInfo = await getWallet(pubKey);
  if (!walletInfo) {
    walletInfo = await createWallet(pubKey);
  }

  const balance = await getBalanceInSats(pubKey);

  const { payment_request } = await createInvoice(
    collateralRequired - balance,
    `Funding collateral for ${pubKey}`,
    false,
    walletInfo.inkey,
    pubKey
  );

  return payment_request;
}

module.exports = {
  fundCollateral,
  seizeWallet,
  getWallets,
  getInvoice,
  getWalletDetails,
  getBalanceInSats,
};
