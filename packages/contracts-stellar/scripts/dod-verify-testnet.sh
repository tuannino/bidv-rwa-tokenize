#!/usr/bin/env bash
# =============================================================================
#  LỚP 2 - NGHIỆM THU DoD TRÊN STELLAR TESTNET (Soroban)
#
#  Chạy chu kỳ nghiệp vụ THẬT trên Stellar testnet và in bằng chứng số dư
#  trước/sau cho từng bước. Dán kết quả vào checkpoint.
#
#  Cách chạy (từ packages/contracts-stellar):
#     bash scripts/dod-verify-testnet.sh
#
#  Yêu cầu:
#     - stellar CLI (Protocol 26/27), đã `stellar network use testnet`
#     - Rust 1.84+ và target wasm32v1-none (chỉ cần nếu bật DEPLOY=1)
#
#  Biến môi trường:
#     ADMIN_KEY      tên khóa ngân hàng trong stellar keys   (mặc định: bank)
#     INVESTOR_KEY   tên khóa nhà đầu tư                     (mặc định: inv1)
#     WPT_ID, VNDB_ID, ORACLE_ID, DIST_ID, REDEMPTION_ID     contract ID đã deploy
#     DEPLOY=1       tự build + deploy + wiring bộ mới (bỏ qua các ID trên)
#     ONLY=p4|p7|p12 chỉ chạy một luồng (mặc định chạy cả ba)
#
#  LƯU Ý: script tiêu XLM test và đổi trạng thái on-chain. Chỉ dùng cho testnet.
# =============================================================================
set -uo pipefail

NETWORK="${NETWORK:-testnet}"
ADMIN_KEY="${ADMIN_KEY:-bank}"
INVESTOR_KEY="${INVESTOR_KEY:-inv1}"
ONLY="${ONLY:-}"
EXPLORER="https://stellar.expert/explorer/testnet"

FAIL=0
STEP=0

c_red() { printf '\033[31m%s\033[0m\n' "$1"; }
c_grn() { printf '\033[32m%s\033[0m\n' "$1"; }
c_yel() { printf '\033[33m%s\033[0m\n' "$1"; }
head1() { printf '\n%s\n  %s\n%s\n' "========================================================================" "$1" "========================================================================"; }

assert_eq() { # nhãn, thực tế, kỳ vọng
  if [ "$2" = "$3" ]; then
    c_grn "  PASS  $1: $2"
  else
    c_red "  FAIL  $1: $2 (kỳ vọng $3)"
    FAIL=$((FAIL+1))
  fi
}

step() { STEP=$((STEP+1)); printf '  [%s] %s\n' "$STEP" "$1"; }

# Gọi hàm contract (thay đổi trạng thái)
inv() { # contract_id, source_key, args...
  local cid="$1"; local src="$2"; shift 2
  stellar contract invoke --id "$cid" --source "$src" --network "$NETWORK" -- "$@"
}

# Gọi hàm chỉ đọc, trả về giá trị đã bỏ dấu ngoặc kép
read_fn() {
  local cid="$1"; shift
  stellar contract invoke --id "$cid" --source "$ADMIN_KEY" --network "$NETWORK" -- "$@" 2>/dev/null | tr -d '"'
}

# -----------------------------------------------------------------------------
head1 "KIỂM MÔI TRƯỜNG"
# -----------------------------------------------------------------------------
if ! command -v stellar >/dev/null 2>&1; then
  c_red "  Không tìm thấy stellar CLI. Cài rồi chạy: stellar network use testnet"
  exit 1
fi
c_grn "  PASS  stellar CLI: $(stellar --version 2>/dev/null | head -1)"

ADMIN_ADDR=$(stellar keys address "$ADMIN_KEY" 2>/dev/null || true)
if [ -z "$ADMIN_ADDR" ]; then
  c_red "  Chưa có khóa '$ADMIN_KEY'. Tạo bằng:"
  echo "        stellar keys generate $ADMIN_KEY --network testnet --fund"
  exit 1
fi
echo "  Ví ngân hàng:   $ADMIN_KEY = $ADMIN_ADDR"

INV_ADDR=$(stellar keys address "$INVESTOR_KEY" 2>/dev/null || true)
if [ -z "$INV_ADDR" ]; then
  c_yel "  Chưa có khóa '$INVESTOR_KEY', đang tạo và nạp XLM..."
  stellar keys generate "$INVESTOR_KEY" --network "$NETWORK" --fund >/dev/null 2>&1
  INV_ADDR=$(stellar keys address "$INVESTOR_KEY")
