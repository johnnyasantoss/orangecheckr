const {
  relayInit,
  generatePrivateKey,
  getPublicKey,
  nip44,
} = require("nostr-tools");

const relayUri = process.env.RELAY_URI;
const postingPolicyUrl = process.env.POSTING_POLICY_URL;
const collateralRequired = process.env.COLLATERAL_REQUIRED;

class Bot {
  constructor() {
    if (!relayUri) {
      throw new Error("RELAY_URI environment variable is required");
    }
    if (!postingPolicyUrl) {
      throw new Error("POSTING_POLICY_URL environment variable is required");
    }
    if (!collateralRequired) {
      throw new Error("COLLATERAL_REQUIRED environment variable is required");
    }
    this.relay = relayInit(relayUri);
    this.privateKey = process.env.BOT_PRIVATE_KEY || generatePrivateKey();
    this.publicKey = getPublicKey(this.privateKey);
  }

  async connect() {
    await this.relay.connect();
  }

  async askForCollateral(ws, pubkey, invoice) {
    let message = `To use this relay you need to post ${collateralRequired} sats
        as collateral. You may lose your funds if you violate our Posting Policy (${postingPolicyUrl}).\n
        To proceed, pay the following lightning invoice:\n\n${invoice}\n\n
        You may withdraw your collateral at any time by replying with "withdraw collateral".`;

    this._sendMessage(ws, pubkey, message);
  }

  async notifyCollateralPosted(ws, pubkey) {
    let message = `Collateral posted! You may now use this relay.\n
        You may withdraw your collateral at any time by replying with "withdraw collateral".`;

    this._sendMessage(ws, pubkey, message);
  }

  async notifyCollateralWithdrawn(ws, pubkey) {
    let message = `Collateral withdrawn! You may no longer use this relay.\n
        To use this relay again, reply with "post collateral".`;

    this._sendMessage(ws, pubkey, message);
  }

  async notifyCollateralWithdrawnFailed(ws, pubkey) {
    let message = `Collateral withdrawal failed! You need to set a valid lightning address
        in your profile for us to pay you back. To try again, reply with "withdraw collateral"`;

    this._sendMessage(ws, pubkey, message);
  }

  async notifyCollateralSeized(ws, pubkey, eventId) {
    let message = `Your collateral has been seized because nostr:${eventId} violated
        our Posting Policy (${postingPolicyUrl}). You may no longer use this relay.\n
        To use this relay again, reply with "post collateral".`;

    this._sendMessage(ws, pubkey, message);
  }

  async informCollateralAmount(ws, pubkey, amount) {
    let message = `You have posted ${amount} sats as collateral.\n
        If you want to withdraw, reply with "withdraw collateral".`;

    this._sendMessage(ws, pubkey, message);
  }

  async notifyPolicyViolation(ws, pubkey, eventId) {
    let message = `Your post nostr:${eventId} violated our Posting Policy (${postingPolicyUrl}).\n
        This is just a warning, but we may seize your collateral next time.`;

    this._sendMessage(ws, pubkey, message);
  }

  async _sendMessage(ws, pubkey, message) {
    let key = nip44.getSharedSecret(this.privateKey, pubkey);
    let ciphertext = nip44.encrypt(key, message);

    let event = {
      kind: 4,
      pubkey: this.publicKey,
      tags: [["p", pubkey]],
      content: ciphertext,
    };

    ws.send(JSON.stringify(["EVENT", event]));
  }
}

module.exports = Bot;
