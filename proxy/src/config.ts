import "dotenv/config";
import { URL } from "url";

function missingEnv(key: string): never {
    throw new Error(`Missing environment variable: ${key}`);
}

function getEnv(key: string, defaultValue?: string) {
    return process.env[key] || defaultValue || missingEnv(key);
}

export const config = {
    envType: getEnv("NODE_ENV", "development"),
    port: parseInt(getEnv("PORT", "8080")),
    invoiceExpirySecs: Number(getEnv("INVOICE_EXPIRY_SECS")),
    workersAmount: Number(getEnv("NUM_WORKERS", "0")),
    authTimeoutSecs: Number(getEnv("AUTH_TIMEOUT_SECS")),
    proxyUrl: new URL(getEnv("PROXY_URI")),
    relayUri: getEnv("RELAY_URI"),
    postingPolicyUrl: getEnv("POSTING_POLICY_URL"),
    botName: getEnv("BOT_NAME", "Orange Checkr Bot"),
    botAbout: getEnv(
        "BOT_ABOUT",
        "I'm a bot that helps you use Orange Checkr. Made at #SatsHack #2023"
    ),
    botPicture: getEnv("BOT_PICTURE", "https://i.imgur.com/MBwgeHK.png"),
    botPrivateKey: getEnv("BOT_PRIVATE_KEY"),
    managerUser: getEnv("USER_MANAGER"),
    adminKey: getEnv("ADMIN_KEY"),
    lnbitsUrl: getEnv("LNBITS_URL"),
    collateralRequired: Number(getEnv("COLLATERAL_REQUIRED")),
    relayId: getEnv("RELAY_ID"),
    relayInvoiceKey: getEnv("RELAY_INVOICE_KEY"),
    policyUrl: getEnv("POSTING_POLICY_URL"),
    checkSpamUrl: getEnv("CHECK_SPAM_URL"),
    filterNipKind: getEnv("FILTER_NIP_KIND")
        .split(",")
        .map((k) => parseInt(k)),
    openAiKey: getEnv("OPENAI_API_KEY"),
    redisHost: getEnv("REDIS_HOST"),
    redisPort: getEnv("REDIS_PORT"),
};

export default config;

export function isDev() {
    return config.envType !== "production";
}
