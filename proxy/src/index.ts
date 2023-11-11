// init stuff
import "websocket-polyfill";
import "./config";

import { createServer } from "node:http";
import { createServerHandler } from "./server";
import { handleWsUpgrade } from "./ws";

const app = createServerHandler();
const server = createServer(app);

server.on("upgrade", handleWsUpgrade);

server.on("error", (err) => {
    console.error("Server error", err);
});

server.on("listening", () => {
    console.info(`Server listening on port 1337`);
});

server.listen({ host: "0.0.0.0", port: 1337 });

process.on("unhandledRejection", (reason, promise) => {
    console.error(`ERROR: ${reason} ${promise}`);
});
