// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ISchnorrSECP256K1Verifier} from "./Interfaces/ISchnorrSECP256K1Verifier.sol";
import {IECDSAVerifier} from "./Interfaces/IECDSAVerifier.sol";

contract Vault is
    Initializable,
    AccessControlUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant EMERGENCY_WITHDRAW_ROLE = keccak256("EMERGENCY_WITHDRAW_ROLE");
    bytes32 public constant SETTER_ROLE = keccak256("SETTER_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    /// @dev Public key components for Schnorr signature verification.
    uint256 public pubKeyX;
    uint8 public pubKeyYParity;

    /// @dev Schnorr verifier contract instance.
    ISchnorrSECP256K1Verifier public schnorrVerifier;

    /// @dev ECDSA verifier contract instance.
    IECDSAVerifier public ecdsaVerifier;

    /// @dev Nonce to differentiate between signatures and secure the contrat against reply attack.
    mapping(uint256 => bool) public nonceIsUsed;

    // Events
    event Withdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event EmergencyWithdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event PublicKeySet(uint256 indexed pubKeyX, uint8 indexed pubKeyYParity);
    event VerifiersSet(address indexed schnorrVerifier, address indexed ecdsaVerifier);

    // Custom Errors
    error InvalidNonce(uint256 Nonce);
    error InvalidSignature();
    error TokenTransferFailed();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the Vault with a Schnorr verifier and public key components.
     * @param schnorrVerifier_ Address of the Schnorr verifier contract.
     * @param ecdsaVerifier_ Address of the ECDSA verifier contract.
     * @param signer_ The signer for ECDSA signature.
     * @param pubKeyX_ X-coordinate of the public key.
     * @param pubKeyYParity_ Parity of the Y-coordinate of the public key.
     */
    function initialize(address admin_, address schnorrVerifier_, address ecdsaVerifier_, address signer_, uint256 pubKeyX_, uint8 pubKeyYParity_) external initializer {
        __AccessControl_init();
        schnorrVerifier = ISchnorrSECP256K1Verifier(schnorrVerifier_);
        ecdsaVerifier = IECDSAVerifier(ecdsaVerifier_);
        pubKeyX = pubKeyX_;
        pubKeyYParity = pubKeyYParity_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(SIGNER_ROLE, signer_);
    }

    /**
     * @dev Sets the Schnorr verifier contract address.
     * @param schnorrVerifier_ Address of the new Schnorr verifier contract.
     * @param ecdsaVerifier_ Address of the new ECDSA verifier contract.
     */
    function setVerifiers(address schnorrVerifier_, address ecdsaVerifier_) external onlyRole(SETTER_ROLE) {
        schnorrVerifier = ISchnorrSECP256K1Verifier(schnorrVerifier_);
        ecdsaVerifier = IECDSAVerifier(ecdsaVerifier_);
        emit VerifiersSet(schnorrVerifier_, ecdsaVerifier_);
    }

    /**
     * @dev Updates the public key components.
     * @param pubKeyX_ X-coordinate of the new public key.
     * @param pubKeyYParity_ Parity of the Y-coordinate of the new public key.
     */
    function setPublicKey(uint256 pubKeyX_, uint8 pubKeyYParity_) external onlyRole(SETTER_ROLE) {
        pubKeyX = pubKeyX_;
        pubKeyYParity = pubKeyYParity_;
        emit PublicKeySet(pubKeyX_, pubKeyYParity_);
    }

    /**
     * @dev Allows a user to withdraw tokens after verifying the Schnorr signature.
     * @param tokenAddress_ The address of the ERC20 token to withdraw.
     * @param amount_ The amount of tokens to withdraw.
     * @param recipient_ The recipient address for the withdrawal.
     * @param nonce_ The user's nonce.
     * @param signature_ The Schnorr signature.
     * @param nonceTimesGeneratorAddress_ The address used in Schnorr signature generation.
     */
    function withdraw(
        address tokenAddress_,
        uint256 amount_,
        address recipient_,
        uint256 nonce_,
        uint256 signature_,
        address nonceTimesGeneratorAddress_,
        bytes memory shieldSignature_
    ) external {
        if (nonceIsUsed[nonce_]) revert InvalidNonce(nonce_);

        bytes32 msgHash = keccak256(
            abi.encodePacked(recipient_, tokenAddress_, amount_, nonce_, block.chainid)
        );

        if (
            !schnorrVerifier.verifySignature(pubKeyX, pubKeyYParity, signature_, uint256(msgHash), nonceTimesGeneratorAddress_) ||
            !hasRole(SIGNER_ROLE, ecdsaVerifier.getSigner(msgHash, shieldSignature_))
        ) revert InvalidSignature();

        nonceIsUsed[nonce_] = true;

        IERC20Upgradeable(tokenAddress_).safeTransfer(recipient_, amount_);
        emit Withdrawal(tokenAddress_, recipient_, amount_);
    }

    /**
     * @dev Allows the owner to emergency withdraw tokens.
     * @param tokenAddress_ The address of the ERC20 token to withdraw.
     * @param amount_ The amount of tokens to withdraw..
     * @param recipient_ The recipient address for the withdrawal.
     */
    function emergencyWithdrawERC20(
        address tokenAddress_,
        uint256 amount_,
        address recipient_
    ) external onlyRole(EMERGENCY_WITHDRAW_ROLE) {
        if (recipient_ == address(0)) revert ZeroAddress();
        IERC20Upgradeable(tokenAddress_).safeTransfer(recipient_, amount_);
        emit EmergencyWithdrawal(tokenAddress_, recipient_, amount_);
    }
}
