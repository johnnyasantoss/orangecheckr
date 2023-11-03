const { Queue } = require("bullmq");
const { Worker } = require("bullmq");
const { resolve } = require("path");

const connection = { host: "localhost", port: 6379 };
const invoicesProcessingQueue = new Queue("invoices_processing", {
  defaultJobOptions: {
    attempts: 10,
    removeOnComplete: 1000,
    removeOnFail: false,
    backoff: {
      type: "exponential",
      delay: 500,
    },
  },

  connection,
});
const workerFile = resolve(__dirname, "workers", "invoices_processing.js");
const invoicesProcessingWorker = new Worker("invoices_processing", workerFile, {
  concurrency: 1,
  connection,
});

function processInvoice(pubKey, invoice) {
  return invoicesProcessingQueue.add("invoices_processing", invoice, {
    jobId: pubKey,
  });
}

module.exports = {
  invoicesProcessingQueue,
  invoicesProcessingWorker,
  processInvoice,
};
