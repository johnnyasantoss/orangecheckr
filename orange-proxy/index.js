require("dotenv").config();
require("websocket-polyfill");

const WebSocket = require("ws");
const { Server: WebSocketServer } = WebSocket;
const express = require("express");
const cors = require("cors");
const { v4: uuidV4 } = require("uuid");
const { validateEvent, verifySignature } = require("nostr-tools");
const Bot = require("./Bot");

const bot = new Bot();
bot.connect();

const app = express();

app.use(cors({ origin: "*" }));

app.use((req, res, next) => res.json({ notFound: true }).status(404));

const server = app.listen(1337, () => {
  console.log("Aberto na porta 1337");
});

function authenticate(req) {
  //TODO:
}

let id = 1;
// conexao chegando no proxy
server.on("upgrade", function upgrade(request, socket, head) {
  request.id = id++;

  console.debug("Recebeu upgrade do WS - passando para o relay", request.url);
  const wss = new WebSocketServer({ noServer: true });
  const relay = new WebSocket(
    "wss://7000-johnnyasant-satshackora-i5zo9336ya4.ws-us105.gitpod.io"
  );
  /** @type {WebSocket | undefined} */
  let ws;

  request.relay = relay;

  relay.on("message", (data) => {
    ws.send(data);
  });

  relay.on("open", function () {
    console.log(`Upstream connection #${request.id}`);
  });
  relay.on("error", (err) =>
    console.error(`Erro na upstream connection do cliente ${request.id}`, err)
  );

  wss.on("connection", function connection(_ws, request) {
    ws = _ws;
    ws.on("error", function () {
      console.error("Erro na conexao #%s", request.id, ...arguments);
    });

    ws.on("message", (data) => {
      console.log(`Recebeu mensagem ${data} na conexão #${request.id}`);

      let msg;
      if (
        !ws.authenticated &&
        data.includes('"AUTH"') &&
        (msg = JSON.parse(data)) &&
        msg[0] === "AUTH"
      ) {
        let event = msg[1];

        console.debug(`Recebeu auth da conexão #${request.id}`, event);
        let challengeTag = event.tags.find((tag) => tag[0] === "challenge");
        let relayTag = event.tags.find((tag) => tag[0] === "relay");
        if (
          validateEvent(event) &&
          verifySignature(event) &&
          challengeTag &&
          Array.isArray(challengeTag) &&
          challengeTag[1] === ws.authChallenge &&
          relayTag &&
          Array.isArray(relayTag) &&
          relayTag[1] === process.env.RELAY_URI
        ) {
          ws.authenticated = true;
          bot.askForCollateral(ws, event.pubkey, "fake-lightning-invoice");
          console.debug(`Usuário validado na conexão #${request.id}`);
        } else {
          console.warn(
            `Usuário invalido na conexão #${request.id}. Fechando...`
          );
          ws.close();
        }

        return;
      }

      if (ws.authenticated) {
        relay.send(data);
      }
    });

    ws.send(
      JSON.stringify([
        "NOTICE",
        "restricted: we can't serve unauthenticated users. Does your client implement NIP-42?",
      ])
    );
    ws.authChallenge = uuidV4();
    ws.send(JSON.stringify(["AUTH", ws.authChallenge]));
  });

  request.wss = wss;

  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit("connection", ws, request);
  });

  // This function is not defined on purpose. Implement it with your own logic.
  // authenticate(request, function next(err, client) {
  //   if (err || !client) {
  //     socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
  //     socket.destroy();
  //     return;
  //   }

  //   socket.removeListener('error', onSocketError);

  //   wss.handleUpgrade(request, socket, head, function done(ws) {
  //     wss.emit('connection', ws, request, client);
  //   });
  // });

  // relayWsConnection.handleUpgrade(request, socket, head, function done(ws) {
  //   ws.emit('connection', ws, request);
  // });
});
