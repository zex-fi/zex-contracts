import {ethers, upgrades, run} from "hardhat";
import {getAddress} from "ethers";

async function main() {
    const [deployer] = await ethers.getSigners();
    const pubKey = "0x0332d634a443d944b033fbcf599535d125a3cabebb7889855e71dc6beaf4f2ced5";
    const factoryAdmin: string = "0x8f4d174e5286f0bc4033751591ecab7caf0a920d";
    const vaultAdmin: string = "0x8f4d174e5286f0bc4033751591ecab7caf0a920d";
    const operatorAddress: string = "0x2439b451333d14646bd1371b72642347c3586c87";
    const adminAddress: string = "0x8f4d174e5286f0bc4033751591ecab7caf0a920d";
    const ecdsaSigner: string = "0xa4b9B13d3F12Ed7C7ebe3371f585dbe0A7d72cDe";

    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy the SchnorrSECP256K1Verifier contract
    console.log("Deploying verifier...");
    const schnorrVerifierFactory = await ethers.getContractFactory("SchnorrSECP256K1Verifier");
    // const schnorrVerifier = await schnorrVerifierFactory.deploy();
    const schnorrVerifier = await ethers.getContractAt("SchnorrSECP256K1Verifier", "0x267bc84e5985a8853f0350e3097740b8728d8fc1")
    await schnorrVerifier.waitForDeployment();
    console.log("Schnorr Verifier deployed to:", await schnorrVerifier.getAddress());

    // Deploy the ECDSAVerifier contract
    console.log("Deploying verifier...");
    const ecdsaVerifierFactory = await ethers.getContractFactory("ECDSAVerifier");
    // const ecdsaVerifier = await ecdsaVerifierFactory.deploy();
    const ecdsaVerifier = await ethers.getContractAt("ECDSAVerifier", "0x490166377dEEC8645F2a979f63b5d6384A3c7ac4")
    await ecdsaVerifier.waitForDeployment();
    console.log("ECDSA Verifier deployed to:", await ecdsaVerifier.getAddress());

    console.log("Deploying Vault...");
    const Vault = await ethers.getContractFactory("Vault");
    // const vault = await upgrades.deployProxy(Vault, [
    //     vaultAdmin,
    //     await schnorrVerifier.getAddress(),
    //     await ecdsaVerifier.getAddress(),
    //     ecdsaSigner,
    //     pubKey,
    // ], {
    //     initializer: "initialize",
    // });

    // const vault = await upgrades.upgradeProxy("", Vault);

    const vault = await ethers.getContractAt("Vault", "0xC7DE0D25746773982c4c04F5856EcB41F4791C31")
    await vault.waitForDeployment();
    console.log("Vault deployed to:", await vault.getAddress());

    // Deploy the factory contract
    const UserDepositFactory = await ethers.getContractFactory("UserDepositFactory");
    // const factory = await UserDepositFactory.deploy(factoryAdmin, adminAddress, operatorAddress, await vault.getAddress());
    const factory = await ethers.getContractAt("UserDepositFactory", "0x7Ed86CA43aB6F740ff47DCfD55e2A275B4a1F1aa")
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
