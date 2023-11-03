const { isPast } = require("date-fns");
const { getInvoice } = require("../lnbits");

/**
 * @param {import('bullmq').SandboxedJob} job
 */
module.exports = async (job) => {
  const {
    data: { paymentHash, apiKey },
  } = job;

  const invoiceInfo = await getInvoice(paymentHash, apiKey);

  if (isPast(invoiceInfo.details.expiry)) {
    job.log("Expired");
  }

  if (invoiceInfo.paid) {
    return;
  } else {
    job.log("Not paid yet");
  }
};
