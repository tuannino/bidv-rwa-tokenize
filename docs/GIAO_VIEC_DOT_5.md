# Giao việc đợt 5 — năm task, hai người làm

| | |
|---|---|
| Nền | `dev` @ `abd1ceb` (PR #38) |
| Người làm | Codex và Claude Code |
| Thời gian | 08/10 tới 18/10 |
| Mục tiêu đợt | Mở lại khả năng trình diễn, và đóng hai trang chỗ trống cuối cùng |

## Đặt vào chỗ

Đo ngày 07/10 trên `dev`: 22 task đã xong, 767 ca đơn vị xanh, 67 ca hợp đồng xanh, 53 ca đầu cuối
xanh, 20 phép kiểm kiến trúc đạt. Còn **2 trong 24 trang** là chỗ trống. Toàn bộ 13 điểm chặn còn lại
nằm trong một tệp duy nhất là `evm.adapter.ts`, chờ bốn task hợp đồng của đợt 6 và 7.

Nhưng bản deploy Cloudflare **không thao tác được**: mọi nghiệp vụ ghi đều hỏng vì thiếu biến bí mật
khóa ký. Vì vậy đợt 5 bắt đầu bằng một task gỡ chặn, không bắt đầu bằng màn hình.

## Thứ tự và cách chia người

```
Vòng 1   OP-02  (một mình, cả hai người cùng chờ)
            |
            v  merge vào dev
Vòng 2   FE-08  (người A)        ||       BE-13  (người B)
            |                                 |
            v  merge trước                    v  rebase rồi merge
Vòng 3   FE-07  (người A)        ||       FE-23  (người B, sau khi BE-13 merge)
```

| Thứ tự | Mã | Tên | Điểm | Mức kiểm chứng | Nhánh |
|---|---|---|---|---|---|
| 1 | **OP-02** | Gỡ chặn bản trình diễn và dọn tài liệu | 5 | Vừa | `ops/02-demo-unblock` |
| 2 | **FE-08** | Màn Chia lợi nhuận và quyền đọc của Kiểm soát viên | 8 | **Cao** | `feat/distribution-ui` |
| 3 | **BE-13** | Nghiệp vụ rút VNDB | 8 | **Cao** | `feat/withdraw-service` |
| 4 | **FE-07** | Màn quản trị phát hành và cấu hình giá | 5 | Vừa | `feat/issuance-admin` |
| 5 | **FE-23** | Màn Rút VNDB của Nhà đầu tư | 5 | Vừa | `feat/investor-withdraw` |

Tổng 31 điểm. OP-02 lên 5 điểm sau khi bổ sung mục E ngày 07/10.

## Vì sao thứ tự này

**OP-02 trước tất cả.** Nó là thứ duy nhất đang chặn việc trình diễn. Nó cũng sửa
`docs/tech-report.md` và `.kiro/task-status.json` là hai tệp mà **mọi** task khác cũng sửa, nên merge
nó trước thì bốn task sau chỉ phải rebase một lần thay vì mỗi task một lần.

**FE-08 là task đáng làm nhất trong đợt.** Chia lợi nhuận là luồng thứ ba trong ba luồng đã chốt, và
là luồng duy nhất mà nghiệp vụ đã xong trọn vẹn nhưng giao diện vẫn trống. Bảy điểm cắm đã sẵn đầu
cuối, nên không phải viết thêm một dòng nghiệp vụ nào. Giá trị cao nhất, rủi ro thấp nhất.

**BE-13 chạy song song được với FE-08** vì hai task đụng hai vùng mã khác hẳn nhau: một bên là màn
chia lợi nhuận và bảng quyền, một bên là tầng lưu trữ và nghiệp vụ rút. Chỗ chạm nhau duy nhất là
`lib/rbac/permissions.ts`, mà hai task thêm hai nhóm hành động khác nhau nên xung đột dễ xử lý.

**FE-23 bắt buộc sau BE-13.** Màn rút của Nhà đầu tư không có gì để cắm vào nếu nghiệp vụ chưa có.
Đây là bài học từ FE-21 và FE-22: khởi động sớm thì phải chờ, và phải rebase hai lần.

## Ba tệp dùng chung, và luật rebase

Bài học đắt nhất của dự án tới giờ: **mọi task đều đụng ba tệp này**.

```
.kiro/task-status.json
docs/tech-report.md
docs/flows/*.md
```

Nên hai task chạy song song chắc chắn xung đột ở đó. Luật:

1. Task merge sau **phải rebase** lên `dev` rồi chạy lại toàn bộ `run-local-all.sh`, không chỉ chạy
   phần mình sửa.
2. Sơ đồ luồng trong `docs/flows/` phải **sinh lại** bằng `node scripts/gen-flow-diagram.mjs`, không
   bao giờ giải quyết xung đột bằng tay. Sửa tay là sơ đồ lệch mã nguồn ngay lần sau.
3. `.kiro/task-status.json` giữ bất biến: một mã task chỉ xuất hiện ở **đúng một** trong ba danh sách.

## Luật nhánh

Nhắc lại vì đã làm mất nội dung `dev` **hai lần** (PR #6 và PR #18):

- Mọi nhánh checkout từ `dev`, không từ nhánh phụ khác.
- **Cấm mẫu merge rồi revert rồi merge lại.** Muốn gỡ một PR đã merge thì revert chính commit revert
  đó (`git revert <sha-của-commit-revert>`), đừng merge lại nhánh cũ.
- Chỉ merge sau khi đã nghiệm thu.
- Đầy đủ ở `.kiro/steering/branching.md`.

## Mức kiểm chứng và phép đột biến

Ba mức theo `.kiro/steering/efficiency.md`: **Cao** cho chỗ đụng tiền và quyền, **Vừa** cho nghiệp vụ
và giao diện, **Thấp** cho công cụ nội bộ. Làm đúng mức spec ghi, không hơn: chạy thừa là lãng phí
thời gian của chính mình.

Bốn trong năm task có **phép kiểm chứng bằng đột biến**, mỗi task đúng hai chỗ. Cách làm: cố tình phá
một dòng, chạy test, xác nhận đúng ca spec chỉ ra chuyển sang đỏ, rồi **phục hồi sạch** và dán kết quả
thật vào checkpoint. Đột biến không bắt được lỗi nghĩa là ca test đó không bảo vệ được gì, phải viết
lại ca test chứ không bỏ qua.

| Task | Hai phép đột biến |
|---|---|
| OP-02 | (một phép) cho chain `evm` dùng nhánh trả tài khoản cố định của `mock` |
| FE-08 | cấp `distribution:execute` cho CONTROLLER; đổi `distributePeriod` sang kiểm `distribution:read` |
| BE-13 | chế độ `PERCENT` tính trên số dư đã lưu; cấp quyền tạo lệnh rút cho Giao dịch viên |
| FE-07 | không bắt buộc (mức Vừa) |
| FE-23 | không bắt buộc (mức Vừa) |

## Quy tắc chung cho cả năm task

1. **Mọi con số phải kèm lệnh đo.** Trong spec và trong checkpoint. Số trong spec lệch số đo thật thì
   **dùng số đo thật** và ghi thành mục sai lệch. Quy tắc này ra đời vì một spec cũ ghi sai cả ba con
   số và làm mất một vòng làm việc.
2. **Ba luật kiến trúc không được chạm:** mọi lời gọi chuỗi qua `ILedgerPort`, mọi chữ ký qua
   `ISigner`, mọi kiểm quyền qua `can()`. `verify-arch-rules.sh` chặn 20 phép kiểm, trong đó có phép
   chặn bảng quyền teo lại so với `origin/dev`.
3. **Không đoán.** Không hiểu một yêu cầu thì dừng, ghi câu hỏi vào checkpoint kèm hai cách hiểu khả
   dĩ và phương án đề xuất. Không sửa mò quá hai lần cho cùng một triệu chứng.
4. **Vitest xanh không có nghĩa là typecheck xanh.** Chạy `npm run typecheck` trước mỗi commit có sửa
   test.
5. **Checkpoint mở đầu bằng mục 0**, tối đa 60 dòng, bảng đối chiếu **đủ** các điều kiện hoàn thành
   kèm số mục chứa bằng chứng. Có máy kiểm: `node scripts/check-checkpoint.mjs`.
6. **Cập nhật tài liệu nằm trong định nghĩa "xong".** Mã và tài liệu đi chung một commit.

## Hai việc của chủ dự án, không nằm trong repo

1. Đặt `SERVER_SIGNER_PRIVATE_KEY` làm biến bí mật của Worker trên Cloudflare. OP-02 làm cho chain
   `mock` không cần khóa nữa, nhưng khi chuyển sang `hardhat-local` hay Sepolia thì vẫn cần biến này.
2. Bật bảo vệ nhánh `dev` trên GitHub theo `docs/BRANCH_PROTECTION.md` (mã G-07 trong kế hoạch).

## Lưu ý về bản deploy

Ngay cả sau OP-02, bản trên Cloudflare vẫn có một hạn chế **không sửa được bằng mã**: bộ nhớ và ledger
mô phỏng sống trong từng tiến trình, mà Cloudflare chạy nhiều isolate. Supervisor đã kiểm chứng: hai
trình duyệt cùng xem một ví thấy hai trạng thái khác nhau. Trình diễn nhiều người xem cùng lúc phải
dùng Postgres chung, hoặc một người thao tác và chia sẻ màn hình.
