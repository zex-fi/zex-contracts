// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ISchnorrSECP256K1Verifier} from "./Interfaces/ISchnorrSECP256K1Verifier.sol";

contract Vault is
    Initializable,
    OwnableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @dev Public key components for Schnorr signature verification.
    uint256 public pubKeyX;
    uint8 public pubKeyYParity;

    /// @dev Schnorr verifier contract instance.
    ISchnorrSECP256K1Verifier public verifier;

    /// @dev Mapping to track user-specific nonces.
    mapping(uint256 => uint256) public nonces;

    /// @dev List of users with registered nonces.
    uint256[] public users;

    // Events
    event Withdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event EmergencyWithdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event PublicKeySet(uint256 indexed pubKeyX, uint8 indexed pubKeyYParity);
    event VerifierSet(address indexed verifier);
    event NonceUpdated(uint256 indexed userId, uint256 newNonce);

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
     * @param _verifier Address of the Schnorr verifier contract.
     * @param _pubKeyX X-coordinate of the public key.
     * @param _pubKeyYParity Parity of the Y-coordinate of the public key.
     */
    function initialize(address _verifier, uint256 _pubKeyX, uint8 _pubKeyYParity) external initializer {
        __Ownable_init();
        verifier = ISchnorrSECP256K1Verifier(_verifier);
        pubKeyX = _pubKeyX;
        pubKeyYParity = _pubKeyYParity;
    }

    /**
     * @dev Sets the Schnorr verifier contract address.
     * @param _verifier Address of the new verifier contract.
     */
    function setVerifier(address _verifier) external onlyOwner {
        verifier = ISchnorrSECP256K1Verifier(_verifier);
        emit VerifierSet(_verifier);
    }

    /**
     * @dev Updates the public key components.
     * @param _pubKeyX X-coordinate of the new public key.
     * @param _pubKeyYParity Parity of the Y-coordinate of the new public key.
     */
    function setPublicKey(uint256 _pubKeyX, uint8 _pubKeyYParity) external onlyOwner {
        pubKeyX = _pubKeyX;
        pubKeyYParity = _pubKeyYParity;
        emit PublicKeySet(_pubKeyX, _pubKeyYParity);
    }

    /**
     * @dev Updates the nonce for a specific user.
     * @param userId The user ID.
     * @param nonce The new nonce.
     */
    function setNonce(uint256 userId, uint256 nonce) public {
        if (nonces[userId] == 0 && nonce != 0) {
            users.push(userId);
        }
        nonces[userId] = nonce;
        emit NonceUpdated(userId, nonce);
    }

    /**
     * @dev Retrieves the current nonce for a user.
     * @param userId The user ID.
     * @return The current nonce for the user.
     */
    function getNonce(uint256 userId) public view returns (uint256) {
        return nonces[userId];
    }

    /**
     * @dev Allows a user to withdraw tokens after verifying the Schnorr signature.
     * @param tokenAddress The address of the ERC20 token to withdraw.
     * @param amount The amount of tokens to withdraw.
     * @param user The user ID.
     * @param recipient The recipient address for the withdrawal.
     * @param nonce The user's nonce.
     * @param signature The Schnorr signature.
     * @param nonceTimesGeneratorAddress The address used in Schnorr signature generation.
     */
    function withdraw(
        address tokenAddress,
        uint256 amount,
        uint256 user,
        address recipient,
        uint256 nonce,
        uint256 signature,
        address nonceTimesGeneratorAddress
    ) external {
        if (nonce != getNonce(user)) revert InvalidNonce(nonce, getNonce(user));

        uint256 msgHash = uint256(keccak256(abi.encodePacked(user, recipient, tokenAddress, amount, nonce)));

        if (!verifier.verifySignature(pubKeyX, pubKeyYParity, signature, msgHash, nonceTimesGeneratorAddress)) {
            revert InvalidSignature();
        }

        setNonce(user, nonce + 1);

        IERC20Upgradeable(tokenAddress).safeTransfer(recipient, amount);
        emit Withdrawal(tokenAddress, recipient, amount);
    }

    /**
     * @dev Allows the owner to emergency withdraw tokens.
     * @param tokenAddress The address of the ERC20 token to withdraw.
     * @param amount The amount of tokens to withdraw..
     * @param recipient The recipient address for the withdrawal.
     */
    function emergencyWithdrawERC20(
        address tokenAddress,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        IERC20Upgradeable(tokenAddress).safeTransfer(recipient, amount);
        emit EmergencyWithdrawal(tokenAddress, recipient, amount);
    }
}
