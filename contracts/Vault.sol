// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ISchnorrSECP256K1Verifier} from "./Interfaces/ISchnorrSECP256K1Verifier.sol";

contract Vault is
    Initializable,
    AccessControlUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant EMERGENCY_WITHDRAW_ROLE = keccak256("EMERGENCY_WITHDRAW_ROLE");
    bytes32 public constant SETTER_ROLE = keccak256("SETTER_ROLE");

    /// @dev Public key components for Schnorr signature verification.
    uint256 public pubKeyX;
    uint8 public pubKeyYParity;

    /// @dev Schnorr verifier contract instance.
    ISchnorrSECP256K1Verifier public verifier;

    /// @dev Nonce to differentiate between signatures and secure the contrat against reply attack.
    uint256 public nonce;

    /// @dev List of users with registered nonces.
    uint256[] public users;

    // Events
    event Withdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event EmergencyWithdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event PublicKeySet(uint256 indexed pubKeyX, uint8 indexed pubKeyYParity);
    event VerifierSet(address indexed verifier);
    event NonceSet(uint256 newNonce);

    // Custom Errors
    error InvalidNonce(uint256 provided, uint256 expected);
    error InvalidSignature();
    error TokenTransferFailed();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the Vault with a Schnorr verifier and public key components.
     * @param verifier_ Address of the Schnorr verifier contract.
     * @param pubKeyX_ X-coordinate of the public key.
     * @param pubKeyYParity_ Parity of the Y-coordinate of the public key.
     */
    function initialize(address admin_, address verifier_, uint256 pubKeyX_, uint8 pubKeyYParity_) external initializer {
        __AccessControl_init();
        verifier = ISchnorrSECP256K1Verifier(verifier_);
        pubKeyX = pubKeyX_;
        pubKeyYParity = pubKeyYParity_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    /**
     * @dev Sets the Schnorr verifier contract address.
     * @param verifier_ Address of the new verifier contract.
     */
    function setVerifier(address verifier_) external onlyRole(SETTER_ROLE) {
        verifier = ISchnorrSECP256K1Verifier(verifier_);
        emit VerifierSet(verifier_);
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
     * @dev Updates the nonce.
     * @notice This function is just for test
     * @param nonce_ The new nonce.
     */
    function setNonce(uint256 nonce_) public onlyRole(SETTER_ROLE) {
        nonce = nonce_;
        emit NonceSet(nonce_);
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
        address nonceTimesGeneratorAddress_
    ) external {
        if (nonce_ != nonce) revert InvalidNonce(nonce_, nonce);

        uint256 msgHash = uint256(keccak256(abi.encodePacked(recipient_, tokenAddress_, amount_, nonce_, block.chainid)));
        if (!verifier.verifySignature(pubKeyX, pubKeyYParity, signature_, msgHash, nonceTimesGeneratorAddress_)) {
            revert InvalidSignature();
        }

        nonce = nonce + 1;

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
