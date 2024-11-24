import {expect} from "chai";
import {ethers, upgrades, network} from "hardhat";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";
import {Vault, SchnorrSECP256K1Verifier, MockERC20} from "../typechain-types";

describe("Vault", function () {
    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://1rpc.io/matic",
                        blockNumber: 64664000 // Optional: specify a block number
                    }
                }
            ]
        });
    });

    let vault: Vault;
    let verifier: SchnorrSECP256K1Verifier;
    let erc20Token: MockERC20;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let recipient: SignerWithAddress;
    let nonceTimesGenerator: SignerWithAddress;
    let richAccount: SignerWithAddress;
    const pubKeyX = "0x72e45deca0fec2d04aae1b3d0b001b97462132c8af72f873ef066b1fc7466df0";
    const pubKeyYParity = 1;
    const mockERC20Address = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    const richAccountAddress = "0xF977814e90dA44bFA03b6295A0616a897441aceC";

    beforeEach(async function () {
        [owner, user, recipient, nonceTimesGenerator] = await ethers.getSigners();

        // Deploy Mock Schnorr Verifier
        const Verifier = await ethers.getContractFactory("SchnorrSECP256K1Verifier");
        verifier = await Verifier.deploy();
        await verifier.waitForDeployment();

        // Deploy Vault
        const Vault = await ethers.getContractFactory("Vault");
        vault = (await upgrades.deployProxy(Vault, [await verifier.getAddress(), pubKeyX, pubKeyYParity], {initializer: "initialize"})) as unknown as Vault;
        await vault.waitForDeployment();

        // Deploy Mock ERC20 Token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        erc20Token = (new ethers.Contract(mockERC20Address, MockERC20.interface, owner)) as unknown as MockERC20;

        // Impersonate the account
        await ethers.provider.send("hardhat_impersonateAccount", [richAccountAddress]);
        richAccount = await ethers.getSigner(richAccountAddress);

        // Mint tokens to Vault
        await erc20Token.connect(richAccount).transfer(await vault.getAddress(), ethers.parseUnits("1000", 8));
    });

    describe("Initialization", function () {
        it("should initialize correctly", async function () {
            expect(await vault.pubKeyX()).to.equal(pubKeyX);
            expect(await vault.pubKeyYParity()).to.equal(pubKeyYParity);
            expect(await vault.verifier()).to.equal(await verifier.getAddress());
        });
    });

    describe("Setters", function () {
        it("should allow the owner to set the Schnorr verifier", async function () {
            const newVerifier = await ethers.getSigner(recipient.address);
            await vault.setVerifier(newVerifier.address);
            expect(await vault.verifier()).to.equal(newVerifier.address);
        });

        it("should allow the owner to update the public key", async function () {
            await vault.setPublicKey(67890, 0);
            expect(await vault.pubKeyX()).to.equal(67890);
            expect(await vault.pubKeyYParity()).to.equal(0);
        });
    });

    describe("Nonce Management", function () {
        it("should update and retrieve user nonces", async function () {
            await vault.setNonce(10);
            expect(await vault.nonce()).to.equal(10);
        });
    });

    describe("Withdrawals", function () {
        beforeEach(async function () {
            await vault.setNonce(0);
        });

        it("should allow valid withdrawals with a correct Schnorr signature", async function () {
            const amount = 5000000;
            const recipientAddress = "0xB0307eAC59A2F39965f88783509aeE2018cE1377";
            await expect(
                vault
                    .connect(user)
                    .withdraw(
                        await erc20Token.getAddress(),
                        amount,
                        "63644720412491992976598222577878081087034640109256048801430282767413641127248",
                        recipientAddress,
                        0, // nonce
                        "23698135881295895658354939174965683122215266279173601812029317795458594455295", // signature
                        "0x372a3DcaFf79eaE0A9229c43b65EbC75859A295B" // nonceTimesGeneratorAddress
                    )
            )
                .to.emit(vault, "Withdrawal")
                .withArgs(await erc20Token.getAddress(), recipientAddress, amount);

            expect(await erc20Token.balanceOf(recipientAddress)).to.equal(amount);
            expect(await vault.nonce()).to.equal(1); // Nonce incremented
        });

        it("should revert if the nonce is invalid", async function () {
            await expect(
                vault
                    .connect(user)
                    .withdraw(
                        await erc20Token.getAddress(),
                        ethers.parseEther("10"),
                        1,
                        recipient.address,
                        1, // Incorrect nonce
                        12345, // signature
                        ethers.ZeroAddress // nonceTimesGeneratorAddress
                    )
            ).to.be.revertedWithCustomError(vault, "InvalidNonce");
        });

        it("should revert if the signature is invalid", async function () {
            await expect(
                vault
                    .connect(user)
                    .withdraw(
                        await erc20Token.getAddress(),
                        ethers.parseEther("10"),
                        1,
                        recipient.address,
                        0, // nonce
                        12345, // signature
                        nonceTimesGenerator.address // nonceTimesGeneratorAddress
                    )
            ).to.be.revertedWithCustomError(vault, "InvalidSignature");
        });
    });

    describe("Emergency Withdrawals", function () {
        it("should allow the owner to perform emergency withdrawals", async function () {
            const amount = ethers.parseUnits("500", 8);
            await expect(
                vault
                    .connect(owner)
                    .emergencyWithdrawERC20(await erc20Token.getAddress(), amount, recipient.address)
            )
                .to.emit(vault, "EmergencyWithdrawal")
                .withArgs(await erc20Token.getAddress(), recipient.address, amount);

            expect(await erc20Token.balanceOf(recipient.address)).to.equal(amount);
        });

        it("should revert if the recipient address is zero", async function () {
            await expect(
                vault
                    .connect(owner)
                    .emergencyWithdrawERC20(
                        await erc20Token.getAddress(),
                        ethers.parseEther("500"),
                        ethers.ZeroAddress
                    )
            ).to.be.revertedWithCustomError(vault, "ZeroAddress");
        });
    });
});
