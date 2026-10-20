// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISpvPaymentVault {
    function projectToken() external view returns (address);
    function paymentToken() external view returns (address);
    function isOrderSettled(bytes32 orderRef) external view returns (bool);
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

/**
 * @title OrderSettlement
 * @notice Khớp lệnh WPT/VNDB nguyên tử với SpvPaymentVault theo một giá công khai.
 * @dev Biên tin cậy của bản thử:
 *  - OPERATOR_ROLE chọn lệnh, nhà đầu tư và số lượng. Permit chỉ giới hạn số token được chi,
 *    không xác nhận giá, chiều hay orderRef.
 *  - PRICE_ROLE có thể đổi giá bất kỳ lúc nào. Lệnh chốt theo giá cũ sẽ revert PriceMismatch,
 *    không bị trừ tài sản theo giá mới.
 *  - Một khoá máy chủ giữ các vai admin/operator/price/pauser trong PoC.
 *  - Hợp đồng không giữ tài sản: chân vào đi thẳng nhà đầu tư -> vault, chân ra do vault trả.
 */
contract OrderSettlement is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PRICE_ROLE = keccak256("PRICE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct PermitData {
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    ISpvPaymentVault public immutable vault;
    IERC20 public immutable projectToken;
    IERC20 public immutable paymentToken;
    uint256 public price;

    event PriceSet(uint256 oldPrice, uint256 newPrice, address indexed operator);

    error ZeroAddress();
    error ZeroPrice();
    error OrderAlreadySettled(bytes32 orderRef);
    error PriceMismatch(uint256 expected, uint256 given);
    error PermitValueMismatch(uint256 expected, uint256 given);

    constructor(address vault_, address admin, uint256 initialPrice) {
        if (vault_ == address(0) || admin == address(0)) revert ZeroAddress();
        if (initialPrice == 0) revert ZeroPrice();
        vault = ISpvPaymentVault(vault_);
        projectToken = IERC20(ISpvPaymentVault(vault_).projectToken());
        paymentToken = IERC20(ISpvPaymentVault(vault_).paymentToken());
        price = initialPrice;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setPrice(uint256 newPrice) external onlyRole(PRICE_ROLE) {
        if (newPrice == 0) revert ZeroPrice();
        uint256 oldPrice = price;
        price = newPrice;
        emit PriceSet(oldPrice, newPrice, msg.sender);
    }

    function buy(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        _validate(orderRef, wptAmount, vndbAmount);
        _buy(orderRef, investor, wptAmount, vndbAmount);
    }

    function sell(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        _validate(orderRef, wptAmount, vndbAmount);
        _sell(orderRef, investor, wptAmount, vndbAmount);
    }

    function buyWithPermit(
        bytes32 orderRef,
        address investor,
        uint256 wptAmount,
        uint256 vndbAmount,
        PermitData calldata permitData
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        _validate(orderRef, wptAmount, vndbAmount);
        _permit(paymentToken, investor, vndbAmount, permitData);
        _buy(orderRef, investor, wptAmount, vndbAmount);
    }

    function sellWithPermit(
        bytes32 orderRef,
        address investor,
        uint256 wptAmount,
        uint256 vndbAmount,
        PermitData calldata permitData
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        _validate(orderRef, wptAmount, vndbAmount);
        _permit(projectToken, investor, wptAmount, permitData);
        _sell(orderRef, investor, wptAmount, vndbAmount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _validate(bytes32 orderRef, uint256 wptAmount, uint256 vndbAmount) private view {
        if (vault.isOrderSettled(orderRef)) revert OrderAlreadySettled(orderRef);
        uint256 expected = wptAmount * price;
        if (vndbAmount != expected) revert PriceMismatch(expected, vndbAmount);
    }

    function _permit(IERC20 token, address owner, uint256 expected, PermitData calldata p) private {
        if (p.value != expected) revert PermitValueMismatch(expected, p.value);
        try IERC20Permit(address(token)).permit(
            owner,
            address(this),
            p.value,
            p.deadline,
            p.v,
            p.r,
            p.s
        ) {} catch {}
    }

    function _buy(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount) private {
        paymentToken.safeTransferFrom(investor, address(vault), vndbAmount);
        vault.settleBuy(orderRef, investor, wptAmount, vndbAmount, price);
    }

    function _sell(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount) private {
        projectToken.safeTransferFrom(investor, address(vault), wptAmount);
        vault.settleSell(orderRef, investor, wptAmount, vndbAmount, price);
    }
}
