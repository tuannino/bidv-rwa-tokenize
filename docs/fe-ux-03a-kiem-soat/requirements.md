# FE-UX-03a: 2 màn Kiểm soát duyệt yêu cầu (`/approvals`, `/approvals/[id]`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-03a-kiem-soat` từ `release/ui-v2` @ `7b3216d` (sau #88) |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, `app/actions`, `app/api`, mọi `gates.ts`; không thêm gói npm; không sửa `components/ui/*` và các thành phần `maker-checker` đã đổi ở FE-UX-02b (thiếu gì thì báo, không tự thêm) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 (có Hardhat vì là nhóm lập duyệt) |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 4.4, 7.1, 8; bản chốt `approvals.html`, `approval-detail.html`, `assets/c.css`; `notes/{approvals,approval-detail}.md` |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` @ `7b3216d`, rồi tài liệu bàn giao và notes, cuối cùng là bản xem thử. Notes đã cũ ở số dòng trích dẫn và `resultText` (đã trả gạch ngắn từ FE-UX-02b) |

## 1. Mục tiêu

FE-UX-03 (4 màn Kiểm soát) tách làm hai PR: **03a** (bài này) gồm `/approvals`, `/approvals/[id]` và xoá `maker-checker/stat-card.tsx`; **03b** gồm `/distribution`, `/vault` (mỗi màn trên 500 dòng, có luồng tiền và cấu hình vault).

Vẽ lại 2 màn theo bản chốt bằng thành phần dùng chung (`Kpi`, `Alert`, `EmptyState`, `fieldClass`, `Card`, `CardTitleIcon`, `Badge` sắc, `RequestTable` với prop `loading`). Không đổi câu chữ (trừ QĐ-6), trường, bộ lọc, nút, điều kiện khoá, lời gọi server action, số action khi mở màn.

Không làm: câu phụ dưới tiêu đề (test cấm), tô sắc chấm tròn nhật ký theo trạng thái (phải suy từ dữ liệu, tức thêm logic), quản lý lại tiêu điểm sau khi tải lại chi tiết (hành vi hiện có, ghi nợ UX), dựng lại khối thông tin token thành thẻ khác (`token-info-block.tsx` giữ như 02b), chuyển động JS.

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic màn.** Giữ nguyên trong `approvals.tsx`: `useSelectedChain`, state `stats` theo khoá chain, effect `getApprovalStatsAction(chain)`, mỗi `Queue` một effect `listTokenRequestsAction` theo `requestKey`, lọc ô tìm kiếm phía client, mặc định `'PENDING'`, id `${prefix}-search`, `${prefix}-status`. Trong `approval-detail.tsx`: `outcomeFeedback` (vẫn export, không chép lại logic Fireblocks ở chỗ khác), `revision`, `loadKey`, `loaded`, `rejectReason`, `feedback`, `useTransition`, `reload` (tăng revision và `router.refresh()`), ba tầng khoá tách riêng (`decisionBlock` khoá cả hai nút và ô lý do; `approveBlock` gồm `working` hoặc `approveBlockReason` chỉ khoá Chấp nhận; `rejectBlock`), nút Đối soát chỉ hiện khi `canReconcile`, khoá khi `working`, từ chối thành công thì xoá lý do. Diff chỉ là vỏ JSX, `className`, thay khối lặp bằng thành phần dùng chung có cùng chữ và thuộc tính.
- **QĐ-2. Số action khi mở màn giữ nguyên:** `/approvals` 3 (`getApprovalStatsAction` và 2 `listTokenRequestsAction`); `/approvals/[id]` 1 (`getTokenRequestDetailAction`).
- **QĐ-3. Ô số liệu `/approvals`:** 3 `Kpi` sắc `default` (số đếm, mục 4.4; nhất quán với `/draft` ở 02b; bản xem thử tô `hl`, `leaf`), giữ `aria-label` "Đang chờ duyệt", "Đã duyệt hôm nay", "Đã từ chối hôm nay"; giá trị chưa có hiện `–` (gạch ngắn). `maker-checker.spec.ts:142` kiểm ô "Đang chờ duyệt" không chứa gạch dài: vẫn qua, không sửa test.
- **QĐ-4. Thành phần dùng chung thay khối tự viết:**
  - `/approvals`: lỗi số liệu và lỗi hàng chờ thành `Alert tone="bad"` (hiện là `p` không `role`: giữ KHÔNG `role`); lỗi lịch sử thành `Alert bad` không `role`; `RequestTable` truyền `loading` khi chưa có dữ liệu (`!fresh`, `!stats` tuỳ bảng); ô tìm kiếm và ô chọn dùng `fieldClass` (ô tìm thêm `pl-10`, biểu tượng canh giữa theo chiều cao ô); câu báo chạm ngưỡng 200 giữ nguyên chữ.
  - `/approvals/[id]`: khung lý do khoá quyết định (`data-testid="decision-block-reason"`) thành `Alert tone="warn"` có biểu tượng khoá (`icon={<Lock className="mt-px size-[18px] shrink-0" aria-hidden="true" />}`, vì `icon` thay hẳn biểu tượng mặc định), không thêm `role`; cảnh báo duyệt (`data-testid="approve-warning"`, `role="alert"`) thành `Alert tone="warn"` giữ `role="alert"`; phản hồi thành `Alert` theo tone (`success` `ok`, `warning` `warn`, `error` `bad`), giữ `role="status"` và giữ thuộc tính `data-tone="success|warning|error"` hiện có (truyền ghi đè); lỗi tải thành `Alert bad` không `role`; ô lý do từ chối dùng `fieldClass`. Xoá `FEEDBACK_STYLE`.
  - Nhật ký: dạng `.timeline` của bản chốt (chấm tròn một sắc, đường nối), giữ phần tử `ol`/`li` và thứ tự.
