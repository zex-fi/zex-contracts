// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ECDSAVerifier {
    /**
     * @dev Recovers the signer address from the given message hash and signature.
     * @param messageHash Hash of the signed message (prefixed with "\x19Ethereum Signed Message:\n32").
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

        // Adjust v for compatibility with `ecrecover`
        if (v < 27) {
            v += 27;
        }

        // Ensure v is valid
        require(v == 27 || v == 28, "Invalid v value");

        // Recover the signer address
        recoveredSigner = ecrecover(getEthSignedMessageHash(messageHash), v, r, s);
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
