# DS-01: Kiến trúc hợp đồng đợt 6 (đã duyệt, bản 5)

| | |
|---|---|
| Người viết | Supervisor |
| Trạng thái | **Đã duyệt** ngày 08/10/2026 (CH-1 đến CH-5, mục 5). **Bản 2 ngày 15/10/2026**: huỷ QĐ-8, thêm QĐ-9 đến QĐ-14 (mục 7). **Bản 3 ngày 19/10/2026**: QĐ-15 đến QĐ-19 theo góp ý thiết kế (mục 8). **Bản 4 ngày 19/10/2026**: QĐ-20 đến QĐ-26 khi chốt spec SC-07 (mục 9). **Bản 5 ngày 20/10/2026**: QĐ-27 đến QĐ-31 khi chốt spec SC-06, cập nhật QĐ-13 (mục 10) |
| Áp cho | SC-09 (tầng token ERC-3643 và permit), SC-07 (vault thanh toán), SC-03 (khớp lệnh), FE-05 (ủy quyền của Nhà đầu tư), OP-05 (Sepolia lần hai); ảnh hưởng SC-06, BE-18, BE-13 ở đợt 7 |
| Nền | `dev` @ `e4dd889` |

Tài liệu này không phải spec giao việc. Nó chốt các quyết định kiến trúc mà spec SC-07 và SC-03
sẽ dựa vào. Mục 5 ghi câu trả lời của chủ dự án; các chỗ trong mục 3, 4 đã sửa theo câu trả lời.

## 1. Hiện trạng đã đo

```bash
ls packages/contracts-evm/contracts packages/contracts-evm/contracts/tokens
# ProfitDistributor, ProfitDistributorOracle, Redemption, ProjectToken, VNDToken. KHONG co hop dong khop lenh
grep -n "@blocked SC-03" app/src/lib/ledger/evm.adapter.ts
# 5: quotePurchase, setPurchasePrice, paymentAllowanceOf, executePurchase, executeSale
grep -n "function burn\|BURNER_ROLE" packages/contracts-evm/contracts/tokens/VNDToken.sol
grep -n "function forcedTransfer\|function agentBurn" packages/contracts-evm/contracts/tokens/ProjectToken.sol
grep -n "totalSupplyAt\|supplyAtSnapshot" packages/contracts-evm/contracts/ProfitDistributor.sol
grep -n "KHÔNG kiểm uỷ quyền WPT" app/src/lib/ledger/mock.adapter.ts
```

- `ILedgerPort` đã mô tả hợp đồng khớp lệnh: giá nằm **trong hợp đồng khớp lệnh**, mua và bán đều
  nguyên tử, Nhà đầu tư cấp ủy quyền VNDB cho hợp đồng khớp lệnh (`paymentAllowanceOf`).
- Chiều **bán** cần Nhà đầu tư cấp ủy quyền **WPT**, nhưng `ILedgerPort` chưa có hàm đọc ủy quyền WPT.
  Câu hỏi này đã mở từ checkpoint BE-14.
- `VNDToken` có `BURNER_ROLE` đốt được VNDB của **mọi** địa chỉ. `ProjectToken` có `AGENT_ROLE` với
  `forcedTransfer` và `agentBurn` trên mọi địa chỉ. Hai quyền này chạm được vào tài sản trong vault.
- `ProfitDistributor` chia theo `totalSupplyAt(snapshot)`. Tổng cung **gồm cả WPT chưa bán nằm trong
  ví SPV**, nên phần của ví SPV bị tính vào mẫu số. URD ghi token trong kho người bán không nhận lợi
  tức, nên cách tính này làm nhà đầu tư nhận ít hơn đúng phần.

## 2. Bức tranh tổng thể

```
Nhà đầu tư (ví tự giữ khoá)
   |  approve VNDB (mua), approve WPT (bán)      [FE-05]
   v
Hợp đồng khớp lệnh (SC-03)  -- giữ giá, thực hiện lệnh, phát sự kiện kèm mã lệnh
   |  có vai MATCHER trên vault
   v
Vault thanh toán SPV (SC-07) -- giữ WPT chưa bán + VNDB thu về, luật khoá, đường rút của SPV
   ^  là spvWallet đăng ký trong ProjectToken (SC-02)
   |
Máy chủ ngân hàng (ISigner; đợt 6 thêm Fireblocks cho Mint/Burn)
```

