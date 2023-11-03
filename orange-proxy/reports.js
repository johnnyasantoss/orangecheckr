const { getWallets, getWalletDetails } = require("./lnbits");

/**
 * @param {import('express').Express} app
 */
const reports = (app) => {
  app.use("/reports", async (req, res) => {
    const wallets = await getWallets();

    const walletsDetails = [];

    for (const wallet of wallets) {
      const details = await getWalletDetails();

      walletsDetails.push(details);
    }

    return res.json({ report: true }).status(200);
  });
};

module.exports = reports;
