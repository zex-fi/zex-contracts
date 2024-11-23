// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

interface ISchnorrSECP256K1Verifier {
    /**
     * @notice Verifies a Schnorr signature.
     * @param signingPubKeyX The x ordinate of the public key (must be < HALF_Q).
     * @param pubKeyYParity Parity of the y ordinate of the public key (0 for even, 1 for odd).
     * @param signature The signature (s) to verify.
     * @param msgHash The hash of the signed message.
     * @param nonceTimesGeneratorAddress Ethereum address of k*g.
     * @return True if the signature is valid, false otherwise.
     */
    function verifySignature(
        uint256 signingPubKeyX,
        uint8 pubKeyYParity,
        uint256 signature,
        uint256 msgHash,
        address nonceTimesGeneratorAddress
    ) external pure returns (bool);

    /**
     * @notice Validates that the x ordinate of the public key is less than HALF_Q.
     * @param signingPubKeyX The x ordinate of the public key to validate.
     */
    function validatePubKey(uint256 signingPubKeyX) external pure;
}