## 3. Các quyết định đề xuất

**QĐ-1. Tách vault và hợp đồng khớp lệnh thành hai hợp đồng.**
Vault giữ tiền và luật khoá, ít khi phải đổi. Hợp đồng khớp lệnh giữ giá và logic lệnh, là phần hay
đổi nhất. Tách ra thì thay phiên bản khớp lệnh chỉ cần thu vai MATCHER của bản cũ và cấp cho bản mới,
tiền không phải di chuyển. Phương án gộp một hợp đồng đơn giản hơn ở lần đầu nhưng mỗi lần sửa logic
lệnh là phải chuyển toàn bộ tài sản sang hợp đồng mới.

**QĐ-2. Ví SPV đăng ký trong `ProjectToken` là địa chỉ vault, đổi bằng cách triển khai lại.**
SC-02 không có hàm đổi ví (giữ bất biến). Trên testnet, OP-05 triển khai lại toàn bộ bộ hợp đồng và
lần Mint đầu đi thẳng vào vault. Vault phải được whitelist trước lần Mint đó. Thứ tự triển khai: giữ
nguyên bốn hợp đồng hiện có, **thêm vault và hợp đồng khớp lệnh vào cuối**, để địa chỉ hardhat của
bốn hợp đồng cũ không đổi.

**QĐ-3. Nhà đầu tư tự giữ khoá, cấp ủy quyền cho hợp đồng khớp lệnh; ngân hàng gọi lệnh thực hiện.**
Đúng với mô hình đang có trên `mock` (`paymentAllowanceOf`) và luồng BE-17 (lệnh đặt ngoài chuỗi,
ngân hàng quyết toán). SC-03 thêm hàm đọc ủy quyền WPT vào `ILedgerPort` để chiều bán kiểm được
trước khi gửi. Phương án mạnh hơn là Nhà đầu tư ký lệnh theo EIP-712 để hợp đồng tự kiểm chữ ký, khi
đó ngân hàng không thể thực hiện lệnh nào Nhà đầu tư chưa ký. Đề xuất ghi là việc tăng cường về sau,
không làm ở đợt 6.

Hệ quả: trên Sepolia, ví Nhà đầu tư cần ETH để gửi giao dịch `approve`. Theo CH-3: trước mỗi bước có
phí, tài khoản tổng của chủ dự án chuyển **vừa đủ phí** cho ví đang thử (script `fund-sepolia.js` của
OP-04), rồi chạy luồng như bình thường.

**QĐ-4. Mỗi lệnh lên chuỗi mang mã lệnh, hợp đồng khớp lệnh từ chối mã đã dùng.**
`execute` nhận thêm `orderRef` (mã lệnh BE-17), phát trong sự kiện, và lưu đã dùng. Lợi ích kép:
đối soát nối thẳng được lệnh trong cơ sở dữ liệu với giao dịch trên chuỗi; và gửi lại cùng một lệnh
**không thể quyết toán hai lần ngay trên chuỗi**. Điều này đóng luôn khoảng trống P2 của BE-17
("tiến trình chết sau khi phát giao dịch nhưng trước khi lưu mã"): đường can thiệp gửi lại được an
toàn vì hợp đồng tự chặn trùng.

**QĐ-5. Luật khoá nằm trong vault.**
- Vault lưu `lockedAmount` đang hiệu lực. Rút của SPV chỉ qua được khi số dư VNDB trừ số rút vẫn
  không nhỏ hơn `lockedAmount`.
- `FIXED`: vai CONFIG đặt thẳng `lockedAmount`.
- `PERCENT`: vai CONFIG đặt tỷ lệ (đơn vị phần vạn). Đầu mỗi kỳ, máy chủ gọi hàm chốt kỳ với số VNDB
  đã chia ở kỳ trước; vault tự tính `lockedAmount`. Số này luôn do máy chủ đẩy lên, vault không đọc
  thẳng vault chia lợi nhuận (sửa theo QĐ-13).
