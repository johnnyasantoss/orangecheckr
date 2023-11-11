import type { SandboxedJob } from "bullmq";
import config from "../config";
import banUserInRelay from "../helpers/banUserInRelay";
import { evaluatePolicy } from "../llm";
const { policyUrl } = config;

export default async function (job: SandboxedJob) {
    const {
        data: { note, pubkey, eventId },
    } = job;

    try {
        const Bot = require("../bot");
        const bot = new Bot();

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
        throw new Error(`Error in spam reporting: ${error.message}`);
    }
}
