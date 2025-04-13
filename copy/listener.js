import { txid } from './decod.js';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import { applySettings } from './helper/controller.js';
import { getPDA, pubKey } from '../panelTest.js';
import { listenToWallets } from './helper/helpers.js';
dotenv.config();


let settings = {
    amount: 0.00001,
    slippage: 10,
    fee: 0.00001,
    jitoFee: 0.00001,
    ATA: "",
    PDA: await getPDA(pubKey),
    sellAmount: 0,
};


const TOKEN = process.env.SYNDICA_TOKEN;

const wsUrl = `wss://api.syndica.io/api-token/${TOKEN}`;

export async function monitorTransactions(wallet) {
    let ws;
    let txCount = 0;

    function connect() {
        ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            ws.send(
                JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'chainstream.transactionsSubscribe',
                    params: {
                        network: 'solana-mainnet',
                        verified: false,
                        filter: {
                            commitment: 'processed',
                            accountKeys: {
                                all: [wallet],
                            },
                        },
                    },
                })
            );

            setInterval(() => {
                ws.ping();
            }, 30000);
        });

        ws.on('message', async (data) => {
            const json = JSON.parse(data.toString());
            if (txCount === 0) {
                console.log('🆗 Subscribed:', json);
            } else {
                const tx = json.params?.result?.value;
                const result = await txid(tx, wallet);

                if (result.error) {
                    console.log("❌ Error copying wallet");
                } else if (result.skip) {
                    console.log("⏭️ Skipped:", result.skip);
                } else {
                    console.log(`\x1b[1m\x1b[32m✅ COPY ${result.type}:\x1b[0m \x1b[36mhttps://solscan.io/tx/${result.result}\x1b[0m`);
                }
            }
            txCount++;
        });

        ws.on('close', () => {
            console.warn('🔌 Disconnected. Reconnecting...');
            setTimeout(connect, 2000);
        });

        ws.on('error', (err) => {
            console.error('❌ WebSocket error:', err.message);
        });
    }
    connect();
}

listenToWallets(pubKey)

applySettings(settings)
monitorTransactions("BMW7wVJ6MF9uoNQJVJk5wx3F89C7QZ2qKBUN6o77x2AP")
