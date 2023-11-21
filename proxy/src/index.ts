// init stuff
import "websocket-polyfill";
import config from "./config";

import cluster from "node:cluster";
import { createServer } from "node:http";
import { availableParallelism, cpus } from "node:os";
import { createServerHandler } from "./server";
import { setupShutdownHook, shutdown } from "./shutdown";
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
            "message",
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
        "message",
    ]) {
        cluster.on(e, function () {
            console.debug(`Event(${e}) on cluster`, ...arguments);
        });
    }

    function handleShutdown(signal: NodeJS.Signals): void {
        console.debug(`Received ${signal}. Shutting down`);

        const workers = cluster.workers ?? {};
        for (const k in workers) {
            const worker = workers[k];
            if (!worker) continue;

            worker.send("shutdown");
        }

        shutdown();
    }

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);
} else {
    console.debug(`Worker#${process.pid} is running`);
    const app = createServerHandler();
    const server = createServer(app);

    // TODO: Force users to add their pubkey to the ws route
    server.on("upgrade", handleWsUpgrade);

    server.on("error", (err) => {
        console.error("Server error", err);
    });

    server.on("listening", () => {
        console.info(`Server listening on port ${config.port}`);
    });

    server.listen({ host: "0.0.0.0", port: config.port });
    setupShutdownHook(() => server.close());

    process.on("message", (msg) => {
        switch (msg) {
            case "shutdown":
                return shutdown();

            default:
                console.error(`Invalid message received: ${msg}`);
                return;
        }
    });
}

process.title = `orangecheckr (${cluster.isPrimary ? "main" : "worker"})`;
process.on("unhandledRejection", function () {
    console.error(`ERROR: Unhandled rejection`, ...arguments);
});
