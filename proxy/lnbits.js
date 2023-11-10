const axios = require("axios");
const { processInvoice } = require("./queue");
const { proxyUrl, invoiceExpirySecs } = require("./config");
const { URL } = require("url");
const { requestInvoice, utils } = require("lnurl-pay");
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
    const walletInfo = await getWallet(pubKey);
    if (!walletInfo) return;
    adminKey = walletInfo.adminkey;
  }
  const response = await api.get(`/api/v1/wallet`, {
    headers: {
      "X-Api-Key": adminKey,
    },
  });

  return response.data;
}

async function getBalanceInSats(pubKey) {
  const walletDetails = await getWalletDetails(pubKey);
  if (!walletDetails) return 0;

  const { balance } = walletDetails;
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
  const { adminkey, inkey } = await getWallet(pubKey);

  // Client wallet details
  const client_wallet = await api.get(`/api/v1/wallet`, {
    headers: {
      "X-Api-Key": inkey,
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
  const seizure_payment = await payInvoice(invoice, adminkey);

  console.debug(`Confiscado saldo do ${pubKey}`, seizure_payment.data);
  return true;
}

async function decodeInvoice(readKey, lnurl) {
  const res = await api.post(
    `/api/v1/payments/decode`,
    {
      data: lnurl,
    },
    {
      headers: {
        "X-Api-Key": readKey,
      },
    }
  );
  return res;
}

async function sweepWallet(invoice, pubKey, amount) {
  // Get wallet details
  const { adminkey } = await getWallet(pubKey);
  return payInvoice(invoice, adminkey, amount);
}

function payInvoice(invoice, client_adminkey, amount) {
  return api.post(
    `/api/v1/payments`,
    {
      out: true,
      bolt11: invoice,
      amount: amount,
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
  // const seize = await seizeWallet(pubKey);

  // Get wallet details
  const { adminkey, inkey } = await getWallet(pubKey);

  // Get invoice info
  const invoice_info = await decodeInvoice(inkey, lnurl);

  const {
    invoice,
    params,
    rawData,
    successAction,
    hasValidAmount,
    hasValidDescriptionHash,
    validatePreimage,
  } = await requestInvoice({
    lnUrlOrAddress: lnurl,
    tokens: 10000, // in TS you can use utils.checkedToSats or utils.toSats
  });

  const paiment = await payInvoice(lnurl, adminkey);
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
      webhook: internal
        ? undefined
        : "https://webhook.site/9a841084-78c4-4bc0-b065-c107ab9a3f7d",
      unit: "sat",
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
  sweepWallet,
};
