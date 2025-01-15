import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";
import {ethers, upgrades} from "hardhat";
import {expect} from "chai";
import {UserDeposit, UserDepositFactory, MockERC20, MockERC721} from "../typechain-types";
import {ZeroAddress} from "ethers";


describe("UserDeposit", function () {
    let userDeposit: UserDeposit;
    let userDepositFactory: UserDepositFactory;
    let erc20Token: MockERC20;
    let erc721Token: MockERC721;
    let owner: SignerWithAddress;
    let operator: SignerWithAddress;
    let vault: SignerWithAddress;

    beforeEach(async function () {
        [owner, operator, vault] = await ethers.getSigners();

        // Deploy UserDepositFactory
        const UserDepositFactory = await ethers.getContractFactory("UserDepositFactory");
        userDepositFactory = (await UserDepositFactory.deploy(owner.address, owner.address, operator.address, vault.address)) as unknown as UserDepositFactory;
        await userDepositFactory.waitForDeployment();

        // Deploy UserDeposit contract
        const UserDeposit = await ethers.getContractFactory("UserDeposit");
        userDeposit = (await UserDeposit.deploy(await owner.getAddress(), await userDepositFactory.getAddress())) as unknown as UserDeposit;
        await userDeposit.waitForDeployment();

        // Deploy mock ERC20 token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        erc20Token = await MockERC20.deploy("MockToken", "MTK", 18, owner.address);
        await erc20Token.waitForDeployment();

        // Deploy mock ERC721 token
        const MockERC721 = await ethers.getContractFactory("MockERC721");
        erc721Token = await MockERC721.deploy("MockNFT", "MNFT");
        await erc721Token.waitForDeployment();
    });

    describe("Initialization", function () {
        it("Should set the correct roles", async function () {
            expect(await userDeposit.hasRole(await userDeposit.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
        });

        it("Should revert if initialized with zero address", async function () {
            const UserDeposit = await ethers.getContractFactory("UserDeposit");
            await expect(UserDeposit.deploy(ZeroAddress, await vault.getAddress())).to.be.revertedWithCustomError(userDeposit, "ZeroAddress");
            await expect(UserDeposit.deploy(await owner.getAddress(), ZeroAddress)).to.be.revertedWithCustomError(userDeposit, "ZeroAddress");
        });
    });

    describe("ERC20 Transfers", function () {
        beforeEach(async function () {
            // Mint some tokens to the UserDeposit contract
            await erc20Token.mint(userDeposit.getAddress(), ethers.parseEther("100"));
        });

        it("Should transfer ERC20 tokens", async function () {
            const amount = ethers.parseEther("10");
            await expect(userDeposit.connect(operator).transferERC20(erc20Token.getAddress(), amount))
                .to.emit(userDeposit, "ERC20Transferred")
                .withArgs(erc20Token.getAddress(), await vault.getAddress(), amount);

            expect(await erc20Token.balanceOf(await vault.getAddress())).to.equal(amount);
        });

        it("Should revert if called by non-transferrer", async function () {
            const amount = ethers.parseEther("10");
            await expect(userDeposit.connect(vault).transferERC20(erc20Token.getAddress(), amount))
                .to.be.revertedWithCustomError(userDeposit, "ImproperRole");
        });

        it("Should revert if transferring zero amount", async function () {
            await expect(userDeposit.connect(operator).transferERC20(erc20Token.getAddress(), 0))
                .to.be.revertedWithCustomError(userDeposit, "InvalidAmount");
        });

        it("Should revert if insufficient balance", async function () {
            const amount = ethers.parseEther("1000"); // More than the contract has
            await expect(userDeposit.connect(operator).transferERC20(erc20Token.getAddress(), amount))
                .to.be.revertedWithCustomError(userDeposit, "InsufficientBalance");
        });
    });

    describe("ERC721 Transfers", function () {
        const tokenId = 1;

        beforeEach(async function () {
            // Mint an NFT to the UserDeposit contract
            await erc721Token.mint(userDeposit.getAddress(), tokenId);
        });

        it("Should transfer ERC721 tokens", async function () {
            await expect(userDeposit.connect(operator).transferERC721(erc721Token.getAddress(), tokenId))
                .to.emit(userDeposit, "ERC721Transferred")
                .withArgs(erc721Token.getAddress(), await vault.getAddress(), tokenId);

            expect(await erc721Token.ownerOf(tokenId)).to.equal(await vault.getAddress());
        });

        it("Should revert if called by non-transferrer", async function () {
            await expect(userDeposit.connect(vault).transferERC721(erc721Token.getAddress(), tokenId))
                .to.be.revertedWithCustomError(userDeposit, "ImproperRole");
        });

        it("Should revert if contract is not the token owner", async function () {
            const newTokenId = 2;
            await erc721Token.mint(await owner.getAddress(), newTokenId);
            await expect(userDeposit.connect(operator).transferERC721(erc721Token.getAddress(), newTokenId))
                .to.be.revertedWithCustomError(userDeposit, "ContractNotTokenOwner");
        });
    });

    describe("ERC721 Receiver", function () {
        it("Should be able to receive ERC721 tokens", async function () {
            const tokenId = 1;
            await erc721Token.mint(await owner.getAddress(), tokenId);
            await erc721Token.connect(owner).transferFrom(await owner.getAddress(), userDeposit.getAddress(), tokenId);
            expect(await erc721Token.ownerOf(tokenId)).to.equal(await userDeposit.getAddress());
        });
    });
    describe("Native Token Transfers", function () {
        beforeEach(async function () {
            // Fund the UserDeposit contract with native tokens
            await owner.sendTransaction({
                to: userDeposit.getAddress(),
                value: ethers.parseEther("1.0"),
            });
        });

        it("Should transfer native tokens", async function () {
            const amount = ethers.parseEther("0.5");
            await expect(userDeposit.connect(operator).transferNativeToken(amount))
                .to.emit(userDeposit, "NativeTokenTransferred")
                .withArgs(await vault.getAddress(), amount);

            const userBalance = await ethers.provider.getBalance(await vault.getAddress());
            expect(userBalance).to.be.gte(amount); // Check that the user's balance increased
        });

        it("Should revert if called by non-transferrer", async function () {
            const amount = ethers.parseEther("0.5");
            await expect(userDeposit.connect(vault).transferNativeToken(amount))
                .to.be.revertedWithCustomError(userDeposit, "ImproperRole");
        });


        it("Should revert if transferring zero amount", async function () {
            await expect(userDeposit.connect(operator).transferNativeToken(0))
                .to.be.revertedWithCustomError(userDeposit, "InvalidAmount");
        });

        it("Should revert if insufficient balance", async function () {
            const amount = ethers.parseEther("2.0"); // More than the contract has
            await expect(userDeposit.connect(operator).transferNativeToken(amount))
                .to.be.revertedWithCustomError(userDeposit, "InsufficientBalance");
        });
    });
});