fi
echo "  Ví nhà đầu tư:  $INVESTOR_KEY = $INV_ADDR"

# -----------------------------------------------------------------------------
if [ "${DEPLOY:-0}" = "1" ]; then
  head1 "BU3 tới BU6 - BUILD, DEPLOY, WIRING"

  step "cargo test toàn workspace (phải xanh trước khi deploy)"
  if ! cargo test 2>&1 | tail -5; then
    c_red "  FAIL  unit test đỏ, dừng lại."
    exit 1
  fi

  step "stellar contract build (target wasm32v1-none)"
  stellar contract build || { c_red "  FAIL  build lỗi"; exit 1; }

  WASM_TOKEN="target/wasm32v1-none/release/spt_token.wasm"
  WASM_ORACLE="target/wasm32v1-none/release/revenue_oracle.wasm"
  WASM_DIST="target/wasm32v1-none/release/profit_distributor_pull.wasm"
  WASM_RED="target/wasm32v1-none/release/redemption.wasm"
  for f in "$WASM_TOKEN" "$WASM_ORACLE" "$WASM_DIST" "$WASM_RED"; do
    [ -f "$f" ] || { c_red "  FAIL  thiếu $f"; exit 1; }
  done
  c_grn "  PASS  đủ WASM wasm32v1-none"

  step "deploy hai token, oracle, distributor, redemption"
  WPT_ID=$(stellar contract deploy --wasm "$WASM_TOKEN" --source "$ADMIN_KEY" --network "$NETWORK")
  VNDB_ID=$(stellar contract deploy --wasm "$WASM_TOKEN" --source "$ADMIN_KEY" --network "$NETWORK")
  ORACLE_ID=$(stellar contract deploy --wasm "$WASM_ORACLE" --source "$ADMIN_KEY" --network "$NETWORK")
  DIST_ID=$(stellar contract deploy --wasm "$WASM_DIST" --source "$ADMIN_KEY" --network "$NETWORK")
  REDEMPTION_ID=$(stellar contract deploy --wasm "$WASM_RED" --source "$ADMIN_KEY" --network "$NETWORK")

  step "initialize"
  inv "$WPT_ID" "$ADMIN_KEY" initialize --admin_addr "$ADMIN_ADDR" --decimals 7 \
      --name "Wind Project Token" --symbol "WPT" >/dev/null
  inv "$VNDB_ID" "$ADMIN_KEY" initialize --admin_addr "$ADMIN_ADDR" --decimals 7 \
      --name "Tokenized VND" --symbol "VNDB" >/dev/null
  inv "$ORACLE_ID" "$ADMIN_KEY" initialize --admin_addr "$ADMIN_ADDR" --reporter_addr "$ADMIN_ADDR" >/dev/null
  inv "$DIST_ID" "$ADMIN_KEY" initialize --admin_addr "$ADMIN_ADDR" --spt_token "$WPT_ID" \
      --vnd_token "$VNDB_ID" --oracle "$ORACLE_ID" >/dev/null
  inv "$REDEMPTION_ID" "$ADMIN_KEY" initialize --admin_addr "$ADMIN_ADDR" --spt_token "$WPT_ID" \
      --vnd_token "$VNDB_ID" --rate 100000000000 >/dev/null   # 10.000 * SCALE(1e7)

  step "wiring: authorize nhà đầu tư VÀ địa chỉ hợp đồng trên cả hai token"
  for who in "$INV_ADDR" "$DIST_ID" "$REDEMPTION_ID"; do
    inv "$WPT_ID"  "$ADMIN_KEY" set_authorized --id "$who" --authorize true >/dev/null
    inv "$VNDB_ID" "$ADMIN_KEY" set_authorized --id "$who" --authorize true >/dev/null
  done

  echo
  echo "  ==== CONTRACT ID (ghi vào packages/shared) ===="
  echo "  WPT_ID=$WPT_ID"
  echo "  VNDB_ID=$VNDB_ID"
  echo "  ORACLE_ID=$ORACLE_ID"
  echo "  DIST_ID=$DIST_ID"
  echo "  REDEMPTION_ID=$REDEMPTION_ID"
fi

# Kiểm đủ ID
for v in WPT_ID VNDB_ID; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || { c_red "  Thiếu $v. Đặt biến môi trường hoặc chạy DEPLOY=1."; exit 1; }
done

