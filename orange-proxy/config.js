require("dotenv").config();

module.exports = {
  collateralRequired: process.env.COLLATERAL_REQUIRED,
  invoiceExpirySecs: Number(process.env.INVOICE_EXPIRY_SECS),
  authTimeoutSecs: Number(process.env.AUTH_TIMEOUT_SECS),
};
