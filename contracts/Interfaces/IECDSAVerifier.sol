// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IECDSAVerifier {
    /**
     * @dev Recovers the signer address from the given message hash and signature.
     * @param messageHash Hash of the signed message (prefixed with "\x19Ethereum Signed Message:\n32").
     * @param signature The signature to verify.
     * @return recoveredSigner The address of the recovered signer.
     */
    function getSigner(
        bytes32 messageHash,
        bytes memory signature
    ) external pure returns (address recoveredSigner);

    /**
     * @dev Computes the hash of the message with Ethereum's prefixed format.
     * @param message The original message.
     * @return messageHash The hash of the prefixed message.
     */
    function getMessageHash(string memory message) external pure returns (bytes32 messageHash);
}