- Kỳ đầu (CH-1, đã chốt): `lockedAmount` = tỷ lệ nhân **VNDB vault thu ròng từ bán WPT** (thu khi bán
  trừ chi khi mua lại). Vault tự cộng trừ con số này mỗi lần `MATCHER` thực hiện lệnh.
- Phần khoá **không chặn** tiền trả Nhà đầu tư khi bán lại WPT (CH-2, bản thử): đường chi của `MATCHER`
  không kiểm `lockedAmount`, chỉ đường rút của SPV kiểm. Hệ quả: sau một lệnh mua lại lớn, số dư có thể
  xuống dưới `lockedAmount`; khi đó SPV không rút được gì cho tới khi số dư lên lại. SC-07 phải có kiểm
  thử cho ca này.
- Kiểm soát viên cấu hình trên màn (FE-07, đợt 7); trước khi có màn, dùng script.

**QĐ-6. Vai trên hợp đồng.**

| Hợp đồng | Vai | Ai giữ trong bản thử | Về sau |
|---|---|---|---|
| Vault | `DEFAULT_ADMIN` | khoá ký máy chủ | ví đa chữ ký kèm khoá thời gian |
| Vault | `MATCHER` | **chỉ** hợp đồng khớp lệnh | giữ |
| Vault | `CONFIG` | khoá ký máy chủ, thay Kiểm soát viên | ví riêng của bộ phận kiểm soát |
| Vault | `WITHDRAWER` | khoá ký máy chủ, sau khi SPV xác nhận OTP | Fireblocks |
| Khớp lệnh | `OPERATOR` | khoá ký máy chủ | Fireblocks |
| Khớp lệnh | `PRICE` | khoá ký máy chủ, thay Giao dịch viên | ví riêng |

Giả định tin cậy phải ghi rõ: trong bản thử, **người giữ khoá ký máy chủ vẫn chạm được vào tài sản
trong vault** qua `BURNER_ROLE` của `VNDToken` và `AGENT_ROLE` của `ProjectToken`. Luật khoá chặn
được SPV, chưa chặn được quản trị ngân hàng. Đường Burn lập duyệt (SC-02) cố ý dùng `agentBurn` trên
ví SPV, nên **phải giữ** `AGENT_ROLE`; vault không cần làm gì thêm để Burn chạy.

**QĐ-7. Không dùng proxy nâng cấp.** Trên testnet, đổi bytecode thì triển khai lại. Hợp đồng khớp
lệnh thay được nhờ QĐ-1.

**QĐ-8. ~~Mẫu số chia lợi nhuận phải trừ phần trong vault.~~ HUỶ ngày 15/10/2026.** Chủ dự án chốt:
lợi nhuận tính cho cả dự án, WPT chưa bán do SPV nắm giữ nên SPV được hưởng phần tương ứng. Mẫu số
giữ là tổng cung tại ảnh chụp, đúng như `ProfitDistributor` hiện có. Xem QĐ-12.

## 4. Tác động tới các task

| Task | Thay đổi so với kế hoạch |
|---|---|
| SC-09 (mới) | Làm trước SC-07: WPT theo kiến trúc ERC-3643 (QĐ-9), `permit` cho VNDB (QĐ-10) |
| SC-07 | Hợp đồng vault theo QĐ-5, QĐ-6, QĐ-13; adapter đọc số dư và phần khoá; **đăng ký vault vào `IdentityRegistry`** khi triển khai (thay cho whitelist) |
| SC-03 | Hợp đồng khớp lệnh theo QĐ-3, QĐ-4; thêm `orderRef` vào lời gọi thực hiện; thêm hàm đọc ủy quyền WPT vào `ILedgerPort`; gỡ 5 điểm chặn SC-03; nối `orderRef` với mã lệnh BE-17 |
| FE-05 | Nhà đầu tư ký `permit` VNDB ngoài chuỗi, ngân hàng gửi hộ (QĐ-10); không còn cần ETH cho bước ủy quyền VNDB. Chỉ hiện khi chain thật |
| OP-05 | Triển khai lại Sepolia theo QĐ-2; runbook dùng `fund-sepolia.js` (OP-04) cấp vừa đủ phí từ tài khoản tổng cho ví Nhà đầu tư thử trước bước `approve` (CH-3) |
| BE-17 | Không sửa trong đợt 6; khi SC-03 xong, cập nhật nợ P2 "khoảng trống phát giao dịch" thành đã đóng nhờ QĐ-4 |
| SC-06, BE-18 | Chia theo tổng cung (QĐ-12); đẩy phần của SPV vào vault bằng `distributeTo` |
| IN-04 | Địa chỉ Fireblocks nhận `MINTER_ROLE`, `AGENT_ROLE` trên `ProjectToken`; chưa nhận vai trên vault ở đợt 6 |

