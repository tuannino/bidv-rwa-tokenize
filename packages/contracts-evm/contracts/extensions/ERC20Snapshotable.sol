// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC20Snapshotable
 * @notice Ghi lại (snapshot) số dư của từng tài khoản và tổng cung tại một thời điểm,
 *         để có thể truy vấn `balanceOfAt` / `totalSupplyAt` về sau.
 *
 *         Đây là "xương sống" của việc chia lợi nhuận công bằng: khi chốt một kỳ chia,
 *         ta gọi `_snapshot()` để đóng băng bức tranh sở hữu tại đúng thời điểm đó.
 *         Nhà đầu tư mua/bán WPT sau thời điểm chốt sẽ không ảnh hưởng phần được chia.
 *
 *         Cơ chế được chuyển thể (port) từ OpenZeppelin ERC20Snapshot (v4) sang hook
 *         `_update` của OpenZeppelin v5. Thuật toán tra cứu, semantics ghi "giá trị
 *         TRƯỚC khi biến động dưới id hiện hành" được giữ nguyên và đã kiểm chứng lâu năm.
 */
abstract contract ERC20Snapshotable is ERC20 {
    struct Snapshots {
        uint256[] ids;
        uint256[] values;
    }

    mapping(address => Snapshots) private _accountBalanceSnapshots;
    Snapshots private _totalSupplySnapshots;

    uint256 private _currentSnapshotId;

    event Snapshot(uint256 id);

    // --- Tạo snapshot ---
    function _snapshot() internal virtual returns (uint256) {
        _currentSnapshotId += 1;
        uint256 currentId = _currentSnapshotId;
        emit Snapshot(currentId);
        return currentId;
    }

    /// @notice Id của snapshot gần nhất (0 nếu chưa từng chốt).
    function getCurrentSnapshotId() public view returns (uint256) {
        return _currentSnapshotId;
    }

    // --- Truy vấn theo snapshot ---
    function balanceOfAt(address account, uint256 snapshotId) public view returns (uint256) {
        (bool snapshotted, uint256 value) = _valueAt(snapshotId, _accountBalanceSnapshots[account]);
        return snapshotted ? value : balanceOf(account);
    }

    function totalSupplyAt(uint256 snapshotId) public view returns (uint256) {
        (bool snapshotted, uint256 value) = _valueAt(snapshotId, _totalSupplySnapshots);
        return snapshotted ? value : totalSupply();
    }

    // --- Hook: ghi lại giá trị TRƯỚC biến động, rồi mới cho ERC20 cập nhật ---
    function _update(address from, address to, uint256 value) internal virtual override {
        if (from == address(0)) {
            // mint
            _updateAccountSnapshot(to);
            _updateTotalSupplySnapshot();
        } else if (to == address(0)) {
            // burn
            _updateAccountSnapshot(from);
            _updateTotalSupplySnapshot();
        } else {
            // transfer
            _updateAccountSnapshot(from);
            _updateAccountSnapshot(to);
        }
        super._update(from, to, value);
    }

    // --- Nội bộ ---
    function _valueAt(uint256 snapshotId, Snapshots storage snapshots)
        private
        view
        returns (bool, uint256)
    {
        require(snapshotId > 0, "Snapshot: id la 0");
        require(snapshotId <= _currentSnapshotId, "Snapshot: id chua ton tai");

        uint256 index = _upperBinaryLookup(snapshots.ids, snapshotId);
        if (index == snapshots.ids.length) {
            return (false, 0);
        } else {
            return (true, snapshots.values[index]);
        }
    }

    /// @dev Trả về chỉ số phần tử đầu tiên có ids[i] >= snapshotId (tìm nhị phân).
    function _upperBinaryLookup(uint256[] storage ids, uint256 snapshotId)
        private
        view
        returns (uint256)
    {
        uint256 low = 0;
        uint256 high = ids.length;
        while (low < high) {
            uint256 mid = (low + high) / 2;
            if (ids[mid] < snapshotId) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low;
    }

    function _updateAccountSnapshot(address account) private {
        _updateSnapshot(_accountBalanceSnapshots[account], balanceOf(account));
    }

    function _updateTotalSupplySnapshot() private {
        _updateSnapshot(_totalSupplySnapshots, totalSupply());
    }

    function _updateSnapshot(Snapshots storage snapshots, uint256 currentValue) private {
        uint256 currentId = _currentSnapshotId;
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.values.push(currentValue);
        }
    }

    function _lastSnapshotId(uint256[] storage ids) private view returns (uint256) {
        if (ids.length == 0) {
            return 0;
        }
        return ids[ids.length - 1];
    }
}
