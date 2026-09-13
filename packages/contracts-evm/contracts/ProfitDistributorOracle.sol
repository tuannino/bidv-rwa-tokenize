// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ProfitDistributor} from "./ProfitDistributor.sol";
import {EnergyOracle} from "./oracle/EnergyOracle.sol";

/**
 * @title ProfitDistributorOracle
 * @notice Mở rộng ProfitDistributor: thay vì ngân hàng nhập tay số lợi nhuận,
 *         hợp đồng đọc EnergyOracle để LẤY số lợi nhuận chia được của kỳ
 *         (tính từ sản lượng điện thực tế × giá bán − chi phí × tỷ lệ chia),
 *         rồi chốt snapshot và nạp quỹ VND như bình thường.
 *
 *  Nhờ đó con số chia cho nhà đầu tư gắn với dữ liệu vận hành đã được nhiều
 *  bên xác nhận trên chuỗi, không phụ thuộc một thao tác nhập tay.
 *
 *  Ngân hàng vẫn phải approve đủ VND cho hợp đồng trước khi tạo đợt chia.
 */
contract ProfitDistributorOracle is ProfitDistributor {
    EnergyOracle public immutable energyOracle;

    // periodId của oracle => đã tạo đợt chia chưa (chống chia trùng một kỳ)
    mapping(uint256 => bool) public oraclePeriodUsed;
    // distributionId => periodId nguồn (để tra ngược)
    mapping(uint256 => uint256) public distributionPeriod;

    event DistributionFromOracle(
        uint256 indexed periodId,
        uint256 indexed distributionId,
        uint256 grossVnd,
        uint256 netVnd,
        uint256 distributableVnd
    );

    constructor(address projectToken_, address payoutToken_, address oracle_, address admin)
        ProfitDistributor(projectToken_, payoutToken_, admin)
    {
        require(oracle_ != address(0), "zero oracle");
        energyOracle = EnergyOracle(oracle_);
    }

    /// @notice Xem trước số VND sẽ chia của một kỳ oracle (0 nếu kỳ chưa chốt).
    function previewDistributableFromOracle(uint256 periodId) external view returns (uint256) {
        if (!energyOracle.isFinalized(periodId)) return 0;
        return energyOracle.distributableProfitVnd(periodId);
    }

    /**
     * @notice Tạo đợt chia lấy số lợi nhuận từ EnergyOracle cho kỳ `periodId`.
     *  Điều kiện: kỳ đã "chốt" trên oracle, chưa từng tạo đợt chia, và số > 0.
     *  Ngân hàng (DISTRIBUTOR_ROLE) phải approve đủ VND trước khi gọi.
     * @return id Mã đợt chia vừa tạo.
     */
    function createDistributionFromOracle(uint256 periodId)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        returns (uint256 id)
    {
        require(!oraclePeriodUsed[periodId], "ky da tao dot chia");
        require(energyOracle.isFinalized(periodId), "oracle chua chot ky nay");

        uint256 amount = energyOracle.distributableProfitVnd(periodId);
        require(amount > 0, "loi nhuan chia = 0");

        oraclePeriodUsed[periodId] = true;

        // Gọi lại logic gốc (chốt snapshot + kéo VND từ msg.sender). Vì createDistribution
        // là public và đây là gọi nội bộ nên msg.sender vẫn là ngân hàng gọi hàm này.
        string memory label = string.concat("ENERGY-", _uintToString(periodId));
        id = createDistribution(amount, label);
        distributionPeriod[id] = periodId;

        emit DistributionFromOracle(
            periodId,
            id,
            energyOracle.grossRevenueVnd(periodId),
            energyOracle.netRevenueVnd(periodId),
            amount
        );
    }

    /// @dev Đổi uint sang chuỗi thập phân, không phụ thuộc thư viện ngoài (tránh opcode Cancun).
    function _uintToString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 digits;
        uint256 tmp = v;
        while (tmp != 0) {
            digits++;
            tmp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (v != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(buffer);
    }
}
