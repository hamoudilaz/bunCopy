import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

const solMint = 'So11111111111111111111111111111111111111112';


const connection = new Connection(process.env.RPC_URL, 'processed');


let wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));

let pubKey = wallet.publicKey.toBase58();

console.log(pubKey)



function getATA(outputMint) {
    try {
        if (!pubKey) throw new Error('pubKey is undefined');
        const mintATA = getAssociatedTokenAddressSync(new PublicKey(outputMint), new PublicKey(pubKey));
        const ATA = mintATA.toBase58()
        return ATA
    } catch (error) {
        return { error: error.message };
    }
}


const getPDA = async (wallet) => {
    const res = await getAssociatedTokenAddress(new PublicKey(solMint), new PublicKey(wallet));
    const PDA = res.toBase58();
    return PDA;
};



async function getBalance(outputMint) {
    try {
        const getDecimal = await fetch(`https://api.jup.ag/tokens/v1/token/${outputMint}`);
        const json = await getDecimal.json();

        const decimals = json?.decimals ?? 6;

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
            mint: new PublicKey(outputMint),
        });

        if (!tokenAccounts.value?.length) throw new Error('No token account found');

        const amountToSell = Math.floor(
            tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
        );

        return { amountToSell, decimals };
    } catch (error) {
        console.error('getBalance error:', error.message);
        return { amountToSell: 0, decimals: 6 };
    }
}

export { wallet, pubKey, getBalance, getATA, getPDA };
