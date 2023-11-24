import type { SandboxedJob } from "bullmq";
import { config } from "../config";
import banUserInRelay from "../helpers/banUserInRelay";
import { evaluatePolicy } from "../llm";

const { policyUrl } = config;

export default async function (job: SandboxedJob) {
    const {
        data: { note, pubkey, eventId },
    } = job;

    const { Bot } = await import("../bot.js");
    const bot = new Bot();
    try {
        const response = await fetch(policyUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const policy = await response.text();

        const spamCheck = await evaluatePolicy(policy, note);

        console.debug("Spam check completed", spamCheck);

        if (spamCheck.credibility < 0.7) {
            await bot.notifyPolicyViolation(pubkey, eventId);
            await banUserInRelay(spamCheck);
        }
    } catch (error) {
        throw new Error(`Error in spam reporting: ${(error as any).message}`);
    } finally {
        bot.close();
    }
}
