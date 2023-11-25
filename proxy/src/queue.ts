import {
    ConnectionOptions,
    DefaultJobOptions,
    Queue,
    Worker,
    WorkerOptions,
} from "bullmq";
import cluster from "node:cluster";
import { resolve } from "path";
import { config } from "./config";
import { setupShutdownHook } from "./shutdown";

export const queues: Queue[] = [];

const connection: ConnectionOptions = {
    host: config.redisHost,
    port: parseInt(config.redisPort),
    password: config.redisPass!,
};

function initQueue(
    name: string,
    defaultJobOptions: DefaultJobOptions = {},
    workerOptions: WorkerOptions = {
        concurrency: 1,
    }
): { queue: Queue; worker?: Worker } {
    const queue = new Queue(name, {
        defaultJobOptions,
        connection,
    });
    queues.push(queue);
    setupShutdownHook(() => queue.close());

    [
        "cleaned",
        "error",
        "paused",
        "progress",
        "removed",
        "resumed",
        "waiting",
    ].forEach((e) =>
        queue.on(e as any, function () {
            return console.debug(
                `Evento ${String(e)} na fila: ${name}`,
                ...arguments
            );
        })
    );

    if (cluster.isPrimary) return { queue };

    const workerFile = resolve(__dirname, "workers", name);

    const worker = new Worker(name, require(workerFile).default, {
        ...workerOptions,
        connection,
    });
    setupShutdownHook(() => worker.close());

    [
        "active",
        "closed",
        "closing",
        "completed",
        "drained",
        "error",
        "failed",
        "paused",
        "progress",
        "ready",
        "resumed",
        "stalled",
    ].map((e) =>
        worker.on(e as any, function () {
            return console.debug(
                `Evento ${String(e)} no worker: ${name}`,
                ...arguments
            );
        })
    );

    return { queue, worker };
}

const { queue: invoicesProcessingQueue, worker: invoicesProcessingWorker } =
    initQueue(
        "invoices_processing",
        {
            attempts: 100,
            delay: 1000,
            removeOnComplete: 1000,
            removeOnFail: false,
            backoff: {
                type: "fixed",
                delay: 1000,
            },
        },
        { concurrency: 10 }
    );

export function processInvoice(pubKey: any, invoice: any) {
    return invoicesProcessingQueue.add("invoices_processing", invoice, {
        jobId: pubKey,
    });
}

const { queue: spamReportingQueue, worker: spamReportingWorker } = initQueue(
    "spam_reporting",
    {
        attempts: 5,
        removeOnComplete: 1000,
        removeOnFail: false,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
    },
    { concurrency: 10 }
);

export function processSpam(pubkey: any, note: any, eventId: any) {
    return spamReportingQueue.add(
        "spam_reporting",
        { pubkey, note, eventId },
        {
            // jobId: pubkey,
        }
    );
}
