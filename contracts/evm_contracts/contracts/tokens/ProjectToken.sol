// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20Snapshotable} from "../extensions/ERC20Snapshotable.sol";

/**
 * @title ProjectToken (SPT — Solar Project Token)
 * @notice Token đại diện quyền hưởng lợi nhuận của một dự án điện mặt trời (RWA).
 *         Đây là token CÓ KIỂM SOÁT: chỉ ví đã KYC (whitelist) mới được nắm giữ,
 *         ngân hàng (agent) có thể đóng băng và thu hồi (clawback) khi cần.
 *
 *         Bản này là phiên bản rút gọn, dễ đọc, thể hiện đúng các quy trình mà đề bài
 *         yêu cầu (mint, burn, clawback, freeze, whitelist, snapshot). Khi lên sản
 *         xuất, nên thay bằng chuẩn ERC-3643 (T-REX) đầy đủ với ONCHAINID và các module
 *         tuân thủ tách rời; các khái niệm ở đây ánh xạ 1-1 sang ERC-3643.
 *
 *         Quy ước số thập phân: mặc định 0 (mỗi đơn vị = 1 phần quyền hưởng), để số học
 *         minh bạch theo góc ngân hàng. Có thể đổi qua tham số constructor.
 */
contract ProjectToken is ERC20Burnable, ERC20Snapshotable, AccessControl {
    // --- Vai trò ---
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // phát hành
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE"); // tuân thủ: whitelist/freeze/clawback/thu hồi
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE"); // chốt kỳ chia lợi nhuận
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE"); // tạm dừng toàn hệ

    // --- Trạng thái tuân thủ ---
    mapping(address => bool) public isWhitelisted; // đã KYC
    mapping(address => bool) public isFrozen; // bị đóng băng
    bool public paused; // tạm dừng toàn bộ chuyển nhượng

    uint8 private immutable _customDecimals;
    bool private _forcedMove; // cờ nội bộ: cho phép clawback/agentBurn bỏ qua kiểm tra tuân thủ

    // --- Sự kiện ---
    event WhitelistUpdated(address indexed account, bool status);
    event FrozenUpdated(address indexed account, bool status);
    event PausedUpdated(bool status);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount);
    event AgentBurn(address indexed from, uint256 amount);

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address admin)
        ERC20(name_, symbol_)
    {
        require(admin != address(0), "admin = 0");
        _customDecimals = decimals_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(AGENT_ROLE, admin);
        _grantRole(SNAPSHOT_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    // =========================================================================
    //  QUẢN TRỊ TUÂN THỦ (AGENT)
    // =========================================================================
    function setWhitelisted(address account, bool status) external onlyRole(AGENT_ROLE) {
        isWhitelisted[account] = status;
        emit WhitelistUpdated(account, status);
    }

    function batchSetWhitelisted(address[] calldata accounts, bool status)
        external
        onlyRole(AGENT_ROLE)
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            isWhitelisted[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    /// @notice Đóng băng/mở băng một ví (ví bị băng không gửi/nhận được).
    function setFrozen(address account, bool status) external onlyRole(AGENT_ROLE) {
        isFrozen[account] = status;
        emit FrozenUpdated(account, status);
    }

    function setPaused(bool status) external onlyRole(PAUSER_ROLE) {
        paused = status;
        emit PausedUpdated(status);
    }

    // =========================================================================
    //  PHÁT HÀNH (MINT) & ĐỐT (BURN)
    // =========================================================================
    /// @notice Ngân hàng phát hành SPT cho nhà đầu tư đã KYC.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Đốt cưỡng bức của agent (dùng khi thu hồi/hủy niêm yết, kể cả ví đã bị băng).
     *         Người dùng tự đốt phần của mình dùng burn()/burnFrom() có sẵn từ ERC20Burnable.
     */
    function agentBurn(address from, uint256 amount) external onlyRole(AGENT_ROLE) {
        _forcedMove = true;
        _burn(from, amount);
        _forcedMove = false;
        emit AgentBurn(from, amount);
    }

    // =========================================================================
    //  SNAPSHOT (chốt kỳ chia lợi nhuận)
    // =========================================================================
    function snapshot() external onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        return _snapshot();
    }

    // =========================================================================
    //  CLAWBACK (chuyển cưỡng bức)
    // =========================================================================
    /**
     * @notice Chuyển cưỡng bức SPT từ `from` sang `to` (thu hồi tài sản), bỏ qua kiểm tra
     *         đóng băng của `from`. Bên nhận vẫn phải là ví đã KYC.
     *         Dùng cho lệnh tòa/cơ quan quản lý, mất khóa, hoặc thu hồi khi vi phạm.
     */
    function forcedTransfer(address from, address to, uint256 amount)
        external
        onlyRole(AGENT_ROLE)
    {
        require(isWhitelisted[to], "clawback: to chua KYC");
        _forcedMove = true;
        _transfer(from, to, amount);
        _forcedMove = false;
        emit ForcedTransfer(from, to, amount);
    }

    // =========================================================================
    //  HOOK TUÂN THỦ + SNAPSHOT
    // =========================================================================
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Snapshotable)
    {
        if (!_forcedMove) {
            require(!paused, "token dang tam dung");
            if (from != address(0)) require(!isFrozen[from], "ben gui bi bang");
            if (to != address(0)) require(!isFrozen[to], "ben nhan bi bang");

            if (from != address(0) && to != address(0)) {
                // chuyển nhượng: cả hai đầu phải KYC
                require(isWhitelisted[from], "ben gui chua KYC");
                require(isWhitelisted[to], "ben nhan chua KYC");
            } else if (from == address(0)) {
                // phát hành: bên nhận phải KYC
                require(isWhitelisted[to], "phat hanh cho vi chua KYC");
            }
            // đốt (to == 0): chỉ cần không bị băng (đã kiểm ở trên)
        }
        // super -> ERC20Snapshotable._update (ghi snapshot) -> ERC20._update (đổi số dư)
        super._update(from, to, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
