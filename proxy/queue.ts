import { DefaultJobOptions, Queue, Worker, WorkerOptions } from "bullmq";
import { resolve } from "path";
import { isSymbolObject } from "util/types";

const connection = { host: "localhost", port: 6379 };

function initQueue(
    name: string,
    defaultJobOptions: DefaultJobOptions = {},
    workerOptions: WorkerOptions = {
        concurrency: 1,
    }
) {
    const queue = new Queue(name, {
        defaultJobOptions,
        connection,
    });

    queue
        .eventNames()
        .filter((e) => !isSymbolObject(e))
        .forEach((e) =>
            queue.on(e as any, () => console.debug(`Evento ${String(e)} na fila: ${name}`))
        );

    const workerFile = resolve(__dirname, "workers", `${name}.js`);

    const worker = new Worker(name, require(workerFile), {
        ...workerOptions,
        connection,
    });

    worker
        .eventNames()
        .filter((e) => !isSymbolObject(e))
        .map((e) =>
            worker.on(e as any, () => console.debug(`Evento ${String(e)} no worker: ${name}`))
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