## 5. Câu hỏi và câu trả lời của chủ dự án (08/10/2026)

| Mã | Câu hỏi | Đề xuất của Supervisor | Chủ dự án chốt |
|---|---|---|---|
| CH-1 | Phần khoá kỳ đầu: "giá trị lượng token đã bán ra" là (a) WPT đang lưu hành nhân giá phát hành, hay (b) VNDB vault thu ròng từ bán WPT (thu khi bán trừ chi khi mua lại)? | (b): đúng số tiền thật đã vào ví, không phụ thuộc giá có thể đã đổi | Đồng ý (b). Giá token đang cố định nên hai cách như nhau |
| CH-2 | Khi Nhà đầu tư bán lại WPT, tiền trả từ vault có bị chặn bởi phần khoá không? | **Không chặn**: phần khoá là giới hạn rút của SPV, không phải giới hạn nghĩa vụ trả Nhà đầu tư. Chặn thì Nhà đầu tư có thể bị kẹt không bán được | Không chặn (bản thử) |
| CH-3 | Trên Sepolia, ai trả ETH cho giao dịch `approve` của Nhà đầu tư? | Ngân hàng chuyển một ít ETH thử cho ví Nhà đầu tư khi whitelist (chỉ testnet), ghi trong runbook OP-05 | Chủ dự án có tài khoản tổng chứa SepoliaETH. Bước nào có phí thì chuyển **vừa đủ phí** từ tài khoản tổng sang ví đang thử, rồi chạy luồng bình thường. Áp cho mọi task dùng Sepolia (OP-04, IN-03, OP-05) |
| CH-4 | Đồng ý tách vault và hợp đồng khớp lệnh (QĐ-1)? | Đồng ý | Đồng ý |
| CH-5 | Đồng ý ghi nhận giả định tin cậy ở QĐ-6 cho bản thử, xử lý ở giai đoạn sau? | Đồng ý | Đồng ý |

## 7. Bổ sung bản 2 (chủ dự án chốt 15/10/2026)

**QĐ-9. WPT theo kiến trúc ERC-3643, phần lõi đơn giản (phương án C), làm ngay đợt 6.**
- Tách ba phần như ERC-3643: token (`ProjectToken`), sổ danh tính (`IdentityRegistry`), bộ luật giao
  dịch (`ModularCompliance` kèm module). Token hỏi sổ danh tính `isVerified` và hỏi bộ luật
  `canTransfer` ở mọi lần chuyển.
- Các hàm của token đặt **đúng tên, tham số và sự kiện** như `IToken` của T-REX v4 cho phần đã làm,
  để về sau thay bằng T-REX thật thì phía ứng dụng không phải đổi.
- **Không dùng ONCHAINID**: sổ danh tính lưu thẳng ví, quốc gia, trạng thái. `recoveryAddress` (cần
  ONCHAINID) không làm.
- Giữ phần riêng của dự án: snapshot cho chia lợi nhuận, luật SC-02 (ví SPV, phát hành lần đầu, mint
  chỉ vào ví SPV).
- Bộ T-REX đầy đủ đã có sẵn ở `packages/contracts-evm/trex` (solc 0.8.17, OpenZeppelin v4, không trộn
  được vào project chính 0.8.28): giữ làm tài liệu tham chiếu "bản sản xuất".

**QĐ-10. `permit` (ERC-2612) cho VNDB, đợt 6.** Nhà đầu tư ký ủy quyền ngoài chuỗi, ngân hàng gửi
giao dịch hộ. Ví Nhà đầu tư không cần ETH cho bước ủy quyền VNDB trên Sepolia.

