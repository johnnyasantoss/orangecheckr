import { Queue } from "bullmq";
import cors from "cors";
import express, { RequestHandler, Router } from "express";
import { hostname } from "os";
import { config, isDev } from "./config";
import { queues } from "./queue";
import { reports } from "./reports";

export function reqCatchAsync(fn: RequestHandler): RequestHandler {
    return (req, res, next) =>
        Promise.resolve()
            .then(() => fn(req, res, next))
            .catch((err) => {
                console.error(`HTTP ERROR: `, err);
                return next(err);
            });
}

const keys = [
    "get",
    "all",
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "options",
    "head",
] as const;

function asyncfyRouter<T extends Router>(router: T): T {
    for (let key of keys) {
        const method = router[key];
        router[key] = function asyncRouterWrapper(
            path: Parameters<typeof method>[0],
            ...callbacks: any[]
        ) {
            return (method as any).call(
                router,
                path,
                ...callbacks.map((cb) => reqCatchAsync(cb))
            );
        };
    }
    return router;
}

export function createServerHandler(): Express.Application {
    const app = asyncfyRouter(express());

    app.use(cors({ origin: "*" }));

    app.use((req, res, next) => {
        console.debug(`HTTP: ${req.method} ${req.originalUrl}`);
        return next();
    });

    if (isDev()) {
        app.get("/info", (req, res) => res.json({ pid: process.pid }));

        const Arena = require("bull-arena");
        const hostId = hostname();
        const arena = Arena(
            {
                BullMQ: Queue,
                queues: queues.map((q) => ({
                    type: "bullmq",
                    name: q.name,
                    hostId,
                    redis: {
                        host: config.redisHost,
                        password: config.redisPass,
                        port: config.redisPort,
                    },
                })),
            },
            {
                disableListen: true,
                useCdn: true,
            }
        );
        app.use("/queues", arena);
    }

    app.get("/reports", reports());

    app.post("/webhooks/lnbits/paid/:pubKey", (req, res) => {
        const pubKey = req.params.pubKey;
        return res.status(200).json({ success: true });
    });

    app.use((_req, res) => res.json({ notFound: true }).status(404));

    return app;
}
