#!/usr/bin/env bash
# =============================================================================
#  CHẠY KIỂM CHỨNG CỤC BỘ — và là NGUỒN DUY NHẤT của danh sách việc cần kiểm
#
#  Chạy từ GỐC repo:
#      bash scripts/run-local-all.sh                 # bộ mặc định (như trước OP-01)
#      bash scripts/run-local-all.sh <phần> [<phần>...]   # chỉ chạy phần được nêu
#      bash scripts/run-local-all.sh --list          # in danh sách phần rồi thoát
#
#  CÁC PHẦN gọi riêng được:
#      arch        Lớp 3 - 3 luật kiến trúc + cấu trúc repo + số hành động RBAC
#      markers     Lớp 3 - điểm cắm: marker @pending / @blocked / @flow đúng quy ước
#      checkpoint  Lớp 3 - khuôn checkpoint của task đang làm (mục 0 nghiệm thu)
#      contracts   Lớp 1 - spec test contract EVM (hardhat)
#      app         Chất lượng app: typecheck, lint, vitest
#      build       Dựng bản phát hành của app  (CẦN MẠNG - xem ghi chú dưới)
#      e2e         Kiểm thử đầu cuối Playwright trên bản build của phần `build`, chain `mock`
#      evm         Đầu cuối trên chuỗi hardhat cục bộ: dựng bản build riêng, reset chuỗi, chạy
#                  project `hardhat`, dọn nút và app kể cả khi đỏ (CẦN MẠNG như `build`)
#
#  BỘ MẶC ĐỊNH = arch markers checkpoint contracts app.
#  `build`, `e2e` và `evm` CỐ Ý ở ngoài bộ mặc định: cả ba nặng, và `build`/`evm` cần mạng
#  nên không chạy được ở nơi bị chặn ra ngoài. Muốn chạy thì gọi tên tường minh.
#
#  VÌ SAO TÁCH THÀNH PHẦN (OP-01). Quy trình tự động ở .github/workflows/ci.yml gọi
#  LẠI ĐÚNG các phần dưới đây, không chép danh sách lệnh sang tệp YAML. Chép sang là
#  tạo ra hai danh sách phải tự tay giữ khớp nhau, và chúng sẽ lệch — lúc đó nơi chạy
#  tự động và nơi chạy tay kiểm hai thứ khác nhau mà không ai biết.
#
#  KHÔNG gồm phần Soroban. Chuỗi Stellar là phần mở rộng tương lai, hiện TẠM DỪNG ở
#  khâu kiểm chứng: mã nguồn Rust vẫn nằm trong repo nhưng bộ công cụ Rust KHÔNG còn là
#  thứ phải có trong môi trường làm việc. Lý do đầy đủ: docs/tech-report.md mục 2.6.
#
#  Phần TỔNG KẾT in thêm bảng điểm cắm đang chờ. Bảng đó là THÔNG TIN, không ảnh
#  hưởng mã thoát: còn điểm cắm là trạng thái bình thường, không phải lỗi.
#
#  Dùng trước mỗi lần nộp hoặc review checkpoint.
# =============================================================================
set -uo pipefail

# Tên phần và thứ tự của bộ mặc định. Thêm phần mới = thêm hàm `part_<tên>` và thêm
# tên vào ALL_PARTS; nếu phần đó thuộc cổng bắt buộc thì thêm cả vào DEFAULT_PARTS.
ALL_PARTS=(arch markers checkpoint contracts app build e2e evm)
DEFAULT_PARTS=(arch markers checkpoint contracts app)

FAILED=()
PASSED=()

c_red() { printf '\033[31m%s\033[0m\n' "$1"; }
c_grn() { printf '\033[32m%s\033[0m\n' "$1"; }
c_yel() { printf '\033[33m%s\033[0m\n' "$1"; }
banner() { printf '\n\033[1m########## %s ##########\033[0m\n' "$1"; }

run() { # nhãn, thư mục, lệnh...
  local label="$1"; local dir="$2"; shift 2
  banner "$label"
  if [ ! -d "$dir" ]; then
    c_yel "  BỎ QUA: không có thư mục $dir"
    return 0
  fi
  if ( cd "$dir" && "$@" ); then
    c_grn "  => PASS: $label"
    PASSED+=("$label")
  else
    c_red "  => FAIL: $label"
    FAILED+=("$label")
  fi
}

