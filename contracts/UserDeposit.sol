// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract UserDeposit is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SETTER_ROLE = keccak256("SETTER_ROLE");

    // Custom errors
    error ZeroAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error TransferFailed();
    error ContractNotTokenOwner();

    // Event to log ERC20 token transfers
    event ERC20Transferred(address indexed token, address indexed to, uint256 amount);

    // Event to log ERC721 token transfers
    event ERC721Transferred(address indexed token, address indexed to, uint256 tokenId);

    // Event to log native token transfers (e.g., Ether)
    event NativeTokenTransferred(address indexed to, uint256 amount);

    event ToAddressSet(address indexed to);

    address toAddress;

    constructor(address defaultAdmin, address operator, address to) {
        if (defaultAdmin == address(0) || operator == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(SETTER_ROLE, msg.sender);
        setToAddress(to);
        _revokeRole(SETTER_ROLE, msg.sender);
    }

    // Function to transfer ERC20 tokens
    function transferERC20(address _token, uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        if (_amount == 0) revert InvalidAmount();

        IERC20 token = IERC20(_token);
        if (token.balanceOf(address(this)) < _amount) revert InsufficientBalance();

        bool success = token.transfer(toAddress, _amount);
        if (!success) revert TransferFailed();

        emit ERC20Transferred(_token, toAddress, _amount);
    }

    // Function to transfer ERC721 tokens
    function transferERC721(address _token, uint256 _tokenId) external onlyRole(OPERATOR_ROLE) {
        IERC721 token = IERC721(_token);
        if (token.ownerOf(_tokenId) != address(this)) revert ContractNotTokenOwner();

        token.safeTransferFrom(address(this), toAddress, _tokenId);

        emit ERC721Transferred(_token, toAddress, _tokenId);
    }

    // Function to withdraw native tokens (e.g., Ether)
    function transferNativeToken(uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        if (_amount == 0) revert InvalidAmount();
        if (address(this).balance < _amount) revert InsufficientBalance();

        (bool success, ) = toAddress.call{value: _amount}("");
        if (!success) revert TransferFailed();

        emit NativeTokenTransferred(toAddress, _amount);
    }

    // Fallback function to receive native tokens
    receive() external payable {}

    // Function to allow the contract to receive ERC721 tokens
    function onERC721Received(address, address, uint256, bytes memory) public virtual returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function setToAddress(address _to) public onlyRole(SETTER_ROLE) {
        if (_to == address(0)) revert ZeroAddress();
        toAddress = _to;
        emit ToAddressSet(_to);
    }
}
