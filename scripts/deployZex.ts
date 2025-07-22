import {ethers, upgrades, run} from "hardhat";
import {getAddress} from "ethers";

async function main() {
    const [deployer] = await ethers.getSigners();
    const pubKey = "0x02712bf86ee0a61a6636bd86c79e5922383c5dd4541062ed4d733a871650a777e9";
    const factoryAdmin: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const vaultAdmin: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const operatorAddress: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const adminAddress: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const ecdsaSigner: string = "0xFB6E059Cc3F3E8029A2b25fE1fb1d952572f4181";

    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy the SchnorrSECP256K1Verifier contract
    console.log("Deploying verifier...");
    const schnorrVerifierFactory = await ethers.getContractFactory("SchnorrSECP256K1Verifier");
    const schnorrVerifier = await schnorrVerifierFactory.deploy();
    // const schnorrVerifier = await ethers.getContractAt("SchnorrSECP256K1Verifier", "")
    await schnorrVerifier.waitForDeployment();
    console.log("Schnorr Verifier deployed to:", await schnorrVerifier.getAddress());

    // Deploy the ECDSAVerifier contract
    console.log("Deploying verifier...");
    const ecdsaVerifierFactory = await ethers.getContractFactory("ECDSAVerifier");
    const ecdsaVerifier = await ecdsaVerifierFactory.deploy();
    // const ecdsaVerifier = await ethers.getContractAt("ECDSAVerifier", "")
    await ecdsaVerifier.waitForDeployment();
    console.log("ECDSA Verifier deployed to:", await ecdsaVerifier.getAddress());

    console.log("Deploying Vault...");
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await upgrades.deployProxy(Vault, [
        vaultAdmin,
        await schnorrVerifier.getAddress(),
        await ecdsaVerifier.getAddress(),
        ecdsaSigner,
        pubKey,
    ], {
        initializer: "initialize",
    });

    // const vault = await upgrades.upgradeProxy("", Vault);

    // const vault = await ethers.getContractAt("Vault", "")
    await vault.waitForDeployment();
    console.log("Vault deployed to:", await vault.getAddress());

    // Deploy the factory contract
    const UserDepositFactory = await ethers.getContractFactory("UserDepositFactory");
    // const factory = await UserDepositFactory.deploy(factoryAdmin, adminAddress, operatorAddress, await vault.getAddress());
    const factory = await ethers.getContractAt("UserDepositFactory", "0xFE74B8A9278c4463bA1273b2090695246b757A32")
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("Factory contract deployed to:", factoryAddress);

    await new Promise(resolve => setTimeout(resolve, 30000));

    // Verify the contract on Etherscan
    console.log("Verifying contracts...");
    try {
        await run("verify:verify", {
            address: await schnorrVerifier.getAddress(),
        });
    } catch (error) {
        console.error("Verification failed:", error);
    }

    try {
        await run("verify:verify", {
            address: await ecdsaVerifier.getAddress(),
        });
    } catch (error) {
        console.error("Verification failed:", error);
    }

    try {
        await run("verify:verify", {
            address: await vault.getAddress(),
        });
    } catch (error) {
        console.error("Verification failed:", error);
    }

    try {
        await run("verify:verify", {
            address: factoryAddress,
            constructorArguments: [
                factoryAdmin,
                adminAddress,
                operatorAddress,
                await vault.getAddress(),
            ],
        });
        console.log("Contract verified successfully!");
    } catch (error) {
        console.error("Verification failed:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
