# DS-01: Kiến trúc hợp đồng đợt 6 (đã duyệt)

| | |
|---|---|
| Người viết | Supervisor |
| Trạng thái | **Đã duyệt** ngày 08/10/2026. Câu trả lời CH-1 đến CH-5 ở mục 5 |
| Áp cho | SC-07 (vault thanh toán), SC-03 (khớp lệnh), FE-05 (ủy quyền của Nhà đầu tư), OP-05 (Sepolia lần hai); ảnh hưởng SC-06, BE-18, BE-13 ở đợt 7 |
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
  đã chia ở kỳ trước; vault tự tính `lockedAmount`. Khi SC-06 có, vault đọc thẳng số đó từ vault chia
  lợi nhuận thay vì nhận từ máy chủ.
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

**QĐ-8. Mẫu số chia lợi nhuận phải trừ phần trong vault.** Không làm ở đợt 6, nhưng SC-06 và BE-18
bắt buộc xử lý: mẫu số là tổng cung tại ảnh chụp trừ số dư của vault tại ảnh chụp. Ghi vào kế hoạch
để không bị quên.

## 4. Tác động tới các task

| Task | Thay đổi so với kế hoạch |
|---|---|
| SC-07 | Hợp đồng vault theo QĐ-5, QĐ-6; adapter đọc số dư và phần khoá; whitelist vault khi triển khai |
| SC-03 | Hợp đồng khớp lệnh theo QĐ-3, QĐ-4; thêm `orderRef` vào lời gọi thực hiện; thêm hàm đọc ủy quyền WPT vào `ILedgerPort`; gỡ 5 điểm chặn SC-03; nối `orderRef` với mã lệnh BE-17 |
| FE-05 | Nút cấp ủy quyền VNDB và WPT qua ví đã kết nối, hiện mức đã cấp; chỉ hiện khi chain thật |
| OP-05 | Triển khai lại Sepolia theo QĐ-2; runbook dùng `fund-sepolia.js` (OP-04) cấp vừa đủ phí từ tài khoản tổng cho ví Nhà đầu tư thử trước bước `approve` (CH-3) |
| BE-17 | Không sửa trong đợt 6; khi SC-03 xong, cập nhật nợ P2 "khoảng trống phát giao dịch" thành đã đóng nhờ QĐ-4 |
| SC-06, BE-18 | Thêm QĐ-8 vào phạm vi |
| IN-04 | Địa chỉ Fireblocks nhận `MINTER_ROLE`, `AGENT_ROLE` trên `ProjectToken`; chưa nhận vai trên vault ở đợt 6 |

## 5. Câu hỏi và câu trả lời của chủ dự án (08/10/2026)

| Mã | Câu hỏi | Đề xuất của Supervisor | Chủ dự án chốt |
|---|---|---|---|
| CH-1 | Phần khoá kỳ đầu: "giá trị lượng token đã bán ra" là (a) WPT đang lưu hành nhân giá phát hành, hay (b) VNDB vault thu ròng từ bán WPT (thu khi bán trừ chi khi mua lại)? | (b): đúng số tiền thật đã vào ví, không phụ thuộc giá có thể đã đổi | Đồng ý (b). Giá token đang cố định nên hai cách như nhau |
| CH-2 | Khi Nhà đầu tư bán lại WPT, tiền trả từ vault có bị chặn bởi phần khoá không? | **Không chặn**: phần khoá là giới hạn rút của SPV, không phải giới hạn nghĩa vụ trả Nhà đầu tư. Chặn thì Nhà đầu tư có thể bị kẹt không bán được | Không chặn (bản thử) |
| CH-3 | Trên Sepolia, ai trả ETH cho giao dịch `approve` của Nhà đầu tư? | Ngân hàng chuyển một ít ETH thử cho ví Nhà đầu tư khi whitelist (chỉ testnet), ghi trong runbook OP-05 | Chủ dự án có tài khoản tổng chứa SepoliaETH. Bước nào có phí thì chuyển **vừa đủ phí** từ tài khoản tổng sang ví đang thử, rồi chạy luồng bình thường. Áp cho mọi task dùng Sepolia (OP-04, IN-03, OP-05) |
| CH-4 | Đồng ý tách vault và hợp đồng khớp lệnh (QĐ-1)? | Đồng ý | Đồng ý |
| CH-5 | Đồng ý ghi nhận giả định tin cậy ở QĐ-6 cho bản thử, xử lý ở giai đoạn sau? | Đồng ý | Đồng ý |

## 6. Không thuộc tài liệu này

- Thiết kế vault chia lợi nhuận và luồng chia mới (BE-18, SC-06) ở đợt 7.
- Fireblocks (IN-03 nghiên cứu trước).
- Xác thực Nhà đầu tư bằng chữ ký ví (AU-01).
