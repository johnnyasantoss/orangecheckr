import { nip44, generatePrivateKey, getPublicKey } from "nostr-tools";

class Bot {
  constructor({ relay }) {
    this.relay = relay
    this.botPrivateKey = process.env.BOT_PRIVATE_KEY || generatePrivateKey();
    this.botPublicKey = getPublicKey(this.botPrivateKey);
  }

  async askForCollateral(receiverPublicKey, amount = null) {
    const message = `To use this relay you need to post ${amount || process.env.COLLATERAL_REQUIRED} sats as collateral. You may lose those funds if you violate our terms of use (${process.env.TERMS_OF_USE_URL}).`;

    const receiverPublicKey = receiverPublicKey

    const key = nip44.getSharedSecret(this.botPrivateKey, receiverPublicKey);

    let ciphertext = nip44.encrypt(key, message);

    const event = {
      kind: 4,
      pubkey: this.botPublicKey,
      tags: [["p", receiverPublicKey]],
      content: ciphertext,
      ...otherProperties,
    };

    return this.relay.send(event)
  }
  
  async 
}

export default Bot;
