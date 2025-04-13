import { txid } from './decod.js';
import dotenv from 'dotenv';
import { applySettings } from './helper/controller.js';
import { getPDA, pubKey } from '../panelTest.js';
import { listenToWallets } from './helper/helpers.js';
import Client, { CommitmentLevel, SubscribeRequest } from '@triton-one/yellowstone-grpc';
import * as bs58 from 'bs58';


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


class GrpcStreamManager {
    constructor(endpoint, authToken, dataHandler) {
        this.client = new Client(endpoint, authToken, { 'grpc.max_receive_message_length': 64 * 1024 * 1024 });
        this.stream = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectInterval = 5000;
        this.dataHandler = dataHandler;
    }

    async connect(subscribeRequest) {
        try {
            this.stream = await this.client.subscribe();
            this.isConnected = true;
            this.reconnectAttempts = 0;

            this.stream.on('data', this.handleData.bind(this));
            this.stream.on('error', this.handleError.bind(this));
            this.stream.on('end', () => this.handleDisconnect(subscribeRequest));
            this.stream.on('close', () => this.handleDisconnect(subscribeRequest));

            await this.write(subscribeRequest);
            this.startPing();
        } catch (error) {
            console.error('Connection error:', error);
            await this.reconnect(subscribeRequest);
        }
    }

    async write(req) {
        return new Promise((resolve, reject) => {
            this.stream.write(req, (err) => (err ? reject(err) : resolve()));
        });
    }

    async reconnect(subscribeRequest) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);

        setTimeout(async () => {
            try {
                await this.connect(subscribeRequest);
            } catch (error) {
                console.error('Reconnection failed:', error);
                await this.reconnect(subscribeRequest);
            }
        }, this.reconnectInterval * Math.min(this.reconnectAttempts, 5));
    }

    startPing() {
        setInterval(() => {
            if (this.isConnected) {
                this.write({
                    ping: { id: 1 },
                    accounts: {},
                    accountsDataSlice: [],
                    transactions: {},
                    blocks: {},
                    blocksMeta: {},
                    entry: {},
                    slots: {},
                    transactionsStatus: {},
                }).catch(console.error);
            }
        }, 30000);
    }

    handleData(data) {
        try {
            const processed = this.processBuffers(data);
            this.dataHandler(processed);
        } catch (error) {
            console.error('Error processing data:', error);
        }
    }

    handleError(error) {
        console.error('Stream error:', error);
        this.isConnected = false;
    }

    handleDisconnect(subscribeRequest) {
        console.log('Stream disconnected');
        this.isConnected = false;
        this.reconnect(subscribeRequest);
    }

    processBuffers(obj) {
        if (!obj) return obj;
        if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
            return bs58.default.encode(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => this.processBuffers(item));
        }
        if (typeof obj === 'object') {
            return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, this.processBuffers(v)]));
        }
        return obj;
    }
}


const GRPC_URL = process.env.GRPC
const GRPC_TOKEN = process.env.TOKEN


async function monitorTransactions(wallet) {
    const manager = new GrpcStreamManager(
        GRPC_URL,
        GRPC_TOKEN,
        (data) => handleTransactionUpdate(data, wallet)
    );


    const subscribeRequest = {
        transactions: {
            client: {
                accountInclude: [wallet],
                accountExclude: [],
                accountRequired: [],
                vote: false,
                failed: false,
                signature: undefined,

            },
        },
        commitment: 0,
        accounts: {},
        accountsDataSlice: [{
            offset: 0,
            length: 64, // adjust to how many bytes you actually need
        },],
        blocks: {},
        blocksMeta: {},
        entry: {},
        slots: {},
        transactionsStatus: {},
    };

    await manager.connect(subscribeRequest);
}

async function handleTransactionUpdate(data, wallet) {
    if (data?.transaction?.transaction) {

        const tx = data.transaction.transaction

        const result = await txid(tx, wallet);
        if (result.error) {
            console.log("❌ Error copying wallet");
        } else if (result.skip) {
            console.log("⏭️ Skipped:", result.skip);
        } else {
            console.log(`\x1b[1m\x1b[32m✅ COPY ${result.type}:\x1b[0m \x1b[36mhttps://solscan.io/tx/${result.result}\x1b[0m`);
        }

    }
}


listenToWallets(pubKey)

applySettings(settings)
monitorTransactions("BMW7wVJ6MF9uoNQJVJk5wx3F89C7QZ2qKBUN6o77x2AP")
