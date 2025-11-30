import {TronWeb} from "tronweb";
import SchnorrArtifact
    from "../artifacts-tron/contracts/Utils/SchnorrSECP256K1Verifier.sol/SchnorrSECP256K1Verifier.json";
import ECDSAArtifact from "../artifacts-tron/contracts/Utils/ECDSAVerifier.sol/ECDSAVerifier.json";
import TronVaultArtifact from "../artifacts-tron/contracts/TronVault.sol/TronVault.json";
import FactoryArtifact from "../artifacts-tron/contracts/UserDepositFactoryTron.sol/UserDepositFactoryTron.json";
import * as dotenv from "dotenv";
import {boolean} from "hardhat/internal/core/params/argumentTypes";

dotenv.config();

// Strip 0x if present
const privateKey = process.env.TRON_PRIVATE_KEY!.replace(/^0x/, "");

const tronWeb = new TronWeb({
    fullHost: "https://api.trongrid.io",
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
    const pubKey = "0x0332d634a443d944b033fbcf599535d125a3cabebb7889855e71dc6beaf4f2ced5";
    const factoryAdminHex = "0x8f4d174e5286f0bc4033751591ecab7caf0a920d";
    const vaultAdminHex = factoryAdminHex;
    const operatorHex = "0x2439b451333d14646bd1371b72642347c3586c87";
    const adminHex = factoryAdminHex;
    const ecdsaSignerHex = "0xa4b9B13d3F12Ed7C7ebe3371f585dbe0A7d72cDe";

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
    console.log("✔ Schnorr Verifier at:", "41d04ce2245589cd27b23b1005ac927d8f1bf1d9e1");

    // Deploy ECDSAVerifier
    console.log("Deploying ECDSAVerifier...");
    // const ecdsa = await tronWeb.contract(
    //     ECDSAArtifact.abi as any
    // ).new({
    //     abi: ECDSAArtifact.abi,
    //     bytecode: ECDSAArtifact.bytecode,
    //     feeLimit: 1_000_000_000,
    //     parameters: [],
    // });
    // console.log("✔ ECDSA Verifier at:", ecdsa.address);
    console.log("✔ ECDSA Verifier at:", "413da96d1a364b9130633c069299a4056f3c73f312");

    // Deploy TronVault
    console.log("Deploying TronVault...");
    // const vault = await tronWeb.contract(
    //     TronVaultArtifact.abi as any
    // ).new({
    //     abi: TronVaultArtifact.abi,
    //     bytecode: TronVaultArtifact.bytecode,
    //     feeLimit: 1_000_000_000,
    //     parameters: [
    //         vaultAdmin,
    //         "41d04ce2245589cd27b23b1005ac927d8f1bf1d9e1",
    //         "413da96d1a364b9130633c069299a4056f3c73f312",
    //         ecdsaSigner,
    //         pubKey
    //     ],
    // });
    // console.log("✔ TronVault at:", vault.address);
    console.log("✔ TronVault at:", "41ab86bd3884d51687bdf3eb0e412071c0c343c022");

    // Deploy UserDepositFactory
    console.log("Deploying UserDepositFactory...");
    const factory = await tronWeb.contract(
        FactoryArtifact.abi as any
    ).new({
        abi: FactoryArtifact.abi,
        bytecode: FactoryArtifact.bytecode,
        feeLimit: 1_000_000_000,
        parameters: [
            factoryAdmin,
            admin,
            operator,
            "41ab86bd3884d51687bdf3eb0e412071c0c343c022",
        ],
    });
    console.log("✔ Factory at:", factory.address);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
