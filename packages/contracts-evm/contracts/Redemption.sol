// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ProjectToken} from "./tokens/ProjectToken.sol";

/**
 * @title Redemption
 * @notice Mua lại / hoàn vốn: nhà đầu tư đưa WPT vào, hợp đồng đốt WPT và trả VND theo tỷ giá.
 *
 *  Luồng:
 *   - Ngân hàng nạp thanh khoản VND vào hợp đồng bằng fund().
 *   - Nhà đầu tư approve WPT cho hợp đồng, rồi gọi redeem(wptAmount).
 *   - Hợp đồng đốt WPT (burnFrom, cần allowance) và chuyển VND = wptAmount * rate cho nhà đầu tư.
 *
 *  rate = số VND cho mỗi 1 WPT (theo đơn vị nhỏ nhất của mỗi token).
 */
contract Redemption is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    ProjectToken public immutable projectToken;
    IERC20 public immutable payoutToken; // VND

    uint256 public rate; // VND / 1 WPT
    bool public paused;

    event Redeemed(address indexed account, uint256 wptAmount, uint256 vndAmount);
    event RateUpdated(uint256 newRate);
    event PausedUpdated(bool status);
    event Funded(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address projectToken_, address payoutToken_, uint256 rate_, address admin) {
        require(projectToken_ != address(0) && payoutToken_ != address(0) && admin != address(0), "zero addr");
        projectToken = ProjectToken(projectToken_);
        payoutToken = IERC20(payoutToken_);
        rate = rate_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    // --- Quản trị ---
    function setRate(uint256 newRate) external onlyRole(MANAGER_ROLE) {
        require(newRate > 0, "rate = 0");
        rate = newRate;
        emit RateUpdated(newRate);
    }

    function setPaused(bool status) external onlyRole(MANAGER_ROLE) {
        paused = status;
        emit PausedUpdated(status);
    }

    /// @notice Ngân hàng nạp thanh khoản VND (phải approve trước).
    function fund(uint256 amount) external onlyRole(MANAGER_ROLE) {
        payoutToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    /// @notice Ngân hàng rút VND dư khỏi hợp đồng.
    function withdraw(address to, uint256 amount) external onlyRole(MANAGER_ROLE) {
        payoutToken.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    // --- Báo giá ---
    function quote(uint256 wptAmount) public view returns (uint256) {
        return wptAmount * rate;
    }

    // --- Hoàn vốn ---
    /**
     * @notice Nhà đầu tư đổi WPT lấy VND. Cần approve WPT cho hợp đồng này trước.
     */
    function redeem(uint256 wptAmount) external nonReentrant returns (uint256 vndAmount) {
        require(!paused, "dang tam dung");
        require(wptAmount > 0, "wptAmount = 0");
        require(projectToken.isWhitelisted(msg.sender), "chua KYC");

        vndAmount = quote(wptAmount);
        require(payoutToken.balanceOf(address(this)) >= vndAmount, "thieu thanh khoan VND");

        // đốt WPT của nhà đầu tư (tiêu allowance mà nhà đầu tư đã cấp)
        projectToken.burnFrom(msg.sender, wptAmount);
        // trả VND
        payoutToken.safeTransfer(msg.sender, vndAmount);

        emit Redeemed(msg.sender, wptAmount, vndAmount);
    }
}
