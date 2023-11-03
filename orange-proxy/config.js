require("dotenv").config();
const { URL } = require("url");

/** @return {never} */
function missingEnv(key) {
  throw new Error(`Missing environment variable: ${key}`);
}

module.exports = {
  invoiceExpirySecs:
    Number(process.env.INVOICE_EXPIRY_SECS) ||
    missingEnv("INVOICE_EXPIRY_SECS"),
  authTimeoutSecs:
    Number(process.env.AUTH_TIMEOUT_SECS) || missingEnv("AUTH_TIMEOUT_SECS"),
  proxyUrl: new URL(process.env.PROXY_URI) || missingEnv("PROXY_URI"),
  relayUri: process.env.RELAY_URI || missingEnv("RELAY_URI"),
  postingPolicyUrl:
    process.env.POSTING_POLICY_URL || missingEnv("POSTING_POLICY_URL"),
  botName: process.env.BOT_NAME || "Orange Checkr Bot",
  botAbout:
    process.env.BOT_ABOUT ||
    "I'm a bot that helps you use Orange Checkr. Made at #SatsHack #2023",
  botPicture: process.env.BOT_PICTURE || "https://i.imgur.com/MBwgeHK.png",
  botPrivateKey: process.env.BOT_PRIVATE_KEY || missingEnv("BOT_PRIVATE_KEY"),
  managerUser: process.env.USER_MANAGER || missingEnv("USER_MANAGER"),
  adminKey: process.env.ADMIN_KEY || missingEnv("ADMIN_KEY"),
  lnbitsUrl: process.env.LNBITS_URL || missingEnv("LNBITS_URL"),
  collateralRequired:
    Number(process.env.COLLATERAL_REQUIRED) ||
    missingEnv("COLLATERAL_REQUIRED"),
  relayId: process.env.RELAY_ID || missingEnv("RELAY_ID"),
  relayInvoiceKey:
    process.env.RELAY_INVOICE_KEY || missingEnv("RELAY_INVOICE_KEY"),
  policyUrl: process.env.POSTING_POLICY_URL || missingEnv("POSTING_POLICY_URL"),
  checkSpamUrl: process.env.CHECK_SPAM_URL || missingEnv("CHECK_SPAM_URL"),
};