**QĐ-11. Không dùng `ProfitDistributorOracle` và `EnergyOracle` trong bản thử.** Lợi nhuận do SPV nạp
VNDB, Kiểm soát viên duyệt. Giữ mã, không triển khai, không nối vào ứng dụng.

**QĐ-12. Chia lợi nhuận theo tổng cung tại ảnh chụp** (thay QĐ-8). Phần của SPV (WPT chưa bán nằm
trong vault) được đẩy vào vault bằng `distributeTo`, vì vault là hợp đồng, không tự nhận được. VNDB
lợi nhuận vào vault cộng vào số dư rút được theo hạn mức, **không** cộng vào "VNDB thu ròng từ bán WPT".

**QĐ-13. Chốt kỳ `PERCENT` bằng số liệu ngoài chuỗi đẩy lên** (sửa QĐ-5).
- Máy chủ đọc tổng VNDB đã chia kỳ trước từ database, vai `CONFIG` gọi `closePeriod(periodRef,
  distributedPrev)`; vault tự tính `lockedAmount`, lưu, phát sự kiện. Mỗi `periodRef` chốt một lần.
- Vault thanh toán **không** đọc trực tiếp vault chia lợi nhuận: hai hợp đồng độc lập.
- **Không qua lập duyệt GDV**; Kiểm soát viên (vai cấu hình) tự đặt. Bắt buộc **hiển thị công khai**
  cho Giao dịch viên và Kiểm soát viên: kỳ, số đã chia kỳ trước, tỷ lệ, phần khoá, người đặt, thời
  điểm, mã giao dịch.

**QĐ-14. Chia lợi nhuận: ngân hàng trả theo lô (đẩy), giữ sẵn đường nhà đầu tư tự nhận** (chủ dự án chốt 16/10/2026).
- Bản thử chỉ làm đường ngân hàng trả hộ (`distributeTo` theo lô). Không làm giao diện "tự bấm nhận".
- Hợp đồng SC-06 **giữ** `claim` và sự kiện `Claimed`; kiểm thử ca vừa tự nhận vừa trả lô (không trả hai lần).
- Backend xác định "đã trả" bằng **trạng thái đọc từ chuỗi** (dấu đã nhận, sự kiện), không chỉ dựa vào kết quả lô mình gửi. Nhờ vậy mở "tự nhận" về sau chỉ còn là việc giao diện (ước 6 đến 8 điểm nếu làm đủ).
- Phần của SPV (vault) luôn trả hộ vì hợp đồng không tự nhận được.

## 8. Bổ sung bản 3 (góp ý thiết kế, chủ dự án chốt 19/10/2026)

Nguồn: sáu góp ý của developer sau khi đọc sơ đồ #SC, DS-01 bản 2 và mã SC-09. Supervisor tái hiện được
lỗi ở góp ý 1 trên Hardhat. Kiến trúc tổng thể giữ nguyên.

**QĐ-15. Quyết toán hai chiều trong một giao dịch (cho SC-03).**

| Lệnh | Chân WPT | Chân VNDB | Nhà đầu tư ủy quyền cho |
|---|---|---|---|
| Mua | Vault chuyển cho nhà đầu tư | OrderSettlement kéo từ nhà đầu tư vào vault | OrderSettlement (VNDB) |
| Bán lại | OrderSettlement kéo từ nhà đầu tư vào vault | Vault trả cho nhà đầu tư | OrderSettlement (WPT) |

- Hai chân cùng thành công hoặc cùng hoàn lại. WPT bị chặn (KYC, đóng băng, bộ luật) thì VNDB không chuyển;
  vault thiếu VNDB thì WPT không chuyển. Phần khoá không chặn chân trả tiền bán lại.
- OrderSettlement chỉ là spender, không giữ WPT nên **không** đăng ký sổ danh tính. Vault giữ WPT nên
  **bắt buộc** đăng ký.

