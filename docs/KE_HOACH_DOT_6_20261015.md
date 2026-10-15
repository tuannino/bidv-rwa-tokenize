# Kế hoạch đợt 6 cập nhật ngày 15/10/2026

> Nền: `dev` @ `945c833` (PR #51, FE-27). Căn cứ: DS-01 bản 2 (chủ dự án chốt 15/10).

## 1. Đóng đợt 5

| Việc | Trạng thái |
|---|---|
| OP-07 | Đã merge. Chờ chủ dự án thử hai trình duyệt trên chain mock, gửi request ID |
| FE-27 | Đã merge (PR #51) |
| OP-06 | Đã merge. Chờ chủ dự án thử Mint/Burn Sepolia hai trình duyệt. **Nên làm trước khi SC-09 merge**, vì sau đó chain `evm` chờ triển khai lại |

## 2. Thứ tự đợt 6 (đề xuất 23/10 đến 14/11)

| Thứ tự | Mã | Tên | Điểm | Mức | Phụ thuộc |
|---|---|---|---|---|---|
| 1 | **SC-09** (mới) | Tầng token theo ERC-3643 (phương án C), `permit` VNDB và WPT, module tuân thủ mặc định cho phép | 10,5 | Cao | FE-27 |
| 1b | (chủ dự án) | Triển khai lại Sepolia lần một theo runbook SC-09 | | | SC-09 |
| 2 | SC-07 | Vault thanh toán SPV: luật khoá `FIXED`/`PERCENT`, chốt kỳ bằng số đẩy từ ngoài chuỗi, hiển thị công khai cho GDV/KSV | 10 | Cao | SC-09 |
| 3 | SC-03 | Hợp đồng khớp lệnh nguyên tử, `orderRef`, dùng `permit` | 13 | Cao | SC-07 |
| 4 | FE-05 | Nhà đầu tư ký `permit` qua ví đã kết nối | 3 | Vừa | SC-03 |
| 5 | OP-05 | Triển khai lại Sepolia lần hai (vault, khớp lệnh) | 2 | Vừa | SC-03 |
| Song song | IN-03, IN-04 | Fireblocks | 10 | | chờ CH-A, CH-B, CH-C |

Đợt 6 từ 38 lên 48,5 điểm (thêm SC-09). Mốc kết thúc lùi khoảng 2 ngày làm việc so với kế hoạch ngày
14/10 (12/11 thành 14/11). Đợt 7, 8 lùi tương ứng nếu không có bù.

## 3. Quyết định mới (DS-01 bản 2)

- QĐ-8 huỷ: chia lợi nhuận theo tổng cung; phần của SPV đẩy vào vault (QĐ-12).
- QĐ-9: WPT theo kiến trúc ERC-3643, không ONCHAINID, làm ngay đợt 6.
- QĐ-10: `permit` cho VNDB.
- QĐ-11: không dùng `ProfitDistributorOracle`, `EnergyOracle`.
- QĐ-13: chốt kỳ `PERCENT` bằng số ngoài chuỗi, không qua lập duyệt GDV, có hiển thị công khai.

## 4. Rủi ro

- SC-09 đổi bytecode hai token: hardhat-local phải `reset`; chain `evm` ngừng tới khi chủ dự án triển
  khai lại. Hai lần triển khai lại Sepolia trong đợt 6 (SC-09, OP-05); testnet nên chi phí nhỏ.
- Mã `SC-09` trùng dải mã cũ "SC-06 đến SC-13 (gộp)" trong bảng kế hoạch v6.1; trong repo
  (`task-status.json`) chưa dùng. Cập nhật ghi chú bảng kế hoạch khi sửa xlsx.
