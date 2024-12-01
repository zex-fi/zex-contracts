import {ethers, upgrades, run} from "hardhat";
import {getAddress} from "ethers";

async function main() {
    const [deployer] = await ethers.getSigners();
    const pubKeyX = "18558685049902181818735037110738643732519729533907885887150087414461356251645";
    const pubKeyYParity = 0;
    const factoryAdmin: string = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
    const vaultAdmin: string = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
    const operatorAddress: string = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
    const adminAddress: string = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";

    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy the SchnorrSECP256K1Verifier contract
    console.log("Deploying verifier...");
    const Verifier = await ethers.getContractFactory("SchnorrSECP256K1Verifier");
    // const verifier = await Verifier.deploy();
    const verifier = await ethers.getContractAt("SchnorrSECP256K1Verifier", "0x4ba18Af73e7E39636cD647b6c6A7E6D6a9086e6c")
    await verifier.waitForDeployment();
    console.log("verifier deployed to:", await verifier.getAddress());

    console.log("Deploying Vault...");
    const Vault = await ethers.getContractFactory("Vault");
    // const vaultImplementation = await Vault.deploy()
    // await vaultImplementation.waitForDeployment();
    // console.log("Implementation deployed to:", await vaultImplementation.getAddress());
    // const vault = await upgrades.deployProxy(Vault, [vaultAdmin, await verifier.getAddress(), pubKeyX, pubKeyYParity], {
    //     initializer: "initialize",
    //     implementation: vaultImplementation.getAddress(),
    // });
    // const vault = await upgrades.upgradeProxy("0xcA3423244F6EC002fa057d633294480e00F04fEF", Vault);
    const vault = await ethers.getContractAt("Vault", "0xcA3423244F6EC002fa057d633294480e00F04fEF")
    await vault.waitForDeployment();
    console.log("Vault deployed to:", await vault.getAddress());

    // Deploy the factory contract
    const UserDepositFactory = await ethers.getContractFactory("UserDepositFactory");
    const factory = await UserDepositFactory.deploy(factoryAdmin, adminAddress, operatorAddress, await vault.getAddress());
    // const factory = await ethers.("UserDepositFactory", "0x6ca7860A5653943025a66AD6e4Cbe6fad47dE62a")
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
