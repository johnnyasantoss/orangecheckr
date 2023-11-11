import type { SandboxedJob } from "bullmq";
import { isPast } from "date-fns";

export default async function (job: SandboxedJob) {
    const {
        data: { paymentHash, apiKey },
        id: pubKey,
    } = job;

    try {
        const { getInvoice } = require("../lnbits");
        const Bot = require("../bot");
        const bot = new Bot();

        const invoiceInfo = await getInvoice(paymentHash, apiKey);

        if (invoiceInfo.paid) {
            await bot.notifyCollateralPosted(pubKey);
        } else if (isPast(invoiceInfo.details.expiry)) {
            return;
        } else {
            throw new Error("Not paid yet");
        }
    } catch (error) {
        console.error("Failed to process invoice", error);
        throw error;
    }
}
