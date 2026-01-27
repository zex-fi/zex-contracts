// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ECDSAVerifier {
    /**
     * @dev Recovers the signer address from the given message hash and signature.
     * @param messageHash Hash of the raw data (will be prefixed with "\x19Ethereum Signed Message:\n32" internally).
     * @param signature The signature to verify.
     * @return recoveredSigner The address of the recovered signer.
     */
    function getSigner(
        bytes32 messageHash,
        bytes memory signature
    ) public pure returns (address recoveredSigner) {
        // Signature consists of r, s, and v
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        // Extract r, s, v from the signature
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        // Prevents signature malleability by requiring 's' to be in the lower half of the curve order
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Invalid signature 's' value");

        // Adjust v for compatibility with `ecrecover`
        if (v < 27) {
            v += 27;
        }

        // Ensure v is valid
        require(v == 27 || v == 28, "Invalid v value");

        // Recover the signer address
        recoveredSigner = ecrecover(getEthSignedMessageHash(messageHash), v, r, s);

        // ecrecover returns address(0) on error
        require(recoveredSigner != address(0), "Invalid signature");
    }

    /**
     * @dev Helper to prefix the hashed message for Ethereum signature compatibility.
     * @param msgHash The hashed message.
     * @return prefixedMessageHash Hash of the prefixed message.
     */
    function getEthSignedMessageHash(bytes32 msgHash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
    }
}