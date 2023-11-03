const axios = require("axios");
const { processInvoice } = require("./queue");

// Manager - LNbits user in the URL
const USER = process.env.USER_MANAGER;

// Admin
const ADMIN_KEY = process.env.ADMIN_KEY;
const LNBITS_URL = process.env.LNBITS_URL;
const COLLATERAL_REQUIRED = process.env.COLLATERAL_REQUIRED;

// User
const RELAY_ID = process.env.RELAY_ID;

// Relay Wallet
const RELAY_INVOICE_KEY = process.env.RELAY_INVOICE_KEY;

// Create an Axios instance
/** @type {axios.Axios} */
const api = axios.create({
  baseURL: LNBITS_URL,
  timeout: 10000, // Set your timeout value (in milliseconds)
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Api-Key": ADMIN_KEY,
  },
});

// Get user
async function getUser() {
  const response = await api.get(`/usermanager/api/v1/users/${USER}`);
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

// Create wallet
async function createWallet(pubKey) {
  const userData = {
    admin_id: USER,
    wallet_name: pubKey,
    user_id: RELAY_ID,
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
    COLLATERAL_REQUIRED,
    `Seizure of wallet ${pubKey}`,
    true,
    RELAY_INVOICE_KEY,
    pubKey
  );
  const invoice = seizure_invoice.payment_request;

  // Pay seizure invoice
  const seizure_payment = await api.post(
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

  console.debug(`Confiscado saldo do ${pubKey}`, seizure_payment.data);
  return true;
}

async function createInvoice(amount, memo, internal = false, apiKey, pubKey) {
  const res = await api.post(
    `/api/v1/payments`,
    {
      out: false,
      amount,
      memo,
      internal,
      expiry: process.env.INVOICE_EXPIRY_SECS,
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

  const { payment_request } = await createInvoice(
    COLLATERAL_REQUIRED,
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
};
