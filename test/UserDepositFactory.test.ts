import {expect} from "chai";
import {ethers} from "hardhat";
import {UserDepositFactory, UserDeposit} from "../typechain-types";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";

describe("UserDepositFactory", function () {
    let factory: UserDepositFactory;
    let owner: SignerWithAddress;
    let defaultAdmin: SignerWithAddress;
    let operator: SignerWithAddress;
    let toAccount: SignerWithAddress;

    beforeEach(async function () {
        [owner, defaultAdmin, operator, toAccount] = await ethers.getSigners();

        // Deploy UserDepositFactory contract
        const Factory = await ethers.getContractFactory("UserDepositFactory");
        factory = (await Factory.deploy(owner.address, defaultAdmin.address, operator.address, toAccount.address)) as UserDepositFactory;
        await factory.waitForDeployment();

        // Update the factory's default addresses if necessary
        await factory.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should deploy the factory contract", async function () {
            expect(factory.getAddress).to.be.a("function");
            expect(factory.deploy).to.be.a("function");
        });
    });

    describe("Deploying UserDeposit Contracts", function () {
        let salt: number;
        let predictedAddress: string;
        let deployedAddress: string;

        beforeEach(async function () {
            salt = 12345; // Example salt value

            // Get the predicted address
            predictedAddress = await factory.getDeploymentAddress(salt);
        });

        it("Should predict the correct address", async function () {
            const bytecode = await factory.getBytecode();

            const computedAddress = ethers.getCreate2Address(
                await factory.getAddress(),
                ethers.zeroPadValue(ethers.toBeHex(salt), 32),
                ethers.keccak256(bytecode)
            );

            expect(predictedAddress).to.equal(computedAddress);
        });

        it("Should deploy a UserDeposit contract at the predicted address", async function () {
            const tx = await factory.deploy(salt);
            const receipt = await tx.wait();

            const filter = factory.filters.Deployed
            const events = await factory.queryFilter(filter, -1)
            const event = events[0]

            deployedAddress = event.args.addr;

            expect(deployedAddress).to.equal(predictedAddress);

            // Verify that the contract at deployedAddress is a UserDeposit contract
            const userDeposit = await ethers.getContractAt(
                "UserDeposit",
                deployedAddress
            );

            expect(await userDeposit.DEFAULT_ADMIN_ROLE()).to.exist;
        });

        it("Should emit Deployed event with correct parameters", async function () {
            await expect(factory.deploy(salt))
                .to.emit(factory, "Deployed")
                .withArgs(predictedAddress, salt);
        });

        it("Should revert deployment if contract already exists at address", async function () {
            await factory.deploy(salt);

            await expect(factory.deploy(salt)).to.be.reverted;
        });
    });

    describe("Interacting with Deployed UserDeposit", function () {
        let salt: number;
        let userDepositAddress: string;
        let userDeposit: UserDeposit;

        beforeEach(async function () {
            salt = 67890;

            // Deploy UserDeposit contract
            await factory.deploy(salt);
            userDepositAddress = await factory.getDeploymentAddress(salt);

            // Get the deployed UserDeposit contract instance
            userDeposit = await ethers.getContractAt(
                "UserDeposit",
                userDepositAddress
            );
        });

        it("Should have correct roles set in UserDeposit", async function () {
            expect(
                await userDeposit.hasRole(
                    await userDeposit.DEFAULT_ADMIN_ROLE(),
                    defaultAdmin.address
                )
            ).to.be.true;
        });

        it("Should allow operator to transfer ERC20 tokens", async function () {
            // Deploy mock ERC20 token
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const erc20Token = await MockERC20.deploy("MockToken", "MTK");
            await erc20Token.waitForDeployment();

            // Mint tokens to UserDeposit contract
            await erc20Token.mint(userDepositAddress, ethers.parseEther("100"));

            // Operator transfers tokens from UserDeposit to toAccount
            await expect(
                userDeposit
                    .connect(operator)
                    .transferERC20(
                        erc20Token.target,
                        ethers.parseEther("10")
                    )
            )
                .to.emit(userDeposit, "ERC20Transferred")
                .withArgs(erc20Token.target, toAccount.address, ethers.parseEther("10"));

            expect(await erc20Token.balanceOf(toAccount.address)).to.equal(
                ethers.parseEther("10")
            );
        });
    });
});