- **QĐ-5. Xoá `maker-checker/stat-card.tsx`** (`StatCard`, `INPUT_CLASS`): sau PR này không tệp nào import nó (chỉ 2 màn này đang dùng; `assets.tsx` có `StatCard` riêng, không đụng).
- **QĐ-6. Ký tự cấm trong chuỗi do frontend dựng (`approval-detail.tsx`):** placeholder ô lý do (`:209`) bỏ gạch dài, thay bằng dấu phẩy; giá trị thiếu ở dòng Chứng từ, Ngày hiệu lực, Ghi chú, Mã giao dịch (`:294-300`) thành gạch ngắn `–`; nhật ký (`:319`) dấu chấm giữa trước tên người thao tác thành dấu phẩy. Không test nào khớp các chuỗi này. Chuỗi do máy chủ trả (`entry.label`, `entry.detail`, `custodyLabel`, lý do khoá) giữ nguyên.
- **QĐ-7. Bản xem thử, notes đã cũ, KHÔNG làm theo:** câu phụ "Xem yêu cầu Giao dịch viên…" (`uiux-02-dau-man.test.ts:263`); thiếu ô chọn token ở bản xem thử (mã có `TokenScopeSelect`, giữ đúng một lần, kể cả chú thích: `uiux-02-dau-man.test.ts:88`); số dòng trích dẫn trong notes; các mục ở mục 1 "Không làm".
- **QĐ-8. Mốc test phải giữ** (không sửa `app/test/**`, không sửa e2e cũ):
  - `/approvals`: heading "Phê duyệt lệnh"; `data-chain={chain}`; ô chọn token `#token-scope` hiện, giá trị `WPT`, bấm được (`uiux-02-dau-man.spec.ts:28-54`); `aria-label` 3 ô số liệu; `aria-label` "Hàng chờ tạo token", "Hàng chờ huỷ token" (đang có trên cả thẻ và bảng, giữ nguyên chuỗi); nhãn "Trạng thái", "Tìm kiếm" trong hàng chờ; ô trạng thái có giá trị `PENDING` và 6 lựa chọn đúng chữ, đúng thứ tự (`maker-checker.spec.ts:182-192`); liên kết mã 8 ký tự đầu; `[data-request-id]` (`maker-checker.spec.ts:141-147`, `mint.spec.ts:208-210`, `chain-scope.spec.ts:16-20`).
  - `/approvals/[id]`: heading "Chi tiết yêu cầu"; `aria-label` "Khối hành động", "Khối nội dung yêu cầu", "Khối thông tin token", "Nhật ký"; khối hành động chứa chữ trạng thái ("Chờ duyệt", "Hoàn tất"); nhật ký đếm bằng `li`; nút đúng tên "Chấp nhận", "Từ chối" và trạng thái khoá; `data-testid="reject-block-reason"`; nhãn "Lý do từ chối"; khối hành động đúng một `role="status"`, có chữ "Đã từ chối yêu cầu" sau khi từ chối; `innerText` của nhật ký vẫn chứa mã giao dịch 64 ký tự (`maker-checker.spec.ts:150-176`, `fe-ux-01c-chuyen-dong.spec.ts:216-220`, `mint.spec.ts:212-219`, `ops-transactions.spec.ts:75-76`, `:191-192`, `recall.spec.ts:43-44`).
  - Mọi màn: đúng một `h1`; không `.font-mono`; có ít nhất một `.tabular-nums` hoặc `.font-code` (`fe-ux-01a-nen.spec.ts:137-143`); 390 px không tràn ngang; mọi `Link` `prefetch={false}`.
