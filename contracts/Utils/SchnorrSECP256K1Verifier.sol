// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

contract SchnorrSECP256K1Verifier {
    uint256 public constant Q =
        // Group order of secp256k1
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    uint256 public constant P = 
        // Field modulus of secp256k1
        P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;

    // BIP-0340 challenge hash TAG
    bytes32 public constant TAG_CHALLENGE_HASH = sha256("BIP0340/challenge");

    /** **************************************************************************
      @dev    verifySignature(publicKey, signature, msgHash, nonceAddress)
      **************************************************************************
      @notice This function verifies a Schnorr signature over secp256k1
              in the style of BIP-340 (Taproot).  
              It assumes the public key is **x-only and canonically normalized**
              with an **even y-coordinate**. Odd-Y public keys are invalid
              and must be negated by the signer before signing.
              
      @param publicKey is signer public key in compressed 33 bytes form.
                       The first byte encodes parity (must be even-Y for Taproot).
      @param signature fist 32 bytes is K (nonce publicKey's x) and the secound 32 bytes is signature
      @param msgHash is a 256-bit hash of the message being signed.
      @param nonceAddress is the ethereum address of k*g
      **************************************************************************
      @return True if passed a valid signature, false otherwise. */

    function verifySignature(
        bytes calldata publicKey,
        bytes calldata signature,
        uint256 msgHash,
        address nonceAddress
    ) public pure returns (bool) {
        require(publicKey.length == 33, "Public key must be 33 bytes");
        require(signature.length == 64, "Signature must be 64 bytes");

        // https://ethereum.github.io/yellowpaper/paper.pdf p. 24, "The
        // value 27 represents an even y value and 28 represents an odd
        // y value."
        uint8 pubKeyYParity = uint8(publicKey[0]) - 2 + 27;

        // BIP-340 / Taproot uses x-only public keys with a canonical lift:
        // the y-coordinate MUST be even. If a secp256k1 public key has odd y,
        // it is negated (P -> -P) by the signer before signing.
        //
        // Ethereum's ecrecover uses:
        //   27 => even y
        //   28 => odd y
        //
        // Therefore, odd-y public keys (28) are incompatible with Taproot-style
        // Schnorr verification. Only even-y public keys (27) are accepted here.
        require(pubKeyYParity == 27, "Invalid parity bit");

        uint256 pubKeyX = uint256(bytes32(publicKey[1:33]));
        require(pubKeyX < P, "pubKeyX out of field range");

        uint256 R = uint256(bytes32(signature[0:32]));
        uint256 s = uint256(bytes32(signature[32:64]));

        require(R < P, "signature R out of field range");

        // Avoid signature malleability from multiple representations for ℤ/Qℤ elts
        require(s < Q, "signature must be reduced modulo Q");

        // Forbid trivial inputs
        require(R > 0 && pubKeyX > 0 && s > 0, "no zero inputs allowed");

        // compute BIP-0340 challenge
        // https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
        uint256 e = uint256(
            sha256(
                abi.encodePacked(
                    TAG_CHALLENGE_HASH,
                    TAG_CHALLENGE_HASH,
                    R,
                    pubKeyX,
                    msgHash
                )
            )
        ) % Q;

        // Verify the Schnorr equation: s*G == R + e*P, where:
        // - s is the signature scalar
        // - R is the nonce public key (x-coordinate of the ephemeral point)
        // - P is the signer public key
        // - e = sha256(BIP0340/challenge || R || pubKeyX || msgHash) mod Q
        //
        // We simulate elliptic curve multiplication using ecrecover as described here:
        // https://ethresear.ch/t/you-can-kinda-abuse-ecrecover-to-do-ecmul-in-secp256k1-today/2384/9
        // https://crypto.stackexchange.com/a/18106
        //
        // Specifically, in this implementation:
        // ecrecover(Q - s*pubKeyX, pubKeyYParity, pubKeyX, Q - e*pubKeyX)
        // returns an address corresponding to the point e*P + s*G.
        //
        // The recoveredAddress should match nonceAddress (the expected R*G) if the
        // signature is valid.
        address recoveredAddress = ecrecover(
            bytes32(Q - mulmod(pubKeyX, s, Q)),
            pubKeyYParity,
            bytes32(pubKeyX),
            bytes32(Q - mulmod(e, pubKeyX, Q))
        );

        require(recoveredAddress != address(0), "ecrecover failed");

        return recoveredAddress == nonceAddress;
    }
}
