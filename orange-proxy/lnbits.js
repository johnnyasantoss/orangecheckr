const axios = require("axios");

require("dotenv").config();

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

// Delete wallet
async function deleteWallet(walletId) {
  const response = await api.delete(`/usermanager/api/v1/wallets/${walletId}`);
  return response.data;
}

// Get wallet
async function getWallet(pubkey) {
  const response = await api.get(`/usermanager/api/v1/wallets`);

  // Filter response where data.name == pubkey
  const wallet = response.data.find((wallet) => wallet.name === pubkey);

  return wallet;
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
    COLLATERAL_REQUIRED - 3,
    `Seizure of wallet ${pubkey}`,
    true,
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

  console.debug(`Confiscado saldo do ${pubkey}`, seizure_payment.data);
  return true;
}

async function createInvoice(amount, memo, internal = false, apiKey) {
  const res = await api.post(
    `/api/v1/payments`,
    {
      out: false,
      amount,
      memo,
      internal,
    },
    {
      headers: {
        "X-Api-Key": apiKey,
      },
    }
  );

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
    walletInfo.inkey
  );

  return payment_request;
}

module.exports = {
  fundCollateral,
  seizeWallet,
};