- **QĐ-10. Tách khối hành động để kiểm được bằng dữ liệu giả.** Không e2e nào kiểm trực tiếp trạng thái có cảnh báo duyệt hay `EXECUTING` có `canReconcile` (mock khó tạo các trạng thái này), và unit test hiện chỉ kiểm hàm `approveBlockReason`, chưa kiểm JSX dùng đúng kết quả. Vì vậy:
  - Tệp mới `components/maker-checker/approval-actions.tsx` (không `'use server'`, không import `app/actions`, `lib/**` ngoài kiểu và hàm thuần): hàm thuần `actionBlocks(detail, working, rejectReason)` trả `{ decisionBlock, approveBlock, rejectBlock, approveWarning }`, là các dòng `approval-detail.tsx:136-140` DỜI NGUYÊN VĂN (cùng thứ tự, cùng hàm `decisionBlockReason`, `approveBlockReason`, `rejectBlockReason`, cùng chuỗi "Đang xử lý…", "Đang tải yêu cầu…"); và component trình bày `ApprovalActions` nhận các giá trị đó cùng `status`, `canReconcile`, `working`, `rejectReason`, `feedback` và các hàm `onRejectReasonChange`, `onApprove`, `onReject`, `onReconcile`, dựng toàn bộ nội dung thẻ "Khối hành động" (giữ mọi `aria-label`, `data-testid`, `role`, điều kiện hiện, `disabled`, `title` như hiện tại).
  - `approval-detail.tsx` gọi `actionBlocks` và `ApprovalActions`; không thêm nhánh, không đổi điều kiện. State, handler, server action vẫn ở `approval-detail.tsx`.
  - Đây là dời mã, không phải thêm logic; diff hai nơi phải đối chiếu được từng dòng (checkpoint dán đoạn trước và sau).
- **QĐ-9. Hiệu năng:** JS gzip `/approvals` và `/approvals/[id]` không tăng quá 3 KB, các trang đo khác không tăng; CSS gzip không tăng quá 2 KB; cảnh báo hydrate, lỗi console 0.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/pages/{approvals,approval-detail}.tsx` | QĐ-1 |
| `app/src/components/maker-checker/stat-card.tsx` | Chỉ được XOÁ (QĐ-5) |
| `app/src/components/maker-checker/approval-actions.tsx` (mới) | QĐ-10 |
| `app/test/fe-ux-03a.test.ts` (mới) | Design mục 3 |
| `app/e2e/fe-ux-03a-kiem-soat.spec.ts` (mới) | Design mục 3 |
| `docs/fe-ux-03a-kiem-soat/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX03A.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác, gồm `components/maker-checker/*` còn lại (trừ tệp mới `approval-actions.tsx`), `components/ui/**`, `components/layout/**`, `globals.css`, route `app/src/app/**`, `lib/**`, `app/test/**`, e2e có sẵn, `package*.json`.

## 4. Điều kiện hoàn thành

