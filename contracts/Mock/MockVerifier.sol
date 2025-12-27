// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockVerifier {
    address public immutable signerAddress;

    constructor(address _signerAddress) {
        signerAddress = _signerAddress;
    }

    // Always returns true for Schnorr
    function verifySignature(bytes calldata, bytes calldata, uint256) external pure returns (bool) {
        return true;
    }

    // Always returns the trusted signer address for ECDSA
    function getSigner(bytes32, bytes calldata) external view returns (address) {
        return signerAddress;
    }
}