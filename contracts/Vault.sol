// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Vault
 * @dev A secure vault contract for managing token withdrawals with Schnorr signature verification.
 */
interface ISchnorrVerifier {
    function verifySignature(
        uint256 pubKeyX,
        uint8 pubKeyYParity,
        uint256 signature,
        uint256 msgHash,
        address nonceTimesGeneratorAddress
    ) external view returns (bool);
}

contract Vault is Ownable {
    using SafeERC20 for IERC20;

    /// @dev Public key components for Schnorr signature verification.
    uint256 public pubKeyX;
    uint8 public pubKeyYParity;

    /// @dev Schnorr verifier contract instance.
    ISchnorrVerifier public verifier;

    /// @dev Mapping to track user-specific nonces.
    mapping(uint256 => uint256) public nonces;

    /// @dev List of users with registered nonces.
    uint256[] public users;

    // Events
    event Withdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event PublicKeySet(uint256 indexed pubKeyX, uint8 indexed pubKeyYParity);
    event VerifierSet(address indexed verifier);
    event NonceUpdated(uint256 indexed userId, uint256 newNonce);

    // Custom Errors
    error InvalidNonce(uint256 provided, uint256 expected);
    error InvalidSignature();
    error TokenTransferFailed();

    /**
     * @dev Initializes the Vault with a Schnorr verifier and public key components.
     * @param _verifier Address of the Schnorr verifier contract.
     * @param _pubKeyX X-coordinate of the public key.
     * @param _pubKeyYParity Parity of the Y-coordinate of the public key.
     */
    constructor(address _verifier, uint256 _pubKeyX, uint8 _pubKeyYParity) {
        verifier = ISchnorrVerifier(_verifier);
        pubKeyX = _pubKeyX;
        pubKeyYParity = _pubKeyYParity;
    }

    /**
     * @dev Sets the Schnorr verifier contract address.
     * @param _verifier Address of the new verifier contract.
     */
    function setVerifier(address _verifier) external onlyOwner {
        verifier = ISchnorrVerifier(_verifier);
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
     * @param dest The destination address for the withdrawal.
     * @param nonce The user's nonce.
     * @param signature The Schnorr signature.
     * @param nonceTimesGeneratorAddress The address used in Schnorr signature generation.
     */
    function withdraw(
        address tokenAddress,
        uint256 amount,
        uint256 user,
        address dest,
        uint256 nonce,
        uint256 signature,
        address nonceTimesGeneratorAddress
    ) external {
        if (nonce != getNonce(user)) revert InvalidNonce(nonce, getNonce(user));

        uint256 msgHash = uint256(keccak256(abi.encodePacked(user, dest, tokenAddress, amount, nonce)));

        if (!verifier.verifySignature(pubKeyX, pubKeyYParity, signature, msgHash, nonceTimesGeneratorAddress)) {
            revert InvalidSignature();
        }

        setNonce(user, nonce + 1);

        IERC20(tokenAddress).safeTransferFrom(address(this), dest, amount);
        emit Withdrawal(tokenAddress, dest, amount);
    }
}
