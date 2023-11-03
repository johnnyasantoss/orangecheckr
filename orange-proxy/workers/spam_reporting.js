const axios = require("axios");
const { policyUrl, checkSpamUrl } = require("../config");
const banUserInRelay = require("../helpers/banUserInRelay");
let bot;

/**
 * @param {import('bullmq').SandboxedJob} job
 */
module.exports = async (job) => {
  const {
    data: { note, pubkey, eventId },
  } = job;

  try {
    const Bot = require("../bot");
    const bot = new Bot();

    const spamCheck = await axios
      .post(checkSpamUrl, {
        policy_url: policyUrl,
        note,
      })
      .then(({ data }) => {
        return {
          credibility: data.credibility,
          reasoning: data.reasoning,
          note,
          pubkey,
          eventId,
        };
      });

    console.debug("Spam check concluido", spamCheck);

    if (spamCheck.credibility < 0.7) {
      await bot.notifyPolicyViolation(pubkey, eventId);
      await banUserInRelay(spamCheck);
    }
  } catch (error) {
    throw new Error(`Error in spam reporting: ${error.message}`);
  }
};
