// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ProjectToken} from "./tokens/ProjectToken.sol";

/**
 * @title SpvPaymentVault
 * @notice Giữ WPT/VNDB của SPV, quyết toán theo lệnh tin cậy và cưỡng chế phần VNDB được giữ lại.
 * @dev Các biên tin cậy của bản thử phải được hiểu trước khi cấp vai:
 *  - MATCHER_ROLE là đặc quyền: vault không tự chứng minh chân token vào; matcher phải kéo tài sản
 *    của nhà đầu tư vào vault trong cùng giao dịch trước khi gọi quyết toán.
 *  - Khoá ký máy chủ có thể dùng AGENT_ROLE của ProjectToken và BURNER_ROLE của VNDToken để chạm
 *    tài sản ngoài luật khoá; đường agent burn/forcedTransfer cố ý vẫn hoạt động.
 *  - DEFAULT_ADMIN_ROLE cấp được mọi vai và bản thử dùng cùng một khoá cho admin/withdrawer.
 *    payoutWallet chỉ ngăn nhập nhầm đích, không bảo vệ khi khoá máy chủ bị lộ.
 *  - closePeriod tin số distributedPrev do người có CONFIG_ROLE cung cấp.
 *  - PERCENT làm tròn xuống bằng Math.mulDiv. UNSET khoá toàn bộ để khoảng trống giữa triển khai và
 *    cấu hình rơi về phía an toàn; quyết toán mua/bán không bị tạm dừng cùng việc rút.
 */
