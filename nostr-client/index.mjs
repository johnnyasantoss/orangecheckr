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

/**
 * @param {Date} d
 * @returns {number}
 */
const toUnixEpoch = (d) => Math.trunc(d.getTime() / 1000);
const now = () => toUnixEpoch(new Date());

const cutoffDate = new Date(2023, 10, 1);
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

    const post0 = finishEvent(
        {
            kind: 0,
            content: "Test 1.2.3.",
            created_at: now(),
            tags: [],
        },
        privKey
    );
    await relay.publish(post0);

    const sub = relay.sub([{ kinds: [4], since: toUnixEpoch(cutoffDate) }]);
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
