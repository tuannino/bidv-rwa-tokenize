// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ProjectToken} from "./tokens/ProjectToken.sol";

// Namespace riêng vì Solidity không cho error và event cùng tên trong một scope.
interface IProfitDistributorErrors {
    error DistributionClosed(uint256 id);
}

/**
 * @title ProfitDistributor
 * @notice Tính và chia lợi nhuận định kỳ cho người nắm giữ WPT, chi trả bằng VND.
 *
 *  Quỹ chia MỘT CHIỀU (SC-06, QĐ-27 đến QĐ-29):
 *   1. SPV nạp VNDB bằng chuyển token thường vào địa chỉ hợp đồng. Không hàm nào của hợp đồng chạy.
 *   2. Ngân hàng gọi createDistributionFromPool("<chain>:2026-Q1"):
 *      - chốt snapshot số dư WPT tại thời điểm đó (bức tranh sở hữu bất biến),
 *      - lấy ĐÚNG phần chưa phân bổ (số dư trừ `totalReserved`) làm quỹ của kỳ,
 *      - nhãn kỳ dùng một lần, tra ngược được bằng distributionIdOfPeriod.
 *   3. Người nắm giữ nhận phần của mình (claim), hoặc ngân hàng chia hộ (distributeTo):
 *         phần_nhận = amount * balanceOfAt(người_nắm_giữ, snapshot) / totalSupplyAt(snapshot)
 *   4. Sau thời hạn nhận, admin gọi closeDistribution(id): phần chưa trả THÔI được giữ cho kỳ và
 *      trở về phần chưa phân bổ, để kỳ sau chia tiếp. Không có hàm nào chuyển tiền về SPV hay về
 *      một địa chỉ tuỳ chọn: chỉ `_claim` chuyển VNDB ra khỏi hợp đồng.
 *
 *  Sổ dự trữ `totalReserved` = tổng (amount - claimed) của các kỳ chưa đóng. Nó tách tiền đang nợ
 *  các kỳ khỏi tiền mới nạp, nên một kỳ mới không bao giờ lấy lại phần kỳ trước còn nợ.
 *
 *  Giả định tin cậy: `VNDToken.BURNER_ROLE` đốt được VNDB trong quỹ; khi đó số dư có thể xuống dưới
 *  `totalReserved` và `unallocatedBalance()` trả 0. Ứng dụng phát hiện bằng so số dư với dự trữ.
 *
 *  Vì chia theo snapshot nên mua/bán WPT SAU thời điểm chốt không làm sai lệch phần được chia.
 */
