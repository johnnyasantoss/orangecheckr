import type { Server } from "node:http";
import { Event, Filter, validateEvent, verifySignature } from "nostr-tools";
import { URL } from "url";
import { v4 as uuidV4 } from "uuid";
import WebSocket from "ws";
import { Bot } from "./bot";
import { config } from "./config";
import { getBalanceInSats } from "./lnbits";
import { processSpam } from "./queue";
import { setupShutdownHook } from "./shutdown";

const {
    authTimeoutSecs,
    collateralRequired,
    filterNipKind,
    invoiceExpirySecs,
    proxyUrl,
    relayUri,
} = config;

const { Server: WebSocketServer } = WebSocket;

export class ClientContext {
    closed = false;
    public readonly authChallenge: string;
    authenticated = false;
    funded = false;
    public readonly queueUpstream: LazyWebsocketMessage[] = [];
    public readonly queueDownstream: LazyWebsocketMessage[] = [];
    private intervalRef?: NodeJS.Timeout;

    getRelay: (this: this) => WebSocket;
    getWs: (this: this) => WebSocket;

    constructor(
        public id: number,
        getRelay: ClientContext["getRelay"],
        getWs: ClientContext["getWs"]
    ) {
        this.authChallenge = uuidV4();
        this.getRelay = getRelay.bind(this);
        this.getWs = getWs.bind(this);
        this.intervalRef = setInterval(() => {
            drainMessageQueue(this);
        }, 100);
    }

    sendAuthChallenge() {
        const ws = this.getWs();

        console.debug(`Sending AUTH challenge on connection #${this.id}`);
        ws.send(
            JSON.stringify([
                "NOTICE",
                "restricted: we can't serve unauthenticated users. Does your client implement NIP-42?",
            ])
        );
        ws.send(JSON.stringify(["AUTH", this.authChallenge]));

        // setTimeout(() => {
        //     if (this.authenticated) return;
        //     // não deu auth em 5s
        //     this.close("failed to authenticate");
        // }, authTimeoutSecs * 1000).unref();
    }

    close(reason: string) {
        if (this.closed) return;

        console.debug(`Closing connection #${this.id}: ${reason}`);

        clearInterval(this.intervalRef);
        delete clients[this.id];

        this.closed = true;
        try {
            this.getWs().close();
        } catch (error) {
            console.debug(
                `Falhou ao fechar conexão com cliente #${this.id}`,
                error
            );
        }
        try {
            this.getRelay().close();
        } catch (error) {
            console.debug(
                `Falhou ao fechar conexão com relay #${this.id}`,
                error
            );
        }
    }
}

type NostrMessage =
    // NIP 1 & 42
    | ["EVENT" | "AUTH", Event]
    // NIP 1
    | ["CLOSE", string]
    // NIP 1 & 45
    | ["REQ" | "COUNT", string, Filter];

class LazyWebsocketMessage {
    private _buffer!: Buffer;
    public get buffer(): Buffer {
        return (this._buffer ??=
            this.rawData instanceof ArrayBuffer
                ? Buffer.from(this.rawData)
                : Array.isArray(this.rawData)
                ? this.rawData.reduce((p, c) => Buffer.concat([p, c]))
                : this.rawData);
    }

    private _event!: Event;
    public get event(): Event {
        if (this._event) return this._event;

        const maybeEvent = this.nostrReq[1];

        if (typeof maybeEvent !== "object") {
            throw new Error(`Invalid Nostr request: ${this.nostrReq}`);
        }

        return (this._event ??= maybeEvent);
    }

    private _nostrReq!: NostrMessage;
    public get nostrReq(): NostrMessage {
        return (this._nostrReq ??= JSON.parse(this.buffer.toString()));
    }

    private _isValidEvent!: boolean;
    public get isValidEvent(): boolean {
        return (this._isValidEvent ??= validateEvent(this.event));
    }

    constructor(private rawData: WebSocket.RawData) {}

    includes(included: string) {
        return this.buffer.includes(included);
    }

    serialize(): string {
        return this.buffer.toString();
    }
}

const clients: Record<string, ClientContext> = {};

export const bot = new Bot();
bot.connect().catch((e) => {
    console.error("Bot failed to connect", e);
});
setupShutdownHook(() => bot.close());

function validateAuthEvent(msg: LazyWebsocketMessage, authChallenge: string) {
    try {
        const event = msg.event;
        if (!msg.isValidEvent || !verifySignature(event)) return false;

        const [, challengeTag] =
            event.tags.find(([name]) => name === "challenge") || [];
        if (!challengeTag || challengeTag !== authChallenge) return false;

        const [, relayTag] =
            event.tags.find(([name]) => name === "relay") || [];
        if (!relayTag) return false;

        const relayTagUrl = new URL(relayTag);

        if (relayTagUrl.host !== proxyUrl.host) return false;

        return true;
    } catch (error) {
        console.error("Failed validating auth event", error);
        return false;
    }
}

