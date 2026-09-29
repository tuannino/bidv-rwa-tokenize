#!/usr/bin/env bash
# =============================================================================
#  CHẠY TOÀN BỘ KIỂM CHỨNG CỤC BỘ (không cần mạng, không cần testnet)
#
#  Chạy từ GỐC repo:  bash scripts/run-local-all.sh
#
#  Gồm:
#    1. Lớp 3 - 3 luật kiến trúc + cấu trúc repo
#    2. Lớp 3 - điểm cắm: marker @pending / @blocked / @flow đúng quy ước
#    3. Lớp 3 - khuôn checkpoint của task đang làm (mục 0 tóm tắt nghiệm thu)
#    4. Lớp 1 - spec test contract EVM   (hardhat)
#    5. Chất lượng app                    (typecheck, lint, vitest)
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

if [ ! -d app/src ] || [ ! -d packages ]; then
  c_red "Phải chạy từ gốc repo bidv-rwa-tokenize."
  exit 1
fi

# --- 1. Luật kiến trúc -------------------------------------------------------
banner "LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO"
if bash scripts/verify-arch-rules.sh; then
  c_grn "  => PASS: luật kiến trúc"; PASSED+=("luật kiến trúc")
else
  rc=$?
  if [ "$rc" = "2" ]; then
    c_yel "  => PASS có cảnh báo: luật kiến trúc"; PASSED+=("luật kiến trúc (có cảnh báo)")
  else
    c_red "  => FAIL: luật kiến trúc"; FAILED+=("luật kiến trúc")
  fi
fi

# --- 2. Điểm cắm (marker) ---------------------------------------------------
# Chỉ đỏ khi marker SAI: sai cú pháp, mã task không có trong .kiro/task-status.json,
# marker chờ task đã done, từ khóa biến thể bị cấm, số bước @flow trùng/nhảy cách.
# Còn nhiều điểm cắm thì KHÔNG đỏ. Quy ước: .kiro/steering/make-control.md
run "LỚP 3 - ĐIỂM CẮM (marker)" . \
    node scripts/scan-pending.mjs --check

# --- 3. Khuôn checkpoint -----------------------------------------------------
# CHỈ kiểm checkpoint của task đang làm, đọc .kiro/task-status.json mục inProgress.
# Không có task nào đang làm, hoặc task đang làm chưa viết checkpoint => BỎ QUA, không đỏ.
# Checkpoint của task đã done thì KHÔNG kiểm: đó là vết lịch sử, không sửa lại để vừa một
# quy tắc ra sau. Quy ước: .kiro/steering/checkpoint.md
run "LỚP 3 - KHUÔN CHECKPOINT" . \
    node scripts/check-checkpoint.mjs --in-progress

# --- 4. Spec test contract EVM ----------------------------------------------
run "LỚP 1 - SPEC TEST CONTRACT EVM" packages/contracts-evm \
    npx hardhat test

# Một dòng thông báo, KHÔNG phải một mục kiểm: không tính vào PASSED/FAILED và không đổi
# mã thoát. Có dòng này để người chạy biết phần Soroban vắng mặt là CHỦ ĐÍCH, chứ không
# phải script quên gọi hay môi trường thiếu công cụ.
c_yel "  (Soroban: tạm dừng ở khâu kiểm chứng, không cần chạy — mã nguồn Rust giữ nguyên)"

# --- 5. Chất lượng app ------------------------------------------------------
run "APP - TYPECHECK" app npm run typecheck
run "APP - LINT"      app npx eslint .
run "APP - VITEST"    app npm test

# --- Tổng kết ---------------------------------------------------------------
banner "TỔNG KẾT"
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
c_grn "  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet."
