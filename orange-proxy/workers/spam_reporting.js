const { isPast } = require("date-fns");
const { getInvoice } = require("../lnbits");
const { axios } = require("axios");
const { policyUrl, checkSpamUrl } = require("../config");
const banUser = require("../helpers/banUser");

/**
 * @param {import('bullmq').SandboxedJob} job
 */
module.exports = async (job) => {
  const {
    data: { note, pubkey },
  } = job;

  try {
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
        };
      });

    if (spamCheck.credibility < 1) {
      await banUser(pubkey);
    }
  } catch (error) {
    throw new Error(`Failed to fetch invoice: ${error.message}`);
  }
};
