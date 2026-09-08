---
inclusion: always
foundationalType: product
---
# Sản phẩm — BIDV RWA Tokenize (ĐIỆN GIÓ)

## Mục đích
Token hóa dự án **điện gió** theo góc ngân hàng BIDV: phát hành token quyền hưởng có kiểm soát, chia lợi tức theo sản lượng, hoàn vốn. Đây là PoC.

## Người dùng
- **Cán bộ ngân hàng (BANK_ADMIN)**: phát hành (mint), whitelist/KYC, chia lợi tức, xử lý ngoại lệ.
- **Nhà đầu tư (INVESTOR)**: nắm giữ token, nhận lợi tức, hoàn vốn.
- (Sau) Compliance, Auditor, Regulator (chỉ đọc).

## Ưu tiên số 1
**Ra demo luồng MINT sớm nhất.** Mọi thứ không phục vụ mint → để phase sau. Dựng bằng mock trước, thay real sau.

## Không làm ở giai đoạn đầu (non-goals)
Fireblocks/HSM thật, T-REX onboarding, Stellar, EVM testnet, KYC/Core Bank thật, maker-checker đầy đủ. Nhưng **thiết kế phải chừa chỗ cắm** các thứ này.
