# FE-23: Nhà đầu tư rút VNDB ra ví ngoài, yêu cầu

Nền: `dev` @ `a7151b8` (sau merge FIX-01, PR #75). Người viết: giám sát. Nguồn: chủ dự án 28/10/2026 (làm nhanh, theo mẫu màn "Tạo lệnh rút" của Người bán).

## 1. Bối cảnh và mục tiêu

- Màn `/withdraw` "Rút VNDB" của Nhà đầu tư đang là trang chờ (`PlaceholderPage`, đánh dấu `@pending FE-23`).
- VNDB của Nhà đầu tư nằm trong CHÍNH ví của họ (ví đã định danh, FIX-01), không nằm trong vault. Máy chủ không có quyền chuyển VNDB của ví đó. Vì vậy giao dịch rút do ví của Nhà đầu tư ký và gửi (chủ dự án chốt), Nhà đầu tư tự trả phí gas.
- Mục tiêu: Nhà đầu tư chuyển VNDB từ ví đang kết nối (đã định danh) sang một ví nhận đã whitelist; hệ thống ghi lệnh, kiểm kết quả trên chuỗi, có lịch sử và sổ kiểm toán.

## 2. Quyết định

- **QĐ-1: ví ký là ví trình duyệt của Nhà đầu tư.** Máy chủ lập lệnh; khi Nhà đầu tư bắt đầu gửi (A8), máy chủ trả giao dịch cần gửi (`to` là hợp đồng VNDB, `data` là `transfer(ví nhận, số lượng)` NỐI THÊM 32 byte nhãn lệnh, QĐ-12); trình duyệt gửi qua ví đang kết nối rồi báo mã giao dịch. Máy chủ KHÔNG tin mã do trình duyệt báo: chỉ chốt hoàn tất khi có bằng chứng trên chuỗi (QĐ-9).
- **QĐ-2: ví nhận phải đã whitelist** (chủ dự án chốt). Cộng: khác ví gửi; dùng lại `payoutWalletFormatError` (`lib/bank/payout-wallet.ts`) cho đúng dạng, khác địa chỉ 0, không là ví mẫu công khai trên chain thật; không là địa chỉ hệ thống (QĐ-8). Ví nhận KHÔNG bắt buộc gắn cho hồ sơ nào.
- **QĐ-3: ví gửi phải là ví đã định danh của phiên** (`assertSessionWallet` của FIX-01, mã `WALLET_NOT_BOUND`).
- **QĐ-4: chain họ `mock`** (nhận biết bằng `chainFamily(chain) === 'mock'`) không có ví trình duyệt: ở bước A8 máy chủ chuyển trên ledger mock thay trình duyệt, KÈM nhãn lệnh; ledger mock ghi lại giao dịch chuyển (trường bền mới `paymentTransfers` trong trạng thái mock) và KHÔNG chuyển lần hai cho cùng nhãn (trả lại giao dịch cũ). Sau đó đối soát của mock chạy y như EVM (tìm theo nhãn), nên lỗi giữa bước chuyển và bước chốt không làm chuyển lặp. Ví gửi trên mock là ví mẫu của hồ sơ (`ownMockWallet`).
- **QĐ-5: mỗi ví gửi mỗi chain chỉ một lệnh đang dở** (`CREATED`, `SENDING` hoặc `SUBMITTED`), chốt bằng cột duy nhất `activeWallet` theo mẫu `activeChain` của lệnh rút vault.
- **QĐ-6: bảng lưu trữ mới `PaymentWithdrawRequest`**, không dùng chung `WithdrawRequest` của vault.
- **QĐ-7: quyền mới `payment:withdraw`**, chỉ `INVESTOR`. Mã một lần 6 chữ số như màn rút của Người bán.
- **QĐ-8: địa chỉ hệ thống bị cấm làm ví nhận**: mọi địa chỉ hợp đồng trong sổ địa chỉ của chain (`Object.values(addressBook[chain]?.contracts ?? {})`), cộng `vaultAddressFor(chain)`, `profitDistributorAddressFor(chain)` (`packages/shared/src/mock-vault.ts`, gồm cả địa chỉ của mock) và `spvWallet()` của ledger; so bằng chữ thường.
- **QĐ-9: bằng chứng hoàn tất** của lệnh R là MỘT giao dịch T thoả đủ: biên nhận thành công; người gửi T (`from` của giao dịch) là ví gửi của R; dữ liệu gọi (`input`) của T kết thúc bằng nhãn của R (QĐ-12); có ít nhất một log `Transfer` của hợp đồng VNDB khớp đủ `from` (ví gửi), `to` (ví nhận), `value` (số lượng). Log khác không làm hỏng việc khớp; so địa chỉ chữ thường. T tìm được bằng mã trình duyệt báo HOẶC bằng quét theo nhãn (QĐ-11). Hàm khớp là hàm thuần `matchesTransfer`.
- **QĐ-10: không chốt trạng thái cuối "âm" khi chưa quét chuỗi, và không miễn đối soát vĩnh viễn.** Trước khi chuyển sang `CANCELLED`, `FAILED` do không thấy giao dịch, hoặc `EXPIRED`, máy chủ quét theo nhãn; thấy bằng chứng thì `COMPLETED`. Mã 4001 do trình duyệt báo chỉ là lý do do trình duyệt khai (ghi rõ trong lý do), KHÔNG là bằng chứng chưa gửi: lệnh huỷ vì 4001 vẫn nằm trong diện quét lại. Lệnh trạng thái cuối âm trong 24 giờ gần nhất (tối đa 5) được quét lại khi mở màn; có bằng chứng thì `COMPLETED`.
- **QĐ-11: liên kết lệnh với giao dịch bằng nhãn, không bằng khoảng khối.** Quét tìm giao dịch của lệnh R: log `Transfer` của VNDB từ ví gửi tới ví nhận, đúng số, từ `createdBlock` của R tới khối mới nhất; với mỗi ứng viên đọc giao dịch, chỉ nhận khi người gửi là ví gửi và `input` kết thúc bằng nhãn của R. Nhãn khác nhau giữa các lệnh nên hai lệnh cùng ví nhận, cùng số, cùng khối tạo hay ký muộn đều không lẫn nhau. Chỉ loại ứng viên có mã đã là `completedTxHash` của lệnh KHÁC (mã đã xác minh); `submittedTxHash` do trình duyệt báo KHÔNG được loại ứng viên của lệnh khác. Chốt `COMPLETED` va ràng buộc duy nhất `(chain, completedTxHash)` thì giữ trạng thái cũ, ghi lý do, không nổ lỗi.
- **QĐ-12: nhãn lệnh** = `keccak256` của mã lệnh (32 byte), nối vào sau calldata `transfer`. Hợp đồng VNDB (OpenZeppelin ERC20, Solidity 0.8) bỏ qua byte thừa sau tham số, nên giao dịch vẫn là một lần `transfer` bình thường; ca 14 trên nút Hardhat chứng minh điều này.
- **QĐ-13: giữ chỗ lần gửi.** Giao dịch cần gửi chỉ được trả ĐÚNG MỘT LẦN, ở bước chuyển `CREATED` sang `SENDING` (A8, câu cập nhật có điều kiện). Từ `SENDING` trở đi, không action nào trả lại giao dịch cần gửi (kể cả gọi lại A1 cùng `clientRequestId`): lệnh chỉ còn đường báo mã, đối soát, huỷ. Như vậy trình duyệt chạy lại không mở lại yêu cầu chuyển tiền cho cùng lệnh.

## 3. Ngoài phạm vi

- Rút về tài khoản ngân hàng (đốt VNDB, ghi có ngoài chuỗi).
- Hạn mức ngày (`dailyTransactionLimitVnd` của hồ sơ): ghi nợ kỹ thuật.
- Ví Fireblocks thay ví trình duyệt (trao đổi sau).
- Phí ngân hàng; tài trợ gas cho Nhà đầu tư.
- Đảo khối (reorg).

## 4. Vòng đời lệnh

| Từ | Sang | Khi |
|---|---|---|
| (tạo) | `CREATED` | máy chủ đã kiểm (A1) |
| `CREATED` | `SENDING` | Nhà đầu tư bấm gửi (A8): máy chủ trả giao dịch cần gửi một lần; trên mock máy chủ chuyển luôn |
| `CREATED` | `CANCELLED` | Nhà đầu tư bấm "Huỷ" trước khi gửi, hoặc A8 đọc lại whitelist, số dư không đạt (chưa từng trả giao dịch nên không cần quét) |
| `SENDING` | `SUBMITTED` | trình duyệt báo mã (lưu `submittedTxHash`, `submittedAt`); từ chối chỉ khi đọc được giao dịch và người gửi khác ví gửi |
| `SENDING`, `SUBMITTED` | `COMPLETED` | bằng chứng QĐ-9 (lưu `completedTxHash`), từ mã đã báo hoặc quét theo nhãn |
| `SENDING` | `CANCELLED` | trình duyệt báo 4001 hoặc Nhà đầu tư bấm "Huỷ", và quét theo nhãn không thấy (lý do ghi rõ "do trình duyệt báo") |
| `SENDING` | `EXPIRED` | quá 30 phút từ lúc chuyển `SENDING` (`sendingAt`), chưa có mã, quét không thấy |
| `SUBMITTED` | `FAILED` | biên nhận của mã đã báo thất bại, hoặc thành công mà không khớp QĐ-9, hoặc quá 30 phút từ `submittedAt` chuỗi không biết mã (`UNKNOWN`); và quét theo nhãn không thấy |
| `CANCELLED`, `EXPIRED`, `FAILED` | `COMPLETED` | quét lại trong 24 giờ thấy bằng chứng (QĐ-10) |

Trạng thái chờ: `CREATED`, `SENDING`, `SUBMITTED` (`activeWallet` có giá trị). Trạng thái cuối: còn lại (`activeWallet` NULL). Nhãn: "Chờ gửi", "Chờ ký trong ví", "Đã gửi, chờ xác nhận", "Hoàn tất", "Thất bại", "Đã huỷ", "Hết hạn". Diện quét lại chỉ gồm lệnh cuối âm có `sendingAt` khác NULL (đã từng `SENDING`); lệnh `CANCELLED` từ `CREATED` không vào diện quét lại.

## 5. Yêu cầu chức năng

### A. Máy chủ

- **A1. `createPaymentWithdraw({ chain, wallet, toWallet, amount, purpose, note?, otp, clientRequestId })`**, quyền `payment:withdraw` qua `authorize`. Thứ tự:
  1. Kiểm dạng; `otp` 6 chữ số (không lưu, không vào log, audit, câu lỗi); `amount` số nguyên lớn hơn 0.
  2. `assertSessionWallet` với `wallet`, có audit.
  3. Kiểm ví nhận theo QĐ-2 và QĐ-8 (QĐ-8 có đọc `spvWallet()` của ledger).
  4. Tra `clientRequestId` của ví trên chain: cùng nội dung trả lệnh cũ (KHÔNG BAO GIỜ kèm giao dịch cần gửi, QĐ-13); khác nội dung: `WITHDRAW_STATE`.
  5. Có lệnh đang dở của ví trên chain: `WITHDRAW_STATE` "Ví đang có lệnh rút chưa xong; chờ hoặc huỷ lệnh đó."
  6. Đọc chuỗi: `isWhitelisted(toWallet)` sai: "Ví nhận chưa whitelist trên chuỗi."; `paymentBalanceOf(wallet) < amount`: "Số dư VNDB không đủ."
  7. Tạo lệnh `CREATED` với `createdBlock`. Ràng buộc duy nhất là trọng tài cho tranh chấp: `(chain, fromWalletKey, clientRequestId)` và `activeWallet`.
  8. Audit `payment:withdraw` cho mọi kết cục từ bước 3 trở đi. A1 KHÔNG trả giao dịch cần gửi và KHÔNG chuyển tiền (kể cả trên mock).
- **A8. `beginPaymentSend({ chain, id })`**, quyền `payment:withdraw` qua `authorize`, chỉ người tạo lệnh. Đọc lại `isWhitelisted(toWallet)` và số dư; không đạt thì `CANCELLED` kèm lý do (chưa trả giao dịch nên an toàn). Chuyển `CREATED` sang `SENDING` bằng câu có điều kiện (ghi `sendingAt`); chỉ lần chuyển thành công mới trả `txRequest: { chainId, to: getContractAddress(chain, 'VNDToken'), data: <transfer calldata nối nhãn>, value: '0' }` (calldata dựng bằng `encodeFunctionData` trong `lib/`). Lần gọi thứ hai (lệnh đã `SENDING`): `WITHDRAW_STATE` "Lệnh đã được gửi tới ví; chờ kết quả hoặc huỷ.", không trả giao dịch. Họ mock: sau khi chuyển `SENDING`, gọi `mockTransferPayment(from, to, amount, nhãn)` rồi đối soát lệnh này ngay (A4), nên lệnh mock về `COMPLETED` trong cùng lần gọi; lỗi giữa chừng để lại `SENDING`, lần đối soát sau tìm theo nhãn, không chuyển lặp.
- **A2. `submitPaymentWithdrawTx({ chain, id, txHash })`**, quyền `payment:withdraw` qua `authorize`, chỉ người tạo lệnh, lệnh phải `SENDING` (hoặc đã `COMPLETED`, xem dưới), `txHash` đúng dạng. Đọc giao dịch (`paymentTxSender(txHash)`, đọc được cả khi còn chờ): đọc được và người gửi khác ví gửi thì từ chối `WITHDRAW_STATE`, lệnh KHÔNG đổi; chưa thấy (`null`, nút của máy chủ chưa nhận giao dịch MetaMask phát) thì VẪN nhận. Lệnh đã `COMPLETED` (đối soát khi mở màn tìm thấy trước) thì trả trạng thái hiện tại, không báo lỗi. Còn lại `SUBMITTED` (cột `submittedTxHash` không ràng buộc duy nhất), rồi đối soát lệnh này một lần (A4) và trả kết quả.
- **A3. `cancelPaymentWithdraw({ chain, id, walletRejected: boolean })`**, chỉ người tạo lệnh. Từ `CREATED`: `CANCELLED` ngay. Từ `SENDING`: quét theo nhãn trước (QĐ-10); thấy thì `COMPLETED`; không thấy thì `CANCELLED`, lý do "Trình duyệt báo người dùng từ chối ký" khi `walletRejected`, ngược lại "Đã huỷ"; lệnh vẫn vào diện quét lại 24 giờ.
- **A4. Đối soát** (chạy trong A6 cho lệnh của ví phiên; lệnh chờ của ví (tối đa 1, QĐ-5) và tối đa 5 lệnh cuối âm có `sendingAt` trong 24 giờ): theo bảng mục 4, dùng `paymentTransferReceipt` (không chờ) cho lệnh `SUBMITTED` và `findPaymentTransferByTag` (QĐ-11) cho lệnh `SENDING` (mọi lần đối soát, vì có thể đã gửi mà mất mã), lệnh `SUBMITTED` cần chốt âm, và lệnh cuối âm trong 24 giờ. Mỗi lần chuyển trạng thái ghi một dòng audit `payment:withdraw`.
- **A5, A6. Một action khi mở màn**: `getPaymentWithdrawPage({ chain, wallet })`: `assertCan(role, 'payment:withdraw')` (không audit mỗi lần mở) rồi `assertSessionWallet` có audit; trả số dư VNDB của ví, kết quả đối soát (A4), danh sách lệnh của ví trên chain (mới trước, tối đa 50). Ví chưa định danh: `WALLET_NOT_BOUND`.
- **A7. `checkPaymentWithdrawTarget({ chain, wallet, toWallet })`** (`assertCan`, không audit): A1 bước 3 và whitelist, dùng trước khi mở hộp mã một lần.

### B. Ledger (`ledger.port.ts`, kiểu địa chỉ và mã dùng `` `0x${string}` `` như `SettlementPermit`, không dùng kiểu của viem)

- `paymentTxSender(txHash): Promise<string | null>`: EVM `getTransaction`; không thấy: `null`.
- `paymentTransferReceipt(txHash): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN'; txFrom: string | null; input: `0x${string}` | null; transfers: Array<{ from; to; value: bigint }> }>`: EVM `getTransactionReceipt`, không có thì `getTransaction` (thấy: `PENDING`, không: `UNKNOWN`); `txFrom`, `input` đọc từ giao dịch; chỉ giải mã log `Transfer` có địa chỉ VNDB.
- `findPaymentTransferByTag({ from, to, value, tag, fromBlock }): Promise<{ txHash; blockNumber: bigint } | null>`: `getLogs` log `Transfer` của VNDB theo đoạn `evmLogBlockChunk` (như `fetchLogs` của Indexer) từ `fromBlock` tới khối mới nhất, lọc `from`, `to` bằng topic, lọc `value`; với từng ứng viên đọc giao dịch, nhận khi `from` của giao dịch là ví gửi và `input` kết thúc bằng `tag`; trả ứng viên đầu tiên (mã giao dịch nhỏ nhất theo khối) hoặc `null`.
- Mock: `mockTransferPayment(from, to, amount, tag)`: nếu `paymentTransfers` đã có `tag` thì trả lại giao dịch cũ, KHÔNG chuyển; ngược lại chuyển số dư bằng các hàm số dư VNDB có sẵn (không kiểm whitelist, đóng băng, tất toán) và ghi `{ tag, txHash, from, to, value, blockNumber }` vào `paymentTransfers` trong cùng lần ghi trạng thái. Trường bền mới: thêm vào `MockLedgerState`, `createDefaultMockLedgerState`, `cloneMockLedgerState`, `encodeMockLedgerState`, `decodeMockLedgerState` (mặc định `[]` khi thiếu, theo mẫu `configEvents`). Ba phương thức đọc trên mock đọc từ `paymentTransfers` (người gửi là `from`, `input` dựng lại kết thúc bằng `tag`).
- Stellar: `LedgerNotImplementedError`.

### C. Giao diện `/withdraw`

- **C1.** Thay `PlaceholderPage` bằng `components/pages/investor-withdraw.tsx`, bố cục theo `seller-withdraw.tsx` (chép theo mẫu, KHÔNG tách thành phần dùng chung để không đụng `seller-withdraw.tsx`, vốn có test kiểm chuỗi):
  - "Số tiền rút (VNDB)" dùng `AmountInput`; "Mạng" chỉ đọc; "Ví gửi" chỉ đọc (ví đang kết nối, mock: ví mẫu) kèm nhãn "Đã định danh"; "Ví nhận" nhập địa chỉ (không có nút "Dùng ví đang kết nối"); "Mục đích", "Ghi chú".
  - "Hệ thống tính": số dư VNDB, số rút, số dư sau rút; câu "Phí gas do ví của bạn trả bằng ETH của mạng." (ẩn trên mock).
- **C2.** "Tạo lệnh rút": gọi A7; đạt thì mở hộp mã một lần; xác nhận gọi A1, rồi gọi A8 ngay (một lần bấm của người dùng). Chain khác mock: gửi `txRequest` nhận được từ A8 bằng hàm mới `sendPaymentTransferWithWallet` ở `lib/signer/wallet-transfer.ts` (theo mẫu `signPermitWithWallet` của `wallet-permit.ts`: dùng `createWalletSigner`, kiểm tài khoản đang chọn đúng ví gửi và đúng `chainId`, rồi gửi); có mã thì gọi A2; lỗi 4001 thì gọi A3 với `walletRejected: true`; lỗi khác (sai tài khoản, sai chain, mất kết nối) hiện câu lỗi; lệnh đã `SENDING` nên KHÔNG gửi lại được: Nhà đầu tư bấm "Huỷ" (A3, `walletRejected: false`) rồi tạo lệnh mới, hoặc để hết hạn. Kiểm tài khoản và chain của ví TRƯỚC khi gọi A8 để lỗi loại này không tiêu lệnh.
- **C3.** Bảng "Lệnh rút của tôi": Mã, Thời điểm, Số tiền, Ví nhận (rút gọn), Trạng thái, Mã giao dịch (`completedTxHash` hoặc `submittedTxHash`, liên kết `explorerTxUrl`), Lý do. Dòng `CREATED` có nút "Gửi từ ví" (gọi A8; chỉ thành công một lần) và "Huỷ". Dòng `SENDING` chỉ có "Huỷ" và câu "Đang chờ ví ký hoặc kết quả trên chuỗi"; KHÔNG có nút gửi lại (QĐ-13).
- **C4.** Kết quả: hoàn tất "Đã rút <số> VNDB tới ví <ví>"; đang chờ "Đã gửi, chờ xác nhận trên chuỗi; mở lại màn sau ít phút."
- **C5.** Ví chưa định danh: `WalletNotBoundNotice`, khoá form. Chưa kết nối ví (chain khác mock): câu và liên kết "Kết nối ví" tới `/wallet`.
- **C6.** Phản hồi lệch thứ tự: giữ kết quả theo khoá `chain|ví` (luật E6 của FIX-01).
- **C7.** Xoá `components/pages/placeholder.tsx` nếu không còn trang nào dùng (ghi trong checkpoint).

### D. Tài liệu

- `docs/USER_GUIDE.md`: màn Rút VNDB, điều kiện ví nhận, Nhà đầu tư trả gas.
- `docs/tech-report.md`: sinh lại khối điểm cắm (`node scripts/scan-pending.mjs --write-report`), bảng quyền, bảng cổng ledger, dòng đếm trang chờ.
- Nợ kỹ thuật: hạn mức ngày; rút về tài khoản ngân hàng; ví Fireblocks.

## 6. Hiệu năng

- Mở `/withdraw`: đúng 1 action. Các màn khác không đổi. Bảng trước và sau trong checkpoint.

## 7. Kiểm thử

Tệp mới `test/fe-23-payment-withdraw.test.ts`. Nhánh EVM giả bọc `getLedger` bằng `vi.mock('@/lib/ledger', ...)` theo mẫu `test/be-13-withdraw.test.ts` (KHÔNG `vi.spyOn` lên ledger trả về, vì `getLedger` dựng mới mỗi lần), chạy trên chain `evm` với `WalletBinding` dựng cho ví gửi (trợ giúp `bindWalletForTest`).

| Ca | Nội dung |
|---|---|
| 1 | Mock: A1 rồi A8: `COMPLETED`, số dư ví gửi giảm, ví nhận tăng đúng số; audit SUCCESS |
| 2 | Ví gửi chưa định danh: `WALLET_NOT_BOUND`, không tạo lệnh |
| 3 | Trên `evm` giả: ví nhận chưa whitelist; bằng ví gửi; địa chỉ 0; địa chỉ VNDB; vault của chain; ví mẫu công khai. Trên `mock`: vault mock; quỹ chia mock. Mọi ca: từ chối, không tạo lệnh, có audit FAILURE |
| 4 | Vượt số dư: từ chối. Mã một lần sai: từ chối; không dòng audit nào chứa mã |
| 5 | EVM giả: A1 không trả giao dịch; A8 trả `txRequest` đúng `to`, `data` giải mã ra `transfer(toWallet, amount)` và 32 byte cuối là nhãn của lệnh; gọi A8 lần hai: `WITHDRAW_STATE`, không trả giao dịch; gọi lại A1 cùng `clientRequestId` khi lệnh đã `SENDING`: trả lệnh, không kèm giao dịch |
| 6 | `submitPaymentWithdrawTx` với người gửi giao dịch khác ví gửi: từ chối, lệnh giữ `SENDING`; `paymentTxSender` trả `null`: vẫn `SUBMITTED` |
| 7 | Biên nhận `CONFIRMED`, `txFrom` đúng, `input` có nhãn đúng, `Transfer` khớp (có thêm log `Transfer` khác): `COMPLETED`, `completedTxHash` ghi |
| 8 | Biên nhận khớp sai số, sai ví nhận, sai `txFrom`, sai nhãn, log của hợp đồng khác: `FAILED` sau khi quét theo nhãn không thấy |
| 9 | Biên nhận `FAILED`: `FAILED`; `PENDING`: giữ `SUBMITTED`; `UNKNOWN` quá 30 phút: quét thấy (giao dịch thay thế bằng "tăng tốc", cùng nhãn) thì `COMPLETED`, không thấy thì `FAILED` |
| 10 | Người khác lệnh gọi A2, A3, A8: `WITHDRAW_STATE`. Huỷ từ `SENDING` với `walletRejected` khi thực ra giao dịch đã lên chuỗi: quét thấy, `COMPLETED`. Huỷ không thấy: `CANCELLED`, sau đó giao dịch (cùng nhãn) mới vào khối: lần mở màn trong 24 giờ chuyển `COMPLETED` |
| 11 | Lệnh đang dở cùng ví: lệnh thứ hai bị chặn; cùng `clientRequestId` cùng nội dung trả lệnh cũ, khác nội dung `WITHDRAW_STATE` |
| 12 | Mất phản hồi: lệnh `SENDING`, ví đã phát giao dịch nhưng trình duyệt không báo mã; trình duyệt gọi lại A1 (không nhận giao dịch) và A8 (bị từ chối); lần đối soát tìm theo nhãn và `COMPLETED`; chỉ một lần chuyển. `SENDING` quá 30 phút không thấy: `EXPIRED` |
| 12b | Hai lệnh R1, R2 cùng ví nhận, cùng số, cùng `createdBlock`: R1 `EXPIRED`, R2 `SENDING`; giao dịch của R1 (nhãn R1) vào khối sau khi tạo R2: lần đối soát gán cho R1 (`COMPLETED`), R2 không nhận nó |
| 12c | Mã khai sai: R1 báo mã T (nút chưa thấy, nhận `SUBMITTED`), T thật là giao dịch của R2 (nhãn R2) mà R2 chưa báo mã: đối soát R2 tìm theo nhãn vẫn nhận T và `COMPLETED`; R1 không nhận T (sai nhãn) |
| 12d | Mock: lỗi cố ý sau `mockTransferPayment`, trước khi chốt `COMPLETED`: lệnh giữ `SENDING`; lần đối soát sau `COMPLETED`; gọi lại `mockTransferPayment` cùng nhãn không trừ số dư lần hai; số dư chỉ giảm một lần |
| 13 | Postgres (`TEST_DATABASE_URL`): hai lần tạo đồng thời cùng ví: đúng một lệnh; hai lần A8 đồng thời cùng lệnh: đúng một lần trả giao dịch; `completedTxHash` duy nhất theo chain |
| 14 | Nút Hardhat (`TEST_HARDHAT_RPC`): ví NDT001 có VNDB (nạp bằng `mintPayment`), A1, A8, gửi `txRequest` (calldata có nhãn) bằng `walletClient` viem với khoá Hardhat #1 (giả trình duyệt): giao dịch thành công, số dư đúng (chứng minh VNDB chấp nhận byte thừa); báo mã: `COMPLETED`; thêm một lệnh gửi rồi KHÔNG báo mã: đối soát tìm theo nhãn và `COMPLETED` |

E2E: một tệp mới `e2e/investor-withdraw.spec.ts`, chỉ dự án `mock`, tự dựng dữ liệu theo mẫu phần chuẩn bị của `e2e/vault-withdraw.spec.ts` (Giao dịch viên gắn ví NB001 ở `/wallet-binding`, nạp VNDB cho NDT001 ở màn Nạp VNDB; cờ tắt thì `test.skip` có lý do); Nhà đầu tư rút 1 VNDB tới ví NB001, thấy dòng "Hoàn tất". Không phụ thuộc thứ tự tệp.

Đột biến bắt buộc (ghi ca đỏ vào checkpoint): bỏ chốt chặn ví gửi; bỏ kiểm whitelist ví nhận; bỏ danh sách địa chỉ hệ thống; chốt `COMPLETED` không kiểm `Transfer`; bỏ kiểm `txFrom`; bỏ kiểm nhãn trong `input`; A8 trả giao dịch cả khi lệnh đã `SENDING`; A1 trả giao dịch khi gọi lại; quét loại ứng viên theo `submittedTxHash` của lệnh khác; `mockTransferPayment` không kiểm nhãn đã có; bỏ quét trước `EXPIRED`; A3 huỷ từ `SENDING` không quét; bỏ quét lại 24 giờ; bỏ chặn lệnh đang dở. (Tổng 14 đột biến.)

Sửa test có sẵn sẽ đỏ: `test/pending-markers.test.ts` (sinh lại khối điểm cắm trong `docs/tech-report.md`); `test/rbac.test.ts` (một bảng dòng quyền mới đưa vào cả `it.each` lẫn tập `covered`, thêm `payment:withdraw` vào `ALL_WRITE_ACTIONS`); `test/fe-10-recall-ui.test.ts` nếu thêm nhãn mới vào `txn-labels.ts`. Người làm chạy toàn bộ và bổ sung nếu còn. Bảng mới không nằm trong `NEW_TABLES` của `test/store-constraints.test.ts` (giống `WithdrawRequest`), nên test đó chỉ kiểm chiều ràng buộc có chỉ mục; thêm bảng vào `NEW_TABLES` nếu không làm đỏ ca khác.

## 8. Điều kiện hoàn thành

- [ ] A1 tới A7, B, C1 tới C7, D đã làm; `/withdraw` không còn `PlaceholderPage` và `@pending FE-23`.
- [ ] Vitest ca 1 tới 14 (gồm 12b, 12c, 12d) xanh (ca 13 với `TEST_DATABASE_URL`, ca 14 với `TEST_HARDHAT_RPC`, ghi lệnh và kết quả vào checkpoint); 14 đột biến đều bị bắt.
- [ ] `typecheck`, `lint`, toàn bộ `vitest`, `build`, `e2e` (mock và hardhat), `arch markers checkpoint` của `run-local-all.sh` xanh.
- [ ] Mở `/withdraw` đúng 1 action; các màn khác không đổi.
- [ ] Ảnh trên `mock` vào `docs/images/fe-23/` (tên có tiền tố ngày): màn rút có dữ liệu; hộp mã một lần; bảng lệnh có dòng "Hoàn tất"; một ảnh trên `hardhat-local` lúc ví hiện yêu cầu ký nếu dựng được (không thì ghi lý do).
- [ ] Diff không thêm dòng chứa ký tự mũi tên, gạch dài, chấm giữa.
- [ ] `docs/USER_GUIDE.md`, `docs/tech-report.md`, `docs/CHECKPOINT_FE23.md`, `.kiro/task-status.json` (FE-23 từ `planned` sang `done`).
