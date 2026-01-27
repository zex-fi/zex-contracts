// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./UserDeposit.sol";

contract UserDepositFactory is AccessControl {

    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant SETTER_ROLE = keccak256("SETTER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    error ZeroAddress();

    event Deployed(address indexed addr, uint256 salt);
    event VaultSet(address indexed vault);

    address public defaultAdminAddress;
    address public vault;

    constructor(address factoryAdmin_, address defaultAdmin_, address operator_, address vault_) {
        if (
            factoryAdmin_ == address(0) ||
            defaultAdmin_ == address(0) ||
            operator_ == address(0) ||
            vault_ == address(0)
        ) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, factoryAdmin_);
        _grantRole(DEPLOYER_ROLE, factoryAdmin_);
        _grantRole(OPERATOR_ROLE, operator_);

        defaultAdminAddress = defaultAdmin_;
        _setVault(vault_);
    }

    function deploy(uint256 salt) external onlyRole(DEPLOYER_ROLE) returns (address userDepositAddress) {
        bytes memory bytecode = getBytecode();

        // using inline assembly: load data and length of data, then call CREATE2.
        assembly { // solhint-disable-line
            let encoded_data := add(0x20, bytecode)     // load initialization code.
            let encoded_size := mload(bytecode)         // load the init code's length.
            userDepositAddress := create2(              // call CREATE2 with 4 arguments.
                callvalue(),                            // forward any attached value.
                encoded_data,                           // pass in initialization code.
                encoded_size,                           // pass in init code's length.
                salt                                    // pass in the salt value.
            )
        }

        // ensure that the contract address is not equal to the null address.
        if (userDepositAddress == address(0)) revert ZeroAddress();

        emit Deployed(userDepositAddress, salt);
    }

    function getDeploymentAddress(
        uint256 salt
    ) public view returns (address) {
        // Compute the address using CREATE2 formula
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(getBytecode())
            )
        );

        // Cast the hash to address
        return address(uint160(uint256(hash)));
    }

    function getBytecode() public view returns (bytes memory) {
        bytes memory code = type(UserDeposit).creationCode;
        return abi.encodePacked(code, abi.encode(defaultAdminAddress, address(this)));
    }

    function getBytecodeHash() public view returns (bytes32) {
        return keccak256(getBytecode());
    }

    function setVault(address vault_) external onlyRole(SETTER_ROLE) {
        _setVault(vault_);
    }

    function _setVault(address vault_) internal {
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
        emit VaultSet(vault_);
    }
}
