#!/usr/bin/env bash
# =============================================================================
#  CHẠY TOÀN BỘ KIỂM CHỨNG CỤC BỘ (không cần mạng, không cần testnet)
#
#  Chạy từ GỐC repo:  bash scripts/run-local-all.sh
#
#  Gồm:
#    1. Lớp 3 - 3 luật kiến trúc + cấu trúc repo
#    2. Lớp 1 - spec test contract EVM   (hardhat)
#    3. Lớp 1 - spec test contract Soroban (cargo)
#    4. Chất lượng app                    (typecheck, lint, vitest)
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

# --- 2. Spec test contract EVM ----------------------------------------------
run "LỚP 1 - SPEC TEST CONTRACT EVM" packages/contracts-evm \
    npx hardhat test

# --- 3. Spec test contract Soroban ------------------------------------------
if command -v cargo >/dev/null 2>&1; then
  run "LỚP 1 - SPEC TEST CONTRACT SOROBAN" packages/contracts-stellar \
      cargo test
else
  banner "LỚP 1 - SPEC TEST CONTRACT SOROBAN"
  c_yel "  BỎ QUA: chưa cài Rust/cargo. Cài Rust 1.84+ rồi chạy lại."
fi

# --- 4. Chất lượng app ------------------------------------------------------
run "APP - TYPECHECK" app npm run typecheck
run "APP - LINT"      app npx eslint .
run "APP - VITEST"    app npm test

# --- Tổng kết ---------------------------------------------------------------
banner "TỔNG KẾT"
echo "  Đạt:     ${#PASSED[@]}"
for p in "${PASSED[@]:-}"; do [ -n "$p" ] && echo "    PASS  $p"; done
echo "  Không đạt: ${#FAILED[@]}"
for f in "${FAILED[@]:-}"; do [ -n "$f" ] && c_red "    FAIL  $f"; done

if [ "${#FAILED[@]}" -gt 0 ]; then
  c_red "\n  => CHƯA ĐẠT. Sửa các mục FAIL trước khi nộp checkpoint."
  exit 1
fi
c_grn "\n  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet."
