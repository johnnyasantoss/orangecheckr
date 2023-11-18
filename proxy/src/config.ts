import "dotenv/config";
import { URL } from "url";

function missingEnv(key: string): never {
    throw new Error(`Missing environment variable: ${key}`);
}

export const config = {
    envType: process.env["NODE_ENV"] || "development",
    port: parseInt(process.env["PORT"] || "8080"),
    invoiceExpirySecs:
        Number(process.env["INVOICE_EXPIRY_SECS"]) ||
        missingEnv("INVOICE_EXPIRY_SECS"),
    workersAmount: Number(process.env["NUM_WORKERS"]),
    authTimeoutSecs:
        Number(process.env["AUTH_TIMEOUT_SECS"]) ||
        missingEnv("AUTH_TIMEOUT_SECS"),
    proxyUrl: new URL(process.env["PROXY_URI"] || missingEnv("PROXY_URI")),
    relayUri: process.env["RELAY_URI"] || missingEnv("RELAY_URI"),
    postingPolicyUrl:
        process.env["POSTING_POLICY_URL"] || missingEnv("POSTING_POLICY_URL"),
    botName: process.env["BOT_NAME"] || "Orange Checkr Bot",
    botAbout:
        process.env["BOT_ABOUT"] ||
        "I'm a bot that helps you use Orange Checkr. Made at #SatsHack #2023",
    botPicture: process.env["BOT_PICTURE"] || "https://i.imgur.com/MBwgeHK.png",
    botPrivateKey:
        process.env["BOT_PRIVATE_KEY"] || missingEnv("BOT_PRIVATE_KEY"),
    managerUser: process.env["USER_MANAGER"] || missingEnv("USER_MANAGER"),
    adminKey: process.env["ADMIN_KEY"] || missingEnv("ADMIN_KEY"),
    lnbitsUrl: process.env["LNBITS_URL"] || missingEnv("LNBITS_URL"),
    collateralRequired:
        Number(process.env["COLLATERAL_REQUIRED"]) ||
        missingEnv("COLLATERAL_REQUIRED"),
    relayId: process.env["RELAY_ID"] || missingEnv("RELAY_ID"),
    relayInvoiceKey:
        process.env["RELAY_INVOICE_KEY"] || missingEnv("RELAY_INVOICE_KEY"),
    policyUrl:
        process.env["POSTING_POLICY_URL"] || missingEnv("POSTING_POLICY_URL"),
    filterNipKind: (
        process.env["FILTER_NIP_KIND"] || missingEnv("FILTER_NIP_KIND")
    )
        .split(",")
        .map((k) => parseInt(k)),
    openAiKey: process.env["OPENAI_API_KEY"] || missingEnv("OPENAI_API_KEY"),
};

export default config;

export function isDev() {
    return config.envType !== "production";
}
