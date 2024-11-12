import { ethers, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const vaultAddress: string = "0xaca4F448D910548293d9Bc0636CFDF2b40813439";
  const operatorAddress: string = "0x0f525aF4819B2AC15CB2883094CCB1Ab0B4e1ac3";
  const adminAddress: string = "0x0f525aF4819B2AC15CB2883094CCB1Ab0B4e1ac3";

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy the factory contract first
  const UserDepositFactory = await ethers.getContractFactory("UserDepositFactory");
  const factory = await UserDepositFactory.deploy(deployer.address, adminAddress, operatorAddress, vaultAddress);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("Factory contract deployed at:", factoryAddress);

  await factory.grantRole(await factory.DEPLOYER_ROLE(), operatorAddress);
  console.log("Deployer role granted to:", operatorAddress);

  await new Promise(resolve => setTimeout(resolve, 30000));

  // Verify the contract on Etherscan
  try {
    console.log("Verifying contract...");
    await run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [
        deployer.address,
        adminAddress,
        operatorAddress,
        vaultAddress,
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
