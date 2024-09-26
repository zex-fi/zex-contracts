// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./UserDeposit.sol";
import "hardhat/console.sol";

contract UserDepositFactory is AccessControl{

    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    error ZeroAddress();

    event Deployed(address addr, uint256 salt);

    address public defaultAdminAddress;
    address public operatorAddress;
    address public toAddress;

     constructor(address deployer, address defaultAdmin, address operator, address to) {
         if (
             deployer == address(0) ||
             defaultAdmin == address(0) ||
             operator == address(0) ||
             to == address(0)
         ) revert ZeroAddress();

         _grantRole(DEFAULT_ADMIN_ROLE, deployer);
        _grantRole(DEPLOYER_ROLE, deployer);

         defaultAdminAddress = defaultAdmin;
         operatorAddress = operator;
         toAddress = to;
     }

    function deploy(uint256 salt) external onlyRole(DEPLOYER_ROLE) returns (address userDepositAddress) {
        bytes memory bytecode = getBytecode(defaultAdminAddress, operatorAddress, toAddress);

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
        bytes memory bytecode = getBytecode(defaultAdminAddress, operatorAddress, toAddress);

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
        address defaultAdmin,
        address operator,
        address to
    ) public pure returns (bytes memory) {
        bytes memory bytecode = type(UserDeposit).creationCode;
        return abi.encodePacked(bytecode, abi.encode(defaultAdmin, operator, to));
    }
}
