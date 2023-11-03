const { isPast } = require("date-fns");

/**
 * @param {import('bullmq').SandboxedJob} job
 */
module.exports = async (job) => {
  const {
    data: { paymentHash, apiKey },
    id: pubKey,
  } = job;

  try {
    const { getInvoice } = require("../lnbits");
    const Bot = require("../bot");
    const bot = new Bot();

    const invoiceInfo = await getInvoice(paymentHash, apiKey);

    if (isPast(invoiceInfo.details.expiry)) {
      return;
    }

    if (invoiceInfo.paid) {
      await bot.notifyCollateralPosted(pubKey);
      process.emit(`${pubKey}.paid`, invoiceInfo);
    } else {
      throw new Error("Not paid yet");
    }
  } catch (error) {
    console.error("Failed to process invoice", error);
    throw error;
  }
};
