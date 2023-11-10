const { relayInit, finishEvent, getPublicKey } = require("nostr-tools");
const { relayUri, botPrivateKey } = require("../config");

const getNow = () => Math.floor(new Date().getTime() / 1000);

module.exports = async ({ pubkey, eventId, reasoning }) => {
  const relay = relayInit(relayUri);

  const reportEvent = finishEvent(
    {
      kind: 1984,
      created_at: getNow(),
      tags: [
        ["e", eventId, "spam"],
        ["p", pubkey],
      ],
      content: reasoning,
    },
    botPrivateKey
  );

  try {
    await relay.publish(reportEvent);
    console.debug("Relatório enviado", JSON.stringify(reportEvent));
  } catch (error) {
    console.error("Erro ao enviar relatório:", error);
    throw error;
  }
};