contract ProfitDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    ProjectToken public immutable projectToken; // token quyền hưởng
    IERC20 public immutable payoutToken; // token chi trả (VND)

    uint256 public claimWindow = 180 days; // thời hạn nhận trước khi được đóng kỳ

    /// @notice Tổng phần còn phải trả của các kỳ CHƯA đóng (QĐ-A).
    uint256 public totalReserved;

    struct Distribution {
        uint256 snapshotId; // id snapshot đã chốt
        uint256 amount; // tổng lợi nhuận kỳ (VND)
        uint256 supplyAtSnapshot; // tổng cung WPT tại thời điểm chốt
        uint256 claimed; // đã chia ra
        uint64 createdAt; // thời điểm tạo kỳ
        string period; // nhãn kỳ, ví dụ "2026-Q1"
        uint64 claimDeadline; // cố định khi tạo kỳ
        bool closed;
    }

    Distribution[] public distributions;
    // distributionId => (nhà đầu tư => đã nhận?)
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    // keccak256(nhãn kỳ) => id + 1; 0 nghĩa là nhãn chưa dùng (QĐ-B). Chỉ kỳ tạo từ quỹ ghi vào đây.
    mapping(bytes32 => uint256) private _periodIdPlusOne;

    event DistributionCreated(
        uint256 indexed id,
        uint256 indexed snapshotId,
        uint256 amount,
        uint256 supplyAtSnapshot,
        string period
    );
    event Claimed(uint256 indexed id, address indexed account, uint256 amount);
    event ClaimWindowUpdated(uint256 newWindow);
    /// @param releasedAmount phần chưa trả trở về quỹ chưa phân bổ (không chuyển đi đâu).
    event DistributionClosed(uint256 indexed id, uint256 releasedAmount);

    error ClaimWindowEnded(uint256 id, uint256 deadline);
    error DistributionOverdrawn(uint256 id, uint256 requested, uint256 remaining);
    error EmptyPeriod();
    error DuplicatePeriod(string period);
    error NothingToDistribute();

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

    /// @notice Chỉ áp dụng cho kỳ tạo sau; không thay hạn của kỳ đã tồn tại.
    function setClaimWindow(uint256 newWindow) external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimWindow = newWindow;
        emit ClaimWindowUpdated(newWindow);
    }

    // =========================================================================
    //  SỔ DỰ TRỮ
    // =========================================================================
    /// @notice Số dư VNDB chưa thuộc kỳ nào: căn cứ tạo kỳ mới. 0 nếu số dư nhỏ hơn dự trữ.
    function unallocatedBalance() public view returns (uint256) {
        uint256 balance = payoutToken.balanceOf(address(this));
        return balance > totalReserved ? balance - totalReserved : 0;
    }

    /// @notice Tra kỳ theo nhãn đã dùng ở createDistributionFromPool (kể cả khi mất biên nhận).
    function distributionIdOfPeriod(string calldata period) external view returns (bool exists, uint256 id) {
        uint256 stored = _periodIdPlusOne[keccak256(bytes(period))];
        if (stored == 0) return (false, 0);
        return (true, stored - 1);
    }

    // =========================================================================
    //  TẠO KỲ CHIA
    // =========================================================================
    /**
     * @notice Tạo kỳ từ phần chưa phân bổ của quỹ (QĐ-B). Không kéo tiền từ người gọi.
     * @dev Nhãn rỗng hoặc đã dùng thì revert: gửi lại cùng nhãn không thể tạo kỳ thứ hai.
     */
    function createDistributionFromPool(string calldata period)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        nonReentrant
        returns (uint256 id)
    {
        if (bytes(period).length == 0) revert EmptyPeriod();
        bytes32 key = keccak256(bytes(period));
        if (_periodIdPlusOne[key] != 0) revert DuplicatePeriod(period);
        uint256 amount = unallocatedBalance();
        if (amount == 0) revert NothingToDistribute();

        id = _newDistribution(amount, period);
        _periodIdPlusOne[key] = id + 1;
    }

    /**
     * @notice Ngân hàng phải approve `amount` VND cho hợp đồng này trước khi gọi.
     * @dev Giữ cho ProfitDistributorOracle và bộ cũ. Không ghi bảng chống trùng nhãn.
     * @return id Mã kỳ chia vừa tạo.
     */
    function createDistribution(uint256 amount, string memory period)
        public
        onlyRole(DISTRIBUTOR_ROLE)
        nonReentrant
        returns (uint256 id)
    {
        require(amount > 0, "amount = 0");
        // kéo VND vào quỹ kỳ này
        payoutToken.safeTransferFrom(msg.sender, address(this), amount);
        id = _newDistribution(amount, period);
    }

    function _newDistribution(uint256 amount, string memory period) internal returns (uint256 id) {
        uint256 snapId = projectToken.snapshot();
        uint256 supply = projectToken.totalSupplyAt(snapId);
        require(supply > 0, "khong co WPT dang luu hanh");

        id = distributions.length;
        distributions.push(
            Distribution({
                snapshotId: snapId,
                amount: amount,
                supplyAtSnapshot: supply,
                claimed: 0,
                createdAt: uint64(block.timestamp),
                period: period,
                claimDeadline: uint64(block.timestamp + claimWindow),
                closed: false
            })
        );
        totalReserved += amount;

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
        Distribution storage d = distributions[id];
        if (d.closed) revert IProfitDistributorErrors.DistributionClosed(id);
        if (block.timestamp >= d.claimDeadline) revert ClaimWindowEnded(id, d.claimDeadline);
        if (hasClaimed[id][account]) return 0;

        amount = entitlementOf(id, account);
        if (d.claimed + amount > d.amount) {
            revert DistributionOverdrawn(id, amount, d.amount - d.claimed);
        }
        hasClaimed[id][account] = true; // đánh dấu kể cả khi phần = 0 để tránh lặp vô ích

        if (amount > 0) {
            d.claimed += amount;
            totalReserved -= amount;
            payoutToken.safeTransfer(account, amount);
            emit Claimed(id, account, amount);
        }
    }

    // =========================================================================
    //  ĐÓNG KỲ (sau thời hạn nhận)
    // =========================================================================
    /**
     * @notice Đóng kỳ `id` sau hạn nhận: phần chưa trả trở về quỹ chưa phân bổ (QĐ-C, QĐ-28).
     * @dev KHÔNG chuyển tiền. `claimed` giữ nghĩa "đã trả"; người không nhận kịp mất phần kỳ này.
     */
    function closeDistribution(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(id < distributions.length, "ky khong ton tai");
        Distribution storage d = distributions[id];
        if (d.closed) revert IProfitDistributorErrors.DistributionClosed(id);
        require(block.timestamp >= d.claimDeadline, "chua het han nhan");
        uint256 released = d.amount - d.claimed;
        d.closed = true;
        totalReserved -= released;
        emit DistributionClosed(id, released);
    }
}