contract SpvPaymentVault is AccessControlEnumerable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS_DENOMINATOR = 10_000;

    bytes32 public constant MATCHER_ROLE = keccak256("MATCHER_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum LockMode {
        UNSET,
        FIXED,
        PERCENT
    }

    enum Side {
        BUY,
        SELL
    }

    ProjectToken public immutable projectToken;
    IERC20 public immutable paymentToken;

    LockMode public lockMode;
    uint256 public fixedLockAmount;
    uint256 public percentRateBps;
    uint256 public pendingPercentRateBps;
    bool public hasPendingRate;
    uint256 public netProceeds;
    uint256 public lastPeriodRef;
    uint256 public lastDistributedPrev;
    uint256 public percentLocked;
    mapping(bytes32 => bool) public settledOrders;
    address public payoutWallet;

    event OrderSettled(
        bytes32 indexed orderRef,
        address indexed investor,
        Side side,
        uint256 wptAmount,
        uint256 vndbAmount,
        uint256 price
    );
    event LockModeChanged(LockMode mode);
    event FixedLockSet(uint256 amount);
    event PercentRateSet(uint256 bps, bool pending);
    event PeriodClosed(
        uint256 indexed periodRef,
        uint256 distributedPrev,
        uint256 rateBps,
        uint256 percentLocked,
        address indexed operator
    );
    event Withdrawn(address indexed to, uint256 amount, address indexed operator);
    event PayoutWalletSet(address wallet);

    error ZeroAddress();
    error ZeroAmount();
    error ZeroPrice();
    error ZeroOrderRef();
    error OrderAlreadySettled(bytes32 orderRef);
    error AmountPriceMismatch(uint256 wpt, uint256 vndb, uint256 price);
    error InvalidLockMode();
    error RateTooHigh(uint256 bps);
    error InvalidPeriodRef(uint256 expected, uint256 got);
    error PayoutWalletNotSet();
    error PayoutWalletNotVerified(address wallet);
    error ExceedsWithdrawable(uint256 requested, uint256 available);

    constructor(address projectToken_, address paymentToken_, address admin) {
        if (projectToken_ == address(0) || paymentToken_ == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }
        projectToken = ProjectToken(projectToken_);
        paymentToken = IERC20(paymentToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /** @notice Số VNDB bị khoá; có thể lớn hơn số dư hiện tại. */
    function lockedAmount() public view returns (uint256) {
        if (lockMode == LockMode.UNSET) return paymentToken.balanceOf(address(this));
        if (lockMode == LockMode.FIXED) return fixedLockAmount;
        if (lastPeriodRef == 0) {
            return Math.mulDiv(netProceeds, percentRateBps, BPS_DENOMINATOR);
        }
        return percentLocked;
    }

    /** @notice Phần VNDB vượt khoá; chặn ở 0 khi số dư thấp hơn phần khoá. */
    function withdrawable() public view returns (uint256) {
        uint256 balance = paymentToken.balanceOf(address(this));
        uint256 locked = lockedAmount();
        return balance > locked ? balance - locked : 0;
    }

    function isOrderSettled(bytes32 orderRef) external view returns (bool) {
        return settledOrders[orderRef];
    }

    function setLockMode(LockMode mode) external onlyRole(CONFIG_ROLE) {
        if (mode == LockMode.UNSET) revert InvalidLockMode();
        lockMode = mode;
        emit LockModeChanged(mode);
    }

    function setFixedLock(uint256 amount) external onlyRole(CONFIG_ROLE) {
        fixedLockAmount = amount;
        emit FixedLockSet(amount);
    }

    function setPercentRate(uint256 bps) external onlyRole(CONFIG_ROLE) {
        if (bps > BPS_DENOMINATOR) revert RateTooHigh(bps);
        if (lastPeriodRef == 0) {
            percentRateBps = bps;
            pendingPercentRateBps = 0;
            hasPendingRate = false;
            emit PercentRateSet(bps, false);
        } else {
            pendingPercentRateBps = bps;
            hasPendingRate = true;
            emit PercentRateSet(bps, true);
        }
    }

    function closePeriod(uint256 periodRef, uint256 distributedPrev) external onlyRole(CONFIG_ROLE) {
        uint256 expected = lastPeriodRef + 1;
        if (periodRef != expected) revert InvalidPeriodRef(expected, periodRef);
        if (hasPendingRate) {
            percentRateBps = pendingPercentRateBps;
            pendingPercentRateBps = 0;
            hasPendingRate = false;
        }
        percentLocked = Math.mulDiv(distributedPrev, percentRateBps, BPS_DENOMINATOR);
        lastPeriodRef = periodRef;
        lastDistributedPrev = distributedPrev;
        emit PeriodClosed(periodRef, distributedPrev, percentRateBps, percentLocked, msg.sender);
    }

    function settleBuy(
        bytes32 orderRef,
        address investor,
        uint256 wptAmount,
        uint256 vndbAmount,
        uint256 price
    ) external onlyRole(MATCHER_ROLE) nonReentrant {
        _markAndValidate(orderRef, investor, wptAmount, vndbAmount, price);
        IERC20(address(projectToken)).safeTransfer(investor, wptAmount);
        netProceeds += vndbAmount;
        emit OrderSettled(orderRef, investor, Side.BUY, wptAmount, vndbAmount, price);
    }

    function settleSell(
        bytes32 orderRef,
        address investor,
        uint256 wptAmount,
        uint256 vndbAmount,
        uint256 price
    ) external onlyRole(MATCHER_ROLE) nonReentrant {
        _markAndValidate(orderRef, investor, wptAmount, vndbAmount, price);
        paymentToken.safeTransfer(investor, vndbAmount);
        netProceeds = netProceeds > vndbAmount ? netProceeds - vndbAmount : 0;
        emit OrderSettled(orderRef, investor, Side.SELL, wptAmount, vndbAmount, price);
    }

    function setPayoutWallet(address wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (wallet == address(0)) revert ZeroAddress();
        if (!projectToken.identityRegistry().isVerified(wallet)) {
            revert PayoutWalletNotVerified(wallet);
        }
        payoutWallet = wallet;
        emit PayoutWalletSet(wallet);
    }

    function withdraw(uint256 amount)
        external
        onlyRole(WITHDRAWER_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (payoutWallet == address(0)) revert PayoutWalletNotSet();
        if (amount == 0) revert ZeroAmount();
        uint256 available = withdrawable();
        if (amount > available) revert ExceedsWithdrawable(amount, available);
        paymentToken.safeTransfer(payoutWallet, amount);
        emit Withdrawn(payoutWallet, amount, msg.sender);
    }

    function pauseWithdrawals() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpauseWithdrawals() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _markAndValidate(
        bytes32 orderRef,
        address investor,
        uint256 wptAmount,
        uint256 vndbAmount,
        uint256 price
    ) private {
        if (orderRef == bytes32(0)) revert ZeroOrderRef();
        if (settledOrders[orderRef]) revert OrderAlreadySettled(orderRef);
        if (investor == address(0)) revert ZeroAddress();
        if (wptAmount == 0) revert ZeroAmount();
        if (price == 0) revert ZeroPrice();
        if (vndbAmount != wptAmount * price) {
            revert AmountPriceMismatch(wptAmount, vndbAmount, price);
        }
        settledOrders[orderRef] = true;
    }
}
