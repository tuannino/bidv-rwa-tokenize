---
inclusion: always
---
# Bài học tích lũy (Supervisor cập nhật dần)

> Mỗi mục: **Triệu chứng → Nguyên tắc đúng**. Kiro đọc để không lặp lỗi.

- **Gọi chain thẳng trong component** → SAI. Luôn qua `ILedgerPort` (`app/src/lib/ledger`).
- **Nhúng private key / ký rải rác** → SAI. Luôn qua `ISigner`.
- **`if (role === 'admin')` cứng** → SAI. Dùng `can(role, action)` (RBAC).
- **Giả định API Next.js theo bản cũ** → SAI. Next.js 16 khác; đọc docs trong node_modules trước.
- **Trộn T-REX (0.8.17/OZ4) vào contracts chính (0.8.28/OZ5)** → SAI. Giữ tách toolchain.
- **Copy ABI/địa chỉ contract rải rác** → SAI. Chỉ đặt ở `packages/shared`.
- **Thêm Polygon** → SAI. Đã loại bỏ; chỉ hardhat-local / evm / stellar.
- **Bundle hardhat/ethers/artifact contract vào web (edge)** → SAI, phình bundle Cloudflare. Dùng viem, ABI tối giản; đồ nặng để ở packages.
- **Luồng demo public phụ thuộc hardhat node thường trú** → SAI. Free-tier không chạy node; default phải là `mock`/`evm-testnet`.
- **Nhớ nhầm giới hạn Cloudflare** → mức hiện tại 64 MiB không nén (mọi gói, từ 2026-09-04); vẫn build gọn.
- **Revert một PR rồi merge lại nhánh đó để "lấy code về"** → SAI. Git không phục hồi: merge chỉ so với merge-base nên phần đã revert mất vĩnh viễn. Đây là lý do `dev` từng mất sạch `packages/` và `app/src/lib/`. Cách đúng **duy nhất**: `git revert <sha-của-commit-revert>`. KHÔNG merge lại nhánh cũ, KHÔNG cherry-pick từng commit — xem `branching.md` §6.
- **Tự chọn nền khác khi `dev` hỏng** → SAI. DỪNG, ghi bằng chứng vào checkpoint mục "Câu hỏi mở", chờ Owner xác nhận (`branching.md` §5). Chỉ khi Owner cho phép mới dùng nền tạm, và phải ghi rõ món nợ rebase về `dev`.
- **`git rebase <đích>` khi nhánh nền chứa commit phá hoại** → SAI, kéo theo cả commit của nhánh nền. Kỹ thuật đúng là `git rebase --onto <đích> <nền> <nhánh>` (replay chỉ commit của mình) — nhưng **chỉ dùng sau khi Owner đã đồng ý** đổi nền, không tự quyết.
- **Tin số dòng/số chỗ trong tài liệu giao việc mà không đo lại** → SAI. Giao việc nói "còn 264 chỗ dùng SPT/tVND", đo thật chỉ còn 33 vì việc đổi SPT→WPT đã làm ở commit trước. Luôn `git grep` đếm lại trước khi lập kế hoạch.
- **Bộ test do người khác viết có thể bám vào trạng thái repo cũ** → kiểm tên crate/đường dẫn/chuỗi revert thật trước khi kết luận contract sai. Sửa test theo contract, không sửa contract theo test.
- **`docker build` fail exit 137 không phải lỗi Dockerfile** → đó là OOM killer. Kiểm bộ nhớ cấp cho runtime (`docker info | grep "Total Memory"`); colima mặc định chỉ 2 GiB, `next build` cần hơn.
- **Thêm method liệt kê người nắm giữ vào `ILedgerPort`** → SAI. ERC-20 chỉ lưu **bảng số dư theo địa chỉ**, không lưu danh sách địa chỉ; không lời gọi nào đọc ra danh sách từ chuỗi. `ILedgerPort` chỉ có `balanceOfAt(wallet, snapshotId)` (tra từng ví). Danh sách ví cần chia lợi nhuận / cần tất toán lấy từ **cơ sở dữ liệu** (lệnh mua đã hoàn tất, vị thế nhà đầu tư), về sau từ **Indexer**. Đừng "giải quyết" bằng cách quét sự kiện trong adapter: quét sự kiện là việc của Indexer — trong adapter thì chậm, không phân trang được, và sai ngay khi RPC giới hạn khoảng block. Thấy cần thì ghi câu hỏi mở, đừng tự thêm.
- **Đọc `data.errorName` trước `reason` khi bóc revert của viem** → SAI, mất sạch lý do. Với `require(cond, "chuoi")` viem đặt `data.errorName = 'Error'` (tên của error dựng sẵn `Error(string)`) và để chuỗi thật ở `reason`, nên ưu tiên `errorName` biến MỌI lỗi tuân thủ thành đúng một câu "Contract từ chối: Error". Custom error của OZ v5 thì ngược lại: `reason` rỗng, `errorName` có tên. Thứ tự đúng: `reason` → `data.errorName` → `signature`.
- **ABI tối giản chỉ có `function` và `event`** → THIẾU. Không có mục `error` thì viem không giải mã được custom error của OZ v5 và chỉ trả về 4 byte selector (`0xe2517d3f`), ra message vô nghĩa với cả người dùng lẫn người sửa. Thêm ít nhất `AccessControlUnauthorizedAccount`, `ERC20InsufficientBalance`, `ERC20InsufficientAllowance`, `SafeERC20FailedOperation`.
- **Lấy mã snapshot bằng cách tự tăng số đếm, hoặc gọi `getCurrentSnapshotId()` sau khi gửi tx** → SAI, sai âm thầm. Giữa hai lời gọi có thể có tx snapshot khác chen vào và ta lấy về mã của người khác — rồi chia lợi nhuận theo ảnh chụp sai. Mã snapshot chỉ có một nguồn: **event `Snapshot` trong receipt**.
- **Mock adapter dễ tính hơn contract thật** → SAI, sinh loại lỗi "xanh ở mock, đỏ ở chain thật". Cụ thể: giá bán mặc định 0 làm khớp lệnh thành "mua không mất tiền"; kiểm tra rải rác giữa các bước thay đổi trạng thái làm thất bại để lại trạng thái nửa vời. Nguyên tắc: **mọi kiểm tra chạy trước mọi thay đổi trạng thái**, và test ca từ chối phải kiểm luôn "trạng thái không đổi", không chỉ kiểm có ném lỗi.
- **TypeScript không thu hẹp kiểu sau lời gọi hàm `never`** → do annotation đặt sai chỗ. Phải ghi kiểu trên **BIẾN** (`const reject: (a: string, b: string) => never = (a, b) => {...}`); viết `const reject = (a: string, b: string): never => {...}` thì sau `if (!x) reject(...)` biến `x` vẫn còn `| undefined`.
- **Nối method vào một contract có ngữ nghĩa "gần gần" khi contract đúng chưa có** → SAI, tệ hơn chưa nối. Ví dụ `Redemption.paused` ngược hướng với "bật giai đoạn tất toán", và `ProfitDistributor.distributeTo` nhận `distributionId` chứ không phải `snapshotId`. Nối sai cho ra hệ thống chạy được nhưng làm ngược — không ai phát hiện tới lúc chạy thật. Chưa có contract thì ném `LedgerNotImplementedError` với gợi ý nêu đúng thứ đang thiếu, rồi ghi câu hỏi mở.
