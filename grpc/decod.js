import { getSettings } from "./helper/controller.js";
import { getATA } from "../panelTest.js";
import { swap } from "./copy-buy.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function txid(transaction, owner) {


    const preBalances = {};
    transaction.meta.preTokenBalances.forEach(token => {
        if (token.owner === owner) {
            const mint = token.mint;
            const amount = BigInt(token.uiTokenAmount.amount);
            preBalances[mint] = (preBalances[mint] || 0n) + amount;
        }
    });
    const postBalances = {};
    transaction.meta.postTokenBalances.forEach(token => {
        if (token.owner === owner) {
            const mint = token.mint;
            const amount = BigInt(token.uiTokenAmount.amount);
            postBalances[mint] = (postBalances[mint] || 0n) + amount;
        }
    });
    const allMints = new Set([...Object.keys(preBalances), ...Object.keys(postBalances)]);
    let inputMint = null, outputMint = null;
    let inputAmount = 0n, outputAmount = 0n;
    allMints.forEach(mint => {
        const pre = preBalances[mint] || 0n;
        const post = postBalances[mint] || 0n;
        const diff = post - pre;
        if (diff < 0n) {
            inputMint = mint;
            inputAmount = -diff;
        } else if (diff > 0n) {
            outputMint = mint;
            outputAmount = diff;
        }
    });
    const preSOL = BigInt(transaction.meta.preBalances[0]);
    const postSOL = BigInt(transaction.meta.postBalances[0]);
    const fee = BigInt(transaction.meta.fee);
    let solInput = 0n, solOutput = 0n;
    if (postSOL < preSOL) {
        const netSpent = preSOL - postSOL;
        if (netSpent > fee) {
            solInput = netSpent - fee;
        }
    } else if (postSOL > preSOL) {
        solOutput = (postSOL - preSOL) + fee;
    }
    if (!inputMint && solInput > 0n) {
        inputMint = SOL_MINT;
        inputAmount = solInput;
    }
    if (!outputMint && solOutput > 0n) {
        outputMint = SOL_MINT;
        outputAmount = solOutput;
    }
    const type = inputMint === SOL_MINT ? "buy" : "sell"

    let result

    if (!outputMint) return { error: "Skip" }

    const { buyAmount, PDA, sellAmount } = getSettings()



    if (inputMint === SOL_MINT) {
        let ATA = getATA(outputMint)
        result = await swap(inputMint, outputMint, ATA, Number(buyAmount.toFixed(0)))
    } else {

        if (sellAmount < 25 * 1e6) return { skip: "skipping" }
        result = await swap(inputMint, outputMint, PDA, Number(sellAmount.toFixed(0)))

    }




    return {
        type: type.toUpperCase(),
        inputMint,
        outputMint,
        inputAmount,
        outputAmount,
        result
    };
}

