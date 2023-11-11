import { getWalletDetails, getWallets } from "./lnbits";

export function reports(app: import("express").Express) {
    return app.get("/reports", async (_req, res) => {
        const wallets = await getWallets();

        const walletsDetails = [];

        for (const wallet of wallets) {
            const details = await getWalletDetails(wallet.id, wallet.adminkey);

            walletsDetails.push(details);
        }

        const totalCollateral = walletsDetails.reduce(
            (sumBalance, walletDetail) => (sumBalance += walletDetail.balance),
            0
        );

        const totalPubKeys = wallets.length;

        return res.json({ totalCollateral, totalPubKeys }).status(200);
    });
}
