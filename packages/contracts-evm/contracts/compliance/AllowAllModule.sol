// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC3643Module} from "../interfaces/IERC3643Module.sol";

/** @notice Default PoC compliance module. It records no state and accepts every movement. */
contract AllowAllModule is IERC3643Module {
    function moduleTransferAction(address, address, uint256) external pure override {}
    function moduleMintAction(address, uint256) external pure override {}
    function moduleBurnAction(address, uint256) external pure override {}

    function moduleCheck(address, address, uint256, address) external pure override returns (bool) {
        return true;
    }

    function name() external pure override returns (string memory) {
        return "AllowAllModule";
    }
}
