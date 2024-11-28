import {ethers, upgrades, run} from "hardhat";
import {getAddress} from "ethers";

async function main() {
    const [deployer] = await ethers.getSigners();
    const pubKeyX = "24583099104342511728895075532502693412257488424408713234459024052814166876670";
    const pubKeyYParity = 0;
    const factoryAdmin: string = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
    const vaultAdmin: string = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
    const operatorAddress: string = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
    const adminAddress: string = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";

    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy the SchnorrSECP256K1Verifier contract
    console.log("Deploying verifier...");
    const Verifier = await ethers.getContractFactory("SchnorrSECP256K1Verifier");
    const verifier = await Verifier.deploy();
    // const verifier = await ethers.getContractAt("SchnorrSECP256K1Verifier", "0xCCD812e5BE7998Fda637771b7B124485678a0b5D")
    await verifier.waitForDeployment();
    console.log("verifier deployed to:", await verifier.getAddress());

    console.log("Deploying Vault...");
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await upgrades.deployProxy(Vault, [vaultAdmin, await verifier.getAddress(), pubKeyX, pubKeyYParity], {
        initializer: "initialize",
    });
    // const vault = await ethers.getContractAt("Vault", "0x48e090a1bBbf6039a2aE27c7Ac3063566643a80E")
    await vault.waitForDeployment();
    console.log("Vault deployed to:", await vault.getAddress());

    // Deploy the factory contract
    const UserDepositFactory = await ethers.getContractFactory("UserDepositFactory");
    const factory = await UserDepositFactory.deploy(factoryAdmin, adminAddress, operatorAddress, await vault.getAddress());
    // const factory = await ethers.getContractAt("UserDepositFactory", "0x6ca7860A5653943025a66AD6e4Cbe6fad47dE62a")
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("Factory contract deployed at:", factoryAddress);

    await new Promise(resolve => setTimeout(resolve, 30000));

    // Verify the contract on Etherscan
    console.log("Verifying contracts...");
    try {
        await run("verify:verify", {
            address: await verifier.getAddress(),
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
