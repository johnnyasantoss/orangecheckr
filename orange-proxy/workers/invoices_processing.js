const { isPast } = require("date-fns");
const { getInvoice } = require("../lnbits");

/**
 * @param {import('bullmq').SandboxedJob} job
 */
module.exports = async (job) => {
  const {
    data: { paymentHash, apiKey },
    id: pubKey,
  } = job;

  const invoiceInfo = await getInvoice(paymentHash, apiKey);

  if (isPast(invoiceInfo.details.expiry)) {
    throw new Error("Expired");
  }

  if (invoiceInfo.paid) {
    process.emit(`${pubKey}.paid`, invoiceInfo);
  } else {
    throw new Error("Not paid yet");
  }
};
