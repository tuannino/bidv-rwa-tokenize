---
inclusion: always
---

# Quy tắc nhánh: `dev` là nhánh phát triển chính

## 1. Nguyên tắc gốc

**`dev` là nhánh phát triển chính và luôn ở trạng thái stable.** Mọi thứ trên `dev`
phải build được, test xanh, và dùng được để demo bất cứ lúc nào.

Vòng đời một yêu cầu, không có ngoại lệ:

```
1. Checkout nhánh mới TỪ dev          → git checkout -b <loại>/<tên> dev
2. Viết spec trong .kiro/specs/<tên>/  → requirements.md, design.md, tasks.md
3. Phát triển theo spec
4. Nộp checkpoint, Supervisor nghiệm thu
5. ĐƯỢC nghiệm thu PASS thì mới merge vào dev
```

**Cấm checkout từ nhánh phụ.** Không lấy nền từ nhánh feature khác, nhánh của người
khác, nhánh đang chờ nghiệm thu, hay nhánh đã merge nhưng chưa xác nhận. Nền duy nhất
được phép là `dev`.

**Cấm merge vào `dev` khi chưa được nghiệm thu.** Checkpoint PASS là điều kiện bắt
buộc, không phải thủ tục hình thức.

## 2. Vì sao nghiêm ngặt như vậy

Chuỗi phụ thuộc nhánh là nguyên nhân của sự cố đã xảy ra thật trong dự án này. Khi
nhánh A lấy nền từ nhánh B đang chờ nghiệm thu, ba rủi ro xuất hiện cùng lúc:

- Nếu B bị từ chối hoặc phải sửa lại, A phải rebase toàn bộ hoặc bỏ đi.
- Lỗi của B lẫn vào A, lúc nghiệm thu không biết lỗi thuộc về ai.
- Khi cả hai merge vào `dev`, xung đột nhân lên và rất khó gỡ đúng.

Lấy nền từ `dev` thì mỗi nhánh độc lập, nghiệm thu độc lập, merge độc lập, và revert
được riêng lẻ nếu cần.

## 3. Đặt tên nhánh

```
p<số>/<tên-ngắn>        phase theo lộ trình      p4/mint-testnet
feat/<tên-ngắn>         tính năng mới            feat/redeem-ui
fix/<tên-ngắn>          sửa lỗi                  fix/docker-lockfile
test/<tên-ngắn>         bổ sung kiểm thử         test/spec-pack-p7
docs/<tên-ngắn>         chỉ tài liệu             docs/tech-report-update
```

Một nhánh giải quyết **một** mục tiêu. Việc không liên quan thì mở nhánh khác, không
nhét kèm.

## 4. Trước khi mở nhánh mới

```bash
git checkout dev
git pull origin dev
git log --oneline -3          # xác nhận đang ở đúng commit mới nhất
git checkout -b p7/profit-distribution dev
```

Bắt buộc `pull` trước khi tạo nhánh. Lấy nền từ bản `dev` cũ trong máy sẽ sinh xung
đột giả khi merge.

## 5. Khi `dev` không dùng được làm nền

Tình huống này **đã xảy ra một lần và đã được xử lý** — giữ lại đây làm tiền lệ:

- **Sự cố:** commit revert `ac4f0b1` xoá thành quả P0/P1 khỏi `dev`; lần merge lại sau
  đó không phục hồi được nên `dev` thiếu 164 file (`packages/`,
  `app/src/lib/{ledger,signer,rbac,...}`, `docker-compose.yml`).
- **Cách đã sửa:** `8b34d4a Revert "Revert "Iteration 2/UI cleanup""` — tức **revert
  chính commit revert**, đúng như §6. Không cherry-pick, không gỡ xung đột thủ công.
- **Trạng thái hiện tại:** `dev` đã lành. Kiểm nhanh bất cứ lúc nào:
  ```bash
  git ls-tree -r --name-only dev | grep -c '^packages/'          # phải > 0
  git ls-tree -r --name-only dev | grep -c '^app/src/lib/ledger' # phải > 0
  git ls-tree -r --name-only dev | grep -c AssetRegistry         # phải = 0
  ```

Khi phát hiện `dev` hỏng (thiếu file, build fail, test đỏ):

1. **DỪNG. Không tự chọn nền khác. Không tự sửa `dev`.**
2. Ghi ngay vào checkpoint mục "Câu hỏi mở": `dev` hỏng ở đâu, bằng chứng cụ thể
   (lệnh đã chạy và output), và đề xuất cách sửa.
3. Chờ Owner xác nhận.
4. Nếu Owner cho phép tạm dùng nền khác, **ghi rõ trong checkpoint** đã dùng nền nào,
   vì sao, và món nợ phải rebase về `dev` sau khi `dev` lành.

Tự ý chọn nền khác mà không báo là vi phạm. Báo rồi được cho phép thì không.

