import { ethers } from "hardhat";
import { ContractReceipt } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy the factory contract first
  const UserDepositFactory = await ethers.getContractFactory("UserDepositFactory");
  const factory = await UserDepositFactory.deploy(deployer.address, deployer.address, deployer.address, deployer.address);
  await factory.waitForDeployment();

  console.log("Factory contract deployed at:", await factory.getAddress());

  // Parameters for the UserDeposit contract
  const salt = ethers.id("unique-salt"); // Replace with unique salt

  // Deploy UserDeposit contract via the factory using CREATE2
  const deploymentTx = await factory.deploy(salt);
  // Wait for the transaction to be mined
  const receipt: ContractReceipt = await deploymentTx.wait();

  const deployedAddress = await factory.getDeploymentAddress(salt);
  console.log("Calculated deploy address:", deployedAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
