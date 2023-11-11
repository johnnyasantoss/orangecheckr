import cors from "cors";
import express from "express";
import { reports } from "./reports";

export function createServerHandler(): Express.Application {
    const app = express();

    app.use(cors({ origin: "*" }));

    app.use((req, res, next) => {
        console.debug(`HTTP: ${req.method} ${req.originalUrl}`);
        return next();
    });

    app.get("/reports", reports());

    app.post("/webhooks/lnbits/paid/:pubKey", (req, res) => {
        const pubKey = req.params.pubKey;
        return res.status(200).json({ success: true });
    });

    app.use((_req, _res, next) => {
        return Promise.resolve()
            .then(() => next())
            .catch((err) => {
                console.error(`HTTP ERROR: `, err);
            });
    });

    app.use((_req, res) => res.json({ notFound: true }).status(404));

    return app;
}
