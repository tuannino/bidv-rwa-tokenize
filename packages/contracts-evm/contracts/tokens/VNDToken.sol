// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VNDToken (tVND — Tokenized VND)
 * @notice Token thanh toán đại diện tiền gửi VND, do ngân hàng phát hành/thu hồi.
 *         Dùng làm phương tiện chi trả lợi nhuận (ProfitDistributor) và hoàn vốn (Redemption).
 *
 *         Số thập phân mặc định 0 (1 đơn vị = 1 VND) cho số học minh bạch. Trong triển
 *         khai thật, đây nên là tiền gửi token hóa cũng có kiểm soát (whitelist/tuân thủ);
 *         ở đây để tối giản, chỉ gắn quyền mint/burn cho ngân hàng.
 */
contract VNDToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint8 private immutable _customDecimals;

    constructor(address admin) ERC20("Tokenized VND", "tVND") {
        require(admin != address(0), "admin = 0");
        _customDecimals = 0;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    /// @notice Ngân hàng nạp VND on-chain (tương ứng ghi nợ tài khoản tiền gửi thật).
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /// @notice Ngân hàng thu hồi VND on-chain (tương ứng chi trả ra ngoài chuỗi).
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }
}
