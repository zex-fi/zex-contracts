// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MockERC20 is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    error ZeroAddress();
    error InvalidAmount();

    uint8 private _decimal;

    constructor(string memory name, string memory symbol, uint8 decimal, address admin) ERC20(name, symbol) {
        if (admin == address(0)) revert ZeroAddress();
        if (decimal == 0) revert InvalidAmount();

        _decimal = decimal;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimal;
    }
}