# Hướng dẫn bật bảo vệ nhánh `dev`

> **Ai làm:** Chủ kho mã (Owner). Kiro **không** tự bật — đây là cấu hình kho mã, không phải mã nguồn.
> **Khi nào:** sau khi OP-01 được hợp nhất vào `dev` (cần quy trình tự động đã chạy ít nhất một
> lần để tên phép kiểm hiện ra trong danh sách chọn).
> **Mất bao lâu:** vài phút, làm một lần.

---

## 1. Vì sao cần

`.kiro/steering/branching.md` đã ghi luật: `dev` luôn ở trạng thái dùng được, mọi thay đổi qua
yêu cầu hợp nhất, không đẩy thẳng. Nhưng luật đó hiện **chỉ là văn bản** — không có gì chặn.

Dự án đã **hai lần mất nội dung trên `dev`** vì đúng lỗ hổng này:

| Lần | Mất gì | Vì sao nhìn nhật ký không thấy |
|---|---|---|
| 1 | 164 tệp của vòng dọn giao diện (`packages/`, `app/src/lib/{ledger,signer,rbac}`, `docker-compose.yml`) | Mẫu "hoàn tác rồi hợp nhất lại": lịch sử vẫn ghi là đã hợp nhất |
| 2 | Toàn bộ phần quyền của BE-08 | Cùng mẫu. Mã vẫn biên dịch, mọi test vẫn xanh |

Bảo vệ nhánh không ngăn được mẫu hoàn tác (`branching.md` §6 nói cách xử lý đúng), nhưng nó
ngăn được **đường đi** đã đưa cả hai lần đó vào `dev`: một thay đổi vào `dev` mà không qua yêu
cầu hợp nhất và không qua phép kiểm nào.

Phần bảo vệ nội dung bảng quyền thì đã có phép kiểm riêng — xem mục 5.

---

## 2. Cần có trước

- Quy trình tự động `.github/workflows/ci.yml` đã chạy **ít nhất một lượt** trên `dev` hoặc trên
  một yêu cầu hợp nhất. Chưa chạy lần nào thì GitHub không gợi ý được tên phép kiểm, và gõ tay
  sai một ký tự sẽ tạo ra một phép kiểm **không bao giờ báo về** — yêu cầu hợp nhất treo vĩnh
  viễn ở trạng thái "đang chờ".
- Quyền `admin` trên kho mã.

Tên hai phép kiểm cần chọn (đúng tên `name:` của việc trong `ci.yml`):

```
A - ung dung (cong bat buoc)
B - hop dong EVM (cong bat buoc)
```

---

## 3. Làm bằng giao diện web

`Settings` → `Branches` → `Add branch protection rule` (kho mã mới dùng
`Settings` → `Rules` → `Rulesets` → `New branch ruleset`).

| Mục | Đặt gì |
|---|---|
| Branch name pattern | `dev` |
| ☑ Require a pull request before merging | BẬT |
| — Required approvals | `0` cho giai đoạn hiện tại (xem ghi chú dưới) |
| — ☑ Dismiss stale approvals when new commits are pushed | BẬT |
| ☑ Require status checks to pass before merging | BẬT |
| — ☑ Require branches to be up to date before merging | BẬT |
| — Status checks that are required | chọn **đúng hai** tên ở mục 2 |
| ☑ Require conversation resolution before merging | BẬT |
| ☐ Allow force pushes | **TẮT** |
| ☐ Allow deletions | **TẮT** |
| ☑ Do not allow bypassing the above settings | BẬT |

**Vì sao `0` phê duyệt mà vẫn bật "require a pull request".** Dự án hiện có một người thực thi
và một người nghiệm thu, nên đòi một phê duyệt trên GitHub sẽ chặn chính Owner khi tự hợp nhất.
Thứ cần ở đây không phải chữ ký, mà là **bắt buộc đi qua yêu cầu hợp nhất** — vì đó là nơi phép
kiểm chạy. Khi có thêm người thì nâng lên `1`.

**Vì sao bật "require branches to be up to date".** Hai yêu cầu hợp nhất xanh độc lập vẫn có thể
làm `dev` đỏ sau khi hợp nhất cả hai (mỗi bên kiểm trên một nền khác). Bật mục này buộc rebase về
`dev` mới nhất rồi chạy lại phép kiểm — đúng bước 1 của `branching.md` §8.

**Vì sao "do not allow bypassing".** Không bật thì người có quyền `admin` vẫn đẩy thẳng được, và
người có quyền `admin` chính là người hay đẩy thẳng nhất.

---

## 4. Làm bằng dòng lệnh

Cần `gh` đã đăng nhập với quyền `admin`.