**QĐ-16. Giới hạn của `permit`.** `permit` chỉ cấp quyền chi token, không xác nhận giá, chiều hay
`orderRef`. Giữ giả định tin cậy QĐ-6: ngân hàng là bên thực hiện lệnh. Số ủy quyền bằng đúng số của lệnh,
có hạn thực hiện. `permit` bọc `try/catch`; nếu đã bị gửi trước (lỗi nonce) nhưng `allowance` vẫn đủ thì
lệnh chạy tiếp. EIP-712 cho lệnh do nhà đầu tư ký vẫn là việc tăng cường về sau.

**QĐ-17. Dấu chống trùng `orderRef` lưu trong vault** (sửa QĐ-4). Vault tồn tại lâu dài, nên thay
OrderSettlement bản mới không làm mất lịch sử. Vault phát sự kiện `OrderSettled` (orderRef dạng indexed,
nhà đầu tư, chiều, số WPT, số VNDB, giá) để backend tìm lại giao dịch đã thành công khi mất tx hash. Đây là
cách đóng khoảng trống đối soát BE-17.

**QĐ-18. Đường cưỡng chế và module có trạng thái.** `forcedTransfer`, `burn` của agent bỏ qua kiểm tra
`canTransfer` nhưng **vẫn báo** `transferred` / `destroyed` cho bộ luật (như T-REX). Module có lưu trạng
thái chỉ được gắn khi token chưa có người nắm giữ, hoặc phải có hàm khởi tạo số liệu do agent gọi. Làm ở
SC-10.

**QĐ-19. Công thức và thời điểm của phần khoá** (bổ sung QĐ-5, QĐ-13, chủ dự án chốt theo đề xuất).
- Kỳ đầu: phần khoá = tỷ lệ nhân thu ròng bán WPT, **cập nhật sau từng lệnh** cho tới lần chốt kỳ đầu.
- "Đã chia kỳ trước" = số VNDB đã nạp quỹ kỳ đó (`amount` của `createDistribution`), **gồm phần SPV**.
- Thu ròng dừng ở 0, không âm; khi đó phần khoá bằng 0.
- Số được rút = số dư trừ phần khoá nếu dương, ngược lại bằng 0 (không để phép trừ gây lỗi).
- Mã kỳ tăng liên tiếp, mỗi kỳ chốt một lần, không chốt lại kỳ cũ.
- Tỷ lệ `PERCENT` mới có hiệu lực từ lần chốt kỳ kế tiếp; số khoá `FIXED` có hiệu lực ngay.

**Lỗi đã xác nhận: `ProfitDistributor` cho chi sau khi quét.** `sweepDust` đặt `claimed = amount` nhưng
`_claim` không kiểm, và mọi kỳ dùng chung một quỹ VNDB: claim kỳ A sau khi quét lấy tiền kỳ B (kỳ A ghi chi
200 trên quỹ 100). Sửa ở SC-10, trước khi dùng chia lợi nhuận nhiều kỳ.

## 9. Bổ sung bản 4 (chủ dự án chốt 19/10/2026, khi chốt spec SC-07)

**QĐ-20. Một phương án: ví SPV là vault, một chain `evm`.** Không chạy song song phương án ví SPV thường.
Điểm khôi phục phương án cũ: commit `3342c2e` trên `dev`, tag `poc-spv-vi-thuong-20261019` (ghi ở
`tech-report.md`). OP-05 triển khai lại `evm` có vault và ghi đè bộ địa chỉ hiện tại.

**QĐ-21. Phần khoá `PERCENT` kỳ đầu** (làm rõ QĐ-19): tỷ lệ nhân giá trị token đã bán đang lưu hành, tức
tổng VNDB vault thu ròng (`netProceeds`). Trước lần chốt kỳ đầu, đổi tỷ lệ có hiệu lực ngay; từ sau lần chốt
đầu, tỷ lệ mới áp ở lần chốt kế tiếp. Phép nhân chia dùng `Math.mulDiv`, làm tròn xuống.

**QĐ-22. Tạm dừng chỉ chặn rút tiền của SPV** (`PAUSER_ROLE`), không chặn quyết toán. Tạm dừng quyết toán
đặt ở hợp đồng khớp lệnh (SC-03).

