// init stuff
import "websocket-polyfill";
import config from "./config";

import cluster from "node:cluster";
import { createServer } from "node:http";
import { availableParallelism, cpus } from "node:os";
import { isSymbolObject } from "node:util/types";
import { createServerHandler } from "./server";
import { handleWsUpgrade } from "./ws";

const numCPUs =
    config.workersAmount ||
    (availableParallelism ? availableParallelism() : cpus().length);

if (cluster.isPrimary) {
    console.debug(`Primary#${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();

        for (const e of [
            "disconnect",
            "error",
            "exit",
            "listening",
            "message",
            "online",
        ]) {
            worker.on(e, function () {
                console.debug(
                    `Event(${e}) on Worker#${worker.id}(${worker.process.pid})`,
                    ...arguments
                );
            });
        }
    }

    for (const e of [
        "disconnect",
        "exit",
        "fork",
        "listening",
        "message",
        "online",
        "setup",
    ]) {
        cluster.on(e, function () {
            console.debug(`Event(${e}) on cluster`, ...arguments);
        });
    }
} else {
    console.debug(`Worker#${process.pid} is running`);
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
}
