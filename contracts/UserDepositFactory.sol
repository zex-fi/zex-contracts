// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./UserDeposit.sol";
import "hardhat/console.sol";

contract UserDepositFactory is AccessControl{

    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant SETTER_ROLE = keccak256("SETTER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    error ZeroAddress();

    event Deployed(address indexed addr, uint256 salt);
    event VaultSet(address indexed vault);

    address public defaultAdminAddress;
    address public vault;

     constructor(address deployer_, address defaultAdmin_, address operator_, address vault_) {
         if (
             deployer_ == address(0) ||
             defaultAdmin_ == address(0) ||
             operator_ == address(0) ||
             vault_ == address(0)
         ) revert ZeroAddress();

         _grantRole(DEFAULT_ADMIN_ROLE, deployer_);
         _grantRole(DEPLOYER_ROLE, deployer_);
         _grantRole(OPERATOR_ROLE, operator_);

         defaultAdminAddress = defaultAdmin_;

         _grantRole(SETTER_ROLE, msg.sender);
         setVault(vault_);
         _revokeRole(SETTER_ROLE, msg.sender);
     }

    function deploy(uint256 salt) external onlyRole(DEPLOYER_ROLE) returns (address userDepositAddress) {
        bytes memory bytecode = getBytecode(defaultAdminAddress, address(this));

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
        // Get the bytecode of the contract to be deployed, including constructor arguments
        bytes memory bytecode = getBytecode(defaultAdminAddress, address(this));

        // Compute the address using CREATE2 formula
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );

        // Cast the hash to address
        return address(uint160(uint256(hash)));
    }

    function getBytecode(
        address defaultAdmin_,
        address vault_
    ) public pure returns (bytes memory) {
        bytes memory bytecode = type(UserDeposit).creationCode;
        return abi.encodePacked(bytecode, abi.encode(defaultAdmin_, vault_));
    }

    function setVault(address vault_) public onlyRole(SETTER_ROLE) {
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
        emit VaultSet(vault_);
    }
}
