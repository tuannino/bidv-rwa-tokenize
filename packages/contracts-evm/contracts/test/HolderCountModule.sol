// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC3643Module} from "../interfaces/IERC3643Module.sol";

/** @dev Test-only: gắn trước khi mint; deploy.js không triển khai module này. */
contract HolderCountModule is IERC3643Module {
    IERC20 public immutable token;
    address public immutable compliance;
    uint256 public holderCount;
    mapping(address => bool) private counted;

    error OnlyCompliance(address caller);

    constructor(address token_, address compliance_) {
        token = IERC20(token_);
        compliance = compliance_;
    }

    modifier onlyCompliance() {
        if (msg.sender != compliance) revert OnlyCompliance(msg.sender);
        _;
    }

    function _sync(address wallet) private {
        if (wallet == address(0)) return;
        bool holds = token.balanceOf(wallet) > 0;
        if (holds == counted[wallet]) return;
        counted[wallet] = holds;
        if (holds) ++holderCount;
        else --holderCount;
    }

    function moduleTransferAction(address from, address to, uint256) external override onlyCompliance {
        _sync(from);
        _sync(to);
    }

    function moduleMintAction(address to, uint256) external override onlyCompliance { _sync(to); }
    function moduleBurnAction(address from, uint256) external override onlyCompliance { _sync(from); }
    function moduleCheck(address, address, uint256, address) external pure override returns (bool) { return true; }
    function name() external pure override returns (string memory) { return "HolderCountModule"; }
}