```bash
gh api -X PUT "repos/{owner}/{repo}/branches/dev/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["A - ung dung (cong bat buoc)", "B - hop dong EVM (cong bat buoc)"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

⚠️ **`contexts` phải khớp từng ký tự** với `name:` trong `ci.yml`. Tên sai không báo lỗi: GitHub
nhận nó như một phép kiểm chưa từng báo về, và mọi yêu cầu hợp nhất sẽ treo ở "Expected — Waiting
for status to be reported". Đây là lý do hai tên việc trong `ci.yml` viết **không dấu**.

---

## 5. Việc C cố ý KHÔNG nằm trong danh sách bắt buộc

`C - phan nang (KHONG chan hop nhat)` dựng bản phát hành rồi chạy kiểm thử đầu cuối. **Chưa siết
ở giai đoạn này**, hai lý do đo được:

1. Bước dựng bản gọi ra dịch vụ phông chữ của Google (`app/src/app/layout.tsx` dùng
   `next/font/google`), nên nó **cần mạng ra ngoài**. Một cổng bắt buộc có thể đỏ vì mạng là một
   cổng sẽ bị người ta xin bỏ qua, và bỏ qua vài lần thì nó thành cổng trang trí.
2. Kiểm thử đầu cuối chạy ~25 giây cục bộ nhưng còn phải dựng bản trước đó; đo thời gian thật
   trên nơi chạy tự động vài lượt rồi mới siết.

Việc C **không** đặt `continue-on-error`, nên nó hiện đỏ đúng như thật. Việc "không chặn" nằm ở
chỗ nó không có trong `contexts` ở trên — chứ không phải ở chỗ che kết quả đi.

**Khi nào siết:** khi việc C xanh liên tục 10 lượt chạy. Lúc đó thêm
`C - phan nang (KHONG chan hop nhat)` vào `contexts` và **đổi tên việc** trong `ci.yml` cho khỏi
nói sai (đổi tên việc thì phải cập nhật `contexts` trong cùng lần, vì tên là khoá).

---

## 6. Hai phép chặn KHÔNG nằm ở bảo vệ nhánh

Bảo vệ nhánh chỉ kiểm soát **đường vào**. Hai thứ dưới đây kiểm soát **nội dung**, và đã nằm
trong việc A:

| Phép chặn | Ở đâu | Chặn được gì |
|---|---|---|
| Bảng quyền không được teo lại | `scripts/verify-arch-rules.sh`, mục LUẬT 3 | Đúng sự cố lần 2: mất hành động khỏi `ACTIONS` mà mã vẫn biên dịch và test vẫn xanh. So với bản trên nền, đỏ kèm tên hành động đã mất |
| Ba luật kiến trúc, điểm cắm, khuôn checkpoint | cùng tệp + `scan-pending.mjs` + `check-checkpoint.mjs` | Gọi chuỗi ngoài `ILedgerPort`, khóa bí mật rải rác, so sánh vai cứng, marker lạc hậu, checkpoint thiếu mục 0 |

Sự cố lần 1 (mất 164 tệp) **không** có phép chặn tự động. Cách phát hiện vẫn là ba lệnh kiểm
nhanh ở `branching.md` §5, chạy bằng tay khi nghi `dev` hỏng.

---

## 7. Kiểm lại sau khi bật

```bash
# 1. Đẩy thẳng lên dev phải BỊ TỪ CHỐI (chạy trên một nhánh tạm, đừng thử với commit thật)
git checkout dev && git pull
git commit --allow-empty -m "thu bao ve nhanh"
git push origin dev        # mong đợi: remote rejected — protected branch
git reset --hard origin/dev

# 2. Cấu hình hiện tại
gh api "repos/{owner}/{repo}/branches/dev/protection" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);console.log('phep kiem bat buoc:',p.required_status_checks.contexts);console.log('strict:',p.required_status_checks.strict,'| enforce_admins:',p.enforce_admins.enabled,'| force push:',p.allow_force_pushes.enabled);});"
```

Mong đợi ở lệnh 2: đúng hai phép kiểm của mục 2, `strict: true`, `enforce_admins: true`,
`force push: false`.

---

## 8. Liên quan

| Việc | Ở đâu |
|---|---|
| Luật nhánh, mẫu revert cấm dùng, tự kiểm trước khi mở PR | `.kiro/steering/branching.md` |
| Danh sách việc cần kiểm (nguồn duy nhất) | `scripts/run-local-all.sh --list` |
| Quy trình tự động | `.github/workflows/ci.yml` |
| Stellar tạm dừng ở khâu kiểm chứng | `docs/tech-report.md` mục 2.6 |
