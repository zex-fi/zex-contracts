// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

interface ISchnorrSECP256K1Verifier {
    /**
     * @notice Verifies a Schnorr signature.
      @param publicKey is signer public key. This publicKey's x must be less than HALF_Q.
      @param signature fist 32 bytes is challenge and the second 32 bytes is signature
      @param msgHash is a 256-bit hash of the message being signed.
      @param nonceAddress is the nonce address of signature
     */
     function verifySignature(
        bytes calldata publicKey,
        bytes calldata signature,
        uint256 msgHash,
        address nonceAddress
    ) external pure returns (bool);
}
