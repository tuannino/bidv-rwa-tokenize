#!/usr/bin/env bash
# =============================================================================
#  CHUỖI HARDHAT CỤC BỘ BẰNG MỘT LỆNH (OP-03)
#
#  Chạy từ GỐC repo:
#      bash scripts/evm-local.sh up      # dựng nút nếu chưa chạy, triển khai nếu cần, nạp ví mẫu
#      bash scripts/evm-local.sh down    # dừng nút do script này dựng
#      bash scripts/evm-local.sh reset   # down rồi up từ trạng thái trống
#
#  `up` KHÔNG BAO GIỜ triển khai đè. Kết luận lấy từ packages/contracts-evm/scripts/local-state.js:
#    - hợp đồng ở các địa chỉ trong addresses.json có và khớp bản biên dịch -> giữ nguyên
#    - chưa có hợp đồng và nút còn mới (khối 0)                             -> triển khai
#    - lệch bản biên dịch, thiếu một phần, hoặc nút đã có giao dịch lạ      -> dừng, báo `reset`
#  Lý do: địa chỉ hardhat chỉ tất định trên nút mới (cùng người triển khai, nonce từ 0), và
#  addresses.json được commit dựa trên điều đó.
#
#  Nhật ký và PID của nút nằm ở $EVM_LOCAL_DIR (mặc định thư mục tạm), không ở cây làm việc.
#  Cổng mặc định 8545; đặt EVM_LOCAL_PORT để chạy song song với một nút khác (worktree khác).
#
#  ⚠️ App giữ dữ liệu nghiệp vụ trong bộ nhớ (USE_MOCK_DB=true). Sau `reset` phải khởi động
#  lại app, nếu không cơ sở dữ liệu và chuỗi lệch nhau. Hướng dẫn: docs/EVM_LOCAL.md
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="$ROOT/packages/contracts-evm"
PORT="${EVM_LOCAL_PORT:-8545}"
RPC="http://127.0.0.1:$PORT"
HARDHAT_CHAIN_ID=0x7a69 # 31337
READY_TIMEOUT_S=60
STATE_DIR="${EVM_LOCAL_DIR:-${TMPDIR:-/tmp}/bidv-evm-local-$PORT}"
PID_FILE="$STATE_DIR/node.pid"
LOG_FILE="$STATE_DIR/node.log"

# Khoá CÔNG KHAI của Hardhat account #0 (ai cũng biết, chỉ dùng cho chuỗi cục bộ). Cùng giá trị
# với app/playwright.config.ts.
HARDHAT_ACCOUNT0_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

say() { printf '[evm-local] %s\n' "$1"; }
die() { printf '[evm-local] LỖI: %s\n' "$1" >&2; exit 1; }

chain_id() {
  curl -s --max-time 2 -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$RPC" 2>/dev/null |
    sed -n 's/.*"result":"\([^"]*\)".*/\1/p' || true # chưa có nút = chuỗi rỗng, không phải lỗi
}

our_pid() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(cat "$PID_FILE")"
  kill -0 "$pid" 2>/dev/null && echo "$pid"
}

# hardhat.config.js đọc LOCAL_RPC_URL cho mạng `localhost`.
hardhat() { (cd "$CONTRACTS" && LOCAL_RPC_URL="$RPC" npx hardhat "$@"); }

start_node() {
  [ -x "$CONTRACTS/node_modules/.bin/hardhat" ] ||
    die "chưa cài phụ thuộc: (cd packages/contracts-evm && npm ci)"
  mkdir -p "$STATE_DIR"
  say "dựng nút hardhat ở $RPC (nhật ký: $LOG_FILE)"
  # Gọi thẳng tệp chạy của hardhat, không qua npx: PID ghi lại là chính tiến trình nút, nên
  # `down` dừng đúng nó chứ không để sót một tiến trình con.
  (cd "$CONTRACTS" && exec node_modules/.bin/hardhat node --port "$PORT" >"$LOG_FILE" 2>&1) &
  echo $! >"$PID_FILE"
  local i=0
  until [ -n "$(chain_id)" ]; do
    kill -0 "$(cat "$PID_FILE")" 2>/dev/null || die "nút dừng khi đang khởi động, xem $LOG_FILE"
    i=$((i + 1))
    [ "$i" -ge "$READY_TIMEOUT_S" ] && die "nút không phản hồi sau ${READY_TIMEOUT_S}s, xem $LOG_FILE"
    sleep 1
  done
  say "nút sẵn sàng sau ${i}s"
}

cmd_up() {
  local just_reset="${1:-}"
  local id
  id="$(chain_id)"
  if [ -z "$id" ]; then
    start_node
  elif [ "$id" != "$HARDHAT_CHAIN_ID" ]; then
    die "cổng $PORT đang có chuỗi chainId=$id, không phải hardhat"
  else
    say "nút đã chạy ở $RPC"
  fi

  local state=0
  hardhat run scripts/local-state.js --network localhost || state=$?
  case "$state" in
    0) say "không triển khai lại" ;;
    10)
      say "triển khai bộ hợp đồng"
      hardhat run scripts/deploy.js --network localhost
      ;;
    20) die "nút không khớp addresses.json hay bản biên dịch. Chạy: bash scripts/evm-local.sh reset" ;;
    *) die "không đọc được trạng thái nút (mã $state)" ;;
  esac

  hardhat run scripts/seed-local.js --network localhost

  cat <<EOF

Biến cho app chạy trên chuỗi này (đặt trong app/.env.local hoặc trước lệnh chạy):
  NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
  RPC_HARDHAT=$RPC
  SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=$HARDHAT_ACCOUNT0_KEY
EOF
  if [ -n "$just_reset" ]; then
    printf '\n⚠️  Vừa reset chuỗi: KHỞI ĐỘNG LẠI app nếu đang chạy, nếu không dữ liệu trong bộ nhớ của app lệch chuỗi mới.\n'
  fi
}

cmd_down() {
  local pid
  if pid="$(our_pid)"; then
    kill "$pid"
    local i=0
    while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
    kill -9 "$pid" 2>/dev/null || true
    say "đã dừng nút (pid $pid)"
  else
    say "không có nút nào do script này dựng"
  fi
  rm -f "$PID_FILE"
  if [ -n "$(chain_id)" ]; then
    die "cổng $PORT vẫn có nút không do script này dựng (docker compose?). Dừng nó bằng tay"
  fi
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down ;;
  reset) cmd_down && cmd_up reset ;;
  *)
    echo "Dùng: bash scripts/evm-local.sh up|down|reset" >&2
    exit 2
    ;;
esac