- [ ] 2 màn đúng bố cục bản chốt trừ mục 1 "Không làm" và QĐ-7; bảng đối chiếu notes (Giữ, Đã cũ, Bỏ kèm lý do) trong checkpoint.
- [ ] Ô số liệu đúng QĐ-3; khối tự viết thay theo QĐ-4; `FEEDBACK_STYLE` không còn.
- [ ] `stat-card.tsx` đã xoá; `rg -n "stat-card|INPUT_CLASS" app/src` rỗng.
- [ ] Ba tầng khoá ở chi tiết giữ tách riêng: checkpoint ghi bảng trạng thái (đang chờ, có lý do khoá, có cảnh báo duyệt, đang xử lý, đã quyết định) và nút nào khoá ở mỗi trạng thái, trước và sau giống nhau.
- [ ] Không đổi chữ, trường, nút, điều kiện khoá; chỉ chuỗi QĐ-6 đổi (tasks bước 6d).
- [ ] Diff giữ logic (QĐ-1); checkpoint liệt kê từng đoạn đổi nằm gần hook, handler, điều kiện khoá, kèm lý do an toàn.
- [ ] Số action khi mở màn đúng QĐ-2 và không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-9; hydrate, lỗi console 0.
- [ ] Mốc test QĐ-8 giữ nguyên; không sửa test có sẵn.
- [ ] Ảnh 1440 và 390, Sáng và Tối, trước và sau cho 2 màn khi ĐÃ CÓ dữ liệu, gồm chi tiết ở 3 trạng thái: chờ duyệt, đã chấp nhận (có mã giao dịch), đã từ chối. Dữ liệu tạo bằng tay trên một máy chủ mock RIÊNG (`next start` cổng khác, env như `playwright.config.ts`): Giao dịch viên lập 3 yêu cầu, Kiểm soát viên chấp nhận 1, từ chối 1, để 1 chờ; chụp xong tắt máy chủ. Trước và sau dùng cùng cách tạo dữ liệu.
- [ ] `fe-ux-03a-kiem-soat.spec.ts` đủ 3 ca và `fe-ux-03a.test.ts` đủ 4 trạng thái (design mục 3), xanh.
- [ ] Khối hành động tách theo QĐ-10, dời nguyên văn; checkpoint dán đoạn trước và sau.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh. Checkpoint ghi nợ: `maker-checker.spec.ts:142` không còn ý nghĩa sau QĐ-3 (ô hiện gạch ngắn kể cả khi đang tải); chú thích `request-table.tsx:21-22` ("Màn Phê duyệt không truyền") sai sau PR này, sửa khi tệp đó được mở lại.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) rỗng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không còn dùng trong 2 tệp xoá hẳn.

## 5. Phạm vi kiểm thử

Kế hoạch quy định nhóm lập duyệt phải kiểm trên Hardhat, và chi tiết yêu cầu có dòng "Thực hiện qua" (Fireblocks) cùng các khoá quyết định. Lưu ý: project Hardhat chỉ chạy `mint.spec.ts`, `chain-scope.spec.ts` (`playwright.config.ts:69-76`), tức chỉ phủ luồng Chấp nhận; Từ chối chỉ có trên mock; cảnh báo duyệt và Đối soát không có e2e, kiểm bằng unit test mới (QĐ-10, design mục 3). Không đổi logic, backend, chuỗi do máy chủ trả.

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần (`e2e` là project mock, `evm` là project Hardhat), lưu log; đo action, JS bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `eefeb720730e3ef4f1d1655e033d91863f994612343cc0ad89d243da83657238`; chạy `JS_PAGES=/,/portfolio,/trade,/approvals node 20261104_do_moc_measure.js <baseURL> <thư mục ra>`; trang chi tiết đo JS bằng tay theo cách 01c), CSS theo cách 01c. Log, ảnh, số đo để ngoài repo; gửi kèm riêng đoạn log từ dòng "EVM - E2E PROJECT HARDHAT" tới hết (để Supervisor đọc mà không cần cả gói) | `contracts` |
| Supervisor | Đọc diff 2 tệp màn; build; chạy `fe-ux-03a-kiem-soat`, `maker-checker`, `mint`, `chain-scope`, `uiux-02-dau-man` (e2e và unit); đọc đoạn log EVM; gây lỗi có chủ đích 4 điểm (bỏ `aria-label` "Đang chờ duyệt" ở `Kpi`; trong `actionBlocks` đổi `approveBlockReason(detail)` thành `decisionBlockReason(detail)`, tức bỏ riêng điều kiện cảnh báo khỏi nút Chấp nhận; cho nút Đối soát luôn khoá hoặc không khoá khi `working`; bỏ `role="status"` của phản hồi); xem ảnh | Full suite |
