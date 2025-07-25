// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

contract SchnorrSECP256K1Verifier {
    // See https://en.bitcoin.it/wiki/Secp256k1 for this constant.
    uint256 constant public Q = // Group order of secp256k1
    // solium-disable-next-line indentation
    0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    // solium-disable-next-line zeppelin/no-arithmetic-operations
    uint256 constant public HALF_Q = (Q >> 1) + 1;

    /** **************************************************************************
@notice verifySignature returns true iff passed a valid Schnorr signature.

      @dev See https://en.wikipedia.org/wiki/Schnorr_signature for reference.

      @dev In what follows, let d be your secret key, PK be your public key,
      PKx be the x ordinate of your public key, and PKyp be the parity bit for
      the y ordinate (i.e., 0 if PKy is even, 1 if odd.)
      **************************************************************************
      @dev TO CREATE A VALID SIGNATURE FOR THIS METHOD

      @dev First PKx must be less than HALF_Q. Then follow these instructions
           (see evm/test/schnorr_test.js, for an example of carrying them out):
      @dev 1. Hash the target message to a uint256, called msgHash here, using
              keccak256

      @dev 2. Pick k uniformly and cryptographically securely randomly from
              {0,...,Q-1}. It is critical that k remains confidential, as your
              private key can be reconstructed from k and the signature.

      @dev 3. Compute k*g in the secp256k1 group, where g is the group
              generator. (This is the same as computing the public key from the
              secret key k. But it's OK if k*g's x ordinate is greater than
              HALF_Q.)

      @dev 4. Compute the ethereum address for k*g. This is the lower 160 bits
              of the keccak hash of the concatenated affine coordinates of k*g,
              as 32-byte big-endians. (For instance, you could pass k to
              ethereumjs-utils's privateToAddress to compute this, though that
              should be strictly a development convenience, not for handling
              live secrets, unless you've locked your javascript environment
              down very carefully.) Call this address
              nonceTimesGeneratorAddress.

      @dev 5. Compute e=uint256(keccak256(PKx as a 32-byte big-endian
                                        ‖ PKyp as a single byte
                                        ‖ msgHash
                                        ‖ nonceTimesGeneratorAddress))
              This value e is called "msgChallenge" in verifySignature's source
              code below. Here "‖" means concatenation of the listed byte
              arrays.

      @dev 6. Let x be your secret key. Compute s = (k - d * e) % Q. Add Q to
              it, if it's negative. This is your signature. (d is your secret
              key.)
      **************************************************************************
      @dev TO VERIFY A SIGNATURE

      @dev Given a signature (s, e) of msgHash, constructed as above, compute
      S=e*PK+s*generator in the secp256k1 group law, and then the ethereum
      address of S, as described in step 4. Call that
      nonceTimesGeneratorAddress. Then call the verifySignature method as:

      @dev    verifySignature(PKx, PKyp, s, msgHash,
                              nonceTimesGeneratorAddress)
      **************************************************************************
      @dev This signging scheme deviates slightly from the classical Schnorr
      signature, in that the address of k*g is used in place of k*g itself,
      both when calculating e and when verifying sum S as described in the
      verification paragraph above. This reduces the difficulty of
      brute-forcing a signature by trying random secp256k1 points in place of
      k*g in the signature verification process from 256 bits to 160 bits.
      However, the difficulty of cracking the public key using "baby-step,
      giant-step" is only 128 bits, so this weakening constitutes no compromise
      in the security of the signatures or the key.

      @dev The constraint pubKeyX < HALF_Q comes from Eq. (281), p. 24
      of Yellow Paper version 78d7b9a. ecrecover only accepts "s" inputs less
      than HALF_Q, to protect against a signature- malleability vulnerability in
      ECDSA. Schnorr does not have this vulnerability, but we must account for
      ecrecover's defense anyway. And since we are abusing ecrecover by putting
      pubKeyX in ecrecover's "s" argument the constraint applies to
      pubKeyX, even though it represents a value in the base field, and
      has no natural relationship to the order of the curve's cyclic group.
      **************************************************************************
      @param publicKey is signer public key. This publicKey's x must be less than HALF_Q.
      @param signature fist 32 bytes is challange and the secound 32 bytes is signature
      @param msgHash is a 256-bit hash of the message being signed.
      **************************************************************************
      @return True if passed a valid signature, false otherwise. */
    function verifySignature(
        bytes calldata publicKey,
        bytes calldata signature,
        uint256 msgHash
    ) public pure returns (bool) {
        require(publicKey.length == 33, "Public key must be 33 bytes");
        require(signature.length == 64, "Signature must be 64 bytes");

        uint8 pubKeyYParity = uint8(publicKey[0]) - 2 + 27;
        require(pubKeyYParity == 27 || pubKeyYParity == 28, "Invalid parity bit");
        uint256 pubKeyX = uint256(bytes32(publicKey[1 : 33]));
        require(pubKeyX < HALF_Q, "Public-key x >= HALF_Q");

        uint256 e = uint256(bytes32(signature[0 : 32]));
        uint256 s = uint256(bytes32(signature[32 : 64]));
        // Avoid signature malleability from multiple representations for ℤ/Qℤ elts
        require(s < Q, "signature must be reduced modulo Q");

        // Forbid trivial inputs, to avoid ecrecover edge cases. The main thing to
        // avoid is something which causes ecrecover to return 0x0: then trivial
        // signatures could be constructed with the nonceTimesGeneratorAddress input
        // set to 0x0.
        //
        // solium-disable-next-line indentation
        require(pubKeyX > 0 && s > 0 && msgHash > 0, "no zero inputs allowed");

        // Verify msgChallenge * pubKey + signature * generator ==
        //        nonce * generator
        //
        // https://ethresear.ch/t/you-can-kinda-abuse-ecrecover-to-do-ecmul-in-secp256k1-today/2384/9
        // The point corresponding to the address returned by
        // ecrecover(-s*r,v,r,e*r) is (r⁻¹ mod Q)*(e*r*R-(-s)*r*g)=e*R+s*g, where R
        // is the (v,r) point. See https://crypto.stackexchange.com/a/18106
        //
        // solium-disable-next-line indentation
        address recoveredAddress = ecrecover(
        // solium-disable-next-line zeppelin/no-arithmetic-operations
            bytes32(Q - mulmod(pubKeyX, s, Q)),
            // https://ethereum.github.io/yellowpaper/paper.pdf p. 24, "The
            // value 27 represents an even y value and 28 represents an odd
            // y value."
            pubKeyYParity,
            bytes32(pubKeyX),
            bytes32(Q - mulmod(e, pubKeyX, Q))
        );

        require(recoveredAddress != address(0), "ecrecover failed");

        return bytes32(e) == keccak256(abi.encodePacked(
            recoveredAddress,
            pubKeyYParity,
            pubKeyX,
            msgHash
        ));
    }

    function validatePubKey(uint256 pubKeyX) public pure {
        require(pubKeyX < HALF_Q, "Public-key x >= HALF_Q");
    }
}