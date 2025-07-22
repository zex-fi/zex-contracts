// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ISchnorrSECP256K1Verifier} from "./Interfaces/ISchnorrSECP256K1Verifier.sol";
import {IECDSAVerifier} from "./Interfaces/IECDSAVerifier.sol";

contract TronVault is
    Initializable,
    AccessControl
{
    using SafeERC20 for IERC20;

    bytes32 public constant EMERGENCY_WITHDRAW_ROLE = keccak256("EMERGENCY_WITHDRAW_ROLE");
    bytes32 public constant SETTER_ROLE = keccak256("SETTER_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    /// @dev Public key components for Schnorr signature verification.
    bytes public pubKey;

    /// @dev Schnorr verifier contract instance.
    ISchnorrSECP256K1Verifier public schnorrVerifier;

    /// @dev ECDSA verifier contract instance.
    IECDSAVerifier public ecdsaVerifier;

    /// @dev WithdrawalId to differentiate between signatures and secure the contrat against reply attack.
    mapping(uint256 => bool) public withdrawalIdIsUsed;

    // Events
    event Withdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event EmergencyWithdrawal(address indexed tokenAddress, address indexed to, uint256 amount);
    event PublicKeySet(bytes indexed pubKey);
    event VerifiersSet(address indexed schnorrVerifier, address indexed ecdsaVerifier);
    event WithdrawalIdReset(uint256 index);

    /**
     * @dev Initializes the Vault with a Schnorr verifier and public key components.
     * @param schnorrVerifier_ Address of the Schnorr verifier contract.
     * @param ecdsaVerifier_ Address of the ECDSA verifier contract.
     * @param signer_ The signer for ECDSA signature.
     * @param pubKey_ The public key.
     */
    constructor(address admin_, address schnorrVerifier_, address ecdsaVerifier_, address signer_, bytes memory pubKey_) {
        schnorrVerifier = ISchnorrSECP256K1Verifier(schnorrVerifier_);
        ecdsaVerifier = IECDSAVerifier(ecdsaVerifier_);
        pubKey = pubKey_;

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
     * @dev Resets the used W\withdrawal ID.
     * @notice This function is only for test in development phase and should be removed in production
     * @param index_ To reset the used withdrawal ID from 0
     */
    function resetWithdrawalID(uint256 index_) external onlyRole(SETTER_ROLE) {
        for(uint256 i = 0; i <= index_; i++){
            withdrawalIdIsUsed[i] = false;
        }
        emit WithdrawalIdReset(index_);
    }

    /**
     * @dev Updates the public key components.
     * @param pubKey_ The new public key.
     */
    function setPublicKey(bytes calldata pubKey_) external onlyRole(SETTER_ROLE) {
        pubKey = pubKey_;
        emit PublicKeySet(pubKey_);
    }

    // Fallback function to receive native tokens
    receive() external payable {}

    /**
     * @dev Allows a user to withdraw tokens after verifying the Schnorr signature.
     * @param tokenAddress_ The address of the ERC20 token to withdraw.
     * @param amount_ The amount of tokens to withdraw.
     * @param recipient_ The recipient address for the withdrawal.
     * @param withdrawalId_ The user's withdrawal ID.
     * @param signature_ The Schnorr signature.
     * @param shieldSignature_ The shield signature.
     */
    function withdraw(
        address tokenAddress_,
        uint256 amount_,
        address recipient_,
        uint256 withdrawalId_,
        bytes calldata signature_,
        bytes calldata shieldSignature_
    ) external {
        require(recipient_ != address(0), "Transfer to Zero Address");
        require(withdrawalIdIsUsed[withdrawalId_] == false, "Invalid Withdrawal Id");

        bytes32 msgHash = keccak256(
            abi.encodePacked(recipient_, tokenAddress_, amount_, withdrawalId_, block.chainid)
        );

        require(
            schnorrVerifier.verifySignature(pubKey, signature_, uint256(msgHash)) &&
            hasRole(SIGNER_ROLE, ecdsaVerifier.getSigner(msgHash, shieldSignature_)),
            "Invalid Signature"
        );

        withdrawalIdIsUsed[withdrawalId_] = true;

        if(tokenAddress_ == address(0)){
            (bool success, ) = recipient_.call{value: amount_}("");
            require(success, "Token Transfer Failed");
        }
        else IERC20(tokenAddress_).safeTransfer(recipient_, amount_);
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
        require(recipient_ != address(0), "Transfer to Zero Address");
        if(tokenAddress_ == address(0)){
            (bool success, ) = recipient_.call{value: amount_}("");
            require(success, "Token Transfer Failed");
        }
        else IERC20(tokenAddress_).safeTransfer(recipient_, amount_);
        emit EmergencyWithdrawal(tokenAddress_, recipient_, amount_);
    }
}
