require("dotenv").config();
require("websocket-polyfill");

const WebSocket = require("ws");
const { Server: WebSocketServer } = WebSocket;
const express = require("express");
const cors = require("cors");
const { v4: uuidV4 } = require("uuid");
const { validateEvent, verifySignature } = require("nostr-tools");
const Bot = require("./bot");
const reports = require("./reports");

const relayUrl = new URL(process.env.PROXY_URI);

const clients = {};

const bot = new Bot();
bot.connect();

const app = express();

app.use(cors({ origin: "*" }));

reports(app);

app.use((req, res, next) => res.json({ notFound: true }).status(404));

const server = app.listen(1337, () => {
  console.log("Aberto na porta 1337");
});

function authenticate(req) {
  //TODO:
}

let id = 1;
// conexao chegando no proxy
server.on("upgrade", function upgrade(req, socket, head) {
  req.id = id++;

  console.debug("Recebeu upgrade do WS - passando para o relay", req.url);
  const wss = new WebSocketServer({ noServer: true });
  const relay = new WebSocket(
    "wss://7000-johnnyasant-satshackora-i5zo9336ya4.ws-us105.gitpod.io"
  );
  /** @type {WebSocket | undefined} */
  let ws;
  const clientObj = (clients[req.id] = clients[req.id] || {
    id: req.id,
    queueUpstream: [],
    queueDownstream: [],
    getRelay: () => relay,
    getWs: () => req.ws,
  });

  clientObj.timeout = setInterval(() => {
    drainMessageQueue(clientObj);
  }, 100);

  req.relay = relay;

  relay.on("message", (data) => {
    clientObj.queueDownstream.push(data);
  });

  relay.on("open", function () {
    console.log(`Upstream connection #${req.id}`);
  });
  relay.on("close", () => {
    closeConnection(clientObj);
  });
  relay.on("error", (err) =>
    console.error(`Erro na upstream connection do cliente ${req.id}`, err)
  );

  wss.on("connection", function connection(_ws, req) {
    req.ws = ws = _ws;

    ws.on("error", function () {
      console.error("Erro na conexao #%s", req.id, ...arguments);
    });
    ws.on("close", () => {
      closeConnection(clientObj);
    });

    ws.on("message", (data) => {
      console.log(`Recebeu mensagem ${data} na conexão #${req.id}`);

      let msg;
      if (
        !ws.authenticated &&
        data.includes('"AUTH"') &&
        (msg = JSON.parse(data)) &&
        msg[0] === "AUTH"
      ) {
        let event = msg[1];

        console.debug(`Recebeu auth da conexão #${req.id}`, event);
        let challengeTag = event.tags.find((tag) => tag[0] === "challenge");
        let relayTag = event.tags.find((tag) => tag[0] === "relay");
        let relayTagUrl;
        if (
          validateEvent(event) &&
          verifySignature(event) &&
          challengeTag &&
          Array.isArray(challengeTag) &&
          challengeTag[1] === ws.authChallenge &&
          relayTag &&
          Array.isArray(relayTag) &&
          (relayTagUrl = new URL(relayTag[1])) &&
          relayTagUrl.host === relayUrl.host
        ) {
          ws.authenticated = true;
          bot.askForCollateral(event.pubkey).catch((e) => {
            console.error(`Falhou ao enviar a DM para a conexão #${req.id}`, e);
            closeConnection(clientObj);
          });
          console.debug(`Usuário validado na conexão #${req.id}`);
        } else {
          console.warn(`Usuário invalido na conexão #${req.id}`);
          closeConnection(clientObj);
        }

        return;
      }

      clientObj.queueUpstream.push(data);
      if (ws.authenticated) {
        relay.send(data);
      }
    });

    sendAuthChallenge(ws, clientObj);
  });

  req.wss = wss;

  wss.handleUpgrade(req, socket, head, function done(ws) {
    wss.emit("connection", ws, req);
  });
});

function sendAuthChallenge(ws, clientObj) {
  ws.send(
    JSON.stringify([
      "NOTICE",
      "restricted: we can't serve unauthenticated users. Does your client implement NIP-42?",
    ])
  );
  ws.authChallenge = uuidV4();
  ws.send(JSON.stringify(["AUTH", ws.authChallenge]));

  setTimeout(() => {
    if (ws.authenticated) return;
    // não deu auth em 5s
    closeConnection(clientObj);
  }, 5000).unref();
}

function closeConnection(clientObj) {
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
    console.debug(`Falhou ao fechar conexão com relay #${clientObj.id}`, error);
  }
}

function drainMessageQueue(clientObj) {
  const ws = clientObj.getWs();
  const relay = clientObj.getRelay();

  if (!ws.authenticated) return;

  let data;
  while ((data = clientObj.queueUpstream.pop())) {
    relay.send(data);
  }
  while ((data = clientObj.queueDownstream.pop())) {
    ws.send(data);
  }
}