# -----------------------------------------------------------------------------
#  Định nghĩa từng phần
# -----------------------------------------------------------------------------

part_arch() {
  banner "LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO"
  # Mã thoát 2 = chỉ có cảnh báo, KHÔNG phải lỗi. Xem scripts/verify-arch-rules.sh.
  if bash scripts/verify-arch-rules.sh; then
    c_grn "  => PASS: luật kiến trúc"; PASSED+=("luật kiến trúc")
  else
    local rc=$?
    if [ "$rc" = "2" ]; then
      c_yel "  => PASS có cảnh báo: luật kiến trúc"; PASSED+=("luật kiến trúc (có cảnh báo)")
    else
      c_red "  => FAIL: luật kiến trúc"; FAILED+=("luật kiến trúc")
    fi
  fi
}

part_markers() {
  # Chỉ đỏ khi marker SAI: sai cú pháp, mã task không có trong .kiro/task-status.json,
  # marker chờ task đã done, từ khóa biến thể bị cấm, số bước @flow trùng/nhảy cách.
  # Còn nhiều điểm cắm thì KHÔNG đỏ. Quy ước: .kiro/steering/make-control.md
  run "LỚP 3 - ĐIỂM CẮM (marker)" . \
      node scripts/scan-pending.mjs --check
}

part_checkpoint() {
  # CHỈ kiểm checkpoint của task đang làm, đọc .kiro/task-status.json mục inProgress.
  # Không có task nào đang làm, hoặc task đang làm chưa viết checkpoint => BỎ QUA, không đỏ.
  # Checkpoint của task đã done thì KHÔNG kiểm: đó là vết lịch sử, không sửa lại để vừa một
  # quy tắc ra sau. Quy ước: .kiro/steering/checkpoint.md
  run "LỚP 3 - KHUÔN CHECKPOINT" . \
      node scripts/check-checkpoint.mjs --in-progress
}

part_contracts() {
  run "LỚP 1 - SPEC TEST CONTRACT EVM" packages/contracts-evm \
      npx hardhat test

  # Một dòng thông báo, KHÔNG phải một mục kiểm: không tính vào PASSED/FAILED và không đổi
  # mã thoát. Có dòng này để người chạy biết phần Soroban vắng mặt là CHỦ ĐÍCH, chứ không
  # phải script quên gọi hay môi trường thiếu công cụ.
  c_yel "  (Soroban: tạm dừng ở khâu kiểm chứng, không cần chạy — mã nguồn Rust giữ nguyên)"
}

part_app() {
  run "APP - TYPECHECK" app npm run typecheck
  run "APP - LINT"      app npx eslint .
  run "APP - VITEST"    app npm test
}

part_build() {
  # CẦN MẠNG: app/src/app/layout.tsx dùng `next/font/google`, nên `next build` gọi ra dịch
  # vụ phông chữ của Google. Nơi chạy bị chặn ra ngoài thì phần này đỏ vì MẠNG, không vì mã
  # nguồn — đừng "sửa" bằng cách bỏ phông chữ đi.
  run "APP - BUILD BẢN PHÁT HÀNH" app npm run build
}

part_e2e() {
  # Playwright TỰ chạy máy chủ theo app/playwright.config.ts: `next start` trên BẢN BUILD mà
  # phần `build` vừa dựng (không dựng lại), cổng 3100, chain `mock`, lưu trong bộ nhớ. Không
  # cần hardhat node, không cần Postgres, và PHẢI chạy khi không có node (chain-selector.spec.ts).
  # Chưa dựng bản thì `next start` báo thiếu bản build: gọi `build e2e`. Gỡ lỗi: E2E_DEV=1.
  run "APP - E2E (PLAYWRIGHT)" app npx playwright test
}

