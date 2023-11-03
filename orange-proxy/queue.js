const { Queue, Worker } = require("bullmq");
const { resolve } = require("path");

const connection = { host: "localhost", port: 6379 };

function initQueue(name, jobOptions) {
  const queue = new Queue(name, {
    defaultJobOptions: jobOptions,

    connection,
  });

  queue
    .eventNames()
    .forEach((e) =>
      queue.on(e, () => console.debug(`Evento ${e} na fila: ${name}`))
    );

  const workerFile = resolve(__dirname, "workers", `${name}.js`);

  const worker = new Worker(name, require(workerFile), {
    concurrency: 1,
    connection,
  });

  worker
    .eventNames()
    .forEach((e) =>
      worker.on(e, () => console.debug(`Evento ${e} no worker: ${name}`))
    );

  return { queue, worker };
}

const { queue: invoicesProcessingQueue, worker: invoicesProcessingWorker } =
  initQueue("invoices_processing", {
    attempts: 100,
    delay: 10000,
    removeOnComplete: 1000,
    removeOnFail: false,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });

function processInvoice(pubKey, invoice) {
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
  }
);

function processSpam(pubkey, note, eventId) {
  return spamReportingQueue.add(
    "spam_reporting",
    { pubkey, note, eventId },
    {
      // jobId: pubkey,
    }
  );
}

module.exports = {
  invoicesProcessingQueue,
  invoicesProcessingWorker,
  processInvoice,
  spamReportingQueue,
  spamReportingWorker,
  processSpam,
};
