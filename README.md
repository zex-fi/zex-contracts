# Technical README: Vault & Deterministic Deposit Infrastructure

This documentation provides a comprehensive technical overview of the smart contract suite designed for secure asset management and deterministic deposit address generation.

---

## 1. System Architecture

The system is built around a centralized high-security **Vault** and a factory for deploying user-specific **Deposit** contracts. It utilizes a defense-in-depth signature model to authorize withdrawals.

### Core Components

* **Vault.sol**: The primary asset hub, utilizing upgradeable logic and multi-signature authorization.


* **UserDepositFactory.sol**: Employs the `CREATE2` opcode to deploy `UserDeposit` contracts at deterministic addresses.


* **UserDeposit.sol**: Individualized instances that hold user funds until they are "swept" into the Vault by an authorized operator.


* **SchnorrSECP256K1Verifier.sol**: Validates primary threshold signatures (FROST).


* **ECDSAVerifier.sol**: Validates secondary "Shield" signatures for redundant security.



---

## 2. Multi-Layered Security Model

The system enforces two independent cryptographic layers to authorize any withdrawal:

### Layer 1: Threshold Schnorr Signature

The primary authorization is a Schnorr signature, typically generated via the **FROST (Flexible Round-Optimized Schnorr Threshold)** algorithm.

* The `SchnorrSECP256K1Verifier` "abuses" the EVM `ecrecover` precompile to perform efficient elliptic curve point multiplication.


* **Constraint**: The public key -coordinate must be less than  to ensure compatibility with Ethereum's signature malleability protections.



### Layer 2: ECDSA "Shield" Signature

As a secondary layer of security, the system requires an **ECDSA Shield Signature**.

* This acts as a failsafe if the threshold Schnorr signature mechanism is compromised or fails.


* The signature must be produced by an account holding the `SIGNER_ROLE` within the Vault.



---

## 3. Workflow Specifications

### Deterministic Deployment

The `UserDepositFactory` allows off-chain services to predict a user's deposit address before the contract is even deployed on-chain.

1. **Salt Generation**: A unique `uint256` salt is provided.


2. **Address Derivation**: .



### Asset Sweeping

Tokens deposited into a `UserDeposit` instance are not permanently held there.

* An **Operator** triggers `transferERC20`, `transferERC721`, or `transferNativeToken`.


* Funds are strictly moved to the `vault` address configured in the factory.



### Withdrawal Process

To withdraw from the `Vault`, a recipient must provide:

1. A `withdrawalId` to prevent replay attacks.


2. A valid Schnorr signature  matching the stored `pubKey`.


3. A valid ECDSA shield signature.



---

## 4. Access Control Matrix

| Role | Responsibility |
| --- | --- |
| **DEFAULT_ADMIN_ROLE** | Absolute admin power, managing all other roles. |
| **SIGNER_ROLE** | Authorized to issue the ECDSA Shield signatures. |
| **OPERATOR_ROLE** | Authorized to sweep funds from Deposit contracts to the Vault. |
| **SETTER_ROLE** | Authorized to update verifier contracts and public keys. |
| **PAUSER_ROLE** | Authorized to halt/resume Vault withdrawals in an emergency. |
| **EMERGENCY_WITHDRAW_ROLE** | Authorized to recover funds directly if the signature logic is unavailable. |

---

## 5. Implementation Notes for Auditors

* **Malleability**: The `SchnorrSECP256K1Verifier` explicitly checks that  and  to prevent signature manipulation.


* **Zero-Input Protection**: The system forbids zero values for `pubKeyX`, `s`, and `msgHash` to prevent `ecrecover` from returning the null address, which could lead to unauthorized withdrawals.


* **Chain ID Binding**: The withdrawal hash includes `block.chainid` to ensure signatures cannot be replayed on forks or other EVM networks.
