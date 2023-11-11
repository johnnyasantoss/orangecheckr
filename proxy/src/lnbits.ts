import axios from "axios";
import { URL } from "url";
import config from "./config";
import { processInvoice } from "./queue";
const {
    adminKey,
    collateralRequired,
    invoiceExpirySecs,
    lnbitsUrl,
    managerUser,
    proxyUrl,
    relayId,
    relayInvoiceKey,
} = config;

// Create an Axios instance
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

async function getInvoice(paymentHash: string, apiKey: string) {
    const response = await api.get(`/api/v1/payments/${paymentHash}`, {
        headers: {
            "X-Api-Key": apiKey,
        },
    });
    return response.data;
}

// Delete wallet
async function deleteWallet(walletId: string) {
    const response = await api.delete(
        `/usermanager/api/v1/wallets/${walletId}`
    );

    return response.data;
}

// Get wallet
export async function getWallet(pubkey: string) {
    const wallets = await getWallets();

    // Filter response where data.name == pubkey
    const wallet = wallets.find(
        (wallet: { name: string }) => wallet.name === pubkey
    );

    return wallet;
}

export async function getWallets() {
    const response = await api.get(`/usermanager/api/v1/wallets`);

    return response.data;
}

export async function getWalletDetails(pubKey: string, adminKey?: string) {
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

export async function getBalanceInSats(pubKey: string) {
    const walletDetails = await getWalletDetails(pubKey);
    if (!walletDetails) return 0;

    const { balance } = walletDetails;
    const balanceSats = Math.floor(balance / 1000);

    return balanceSats;
}

// Create wallet
async function createWallet(pubKey: string) {
    const userData = {
        admin_id: managerUser,
        wallet_name: pubKey,
        user_id: relayId,
    };

    const response = await api.post("/usermanager/api/v1/wallets", userData);
    return response.data;
}

// Seizure wallet
export async function seizeWallet(pubKey: string) {
    const { adminkey, inkey } = await getWallet(pubKey);

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

// async function decodeInvoice(readKey: string, lnurl: string) {
//     const res = await api.post(
//         `/api/v1/payments/decode`,
//         {
//             data: lnurl,
//         },
//         {
//             headers: {
//                 "X-Api-Key": readKey,
//             },
//         }
//     );
//     return res;
// }

export async function sweepWallet(
    invoice: string,
    pubKey: string,
    amount?: number
) {
    // Get wallet details
    const { adminkey } = await getWallet(pubKey);
    return payInvoice(invoice, adminkey, amount);
}

function payInvoice(invoice: string, client_adminkey: string, amount?: number) {
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
// async function withdrawCollateral(pubKey: string, lnurl: string) {
//     // const seize = await seizeWallet(pubKey);

//     // Get wallet details
//     const { adminkey, inkey } = await getWallet(pubKey);

//     // Get invoice info
//     const invoice_info = await decodeInvoice(inkey, lnurl);

//     const {
//         invoice,
//         params,
//         rawData,
//         successAction,
//         hasValidAmount,
//         hasValidDescriptionHash,
//         validatePreimage,
//     } = await requestInvoice({
//         lnUrlOrAddress: lnurl,
//         tokens: 10000, // in TS you can use utils.checkedToSats or utils.toSats
//     });

//     const paiment = await payInvoice(lnurl, adminkey);
// }

async function createInvoice(
    amount: number,
    memo: string,
    internal = false,
    apiKey: string,
    pubKey: string
) {
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

export async function fundCollateral(pubKey: string) {
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
