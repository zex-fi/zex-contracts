import {expect} from "chai";
import {ethers, upgrades, network} from "hardhat";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";
import {Vault, SchnorrSECP256K1Verifier, ECDSAVerifier, MockERC20} from "../typechain-types";

describe("Vault", function () {
    let vault: Vault;
    let schnorrVerifier: SchnorrSECP256K1Verifier;
    let ecdsaVerifier: ECDSAVerifier;
    let erc20Token: MockERC20;
    let owner: SignerWithAddress;
    let setter: SignerWithAddress;
    let withdrawer: SignerWithAddress;
    let user: SignerWithAddress;
    let ecdsaSigner: SignerWithAddress;
    let recipient: SignerWithAddress;
    let nonceTimesGenerator: SignerWithAddress;
    let richAccount: SignerWithAddress;
    let setterRole: string;
    let signerRole: string;
    let withdrawerRole: string;
    const chainId = 137;
    const pubKey = "0x0210f2d4d7658f6f94d01e1d5b2a4b042861aab2a72ba100c85e79bc142ab55494";
    const mockERC20Address = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    const richAccountAddress = "0xF977814e90dA44bFA03b6295A0616a897441aceC";

    beforeEach(async function () {
        [owner, setter, withdrawer, user, ecdsaSigner, recipient, nonceTimesGenerator,] = await ethers.getSigners();

        // Deploy Mock Schnorr Verifier
        const schnorrVerifierFactory = await ethers.getContractFactory("SchnorrSECP256K1Verifier");
        schnorrVerifier = await schnorrVerifierFactory.deploy();
        await schnorrVerifier.waitForDeployment();

        const ecdsaVerifierFactory = await ethers.getContractFactory("ECDSAVerifier");
        ecdsaVerifier = await ecdsaVerifierFactory.deploy();
        await ecdsaVerifier.waitForDeployment();

        // Deploy Vault
        const Vault = await ethers.getContractFactory("Vault");
        vault = (await upgrades.deployProxy(Vault, [
            owner.address,
            await schnorrVerifier.getAddress(),
            await ecdsaVerifier.getAddress(),
            ecdsaSigner.address,
            pubKey,
        ], {initializer: "initialize"})) as unknown as Vault;
        await vault.waitForDeployment();

        setterRole = await vault.SETTER_ROLE();
        signerRole = await vault.SIGNER_ROLE();
        withdrawerRole = await vault.EMERGENCY_WITHDRAW_ROLE();
        await vault.grantRole(setterRole, setter.address);
        await vault.grantRole(signerRole, ecdsaSigner.address);
        await vault.grantRole(withdrawerRole, withdrawer.address);

        // Deploy Mock ERC20 Token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        erc20Token = (await MockERC20.deploy("Test Token", "TTK", 8, owner.address)) as unknown as MockERC20;
        await erc20Token.waitForDeployment();
        await erc20Token.mint(await vault.getAddress(), ethers.parseUnits("1000", 18))
        await owner.sendTransaction({
            to: await vault.getAddress(),
            value: ethers.parseEther("1.0"),
        });
    });

    describe("Initialization", function () {
        it.only("should initialize correctly", async function () {
            expect(await vault.pubKey()).to.equal(pubKey);
            expect(await vault.schnorrVerifier()).to.equal(await schnorrVerifier.getAddress());
            expect(await vault.ecdsaVerifier()).to.equal(await ecdsaVerifier.getAddress());
            console.log(
                ethers.solidityPacked(
                ["address", "address", "uint256", "uint256", "uint256"],
                [
                    "0xF5Ed9bd40fD35A5f60dc3059bB16cfb8B5B8dd01".toLowerCase(),
                    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238".toLowerCase(),
                    5000,
                    2443,
                    11155111
                ]
            )
            )
        });
    });

    describe("Setters", function () {
        it("should allow the setter to set the verifiers", async function () {
            await vault.connect(setter).setVerifiers(recipient.address, user.address);
            expect(await vault.schnorrVerifier()).to.equal(recipient.address);
            expect(await vault.ecdsaVerifier()).to.equal(user.address);
        });

        it("should allow the setter to update the public key", async function () {
            await vault.connect(setter).setPublicKey("0x12712bf86ee0a61a6636bd86c79e5922383c5dd4541062ed4d733a871650a777e9");
            expect(await vault.pubKey()).to.equal("0x12712bf86ee0a61a6636bd86c79e5922383c5dd4541062ed4d733a871650a777e9");
        });

        it("should not allow the user to set the verifiers", async function () {
            await expect(
                vault.connect(user).connect(user).setVerifiers(recipient.address, user.address)
            ).to.be.revertedWith(/AccessControl: account .* is missing role .*/);
        });

        it("should not allow the user to update the public key", async function () {
            await expect(
                vault.connect(user).setPublicKey("0x12712bf86ee0a61a6636bd86c79e5922383c5dd4541062ed4d733a871650a777e9")
            ).to.be.revertedWith(/AccessControl: account .* is missing role .*/);
        });
    });

    describe("Emergency Withdrawals", function () {
        it("should allow the withdrawer to perform emergency withdrawals", async function () {
            const amount = ethers.parseUnits("500", 8);
            await expect(
                vault
                    .connect(withdrawer)
                    .emergencyWithdrawERC20(await erc20Token.getAddress(), amount, recipient.address)
            )
                .to.emit(vault, "EmergencyWithdrawal")
                .withArgs(await erc20Token.getAddress(), recipient.address, amount);

            expect(await erc20Token.balanceOf(recipient.address)).to.equal(amount);
        });

        it("should allow the withdrawer to perform emergency withdrawals", async function () {
            const amount = ethers.parseEther("1");
            const recipientBalance = await ethers.provider.getBalance(recipient.address);
            const vaultBalance = await ethers.provider.getBalance(await vault.getAddress());
            await expect(
                vault
                    .connect(withdrawer)
                    .emergencyWithdrawERC20(ethers.ZeroAddress, amount, recipient.address)
            )
                .to.emit(vault, "EmergencyWithdrawal")
                .withArgs(ethers.ZeroAddress, recipient.address, amount);

            expect(await ethers.provider.getBalance(recipient.address)).to.equal(recipientBalance + amount);
            expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(vaultBalance - amount);
        });

        it("should not allow the user to perform emergency withdrawals", async function () {
            const amount = ethers.parseUnits("500", 8);
            await expect(
                vault
                    .connect(user)
                    .emergencyWithdrawERC20(await erc20Token.getAddress(), amount, recipient.address)
            ).to.be.revertedWith(/AccessControl: account .* is missing role .*/);
        });

        it("should revert if the recipient address is zero", async function () {
            await expect(
                vault
                    .connect(withdrawer)
                    .emergencyWithdrawERC20(
                        await erc20Token.getAddress(),
                        ethers.parseEther("500"),
                        ethers.ZeroAddress
                    )
            ).to.be.revertedWithCustomError(vault, "ZeroAddress");
        });
    });

    describe("Withdrawals", function () {
        before(async () => {
            await network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: "https://polygon.drpc.org",
                        },
                    }
                ]
            });
        });

        beforeEach(async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            erc20Token = (new ethers.Contract(mockERC20Address, MockERC20.interface, owner)) as unknown as MockERC20;
            // Impersonate the account
            await ethers.provider.send("hardhat_impersonateAccount", [richAccountAddress]);
            richAccount = await ethers.getSigner(richAccountAddress);
            // Transfer tokens to Vault
            await erc20Token.connect(richAccount).transfer(await vault.getAddress(), ethers.parseUnits("1000", 8));
        });

        it("should allow valid withdrawals with a correct Schnorr signature", async function () {
            const amount = 1000;
            const recipientAddress = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
            const previousBalance = await erc20Token.balanceOf(recipientAddress);
            const tokenAddress = await erc20Token.getAddress();
            const withdrawalId = 0
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "address", "uint256", "uint256", "uint256"],
                [recipientAddress, tokenAddress, amount, withdrawalId, chainId]
            );
            const shieldSignature = await ecdsaSigner.signMessage(ethers.toBeArray(messageHash));
            await expect(
                vault
                    .connect(user)
                    .withdraw(
                        tokenAddress,
                        amount,
                        recipientAddress,
                        withdrawalId,
                        "0x88dbc8cb6e8df759831e086d995ca4b36bb2e60fbc07a20d8b1e98ab25aaaf82272eabebd14de73f5a83de44bc8c7cddef7761eac96d117dad11a25ee0e1e3ce", // signature
                        shieldSignature
                    )
            )
                .to.emit(vault, "Withdrawal")
                .withArgs(await erc20Token.getAddress(), recipientAddress, amount);

            expect(await erc20Token.balanceOf(recipientAddress) - previousBalance).to.equal(amount);
            expect(await vault.withdrawalIdIsUsed(0)).to.equal(true); // Nonce incremented
        });

        it("should revert if the withdrawalId is invalid", async function () {
            const amount = 1000;
            const recipientAddress = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
            const previousBalance = await erc20Token.balanceOf(recipientAddress);
            const tokenAddress = await erc20Token.getAddress();
            const withdrawalId = 0
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "address", "uint256", "uint256", "uint256"],
                [recipientAddress, tokenAddress, amount, withdrawalId, chainId]
            );
            const shieldSignature = await ecdsaSigner.signMessage(ethers.toBeArray(messageHash));

            vault.connect(user).withdraw(
                tokenAddress,
                amount,
                recipientAddress,
                withdrawalId,
                "0x88dbc8cb6e8df759831e086d995ca4b36bb2e60fbc07a20d8b1e98ab25aaaf82272eabebd14de73f5a83de44bc8c7cddef7761eac96d117dad11a25ee0e1e3ce", // signature
                shieldSignature
            );
            await expect(
                vault
                    .connect(user)
                    .withdraw(
                        tokenAddress,
                        amount,
                        recipientAddress,
                        withdrawalId,
                        "0x88dbc8cb6e8df759831e086d995ca4b36bb2e60fbc07a20d8b1e98ab25aaaf82272eabebd14de73f5a83de44bc8c7cddef7761eac96d117dad11a25ee0e1e3ce", // signature
                        shieldSignature
                    )
            ).to.be.revertedWithCustomError(vault, "InvalidWithdrawalId");
        });

        it("should not revert if the used nonce is reset", async function () {
            const amount = 1000;
            const recipientAddress = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
            const previousBalance = await erc20Token.balanceOf(recipientAddress);
            const tokenAddress = await erc20Token.getAddress();
            const withdrawID = 0
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "address", "uint256", "uint256", "uint256"],
                [recipientAddress, tokenAddress, amount, withdrawID, chainId]
            );
            const shieldSignature = await ecdsaSigner.signMessage(ethers.toBeArray(messageHash));

            vault.connect(user).withdraw(
                tokenAddress,
                amount,
                recipientAddress,
                withdrawID,
                "0x88dbc8cb6e8df759831e086d995ca4b36bb2e60fbc07a20d8b1e98ab25aaaf82272eabebd14de73f5a83de44bc8c7cddef7761eac96d117dad11a25ee0e1e3ce", // signature
                shieldSignature
            );
            await vault.connect(setter).resetWithdrawalID(withdrawID);
            await expect(
                vault
                    .connect(user)
                    .withdraw(
                        tokenAddress,
                        amount,
                        recipientAddress,
                        withdrawID,
                        "0x88dbc8cb6e8df759831e086d995ca4b36bb2e60fbc07a20d8b1e98ab25aaaf82272eabebd14de73f5a83de44bc8c7cddef7761eac96d117dad11a25ee0e1e3ce", // signature
                        shieldSignature
                    )
            )
                .to.emit(vault, "Withdrawal")
                .withArgs(await erc20Token.getAddress(), recipientAddress, amount);
        });

        it("should revert if the schnorr signature is invalid", async function () {
            const tokenAddress = await erc20Token.getAddress();
            const amount = ethers.parseEther("10");
            const withdrawlId = 0
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "address", "uint256", "uint256", "uint256"],
                [recipient.address, tokenAddress, amount, withdrawlId, chainId]
            );
            const shieldSignature = await ecdsaSigner.signMessage(ethers.toBeArray(messageHash));
            await expect(
                vault
                    .connect(user)
                    .withdraw(
                        await erc20Token.getAddress(),
                        amount,
                        recipient.address,
                        withdrawlId,
                        "0x98dbc8cb6e8df759831e086d995ca4b36bb2e60fbc07a20d8b1e98ab25aaaf82272eabebd14de73f5a83de44bc8c7cddef7761eac96d117dad11a25ee0e1e3ce", // signature
                        shieldSignature
                    )
            ).to.be.revertedWithCustomError(vault, "InvalidSignature");
        });

        it("should revert if the ECDSA signature is invalid", async function () {
            const amount = 1000;
            const recipientAddress = "0x2B3e5649A2Bfc3667b1db1A0ae7E1f9368d676A9";
            const tokenAddress = await erc20Token.getAddress();
            const withdrawalId = 0
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "address", "uint256", "uint256", "uint256"],
                [recipientAddress, tokenAddress, amount, 1, chainId]
            );
            const shieldSignature = await ecdsaSigner.signMessage(ethers.toBeArray(messageHash));

            await expect(
                vault
                    .connect(user)
                    .withdraw(
                        tokenAddress,
                        amount,
                        recipientAddress,
                        withdrawalId,
                        "0x88dbc8cb6e8df759831e086d995ca4b36bb2e60fbc07a20d8b1e98ab25aaaf82272eabebd14de73f5a83de44bc8c7cddef7761eac96d117dad11a25ee0e1e3ce", // signature
                        shieldSignature
                    )
            ).to.be.revertedWithCustomError(vault, "InvalidSignature");
        });
    });
});
