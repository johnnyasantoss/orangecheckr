const { isPast } = require("date-fns");
const { getInvoice } = require("../lnbits");

/**
 * @param {import('bullmq').SandboxedJob} job
 */
module.exports = async (job) => {
  const {
    data: { paymentHash, apiKey },
  } = job;

  try {
    const invoiceInfo = await getInvoice(paymentHash, apiKey);

    if (isPast(invoiceInfo.details.expiry)) {
      throw new Error("Expired");
    }

    if (invoiceInfo.paid) {
      process.emit(`${pubkey}.paid`, invoiceInfo);
    } else {
      job.log("Not paid yet");
    }
  } catch (error) {
    throw new Error(`Failed to fetch invoice: ${error.message}`);
  }
};