## 6. Cấm mẫu revert rồi merge lại

**Đây là lỗi đã gây thiệt hại thật, không được lặp lại.**

Chuỗi sai:

```
merge nhánh X vào dev   → có nội dung
revert merge đó         → xoá nội dung
merge lại nhánh X       → git KHÔNG phục hồi nội dung
```

Nguyên nhân: sau khi revert, commit của X vẫn nằm trong lịch sử `dev`, nên lần merge
sau git coi là "đã có" và bỏ qua phần đã bị revert.

Cách xử lý đúng khi cần khôi phục thứ đã revert: **revert chính commit revert đó**.

```bash
git revert <sha-của-commit-revert>
```

Không merge lại nhánh cũ, không cherry-pick từng commit, không giải xung đột thủ công
hàng chục file.

Và nếu cần loại bỏ một nhánh đã merge: cân nhắc kỹ trước khi revert merge commit, vì
đưa nhánh đó trở lại sẽ phức tạp.

## 7. Giữ nhánh đồng bộ với `dev`

Nhánh sống lâu thì `dev` sẽ đi trước. Cập nhật bằng **rebase**, không merge `dev`
ngược vào nhánh:

```bash
git fetch origin
git rebase origin/dev
```

Rebase giữ lịch sử thẳng, dễ đọc và dễ nghiệm thu. Merge `dev` vào nhánh tạo lịch sử
rối, khó biết thay đổi nào là của nhánh.

Nếu nhánh đã đẩy lên và có người khác dùng thì không rebase, hỏi Owner trước.

## 8. Sau khi được nghiệm thu

1. Rebase về `dev` mới nhất, chạy lại toàn bộ kiểm chứng cục bộ:
   ```bash
   git fetch origin && git rebase origin/dev
   bash scripts/run-local-all.sh
   ```
2. Mở PR vào `dev`, mô tả kèm đường dẫn checkpoint.
3. Owner merge. **Kiro không tự merge vào `dev`.**
4. Sau khi merge, xoá nhánh trên remote để không ai lấy nhầm làm nền.

## 9. Quan hệ với `main`

`main` là bản phát hành, chỉ nhận từ `dev` và chỉ do Owner quyết định. Kiro không tạo
nhánh từ `main`, không mở PR vào `main`.

## 10. Việc tuyệt đối không làm

- `git push --force` lên `dev` hoặc `main`
- Commit trực tiếp lên `dev` (kể cả sửa một dòng tài liệu)
- Merge nhánh chưa được nghiệm thu vào `dev`
- Lấy nền từ nhánh phụ mà không được Owner cho phép
- Xoá hoặc viết lại lịch sử của nhánh người khác
- Merge khi kiểm chứng cục bộ còn đỏ, dù chỉ một mục

## 11. Tự kiểm trước khi mở PR

Áp dụng cho nhánh có thay đổi mã (`p<số>/`, `feat/`, `fix/`, `test/`):

- [ ] Nhánh này tạo từ `dev`, không phải từ nhánh phụ
- [ ] Đã rebase về `dev` mới nhất
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ
- [ ] Có spec trong `.kiro/specs/<tên>/` đủ 3 file
- [ ] Có checkpoint và đã được nghiệm thu PASS
- [ ] `docs/tech-report.md` đã cập nhật theo `docs/tech-report-maintenance.md`
- [ ] Nhánh chỉ giải quyết một mục tiêu

Nhánh `docs/` (chỉ tài liệu, steering, spec — **không** chạm mã nguồn) dùng bản gọn,
vì đòi spec 3 file và checkpoint cho một thay đổi tài liệu là không tương xứng:

- [ ] Nhánh này tạo từ `dev`
- [ ] Chỉ sửa tài liệu — `git diff --name-only dev...HEAD` không có file trong
      `app/src`, `packages/*/contracts`, `packages/*/src`
- [ ] Không mâu thuẫn với steering khác đang `inclusion: always`
- [ ] Owner merge, Kiro không tự merge

## 12. Ngoại lệ do Owner chỉ định

Owner có thể yêu cầu trực tiếp một việc mà mục 10 cấm — ví dụ commit một file tài liệu
thẳng lên `dev`. Khi đó:

1. **Làm theo Owner**, vì Owner là người quyết định cuối cùng.
2. **Nói rõ ra** rằng việc này lệch quy tắc nào, đừng làm im lặng.
3. Ghi lại: chỉ định của Owner, việc đã làm, commit sinh ra.

Ngoại lệ chỉ có giá trị cho đúng lần yêu cầu đó, không thành tiền lệ. Kiro **không**
tự viện dẫn mục này để bỏ qua mục 10.

**Đã dùng ngoại lệ này:** 13/09/2026 — Owner yêu cầu commit `.kiro/steering/branching.md`
trực tiếp lên `dev`; kết quả là commit `fce4e00`, lệch mục 10 dòng "Commit trực tiếp lên
`dev`".
