// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EnergyOracle
 * @notice Đưa dữ liệu vận hành nhà máy điện mặt trời lên chuỗi để tính lợi nhuận
 *         chia cho nhà đầu tư một cách minh bạch, thay vì ngân hàng nhập tay con số.
 *
 *  Mô hình: các "reporter" (gateway đọc công-tơ/SCADA, đơn vị O&M, kiểm toán độc lập)
 *  đẩy số liệu mỗi kỳ:
 *      - kWh:               sản lượng điện phát trong kỳ (kWh)
 *      - tariffVndPerKwh:   giá bán điện (VND/kWh, thường theo hợp đồng PPA)
 *      - opexVnd:           chi phí vận hành kỳ (VND) trừ khỏi doanh thu
 *      - bankShareBps:      phần nhà đầu tư/ngân hàng được chia (bps; 10000 = 100%)
 *
 *  Công thức:
 *      doanh thu (gross)     = kWh * tariffVndPerKwh
 *      lãi ròng (net)        = max(gross - opexVnd, 0)
 *      lợi nhuận chia được   = net * bankShareBps / 10000
 *
 *  Chống thao túng: cần tối thiểu `requiredConfirmations` reporter đẩy CÙNG một bộ
 *  số liệu thì kỳ mới được "chốt" (finalized). Sau khi chốt, số liệu bất biến —
 *  ProfitDistributorOracle chỉ đọc kỳ đã chốt để tạo đợt chia.
 *
 *  Lưu ý số học: dùng số nguyên (0 decimals) khớp với token VND của dự án. Nếu
 *  đổi decimals của VND thì quy đổi tariff/opex cho khớp đơn vị nhỏ nhất.
 */
contract EnergyOracle is AccessControl {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    uint16 public constant BPS_DENOMINATOR = 10000;

    // Số reporter tối thiểu phải xác nhận trùng khớp để chốt một kỳ.
    // Pilot có thể để 1; sản xuất nên >= 2 (ví dụ O&M + kiểm toán độc lập).
    uint256 public requiredConfirmations = 1;

    struct Reading {
        uint256 kWh; // sản lượng điện kỳ (kWh)
        uint256 tariffVndPerKwh; // giá bán điện (VND/kWh)
        uint256 opexVnd; // chi phí vận hành kỳ (VND)
        uint16 bankShareBps; // phần được chia (bps)
        uint64 reportedAt; // thời điểm số liệu đầu tiên được đẩy
        uint32 confirmations; // số reporter đã xác nhận trùng khớp
        bool finalized; // đã chốt chưa
        bytes32 dataHash; // hash bộ số liệu để reporter khác đối chiếu
    }

    // periodId (ví dụ 202601 cho 2026-Q1) => số liệu kỳ
    mapping(uint256 => Reading) private _readings;

    event ReadingSubmitted(
        uint256 indexed periodId,
        address indexed reporter,
        uint256 kWh,
        uint256 tariffVndPerKwh,
        uint256 opexVnd,
        uint16 bankShareBps,
        uint32 confirmations
    );
    event ReadingFinalized(
        uint256 indexed periodId,
        uint256 grossVnd,
        uint256 netVnd,
        uint256 distributableVnd
    );
    event PendingReset(uint256 indexed periodId);
    event RequiredConfirmationsUpdated(uint256 newValue);

    constructor(address admin) {
        require(admin != address(0), "zero addr");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(REPORTER_ROLE, admin); // pilot tiện dùng; sản xuất tách vai reporter
    }

    // =========================================================================
    //  ĐẨY / XÁC NHẬN SỐ LIỆU
    // =========================================================================
    /**
     * @notice Reporter đẩy hoặc xác nhận số liệu vận hành cho một kỳ.
     *  - Lần đầu: ghi số liệu ở trạng thái "chờ" (pending).
     *  - Lần sau: reporter khác phải đẩy ĐÚNG bộ số liệu (kWh, tariff, opex, share)
     *    thì mới tăng số xác nhận. Đủ ngưỡng thì tự chốt.
     */
    function submitReading(
        uint256 periodId,
        uint256 kWh,
        uint256 tariffVndPerKwh,
        uint256 opexVnd,
        uint16 bankShareBps
    ) external onlyRole(REPORTER_ROLE) {
        require(bankShareBps <= BPS_DENOMINATOR, "share > 100%");
        require(kWh > 0 && tariffVndPerKwh > 0, "so lieu rong");

        Reading storage r = _readings[periodId];
        require(!r.finalized, "ky da chot");

        bytes32 h = keccak256(abi.encode(kWh, tariffVndPerKwh, opexVnd, bankShareBps));

        if (r.reportedAt == 0) {
            r.kWh = kWh;
            r.tariffVndPerKwh = tariffVndPerKwh;
            r.opexVnd = opexVnd;
            r.bankShareBps = bankShareBps;
            r.reportedAt = uint64(block.timestamp);
            r.confirmations = 1;
            r.dataHash = h;
        } else {
            require(r.dataHash == h, "so lieu khong khop lan truoc");
            r.confirmations += 1;
        }

        emit ReadingSubmitted(periodId, msg.sender, kWh, tariffVndPerKwh, opexVnd, bankShareBps, r.confirmations);

        if (r.confirmations >= requiredConfirmations) {
            r.finalized = true;
            emit ReadingFinalized(
                periodId,
                grossRevenueVnd(periodId),
                netRevenueVnd(periodId),
                distributableProfitVnd(periodId)
            );
        }
    }

    // =========================================================================
    //  QUẢN TRỊ
    // =========================================================================
    function setRequiredConfirmations(uint256 n) external onlyRole(MANAGER_ROLE) {
        require(n >= 1, "toi thieu 1");
        requiredConfirmations = n;
        emit RequiredConfirmationsUpdated(n);
    }

    /// @notice Xoá số liệu một kỳ CHƯA chốt (khi phát hiện sai). Không đụng được kỳ đã chốt.
    function resetPending(uint256 periodId) external onlyRole(MANAGER_ROLE) {
        require(!_readings[periodId].finalized, "da chot, khong sua duoc");
        delete _readings[periodId];
        emit PendingReset(periodId);
    }

    // =========================================================================
    //  ĐỌC SỐ LIỆU / CÔNG THỨC LỢI NHUẬN
    // =========================================================================
    function getReading(uint256 periodId)
        external
        view
        returns (
            uint256 kWh,
            uint256 tariffVndPerKwh,
            uint256 opexVnd,
            uint16 bankShareBps,
            uint32 confirmations,
            bool finalized
        )
    {
        Reading storage r = _readings[periodId];
        return (r.kWh, r.tariffVndPerKwh, r.opexVnd, r.bankShareBps, r.confirmations, r.finalized);
    }

    function isFinalized(uint256 periodId) external view returns (bool) {
        return _readings[periodId].finalized;
    }

    function grossRevenueVnd(uint256 periodId) public view returns (uint256) {
        Reading storage r = _readings[periodId];
        return r.kWh * r.tariffVndPerKwh;
    }

    function netRevenueVnd(uint256 periodId) public view returns (uint256) {
        uint256 gross = grossRevenueVnd(periodId);
        uint256 opex = _readings[periodId].opexVnd;
        return gross > opex ? gross - opex : 0;
    }

    function distributableProfitVnd(uint256 periodId) public view returns (uint256) {
        return (netRevenueVnd(periodId) * _readings[periodId].bankShareBps) / BPS_DENOMINATOR;
    }
}
