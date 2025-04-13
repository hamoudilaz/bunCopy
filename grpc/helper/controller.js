

let settings = {
    buyAmount: 0,
    SlippageBps: 0,
    fee: 0,
    jitoFee: 0,
    sellAmount: 0,
    ATA: null,
    PDA: null
};





export function applySettings({ amount, slippage, fee, jitoFee, sellAmount, ATA, PDA }) {
    if (amount !== undefined) settings.buyAmount = amount * 1e9;
    if (slippage !== undefined) settings.SlippageBps = slippage * 100;
    if (fee !== undefined) settings.fee = fee * 1e9;
    if (jitoFee !== undefined) settings.jitoFee = jitoFee * 1e9;
    if (sellAmount !== undefined) settings.sellAmount = Number(sellAmount || 0) * 1e6
    if (ATA !== undefined) settings.ATA = ATA;
    if (PDA !== undefined) settings.PDA = PDA;
}
export function getSettings() {
    return { ...settings };
}
