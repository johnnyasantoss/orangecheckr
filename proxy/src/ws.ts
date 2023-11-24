import type { Server } from "node:http";
import { Event, validateEvent, verifySignature } from "nostr-tools";
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

export interface ClientContext {
    closed?: boolean;
    authChallenge?: string;
    authenticated: boolean;
    funded: boolean;
    id: number;
    queueUpstream: WebSocket.RawData[];
    queueDownstream: WebSocket.RawData[];
    timeout?: NodeJS.Timeout;

    getRelay(): WebSocket;
    getWs(): WebSocket;
}

export const clients: Record<string, ClientContext> = {};

export const bot = new Bot();
bot.connect().catch((e) => {
    console.error("Bot failed to connect", e);
});
setupShutdownHook(() => bot.close());

function validateAuthEvent(event: Event, authChallenge: string) {
    try {
        if (!validateEvent(event) || !verifySignature(event)) return false;

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
function sendAuthChallenge(ws: WebSocket, clientObj: ClientContext) {
    ws.send(
        JSON.stringify([
            "NOTICE",
            "restricted: we can't serve unauthenticated users. Does your client implement NIP-42?",
        ])
    );
    clientObj.authChallenge = uuidV4();
    ws.send(JSON.stringify(["AUTH", clientObj.authChallenge]));

    setTimeout(() => {
        if (clientObj.authenticated) return;
        // não deu auth em 5s
        closeConnection(clientObj);
    }, authTimeoutSecs * 1000).unref();
}

function closeConnection(clientObj: ClientContext) {
    if (clientObj.closed) return;

    console.debug(`Fechando conexão #${clientObj.id}`);

    clearInterval(clientObj.timeout);
    delete clients[clientObj.id];

    clientObj.closed = true;
    try {
        clientObj.getWs().close();
    } catch (error) {
        console.debug(
            `Falhou ao fechar conexão com cliente #${clientObj.id}`,
            error
        );
    }
    try {
        clientObj.getRelay().close();
    } catch (error) {
        console.debug(
            `Falhou ao fechar conexão com relay #${clientObj.id}`,
            error
        );
    }
}

function drainMessageQueue(clientObj: ClientContext) {
    const ws = clientObj.getWs();
    const relay = clientObj.getRelay();

    if (!clientObj.authenticated) return;

    let data: WebSocket.RawData | undefined;
    if (relay.readyState === WebSocket.OPEN) {
        const reAddUpstream: WebSocket.RawData[] = [];
        while ((data = clientObj.queueUpstream.pop())) {
            let event: any[] | undefined = undefined;

            if (
                !clientObj.funded &&
                (event = JSON.parse(data.toString())) &&
                event[0] !== "REQ" &&
                event[0] !== "CLOSE"
            ) {
                reAddUpstream.push(data);
            }

            if (
                clientObj.funded &&
                (event ||
                    ((event = JSON.parse(data.toString())) &&
                        event[0] === "EVENT"))
            ) {
                const e = event[1];
                if (filterNipKind.includes(e.kind)) {
                    processSpam(e.pubkey, e.content, e.id).catch(() => {
                        console.error("Failed to process spam", event);
                    });
                }
            }

            relay.send(data);
        }
        clientObj.queueUpstream.push(...reAddUpstream);
    }

    if (ws.readyState !== WebSocket.OPEN) return;
    while ((data = clientObj.queueDownstream.pop())) {
        ws.send(data);
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

    console.debug("Recebeu upgrade do WS #%s", reqId);
    const wss = new WebSocketServer({ noServer: true });
    const relay = new WebSocket(relayUri);

    let ws: WebSocket;
    const clientObj: ClientContext = (clients[reqId] =
        clients[reqId] ||
        ({
            id: reqId,
            authenticated: false,
            funded: false,
            queueUpstream: [],
            queueDownstream: [],
            getRelay: () => relay,
            getWs: () => ws,
        } as ClientContext));

    clientObj.timeout = setInterval(() => {
        drainMessageQueue(clientObj);
    }, 100);

    socket.once("end", () => {
        closeConnection(clientObj);
    });

    relay.on("message", (data) => {
        clientObj.queueDownstream.push(data);
    });

    relay.on("open", function () {
        console.log(`Upstream connection #${reqId}`);
    });
    relay.on("close", () => {
        closeConnection(clientObj);
    });
    relay.on("error", (err) =>
        console.error(`Erro na upstream connection do cliente ${reqId}`, err)
    );

    wss.on("connection", function connection(_ws, req) {
        ws = _ws;

        ws.on("error", function () {
            console.error("Erro na conexao #%s", reqId, ...arguments);
        });
        ws.on("close", () => {
            closeConnection(clientObj);
        });

        ws.on("message", async (data) => {
            console.log(`Recebeu mensagem ${data} na conexão #${reqId}`);

            let msg;
            // TODO(johnnyasantoss): Check if these types are correct with runtime
            const buf =
                data instanceof ArrayBuffer
                    ? Buffer.from(data)
                    : Array.isArray(data)
                    ? data.reduce((p, c) => Buffer.concat([p, c]))
                    : data;
            if (
                !clientObj.authenticated &&
                buf.includes('"AUTH"') &&
                (msg = JSON.parse(buf.toString())) &&
                msg[0] === "AUTH"
            ) {
                const event = msg[1];

                console.debug(`Recebeu auth da conexão #${reqId}`, event);

                if (
                    typeof event !== "object" ||
                    !validateAuthEvent(event, clientObj.authChallenge!)
                ) {
                    console.warn(`Usuário invalido na conexão #${reqId}`);
                    return closeConnection(clientObj);
                }

                if (event.pubkey === bot.publicKey) {
                    clientObj.authenticated = true;
                    clientObj.funded = true;
                    return;
                }

                clientObj.authenticated = true;
                console.debug(`Usuário autenticado na conexão #${reqId}`);

                const balance = await getBalanceInSats(event.pubkey);
                if (balance && balance >= collateralRequired) {
                    clientObj.funded = true;

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
                    return closeConnection(clientObj);
                }

                const timeout = setTimeout(async () => {
                    if (clientObj.funded) return;
                    const balance = await getBalanceInSats(event.pubkey);

                    if (balance && balance >= collateralRequired) {
                        clientObj.funded = true;
                        return;
                    }

                    closeConnection(clientObj);
                }, invoiceExpirySecs * 1000);

                process.once(`${event.pubkey}.paid`, (invoiceInfo) => {
                    console.debug(
                        `Recebeu pagamento do ${event.pubkey}`,
                        invoiceInfo
                    );
                    clientObj.funded = true;
                    clearTimeout(timeout);
                });

                return;
            }

            clientObj.queueUpstream.push(data);
        });

        sendAuthChallenge(ws, clientObj);
    });

    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
    });
};
