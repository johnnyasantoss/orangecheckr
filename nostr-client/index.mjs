import "websocket-polyfill";
import {
  relayInit,
  finishEvent,
  generatePrivateKey,
  getPublicKey,
} from "nostr-tools";

const priv = generatePrivateKey();
const pub = getPublicKey(priv);

const relayUrl =
  "wss://1337-johnnyasant-satshackora-i5zo9336ya4.ws-us105.gitpod.io";
const relay = relayInit(relayUrl);

relay.on("auth", (challenge) => {
  console.debug(`Recebeu auth: ${challenge}`);

  const sigEvent = finishEvent({
    kind: 22242,
    created_at: Date.now(),
    content: "",
    tags: [["relay", , relayUrl], [["challenge", challenge]]],
  });

  relay.publish(sigEvent);
});

relay.on('notice', console.debug);

relay.on("connect", () => {
  console.log(`connected to ${relay.url}`);
});

relay.on("error", () => {
  console.log(`failed to connect to ${relay.url}`);
});

await relay.connect();
