import { VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import { wallet, pubKey } from '../panelTest.js';
import { performance } from 'perf_hooks';
import { getSettings } from './helper/controller.js';
import dotenv from 'dotenv';

dotenv.config();


const quoteApi = process.env.JUP_QUOTE;
const swapApi = process.env.JUP_SWAP;
const JITO_RPC = process.env.JITO_RPC;

export async function swap(inputmint, outputMint, destination, amount) {
    try {
        const { SlippageBps, fee, jitoFee } = getSettings();

        if (!wallet || !pubKey) throw new Error('Failed to load wallet');


        let quote;
        for (let attempt = 1; attempt <= 5; attempt++) {

            const url = `${quoteApi}?inputMint=${inputmint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${SlippageBps}`;

            const start = performance.now();

            const quoteRes = await fetch(url);
            const duration = performance.now() - start;

            quote = await quoteRes.json();
            const slow = duration > 80;

            if (!quote.error && !slow) break;

            console.warn(`⚠️ Quote retry ${attempt}: error=${!!quote.error}, slow=${slow}, duration=${Math.round(duration)}ms`);
        }

        if (quote.error) {
            console.error('Error getting quote:', quote.error);
            return quote.error;
        }



        let swapTransaction;

        for (let attempt = 1; attempt <= 5; attempt++) {
            const start = performance.now();
            const swapRes = await fetch(swapApi, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userPublicKey: pubKey,
                    prioritizationFeeLamports: { jitoTipLamports: jitoFee },
                    dynamicComputeUnitLimit: true,
                    quoteResponse: quote,
                    wrapAndUnwrapSol: false,
                    destinationTokenAccount: destination,
                }),
            });
            const duration = performance.now() - start;

            const swap = await swapRes.json();
            swapTransaction = swap.swapTransaction;

            const slow = duration > 80;

            if (swapTransaction && !slow) break;

            console.warn(`⚠️ Swap retry ${attempt}: success=${!!swapTransaction}, slow=${slow}, duration=${Math.round(duration)}ms`);
        }

        if (!swapTransaction) {
            return { error: 'Retry getting swap transaction' }
        }


        let transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));

        let addPrice = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: fee,
        });

        const newInstruction = {
            programIdIndex: transaction.message.staticAccountKeys.findIndex((key) => key.toBase58() === addPrice.programId.toBase58()),
            accountKeyIndexes: addPrice.keys.map((key) => transaction.message.staticAccountKeys.findIndex((acc) => acc.toBase58() === key.pubkey.toBase58())),
            data: new Uint8Array(addPrice.data),
        };

        transaction.message.compiledInstructions.splice(1, 0, newInstruction);

        transaction.sign([wallet]);

        const transactionBase64 = Buffer.from(transaction.serialize()).toString('base64');

        const sendResponse = await fetch(JITO_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: 'sendTransaction',
                params: [
                    transactionBase64,
                    {
                        encoding: 'base64',
                        skipPreflight: true,
                    },
                ],
            }),
        });

        const sendResult = await sendResponse.json();
        if (sendResult.error) throw new Error(`Transaction error: ${sendResult.error.message}`);
        const signature = sendResult.result;

        return signature;
    } catch (err) {
        console.error(`❌ Swap failed:`, err.message);

        return err;
    }
}
