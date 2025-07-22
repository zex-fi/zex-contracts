import {TronWeb} from "tronweb";
import SchnorrArtifact
    from "../artifacts-tron/contracts/Utils/SchnorrSECP256K1Verifier.sol/SchnorrSECP256K1Verifier.json";
import ECDSAArtifact from "../artifacts-tron/contracts/Utils/ECDSAVerifier.sol/ECDSAVerifier.json";
import TronVaultArtifact from "../artifacts-tron/contracts/TronVault.sol/TronVault.json";
import FactoryArtifact from "../artifacts-tron/contracts/UserDepositFactory.sol/UserDepositFactory.json";
import * as dotenv from "dotenv";
import {boolean} from "hardhat/internal/core/params/argumentTypes";

dotenv.config();

// Strip 0x if present
const privateKey = process.env.TRON_PRIVATE_KEY!.replace(/^0x/, "");

const tronWeb = new TronWeb({
    fullHost: "https://nile.trongrid.io",
    privateKey,
    headers: process.env.TRON_PRO_API_KEY
        ? {"TRON-PRO-API-KEY": process.env.TRON_PRO_API_KEY!}
        : undefined,
});

// Helper to convert hex to Base58
function hexToBase58(hex: string): string {
    const cleaned = hex.replace(/^0x/, "");
    return tronWeb.address.fromHex(cleaned);
}

async function main() {
    const owner = tronWeb.defaultAddress.base58;
    console.log("Deploying from:", owner);

    // Contract parameters (hex addresses)
    const pubKey = "0x021f2e9d30c750366e82c223165e4299e0d430af965dd8126e4fef00691b7284d9";
    const factoryAdminHex = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const vaultAdminHex = factoryAdminHex;
    const operatorHex = factoryAdminHex;
    const adminHex = factoryAdminHex;
    const ecdsaSignerHex = "0xFB6E059Cc3F3E8029A2b25fE1fb1d952572f4181";

    // Convert to Base58
    const factoryAdmin = hexToBase58(factoryAdminHex);
    const vaultAdmin = hexToBase58(vaultAdminHex);
    const operator = hexToBase58(operatorHex);
    const admin = hexToBase58(adminHex);
    const ecdsaSigner = hexToBase58(ecdsaSignerHex);

    // Deploy SchnorrSECP256K1Verifier
    console.log("Deploying SchnorrSECP256K1Verifier...");
    // const schnorr = await tronWeb.contract(
    //     SchnorrArtifact.abi as any
    // ).new({
    //     abi: SchnorrArtifact.abi,
    //     bytecode: SchnorrArtifact.bytecode,
    //     feeLimit: 1_000_000_000,
    //     parameters: [],
    // });
    // console.log("✔ Schnorr Verifier at:", schnorr.address);
    console.log("✔ Schnorr Verifier at:", "411c67425777b2fbdb08ec7efbe9305d8ecc9e6145");

    // Deploy ECDSAVerifier
    // console.log("Deploying ECDSAVerifier...");
    // const ecdsa = await tronWeb.contract(
    //     ECDSAArtifact.abi as any
    // ).new({
    //     abi: ECDSAArtifact.abi,
    //     bytecode: ECDSAArtifact.bytecode,
    //     feeLimit: 1_000_000_000,
    //     parameters: [],
    // });
    // console.log("✔ ECDSA Verifier at:", ecdsa.address);
    console.log("✔ ECDSA Verifier at:", "418eeb5b26b65dae02fc420e8fd1eabbad82c85e0e");

    // Deploy TronVault
    console.log("Deploying TronVault...");
    const ecdsa = await tronWeb.contract(
        TronVaultArtifact.abi as any
    ).new({
        abi: TronVaultArtifact.abi,
        bytecode: TronVaultArtifact.bytecode,
        feeLimit: 1_000_000_000,
        parameters: [
            vaultAdmin,
            "411c67425777b2fbdb08ec7efbe9305d8ecc9e6145",
            "418eeb5b26b65dae02fc420e8fd1eabbad82c85e0e",
            ecdsaSigner,
            pubKey
        ],
    });
    console.log("✔ TronVault at:", ecdsa.address);
    // console.log("✔ TronVault at:", "");

    // Deploy UserDepositFactory
    // console.log("Deploying UserDepositFactory...");
    // const factory = await tronWeb.contract(
    //     FactoryArtifact.abi as any
    // ).new({
    //     abi: FactoryArtifact.abi,
    //     bytecode: FactoryArtifact.bytecode,
    //     feeLimit: 1_000_000_000,
    //     parameters: [
    //         factoryAdmin,
    //         admin,
    //         operator,
    //         "417502ae8984010e4e8efff5c510e0d803f7a2fe48",
    //     ],
    // });
    // console.log("✔ Factory at:", factory.address);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
