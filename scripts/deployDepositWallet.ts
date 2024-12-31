import {ethers, upgrades, run} from "hardhat";
import {getAddress} from "ethers";

async function main() {
    const [deployer] = await ethers.getSigners();
    const pubKeyX = "18558685049902181818735037110738643732519729533907885887150087414461356251645";
    const pubKeyYParity = 0;
    const factoryAdmin: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const vaultAdmin: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const operatorAddress: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const adminAddress: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";
    const ecdsaSigner: string = "0xFB6E059Cc3F3E8029A2b25fE1fb1d952572f4181";

    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy the SchnorrSECP256K1Verifier contract
    console.log("Deploying verifier...");
    const schnorrVerifierFactory = await ethers.getContractFactory("SchnorrSECP256K1Verifier");
    // const schnorrVerifier = await schnorrVerifierFactory.deploy();
    const schnorrVerifier = await ethers.getContractAt("SchnorrSECP256K1Verifier", "0xdEE6525Ae3881f02F13a9aCb8C8f270E461D54c7")
    await schnorrVerifier.waitForDeployment();
    console.log("Schnorr Verifier deployed to:", await schnorrVerifier.getAddress());

    // Deploy the ECDSAVerifier contract
    console.log("Deploying verifier...");
    const ecdsaVerifierFactory = await ethers.getContractFactory("ECDSAVerifier");
    // const ecdsaVerifier = await ecdsaVerifierFactory.deploy();
    const ecdsaVerifier = await ethers.getContractAt("ECDSAVerifier", "0xA791763d2Bd0e0610D5D9f40e52E298e53E692fb")
    await ecdsaVerifier.waitForDeployment();
    console.log("ECDSA Verifier deployed to:", await ecdsaVerifier.getAddress());

    console.log("Deploying Vault...");
    const Vault = await ethers.getContractFactory("Vault");
    // const vault = await upgrades.deployProxy(Vault, [
    //     vaultAdmin,
    //     await schnorrVerifier.getAddress(),
    //     await ecdsaVerifier.getAddress(),
    //     ecdsaSigner,
    //     pubKeyX,
    //     pubKeyYParity
    // ], {
    //     initializer: "initialize",
    // });

    const vault = await upgrades.upgradeProxy("0x17a8bC4724666738387Ef5Fc59F7EF835AF60979", Vault);

    // const vault = await ethers.getContractAt("Vault", "0xcb00C4e20F84aE691C9739e4E202eaCafD187e8d")
    await vault.waitForDeployment();
    console.log("Vault deployed to:", await vault.getAddress());

    // Deploy the factory contract
    const UserDepositFactory = await ethers.getContractFactory("UserDepositFactory");
    // const factory = await UserDepositFactory.deploy(factoryAdmin, adminAddress, operatorAddress, await vault.getAddress());
    const factory = await ethers.getContractAt("UserDepositFactory", "0xa16aF858AEfE32994dAcdb640683a66FDcCB9569")
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
