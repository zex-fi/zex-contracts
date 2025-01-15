import {ethers, run} from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const adminAddress: string = "0x5fCeb18CF62bF791d7Aa0931D3159f95650A0061";

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy the MockERC20 contract
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");

  // Replace 'TokenName' and 'TKN' with the actual token name and symbol
  const tokenName = "Zex Wrapped BTC"; //Zex Tether USD, Zex Eigen, Zex Wrapped BTC
  const tokenSymbol = "zWBTC"; //zUSDT, zEIGEN, zWBTC
  const decimals= 8; //6, 18, 8

  const mockERC20 = await MockERC20Factory.deploy(tokenName, tokenSymbol, decimals, adminAddress);
  // const mockERC20 = await ethers.getContractAt("MockERC20", "0x325CCd77e71Ac296892ed5C63bA428700ec0f868")

  // Wait for the contract deployment to complete
  await mockERC20.waitForDeployment();

  console.log(tokenSymbol, "contract deployed at:", await mockERC20.getAddress());

  try {
    await run("verify:verify", {
        address: await mockERC20.getAddress(),
        constructorArguments: [
            tokenName,
            tokenSymbol,
            decimals,
            adminAddress,
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
