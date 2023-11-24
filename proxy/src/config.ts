import "dotenv/config";

import { URL } from "url";

function missingEnv(key: string): never {
    throw new Error(`Missing environment variable: ${key}`);
}

function getEnv(key: string, defaultValue?: string) {
    return process.env[key] || defaultValue || missingEnv(key);
}

export const config = {
    envType: getEnv("NODE_ENV", "production"),
    port: parseInt(getEnv("PORT", "8080")),
    workersAmount: Number(getEnv("NUM_WORKERS", "0")),

    collateralRequired: Number(getEnv("AMOUNT_COLLATERAL_REQUIRED")),
    invoiceExpirySecs: Number(getEnv("INVOICE_EXPIRY_SECS")),
    authTimeoutSecs: Number(getEnv("AUTH_TIMEOUT_SECS")),

    policyUrl: getEnv("POSTING_POLICY_URL"),
    filterNipKind: getEnv("FILTER_NIP_KIND")
        .split(",")
        .map((k) => parseInt(k)),

    proxyUrl: new URL(getEnv("PROXY_URI")),
    relayUri: getEnv("RELAY_URI"),

    botName: getEnv("BOT_NAME", "Orange Checkr Bot"),
    botAbout: getEnv(
        "BOT_ABOUT",
        "I'm a bot that helps you use Orange Checkr. Made at #SatsHack #2023"
    ),
    botPicture: getEnv("BOT_PICTURE", ""),
    botPrivateKey: getEnv("BOT_PRIVATE_KEY"),

    lnbitsMasterAccountAdminKey: getEnv("LNBITS_MASTER_ACCOUNT_ADMIN_KEY"),
    lnbitsMasterAccountUser: getEnv("LNBITS_MASTER_ACCOUNT_USER"),
    lnbitsRelaySubWallet: getEnv("LNBITS_RELAY_SUBWALLET"),
    lnbitsRelaySubWalletInvoiceKey: getEnv(
        "LNBITS_RELAY_SUBWALLET_INVOICE_KEY"
    ),
    lnbitsUrl: getEnv("LNBITS_URL"),

    openAiKey: getEnv("OPENAI_API_KEY"),

    redisHost: getEnv("REDIS_HOST"),
    redisPort: getEnv("REDIS_PORT"),
};

export function isDev() {
    return config.envType !== "production";
}
