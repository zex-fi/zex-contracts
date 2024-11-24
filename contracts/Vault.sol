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
     * @dev Updates the nonce.
     * @notice This function is just for test
     * @param _nonce The new nonce.
     */
    function setNonce(uint256 _nonce) public onlyOwner {
        nonce = _nonce;
        emit NonceSet(nonce);
    }

    /**
     * @dev Allows a user to withdraw tokens after verifying the Schnorr signature.
     * @param _tokenAddress The address of the ERC20 token to withdraw.
     * @param _amount The amount of tokens to withdraw.
     * @param _user The user ID.
     * @param _recipient The recipient address for the withdrawal.
     * @param _nonce The user's nonce.
     * @param _signature The Schnorr signature.
     * @param _nonceTimesGeneratorAddress The address used in Schnorr signature generation.
     */
    function withdraw(
        address _tokenAddress,
        uint256 _amount,
        uint256 _user,
        address _recipient,
        uint256 _nonce,
        uint256 _signature,
        address _nonceTimesGeneratorAddress
    ) external {
        if (_nonce != nonce) revert InvalidNonce(_nonce, nonce);

        uint256 msgHash = uint256(keccak256(abi.encodePacked(_user, _recipient, _tokenAddress, _amount, _nonce)));

        if (!verifier.verifySignature(pubKeyX, pubKeyYParity, _signature, msgHash, _nonceTimesGeneratorAddress)) {
            revert InvalidSignature();
        }

        nonce = nonce + 1;

        IERC20Upgradeable(_tokenAddress).safeTransfer(_recipient, _amount);
        emit Withdrawal(_tokenAddress, _recipient, _amount);
    }

    /**
     * @dev Allows the owner to emergency withdraw tokens.
     * @param _tokenAddress The address of the ERC20 token to withdraw.
     * @param _amount The amount of tokens to withdraw..
     * @param _recipient The recipient address for the withdrawal.
     */
    function emergencyWithdrawERC20(
        address _tokenAddress,
        uint256 _amount,
        address _recipient
    ) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        IERC20Upgradeable(_tokenAddress).safeTransfer(_recipient, _amount);
        emit EmergencyWithdrawal(_tokenAddress, _recipient, _amount);
    }
}
