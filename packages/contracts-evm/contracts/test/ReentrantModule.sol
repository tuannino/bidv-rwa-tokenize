// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC3643Module} from "../interfaces/IERC3643Module.sol";

interface IReentrantVault {
    function settleBuy(
        bytes32 orderRef,
        address investor,
        uint256 wptAmount,
        uint256 vndbAmount,
        uint256 price
    ) external;
}

/** @notice Module độc hại chỉ dùng để chứng minh settleBuy chống gọi lồng. */
contract ReentrantModule is IERC3643Module {
    IReentrantVault public immutable vault;
    bytes32 public orderRef;
    address public investor;
    uint256 public wptAmount;
    uint256 public vndbAmount;
    uint256 public price;
    bool public armed;

    constructor(address vault_) {
        vault = IReentrantVault(vault_);
    }

    function arm(
        bytes32 orderRef_,
        address investor_,
        uint256 wptAmount_,
        uint256 vndbAmount_,
        uint256 price_
    ) external {
        orderRef = orderRef_;
        investor = investor_;
        wptAmount = wptAmount_;
        vndbAmount = vndbAmount_;
        price = price_;
        armed = true;
    }

    function moduleTransferAction(address, address, uint256) external override {
        if (armed) vault.settleBuy(orderRef, investor, wptAmount, vndbAmount, price);
    }

    function moduleMintAction(address, uint256) external override {}
    function moduleBurnAction(address, uint256) external override {}

    function moduleCheck(address, address, uint256, address)
        external
        pure
        override
        returns (bool)
    {
        return true;
    }

    function name() external pure override returns (string memory) {
        return "ReentrantModule";
    }
}