part_evm() {
  # Bản build RIÊNG ở `.next-hardhat` (khớp HARDHAT_DIST_DIR trong app/playwright.config.ts):
  # `NEXT_PUBLIC_DEFAULT_CHAIN` bị nhúng lúc dựng, và không được ghi đè `.next` của phần `e2e`.
  # Lý do chọn cách này: docs/CHECKPOINT_OP03.md.
  run "EVM - BUILD BẢN HARDHAT" app \
      env NEXT_DIST_DIR=.next-hardhat NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local npm run build
  case " ${FAILED[*]:-} " in *" EVM - BUILD BẢN HARDHAT "*) return 0;; esac

  # Dọn nút kể cả khi bị ngắt giữa chừng. Kiểm thử đỏ thì `run` đã bắt mã thoát nên vẫn tới
  # bước dọn bên dưới; còn app do Playwright tự dừng khi chạy xong, đỏ hay xanh.
  trap 'bash scripts/evm-local.sh down >/dev/null 2>&1' EXIT
  run "EVM - DỰNG CHUỖI MỚI" . bash scripts/evm-local.sh reset
  case " ${FAILED[*]:-} " in
    *" EVM - DỰNG CHUỖI MỚI "*) ;;
    *) run "EVM - E2E PROJECT HARDHAT" app env E2E_CHAIN=hardhat-local npx playwright test ;;
  esac
  bash scripts/evm-local.sh down
  trap - EXIT
}

# -----------------------------------------------------------------------------
#  Chọn phần cần chạy
# -----------------------------------------------------------------------------

list_parts() {
  echo "Các phần gọi riêng được:"
  for p in "${ALL_PARTS[@]}"; do
    local mark="  "
    case " ${DEFAULT_PARTS[*]} " in *" $p "*) mark="* ";; esac
    echo "  ${mark}${p}"
  done
  echo
  echo "  * = thuộc bộ mặc định (chạy khi không truyền tham số)"
}

is_known_part() {
  case " ${ALL_PARTS[*]} " in *" $1 "*) return 0;; *) return 1;; esac
}

if [ "${1:-}" = "--list" ] || [ "${1:-}" = "-l" ]; then
  list_parts
  exit 0
fi

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  # In khối chú thích đầu tệp, giữa hai đường kẻ `# ====`. Dò theo MỐC chứ không theo số
  # dòng: số dòng lệch ngay lần đầu ai đó thêm một dòng vào khối chú thích, và lúc đó
  # `--help` im lặng in thiếu hoặc in lẫn cả mã nguồn.
  awk 'NR==2 { inside=1; next } inside && /^# ={10,}/ { exit } inside { sub(/^# ?/, ""); print }' "$0"
  exit 0
fi

if [ "$#" -gt 0 ]; then
  SELECTED=("$@")
  for p in "${SELECTED[@]}"; do
    if ! is_known_part "$p"; then
      c_red "Không có phần tên \"$p\"."
      list_parts
      # Mã thoát 2 = gọi sai, phân biệt với 1 = có mục kiểm không đạt. Nơi chạy tự động
      # cần phân biệt hai thứ này: gõ sai tên phần thì CI xanh oan nếu ta trả 0, và bị
      # đọc là "test đỏ" nếu ta trả 1.
      exit 2
    fi
  done
else
  SELECTED=("${DEFAULT_PARTS[@]}")
fi

if [ ! -d app/src ] || [ ! -d packages ]; then
  c_red "Phải chạy từ gốc repo bidv-rwa-tokenize."
  exit 1
fi

for p in "${SELECTED[@]}"; do
  "part_$p"
done

# --- Tổng kết ---------------------------------------------------------------
banner "TỔNG KẾT"
echo "  Phần đã chạy: ${SELECTED[*]}"
echo "  Đạt:     ${#PASSED[@]}"
for p in "${PASSED[@]:-}"; do [ -n "$p" ] && echo "    PASS  $p"; done
echo "  Không đạt: ${#FAILED[@]}"
for f in "${FAILED[@]:-}"; do [ -n "$f" ] && c_red "    FAIL  $f"; done

# Bảng điểm cắm: THÔNG TIN thôi, không tính vào PASSED/FAILED và không đổi mã thoát.
printf '\n'
node scripts/scan-pending.mjs || c_yel "  (không in được bảng điểm cắm - xem scripts/scan-pending.mjs)"

# Dòng trống tách kết luận khỏi bảng điểm cắm. Phải in bằng printf riêng: c_red/c_grn
# dùng printf '%s' nên chuỗi "\n" đặt trong THAM SỐ sẽ in ra nguyên văn hai ký tự.
printf '\n'
if [ "${#FAILED[@]}" -gt 0 ]; then
  c_red "  => CHƯA ĐẠT. Sửa các mục FAIL trước khi nộp checkpoint."
  exit 1
fi
c_grn "  => ĐẠT các phần đã chạy: ${SELECTED[*]}"