**QĐ-23. Ví nhận tiền rút cố định** (`payoutWallet`), phải đã xác minh trong sổ danh tính, admin đặt.
Giả định tin cậy: bản thử dùng một khoá máy chủ cho admin và rút, nên `payoutWallet` chỉ ngăn nhập nhầm
đích, không bảo vệ khi khoá lộ. Tách khoá hoặc đổi ví hai bước có thời gian chờ là việc giai đoạn sau.

**QĐ-24. `MATCHER_ROLE` là biên tin cậy đặc quyền.** Vault không tự chứng minh chân vào; giữ QĐ-15 (hợp
đồng khớp lệnh là bên được ủy quyền). Vault kiểm `price > 0` và `vndbAmount == wptAmount * price`. Dùng
`AccessControlEnumerable` để kiểm được số người giữ vai.

**QĐ-25. Vault khởi tạo `UNSET` (khoá toàn bộ)** cho tới khi Kiểm soát viên cấu hình: lỗi quên cấu hình rơi
về phía an toàn, không viết cứng con số nghiệp vụ trong mã.

**QĐ-26. PERCENT theo DS-01 thay cho FE-21.** Chain có vault đọc khoá trên chuỗi. Gỡ PERCENT kiểu FE-21
(phần trăm số dư lúc rút) và mô phỏng khoá DS-01 trên chain mock gộp vào BE-13. `periodRef` trên chuỗi là
bộ đếm độc lập; ánh xạ với `periodKey` của database thuộc SC-06. Address book lưu `deployBlock` để đọc sự
kiện.

## 10. Bổ sung bản 5 (chủ dự án chốt 20/10/2026, khi chốt spec SC-06)

**QĐ-27. `ProfitDistributor` là quỹ chia một chiều.** Tiền vào bằng chuyển VNDB thường; chỉ `_claim` (trả cho người
được chia) chuyển tiền ra. Sổ dự trữ `totalReserved` tách tiền đang nợ các kỳ khỏi phần chưa phân bổ. Kỳ mới tạo bằng
`createDistributionFromPool(period)` lấy đúng phần chưa phân bổ.

**QĐ-28. Phần còn lại sau hạn nhận trở về quỹ.** `closeDistribution(id)` thay `sweepDust(id, to)`: không chuyển tiền,
phần còn lại vào kỳ chia sau. Ví không nhận kịp trong hạn mất phần kỳ đó.

**QĐ-29. Mã kỳ chống trùng trên chuỗi, có tiền tố chain.** Nhãn kỳ dùng một lần (`DuplicatePeriod`), tra ngược bằng
`distributionIdOfPeriod`; ứng dụng giữ chỗ kỳ (`OPENING`) và phục hồi khi mất biên nhận. Mã kỳ có tiền tố chain
(`mock:2026-Q1`).

**QĐ-30. Phần của SPV được chia vào vault**, ví SPV có trong danh sách người nhận ở mọi chain (thực thi QĐ-12).
Tiến trình tự động (BE-07) mở kỳ theo phần chưa phân bổ, không theo mốc số dư.

**QĐ-31. Kỳ hết hạn và kỳ đóng có trạng thái kết thúc riêng** (`EXPIRED`, `CLOSED`), không chặn kỳ mới; phần chưa
trả không bao giờ ghi là đã trả. SC-05 gộp vào SC-06.

**Cập nhật QĐ-13.** Số "đã chia kỳ trước" được **tự động** đẩy vào `closePeriod` của vault thanh toán ngay khi mở kỳ
chia, đúng một lần cho mỗi kỳ (giữ chỗ mã kỳ vault, đối soát sự kiện trước khi gửi lại). Đây là tiền **đã dành cho
kỳ** (gồm phần SPV), không phải tiền đã tới tay người nhận. Kiểm soát viên vẫn đặt tỷ lệ và chế độ khoá, thấy lịch sử
công khai trên `/vault`; script `vault-admin.js close-period` không dùng khi luồng tự động đang chạy.

## 6. Không thuộc tài liệu này

- Thiết kế vault chia lợi nhuận và luồng chia mới (BE-18, SC-06) ở đợt 7.
- Fireblocks (IN-03 nghiên cứu trước).
- Xác thực Nhà đầu tư bằng chữ ký ví (AU-01).
