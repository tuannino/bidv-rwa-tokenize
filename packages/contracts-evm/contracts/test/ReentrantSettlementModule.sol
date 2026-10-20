// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC3643Module} from "../interfaces/IERC3643Module.sol";

interface IReentrantSettlement {
    function sell(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount) external;
}

/** @dev Test-only module. It disarms before re-entering so a missing guard fails deterministically. */
contract ReentrantSettlementModule is IERC3643Module {
    IReentrantSettlement public immutable settlement;
    bytes32 public orderRef;
    address public investor;
    uint256 public wptAmount;
    uint256 public vndbAmount;
    bool public armed;

    constructor(address settlement_) {
        settlement = IReentrantSettlement(settlement_);
    }

    function arm(bytes32 orderRef_, address investor_, uint256 wptAmount_, uint256 vndbAmount_) external {
        orderRef = orderRef_;
        investor = investor_;
        wptAmount = wptAmount_;
        vndbAmount = vndbAmount_;
        armed = true;
    }

    function moduleTransferAction(address, address, uint256) external override {
        if (!armed) return;
        armed = false;
        settlement.sell(orderRef, investor, wptAmount, vndbAmount);
    }

    function moduleMintAction(address, uint256) external override {}
    function moduleBurnAction(address, uint256) external override {}

    function moduleCheck(address, address, uint256, address) external pure override returns (bool) {
        return true;
    }

    function name() external pure override returns (string memory) {
        return "ReentrantSettlementModule";
    }
}
