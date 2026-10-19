// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISpvPaymentVaultMatcher {
    function settleBuy(
        bytes32 orderRef,
        address investor,
        uint256 wptAmount,
        uint256 vndbAmount,
        uint256 price
    ) external;

    function settleSell(
        bytes32 orderRef,
        address investor,
        uint256 wptAmount,
        uint256 vndbAmount,
        uint256 price
    ) external;
}

/** @notice Mẫu kiểm thử hai chân nguyên tử; SC-03 sẽ thay bằng matcher thật. */
contract TestMatcher {
    using SafeERC20 for IERC20;

    ISpvPaymentVaultMatcher public immutable vault;
    IERC20 public immutable projectToken;
    IERC20 public immutable paymentToken;

    constructor(address vault_, address projectToken_, address paymentToken_) {
        vault = ISpvPaymentVaultMatcher(vault_);
        projectToken = IERC20(projectToken_);
        paymentToken = IERC20(paymentToken_);
    }

    function buy(bytes32 orderRef, uint256 wptAmount, uint256 vndbAmount, uint256 price) external {
        paymentToken.safeTransferFrom(msg.sender, address(vault), vndbAmount);
        vault.settleBuy(orderRef, msg.sender, wptAmount, vndbAmount, price);
    }

    function sell(bytes32 orderRef, uint256 wptAmount, uint256 vndbAmount, uint256 price) external {
        projectToken.safeTransferFrom(msg.sender, address(vault), wptAmount);
        vault.settleSell(orderRef, msg.sender, wptAmount, vndbAmount, price);
    }
}
