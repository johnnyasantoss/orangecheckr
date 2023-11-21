// @ts-check
import "dotenv/config";
import "websocket-polyfill";

import {
    finishEvent,
    generatePrivateKey,
    getPublicKey,
    nip42,
    relayInit,
} from "nostr-tools";

const { RELAY_URL, PRIVATE_KEY } = process.env;

if (!RELAY_URL) throw new Error("Missing envs");

const privKey = PRIVATE_KEY || generatePrivateKey();
const pubKey = getPublicKey(privKey);
console.debug("Usando pub key: %s", pubKey);

const relay = relayInit(RELAY_URL);

let receivedAuth = false;

relay.on("auth", async (challenge) => {
    receivedAuth = true;
    console.debug(`Received AUTH: ${challenge}`);

    await nip42.authenticate({
        challenge,
        relay,
        sign: (e) => finishEvent(e, privKey),
    });

    const sub = relay.sub([
        { kinds: [4], since: new Date(2023, 10, 1).getTime() / 1000 },
    ]);
    sub.on("count", (c) => console.info(`Received ${c} posts from relay`));
    sub.on("eose", () => relay.close());
});

relay.on("notice", (n) => console.debug("NOTICE: %s", n));

relay.on("connect", () => {
    console.log(`connected to ${relay.url}`);
    setTimeout(() => {
        if (receivedAuth) return;
        console.error(
            "Did not receive AUTH in time. Probably not connected to proxy"
        );
        relay.close();
    }, 500);
});

relay.on("error", (err) =>
    console.error(`Failed to connect to ${relay.url}`, err)
);

relay.on("disconnect", () => console.info("Disconnected"));

await relay.connect();
