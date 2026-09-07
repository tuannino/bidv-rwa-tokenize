// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ProjectToken} from "./tokens/ProjectToken.sol";

/**
 * @title ProfitDistributor
 * @notice Tính và chia lợi nhuận định kỳ cho người nắm giữ WPT, chi trả bằng VND.
 *
 *  Cơ chế (mô hình "pull theo snapshot" — chuẩn, an toàn gas, kiểm toán được):
 *   1. Ngân hàng gọi createDistribution(amount, "2026-Q1"):
 *      - chốt snapshot số dư WPT tại thời điểm đó (bức tranh sở hữu bất biến),
 *      - kéo `amount` VND từ ngân hàng vào hợp đồng làm quỹ chia của kỳ.
 *   2. Mỗi nhà đầu tư tự gọi claim(id) để nhận phần của mình:
 *         phần_nhận = amount * balanceOfAt(nhà_đầu_tư, snapshot) / totalSupplyAt(snapshot)
 *      (hoặc đại lý gọi distributeTo(id, [ví...]) để chia hộ hàng loạt).
 *   3. Sau thời hạn nhận, ngân hàng gọi sweepDust(id) để thu phần chưa nhận + phần lẻ do làm tròn.
 *
 *  Vì chia theo snapshot nên mua/bán WPT SAU thời điểm chốt không làm sai lệch phần được chia.
 */
contract ProfitDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    ProjectToken public immutable projectToken; // token quyền hưởng
    IERC20 public immutable payoutToken; // token chi trả (VND)

    uint256 public claimWindow = 180 days; // thời hạn nhận trước khi được quét dư

    struct Distribution {
        uint256 snapshotId; // id snapshot đã chốt
        uint256 amount; // tổng lợi nhuận kỳ (VND)
        uint256 supplyAtSnapshot; // tổng cung WPT tại thời điểm chốt
        uint256 claimed; // đã chia ra
        uint64 createdAt; // thời điểm tạo kỳ
        string period; // nhãn kỳ, ví dụ "2026-Q1"
    }

    Distribution[] public distributions;
    // distributionId => (nhà đầu tư => đã nhận?)
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event DistributionCreated(
        uint256 indexed id,
        uint256 indexed snapshotId,
        uint256 amount,
        uint256 supplyAtSnapshot,
        string period
    );
    event Claimed(uint256 indexed id, address indexed account, uint256 amount);
    event DustSwept(uint256 indexed id, address indexed to, uint256 amount);
    event ClaimWindowUpdated(uint256 newWindow);

    constructor(address projectToken_, address payoutToken_, address admin) {
        require(projectToken_ != address(0) && payoutToken_ != address(0) && admin != address(0), "zero addr");
        projectToken = ProjectToken(projectToken_);
        payoutToken = IERC20(payoutToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
    }

    function distributionsCount() external view returns (uint256) {
        return distributions.length;
    }

    function setClaimWindow(uint256 newWindow) external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimWindow = newWindow;
        emit ClaimWindowUpdated(newWindow);
    }

    // =========================================================================
    //  TẠO KỲ CHIA (chốt snapshot + nạp quỹ VND)
    // =========================================================================
    /**
     * @notice Ngân hàng phải approve `amount` VND cho hợp đồng này trước khi gọi.
     * @return id Mã kỳ chia vừa tạo.
     */
    function createDistribution(uint256 amount, string memory period)
        public
        onlyRole(DISTRIBUTOR_ROLE)
        nonReentrant
        returns (uint256 id)
    {
        require(amount > 0, "amount = 0");

        uint256 snapId = projectToken.snapshot();
        uint256 supply = projectToken.totalSupplyAt(snapId);
        require(supply > 0, "khong co WPT dang luu hanh");

        // kéo VND vào quỹ kỳ này
        payoutToken.safeTransferFrom(msg.sender, address(this), amount);

        id = distributions.length;
        distributions.push(
            Distribution({
                snapshotId: snapId,
                amount: amount,
                supplyAtSnapshot: supply,
                claimed: 0,
                createdAt: uint64(block.timestamp),
                period: period
            })
        );

        emit DistributionCreated(id, snapId, amount, supply, period);
    }

    // =========================================================================
    //  TÍNH LỢI NHUẬN (không đổi trạng thái)
    // =========================================================================
    /// @notice Phần lợi nhuận theo quyền của `account` trong kỳ `id`, không tính việc đã nhận hay chưa.
    function entitlementOf(uint256 id, address account) public view returns (uint256) {
        Distribution storage d = distributions[id];
        if (d.supplyAtSnapshot == 0) return 0;
        uint256 bal = projectToken.balanceOfAt(account, d.snapshotId);
        return (d.amount * bal) / d.supplyAtSnapshot;
    }

    /// @notice Phần còn có thể nhận (0 nếu đã nhận). Dùng để hiển thị cho nhà đầu tư.
    function previewClaim(uint256 id, address account) public view returns (uint256) {
        if (hasClaimed[id][account]) return 0;
        return entitlementOf(id, account);
    }

    // =========================================================================
    //  CHIA LỢI NHUẬN
    // =========================================================================
    /// @notice Nhà đầu tư tự nhận phần của mình trong một kỳ.
    function claim(uint256 id) external nonReentrant returns (uint256) {
        return _claim(id, msg.sender);
    }

    /// @notice Nhận phần của nhiều kỳ trong một giao dịch.
    function claimMany(uint256[] calldata ids) external nonReentrant returns (uint256 total) {
        for (uint256 i = 0; i < ids.length; i++) {
            total += _claim(ids[i], msg.sender);
        }
    }

    /// @notice Đại lý (ngân hàng) chia hộ cho danh sách nhà đầu tư (mô hình "push").
    function distributeTo(uint256 id, address[] calldata accounts)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        nonReentrant
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            _claim(id, accounts[i]);
        }
    }

    function _claim(uint256 id, address account) internal returns (uint256 amount) {
        require(id < distributions.length, "ky khong ton tai");
        if (hasClaimed[id][account]) return 0;

        amount = entitlementOf(id, account);
        hasClaimed[id][account] = true; // đánh dấu kể cả khi phần = 0 để tránh lặp vô ích

        if (amount > 0) {
            Distribution storage d = distributions[id];
            d.claimed += amount;
            payoutToken.safeTransfer(account, amount);
            emit Claimed(id, account, amount);
        }
    }

    // =========================================================================
    //  QUÉT PHẦN DƯ (sau thời hạn nhận)
    // =========================================================================
    /// @notice Thu phần chưa nhận + phần lẻ do làm tròn của kỳ `id` về `to`, sau khi hết hạn nhận.
    function sweepDust(uint256 id, address to)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        nonReentrant
    {
        require(id < distributions.length, "ky khong ton tai");
        Distribution storage d = distributions[id];
        require(block.timestamp >= d.createdAt + claimWindow, "chua het han nhan");
        uint256 remaining = d.amount - d.claimed;
        require(remaining > 0, "khong con du");
        d.claimed = d.amount;
        payoutToken.safeTransfer(to, remaining);
        emit DustSwept(id, to, remaining);
    }
}