head1 "BU7 - ĐỌC THÔNG TIN TOKEN TRÊN TESTNET"
SYM=$(read_fn "$WPT_ID" symbol)
DEC=$(read_fn "$WPT_ID" decimals)
echo "  WPT: symbol=$SYM decimals=$DEC"
echo "  Link: $EXPLORER/contract/$WPT_ID"
assert_eq "decimals của token Stellar" "$DEC" "7"
if [ "$SYM" != "WPT" ]; then
  c_yel "  WARN  ký hiệu là '$SYM', kỳ vọng 'WPT' (nợ P1 đổi tên chưa xong)"
fi

# -----------------------------------------------------------------------------
if [ -z "$ONLY" ] || [ "$ONLY" = "p4" ]; then
  head1 "P4 - PHÁT HÀNH WPT"
  BEFORE=$(read_fn "$WPT_ID" balance --id "$INV_ADDR")
  echo "  Số dư WPT trước: $BEFORE"

  step "authorize nhà đầu tư (nếu chưa)"
  inv "$WPT_ID" "$ADMIN_KEY" set_authorized --id "$INV_ADDR" --authorize true >/dev/null
  AUTH=$(read_fn "$WPT_ID" authorized --id "$INV_ADDR")
  assert_eq "nhà đầu tư đã được authorize" "$AUTH" "true"

  step "mint 100 WPT"
  inv "$WPT_ID" "$ADMIN_KEY" mint --to "$INV_ADDR" --amount 100 >/dev/null
  AFTER=$(read_fn "$WPT_ID" balance --id "$INV_ADDR")
  assert_eq "số dư WPT sau mint" "$AFTER" "$((BEFORE + 100))"
fi

# -----------------------------------------------------------------------------
if [ -z "$ONLY" ] || [ "$ONLY" = "p7" ]; then
  head1 "P7 - CHIA LỢI TỨC (pull + snapshot)"
  [ -n "${ORACLE_ID:-}" ] && [ -n "${DIST_ID:-}" ] || { c_red "  Thiếu ORACLE_ID / DIST_ID"; exit 1; }

  PERIOD="${PERIOD:-1}"
  TREASURY=1000000

  step "nạp kho VNDB cho distributor (mint thẳng vào địa chỉ hợp đồng)"
  inv "$VNDB_ID" "$ADMIN_KEY" mint --to "$DIST_ID" --amount "$TREASURY" >/dev/null
  LIQ=$(read_fn "$VNDB_ID" balance --id "$DIST_ID")
  echo "  Kho VNDB của distributor: $LIQ"

  step "oracle report + finalize doanh thu kỳ $PERIOD"
  inv "$ORACLE_ID" "$ADMIN_KEY" report --period_id "$PERIOD" --revenue "$TREASURY" >/dev/null
  inv "$ORACLE_ID" "$ADMIN_KEY" finalize --period_id "$PERIOD" >/dev/null
  FIN=$(read_fn "$ORACLE_ID" is_finalized --period_id "$PERIOD")
  assert_eq "kỳ oracle đã chốt" "$FIN" "true"

  step "mở kỳ chia (chốt snapshot)"
  inv "$DIST_ID" "$ADMIN_KEY" open_period --period_id "$PERIOD" >/dev/null 2>&1 \
    || c_yel "  WARN  mở kỳ thất bại (có thể kỳ đã mở trước đó, hoặc admin thiếu quyền snapshot)"

  PREVIEW=$(read_fn "$DIST_ID" preview_claim --period_id "$PERIOD" --investor "$INV_ADDR")
  echo "  Phần nhà đầu tư được nhận: $PREVIEW"

  step "nhà đầu tư tự claim (KÝ BẰNG KHÓA NHÀ ĐẦU TƯ, không phải ngân hàng)"
  VND_BEFORE=$(read_fn "$VNDB_ID" balance --id "$INV_ADDR")
  inv "$DIST_ID" "$INVESTOR_KEY" claim --period_id "$PERIOD" --investor "$INV_ADDR" >/dev/null
  VND_AFTER=$(read_fn "$VNDB_ID" balance --id "$INV_ADDR")
  assert_eq "VNDB nhận đúng phần chia" "$((VND_AFTER - VND_BEFORE))" "$PREVIEW"

  step "claim lần hai phải bị từ chối"
  if inv "$DIST_ID" "$INVESTOR_KEY" claim --period_id "$PERIOD" --investor "$INV_ADDR" >/dev/null 2>&1; then
    c_red "  FAIL  claim lần hai vẫn thành công (phải lỗi AlreadyClaimed)"
    FAIL=$((FAIL+1))
  else
    c_grn "  PASS  claim lần hai bị từ chối đúng như spec"
  fi
