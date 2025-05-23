// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./UserDepositFactory.sol";

contract UserDeposit is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTER_ROLE = keccak256("SETTER_ROLE");

    // Custom errors
    error ZeroAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error TransferFailed();
    error ImproperRole();
    error ContractNotTokenOwner();

    // Event to log ERC20 token transfers
    event ERC20Transferred(address indexed token, address indexed vault, uint256 amount);

    // Event to log ERC721 token transfers
    event ERC721Transferred(address indexed token, address indexed vault, uint256 tokenId);

    // Event to log native token transfers (e.g., Ether)
    event NativeTokenTransferred(address indexed vault, uint256 amount);

    event FactoryAddressSet(address indexed factoryAddress);

    address factoryAddress;

    modifier isOperator(address caller){
        bytes32 operatorRole = UserDepositFactory(factoryAddress).OPERATOR_ROLE();
        if (!UserDepositFactory(factoryAddress).hasRole(operatorRole, caller)) revert ImproperRole();
        _;
    }

    constructor(address defaultAdmin, address factory) {
        if (defaultAdmin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(SETTER_ROLE, msg.sender);
        setFactoryAddress(factory);
        _revokeRole(SETTER_ROLE, msg.sender);
    }

    // Function to transfer ERC20 tokens
    function transferERC20(address _token, uint256 _amount) external isOperator(msg.sender) nonReentrant {
        if (_amount == 0) revert InvalidAmount();

        IERC20 token = IERC20(_token);
        if (token.balanceOf(address(this)) < _amount) revert InsufficientBalance();
        address vault = UserDepositFactory(factoryAddress).vault();
        token.safeTransfer(vault, _amount);

        emit ERC20Transferred(_token, vault, _amount);
    }

    // Function to transfer ERC721 tokens
    function transferERC721(address _token, uint256 _tokenId) external isOperator(msg.sender) nonReentrant {
        IERC721 token = IERC721(_token);
        if (token.ownerOf(_tokenId) != address(this)) revert ContractNotTokenOwner();

        address vault = UserDepositFactory(factoryAddress).vault();
        token.safeTransferFrom(address(this), vault, _tokenId);

        emit ERC721Transferred(_token, vault, _tokenId);
    }

    // Function to withdraw native tokens (e.g., Ether)
    function transferNativeToken(uint256 _amount) external isOperator(msg.sender) {
        if (_amount == 0) revert InvalidAmount();
        if (address(this).balance < _amount) revert InsufficientBalance();

        address vault = UserDepositFactory(factoryAddress).vault();
        (bool success, ) = vault.call{value: _amount}("");
        if (!success) revert TransferFailed();

        emit NativeTokenTransferred(vault, _amount);
    }

    // Fallback function to receive native tokens
    receive() external payable {}

    // Function to allow the contract to receive ERC721 tokens
    function onERC721Received(address, address, uint256, bytes memory) public pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function setFactoryAddress(address _factoryAddress) public onlyRole(SETTER_ROLE) {
        if (_factoryAddress == address(0)) revert ZeroAddress();
        factoryAddress = _factoryAddress;
        emit FactoryAddressSet(_factoryAddress);
    }
}
