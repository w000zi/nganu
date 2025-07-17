import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;
const TO_ADDRESS = process.env.TO_ADDRESS;
const MAX_MINT = parseInt(process.env.MINT_AMOUNT || "5");
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || "15000");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Kontrak mint dan selector
const CONTRACT_ADDRESS = '0xfce521166366566a49344a0dd529028d5fda5cd3';
const MINT_SELECTOR = '0x40d097c3'; // ganti ini jika selector mint beda

let mintCount = 0;

console.log(`🚀 Auto mint dimulai setiap ${INTERVAL_MS / 1000} detik...\n`);

autoMint();

async function autoMint() {
    if (mintCount >= MAX_MINT) {
        console.log(`✅ Minting selesai: total ${mintCount} transaksi berhasil dikirim.`);
        process.exit(0);
    }

    try {
        const gasData = await provider.getFeeData();

        const encodedAddress = TO_ADDRESS.toLowerCase().replace("0x", "").padStart(64, "0");
        const data = MINT_SELECTOR + encodedAddress;

        const tx = {
            to: CONTRACT_ADDRESS,
            data: data,
            value: 0,
            gasLimit: 150000n,
            maxFeePerGas: gasData.maxFeePerGas || ethers.parseUnits('2', 'gwei'),
            maxPriorityFeePerGas: gasData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei'),
        };

        console.log(`🔄 (#${mintCount + 1}) Mengirim minting ke ${TO_ADDRESS}...`);
        const sentTx = await wallet.sendTransaction(tx);
        console.log(`📤 Tx terkirim: ${sentTx.hash}`);

        const receipt = await waitForReceiptWithRetry(sentTx.hash);
        console.log(`✅ Mint sukses! Gas used: ${receipt.gasUsed.toString()}\n`);

        mintCount++;
    } catch (err) {
        console.error(`❌ Gagal minting: ${err.message}\n`);
    }

    setTimeout(autoMint, INTERVAL_MS);
}

async function waitForReceiptWithRetry(txHash, retries = 10, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);
            if (receipt) return receipt;
        } catch (err) {
            if (err.code === -32005 || err.message.includes('Too many requests')) {
                console.warn(`⚠️ Rate limit, retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                continue;
            } else {
                throw err;
            }
        }

        // Jika belum ada receipt, tunggu dan ulang
        await new Promise(res => setTimeout(res, delay));
    }

    throw new Error(`Timeout: Receipt untuk tx ${txHash} tidak ditemukan`);
}
