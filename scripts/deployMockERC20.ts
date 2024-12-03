import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy the MockERC20 contract
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");

  // Replace 'TokenName' and 'TKN' with the actual token name and symbol
  const tokenName = "Zellular Test Token";
  const tokenSymbol = "ZTT";

  const mockERC20 = await MockERC20Factory.deploy(tokenName, tokenSymbol);

  // Wait for the contract deployment to complete
  await mockERC20.waitForDeployment();

  console.log("MockERC20 contract deployed at:", await mockERC20.getAddress());

  // Example of minting tokens after deployment
  const mintAmount = ethers.parseUnits("1000", 18); // Mint 1000 tokens (adjust decimals if needed)
  const mintTx = await mockERC20.mint(deployer.address, mintAmount);
  await mintTx.wait();

  console.log(`Minted ${mintAmount.toString()} tokens to:`, deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
