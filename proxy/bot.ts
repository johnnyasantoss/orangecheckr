import {
    Event,
    Relay,
    finishEvent,
    getPublicKey,
    nip04,
    relayInit,
} from "nostr-tools";
import config from "./config";
import { getNow } from "./helpers";
import { fundCollateral, seizeWallet } from "./lnbits";
const {
    botAbout,
    botName,
    botPicture,
    botPrivateKey,
    collateralRequired,
    postingPolicyUrl,
    relayUri,
} = config;

export class Bot {
    private relay: Relay;
    private privateKey: string;
    public publicKey: string;

    constructor() {
        if (!relayUri) {
            throw new Error("RELAY_URI environment variable is required");
        }
        if (!postingPolicyUrl) {
            throw new Error(
                "POSTING_POLICY_URL environment variable is required"
            );
        }
        if (!collateralRequired) {
            throw new Error(
                "COLLATERAL_REQUIRED environment variable is required"
            );
        }
        this.relay = relayInit(relayUri);
        this.privateKey = botPrivateKey;
        this.publicKey = getPublicKey(this.privateKey);
    }

    async connect() {
        await this.relay.connect();
        // await this._publishMetadata();
        let sub = this.relay.sub([
            {
                kinds: [4],
                "#p": [this.publicKey],
                since: getNow(),
            },
        ]);
        sub.on("event", (event) => {
            this._handleEvent(event);
        });
    }

    async askForCollateral(pubkey: string, invoice?: string) {
        if (!invoice) {
            invoice = await fundCollateral(pubkey);
        }

        let message = `To use this relay you need to post ${collateralRequired} sats as collateral. You may lose your funds if you violate our Posting Policy (${postingPolicyUrl}).\nTo proceed, pay the following lightning invoice:\n\n${invoice}\n\nYou may withdraw your collateral at any time by replying with /withdrawCollateral <lightning invoice>.`;

        await this._sendMessage(pubkey, message);
    }

    async notifyCollateralPosted(pubkey: string) {
        let message = `Collateral posted! You may now use this relay.\nYou may withdraw your collateral at any time by replying with /withdrawCollateral <lightning invoice>.`;

        await this._sendMessage(pubkey, message);
    }

    async notifyCollateralWithdrawn(pubkey: string) {
        let message = `Collateral withdrawn! You may no longer use this relay.\nTo use this relay again, reply with /postCollateral.`;

        await this._sendMessage(pubkey, message);
    }

    async notifyCollateralWithdrawnFailed(pubkey: string) {
        let message = `Collateral withdrawal failed! You need to set a valid lightning address in your profile for us to pay you back. To try again, reply with /withdrawCollateral <lightning invoice>`;

        await this._sendMessage(pubkey, message);
    }

    async notifyCollateralSeized(pubkey: string, eventId: string) {
        let message = `Your collateral has been seized because nostr:${eventId} violated our Posting Policy (${postingPolicyUrl}). You may no longer use this relay.\nTo use this relay again, reply with /postCollateral.`;

        await this._sendMessage(pubkey, message);
    }

    async informCollateralAmount(pubkey: string, amount: string) {
        let message = `You have posted ${amount} sats as collateral.\nIf you want to withdraw, reply with /withdrawCollateral <lightning invoice>.`;

        await this._sendMessage(pubkey, message);
    }

    async notifyPolicyViolation(pubkey: string, eventId: string) {
        let message = `Your post nostr:${eventId} violated our Posting Policy (${postingPolicyUrl}).\nThis is just a warning, but we may seize your collateral next time.`;

        await this._sendMessage(pubkey, message);
    }

    async _sendMessage(pubkey: string, message: string) {
        const ciphertext = await nip04.encrypt(
            this.privateKey,
            pubkey,
            message
        );

        const event = finishEvent(
            {
                kind: 4,
                created_at: getNow(),
                tags: [["p", pubkey]],
                content: ciphertext,
            },
            this.privateKey
        );

        console.debug("Enviando DM", JSON.stringify(event));

        await this.relay.publish(event);
    }

    async _publishMetadata() {
        let event = finishEvent(
            {
                kind: 0,
                created_at: getNow(),
                content: JSON.stringify({
                    name: botName,
                    about: botAbout,
                    picture: botPicture,
                }),
                tags: [],
            },
            this.privateKey
        );

        await this.relay.publish(event);
    }

    async _handleEvent(event: Event<4>) {
        if (this.publicKey === event.pubkey) return;

        let message = await nip04.decrypt(
            this.privateKey,
            event.pubkey,
            event.content
        );

        if (message === "/postCollateral") {
            const invoice = await fundCollateral(event.pubkey);
            await this.askForCollateral(event.pubkey, invoice);
        } else if (message.startsWith("/withdrawCollateral")) {
            let invoice = message.substring("/withdrawCollateral ".length);
            await this.withdrawalCollateral(event.pubkey, invoice);
        } else if (message === "/seize") {
            // TODO: Remover
            await seizeWallet(event.pubkey);
        } else {
            this._sendMessage(
                event.pubkey,
                `Sorry, I didn't understand that.
If you want to post collateral, reply with "/postCollateral".
If you want to withdraw collateral, reply with /withdrawCollateral <lightning invoice>.`
            );
            console.log("Bot received message: ", message);
        }
    }

    async withdrawalCollateral(pubKey: string, invoice: string) {
        console.log("PAY", invoice);
    }

    close() {
        this.relay.close();
    }
}