let id = 1;

function drainMessageQueue(clientObj: ClientContext) {
    const ws = clientObj.getWs();
    const relay = clientObj.getRelay();

    if (!clientObj.authenticated) return;

    let msg: LazyWebsocketMessage | undefined;
    if (relay.readyState === WebSocket.OPEN) {
        const reAddUpstream: LazyWebsocketMessage[] = [];
        while ((msg = clientObj.queueUpstream.pop())) {
            if (
                !clientObj.funded &&
                msg.nostrReq[0] !== "REQ" &&
                msg.nostrReq[0] !== "CLOSE"
            ) {
                reAddUpstream.push(msg);
                continue;
            }

            if (clientObj.funded && msg.nostrReq[0] === "EVENT") {
                const e = msg.event;
                if (filterNipKind.includes(e.kind)) {
                    processSpam(e.pubkey, e.content, e.id).catch(() => {
                        console.error("Failed to process spam", event);
                    });
                }
            }

            relay.send(msg.serialize());
        }
        clientObj.queueUpstream.push(...reAddUpstream);
    }

    if (ws.readyState !== WebSocket.OPEN) return;
    while ((msg = clientObj.queueDownstream.pop())) {
        ws.send(msg.serialize());
    }
}

export type ExpressUpgradeHandler = Server["on"] extends (
    e: "upgrade",
    listener: infer L
) => any
    ? L
    : never;

export const handleWsUpgrade: ExpressUpgradeHandler = function handleWsUpgrade(
    req,
    socket,
    head
) {
    const reqId = id++;

    console.debug(`New WS connection #${reqId}`);
    const wss = new WebSocketServer({ noServer: true });
    const relay = new WebSocket(relayUri);

    let ws: WebSocket;
    const clientContext = new ClientContext(
        reqId,
        () => relay,
        () => ws
    );

    socket.once("end", () => {
        clientContext.close("socket closed");
    });

    relay.on("message", (data) => {
        clientContext.queueDownstream.push(new LazyWebsocketMessage(data));
    });

    relay.on("open", () => {
        console.log(`Upstream connection #${reqId}`);
    });
    relay.on("close", () => {
        clientContext.close("upstream relay closed conn");
    });
    relay.on("error", (err) => {
        console.error(`Error in upstream connection #${reqId}`, err);
    });

    wss.on("connection", function connection(_ws, req) {
        ws = _ws;

        ws.on("error", function () {
            console.error("Erro na conexao #%s", reqId, ...arguments);
        });
        ws.on("close", () => {
            clientContext.close("ws close");
        });

        ws.on("message", async (data) => {
            console.debug(`Recebeu mensagem na conexão #${reqId}`);
            const msg = new LazyWebsocketMessage(data);

            if (
                !clientContext.authenticated &&
                msg.includes('"AUTH"') &&
                msg.nostrReq[0] === "AUTH"
            ) {
                const event = msg.event;

                console.debug(`Recebeu auth da conexão #${reqId}`, event);

                if (!validateAuthEvent(msg, clientContext.authChallenge!)) {
                    console.warn(`Usuário invalido na conexão #${reqId}`);
                    return clientContext.close("invalid auth event");
                }

                // reply that auth went well
                ws.send(JSON.stringify(["OK", msg.event.id, true]));

                if (event.pubkey === bot.publicKey) {
                    clientContext.authenticated = true;
                    clientContext.funded = true;
                    return;
                }

                clientContext.authenticated = true;
                console.debug(`Usuário autenticado na conexão #${reqId}`);

                const balance = await getBalanceInSats(event.pubkey);
                if (balance && balance >= collateralRequired) {
                    clientContext.funded = true;

                    console.debug(
                        `Usuário autenticado e com colateral #${reqId}`
                    );
                    return;
                }

                const didSendDM = await bot.askForCollateral(event.pubkey).then(
                    () => true,
                    (e) => {
                        console.error(
                            `Falhou ao enviar a DM para a conexão #${reqId}`,
                            e
                        );
                        return false;
                    }
                );

                if (!didSendDM) {
                    return clientContext.close("failed to send DM");
                }

                const timeout = setTimeout(async () => {
                    if (clientContext.funded) return;
                    const balance = await getBalanceInSats(event.pubkey);

                    if (balance && balance >= collateralRequired) {
                        clientContext.funded = true;
                        return;
                    }

                    clientContext.close("failed to fund collateral");
                }, invoiceExpirySecs * 1000);

                process.once(`${event.pubkey}.paid`, (invoiceInfo) => {
                    console.debug(
                        `Recebeu pagamento do ${event.pubkey}`,
                        invoiceInfo
                    );
                    clientContext.funded = true;
                    clearTimeout(timeout);
                });

                return;
            }

            clientContext.queueUpstream.push(msg);
        });

        clientContext.sendAuthChallenge();
    });

    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
    });
};
