import { TOKEN_PROGRAM_ID, AccountLayout } from '@solana/spl-token';
import { Connection } from '@solana/web3.js';
import { applySettings } from './controller';

const connection = new Connection(process.env.RPC_URL, {
    wsEndpoint: process.env.WSS_SHYFT,
    commitment: 'confirmed',
});



let solMint = 'So11111111111111111111111111111111111111112';
let otherMint;
let ourBalance;
let tokenBalance;




export async function listenToWallets(wallet) {
    try {
        connection.onProgramAccountChange(
            TOKEN_PROGRAM_ID,
            async (data) => {
                const changedMint = AccountLayout.decode(data.accountInfo.data).mint.toBase58();
                const amount = AccountLayout.decode(data.accountInfo.data).amount;
                const balance = Number(amount) / 1e6;

                if (changedMint === solMint) {

                    ourBalance = balance.toFixed(2);

                } else {
                    otherMint = changedMint;
                    tokenBalance = balance.toFixed(2);
                    console.log(tokenBalance)
                    applySettings({ sellAmount: tokenBalance * 0.99 });

                }
            },
            {
                commitment: 'processed',
                filters: [
                    {
                        dataSize: 165,
                    },
                    {
                        memcmp: {
                            offset: 32,
                            bytes: wallet,
                        },
                    },
                ],
            }
        );
    } catch (err) {
        console.error('Error listening to wallets:', err);
    }
}