fi

# -----------------------------------------------------------------------------
if [ -z "$ONLY" ] || [ "$ONLY" = "p12" ]; then
  head1 "P12 - TẤT TOÁN"
  [ -n "${REDEMPTION_ID:-}" ] || { c_red "  Thiếu REDEMPTION_ID"; exit 1; }

  REDEEM=10
  RATE=$(read_fn "$REDEMPTION_ID" rate)
  QUOTE=$(read_fn "$REDEMPTION_ID" preview --spt_amount "$REDEEM")
  echo "  Tỷ giá (đã nhân SCALE): $RATE"
  echo "  Quote cho $REDEEM WPT:  $QUOTE VNDB"

  step "nạp kho VNDB cho Redemption (mint thẳng vào địa chỉ hợp đồng)"
  inv "$VNDB_ID" "$ADMIN_KEY" mint --to "$REDEMPTION_ID" --amount "$QUOTE" >/dev/null
  echo "  Kho VNDB của Redemption: $(read_fn "$VNDB_ID" balance --id "$REDEMPTION_ID")"

  WPT_BEFORE=$(read_fn "$WPT_ID" balance --id "$INV_ADDR")
  VND_BEFORE=$(read_fn "$VNDB_ID" balance --id "$INV_ADDR")
  SUPPLY_BEFORE=$(read_fn "$WPT_ID" total_supply)

  step "tất toán $REDEEM WPT (KHÔNG cần approve, khác bản EVM)"
  inv "$REDEMPTION_ID" "$INVESTOR_KEY" redeem --investor "$INV_ADDR" --spt_amount "$REDEEM" >/dev/null

  WPT_AFTER=$(read_fn "$WPT_ID" balance --id "$INV_ADDR")
  VND_AFTER=$(read_fn "$VNDB_ID" balance --id "$INV_ADDR")
  SUPPLY_AFTER=$(read_fn "$WPT_ID" total_supply)

  assert_eq "WPT giảm đúng số tất toán" "$((WPT_BEFORE - WPT_AFTER))" "$REDEEM"
  assert_eq "tổng cung WPT giảm đúng"   "$((SUPPLY_BEFORE - SUPPLY_AFTER))" "$REDEEM"
  assert_eq "VNDB nhận đúng quote"      "$((VND_AFTER - VND_BEFORE))" "$QUOTE"

  step "tạm dừng rồi thử tất toán, phải bị chặn"
  inv "$REDEMPTION_ID" "$ADMIN_KEY" set_paused --paused true >/dev/null
  if inv "$REDEMPTION_ID" "$INVESTOR_KEY" redeem --investor "$INV_ADDR" --spt_amount 1 >/dev/null 2>&1; then
    c_red "  FAIL  vẫn tất toán được khi đang tạm dừng (phải lỗi Paused)"
    FAIL=$((FAIL+1))
  else
    c_grn "  PASS  bị chặn đúng khi tạm dừng"
  fi
  inv "$REDEMPTION_ID" "$ADMIN_KEY" set_paused --paused false >/dev/null
fi

# -----------------------------------------------------------------------------
head1 "TỔNG KẾT NGHIỆM THU"
echo "  Bước đã chạy: $STEP     Kiểm tra thất bại: $FAIL"
echo
echo "  Link tra cứu để dán vào checkpoint:"
echo "    WPT:        $EXPLORER/contract/${WPT_ID}"
echo "    VNDB:       $EXPLORER/contract/${VNDB_ID}"
[ -n "${DIST_ID:-}" ]       && echo "    Distributor: $EXPLORER/contract/${DIST_ID}"
[ -n "${REDEMPTION_ID:-}" ] && echo "    Redemption:  $EXPLORER/contract/${REDEMPTION_ID}"
echo "    Ví nhà đầu tư: $EXPLORER/account/${INV_ADDR}"

if [ "$FAIL" -gt 0 ]; then
  c_red "  => KHÔNG ĐẠT DoD ($FAIL mục)."
  exit 1
fi
c_grn "  => ĐẠT DoD trên Stellar testnet."
