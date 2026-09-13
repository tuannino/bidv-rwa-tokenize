#!/usr/bin/env bash
# =============================================================================
#  LỚP 3 - Kiểm 3 luật kiến trúc + cấu trúc repo
#
#  Chạy từ GỐC repo:  bash scripts/verify-arch-rules.sh
#  Không cần mạng, không cần cài gì. Dùng trước mỗi lần review checkpoint.
#
#  Mã thoát: 0 = PASS toàn bộ, 1 = có lỗi phải sửa (FAIL), 2 = chỉ có cảnh báo.
# =============================================================================
set -uo pipefail

FAIL=0
WARN=0
PASS_N=0

c_red()  { printf '\033[31m%s\033[0m\n' "$1"; }
c_grn()  { printf '\033[32m%s\033[0m\n' "$1"; }
c_yel()  { printf '\033[33m%s\033[0m\n' "$1"; }
head1()  { printf '\n\033[1m%s\033[0m\n' "$1"; }

ok()   { c_grn "  PASS  $1"; PASS_N=$((PASS_N+1)); }
bad()  { c_red "  FAIL  $1"; FAIL=$((FAIL+1)); }
warn() { c_yel "  WARN  $1"; WARN=$((WARN+1)); }

# Kiểm tra đang đứng ở gốc repo
if [ ! -d app/src ] || [ ! -d packages ]; then
  c_red "Phải chạy từ gốc repo bidv-rwa-tokenize (thấy app/src và packages/)."
  exit 1
fi

# -----------------------------------------------------------------------------
head1 "LUẬT 1 - Mọi tương tác chain đi qua ILedgerPort"
# -----------------------------------------------------------------------------
# viem/ethers chỉ được import trong app/src/lib (adapter). Ngoài đó là vi phạm.
HITS=$(grep -rnE "from ['\"](viem|ethers)(/[a-z]+)?['\"]" app/src/ 2>/dev/null \
        | grep -v "app/src/lib/" || true)
if [ -z "$HITS" ]; then
  ok "viem/ethers không xuất hiện ngoài app/src/lib"
else
  bad "viem/ethers bị import ngoài app/src/lib:"; echo "$HITS" | sed 's/^/        /'
fi

# Stellar SDK cũng phải bị giới hạn trong lib (áp dụng khi làm spec Stellar)
HITS=$(grep -rn "@stellar/stellar-sdk" app/src/ 2>/dev/null | grep -v "app/src/lib/" || true)
if [ -z "$HITS" ]; then
  ok "@stellar/stellar-sdk không xuất hiện ngoài app/src/lib"
else
  bad "@stellar/stellar-sdk bị import ngoài app/src/lib:"; echo "$HITS" | sed 's/^/        /'
fi

# Component không được gọi trực tiếp contract
HITS=$(grep -rnE "writeContract|readContract|simulateContract|new Contract\(" \
        app/src/components/ app/src/app/ 2>/dev/null || true)
if [ -z "$HITS" ]; then
  ok "Không có lời gọi contract trực tiếp trong components/ và app/"
else
  bad "Gọi contract trực tiếp ngoài tầng ledger:"; echo "$HITS" | sed 's/^/        /'
fi

# -----------------------------------------------------------------------------
head1 "LUẬT 2 - Mọi thao tác ký đi qua ISigner"
# -----------------------------------------------------------------------------
ALLOWED_KEY_FILES="app/src/lib/config/env.ts app/src/lib/signer/server.signer.ts"
HITS=$(grep -rln "SERVER_SIGNER_PRIVATE_KEY" app/src/ 2>/dev/null || true)
BADF=""
for f in $HITS; do
  case " $ALLOWED_KEY_FILES " in
    *" $f "*) ;;
    *) BADF="$BADF $f" ;;
  esac
done
if [ -z "$BADF" ]; then
  ok "SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts"
else
  bad "Khóa bí mật bị đọc ở nơi khác:$BADF"
fi

# process.env chỉ được đọc ở config
HITS=$(grep -rn "process\.env\." app/src/ 2>/dev/null \
        | grep -v "app/src/lib/config/" | grep -v "NEXT_PUBLIC_" || true)
if [ -z "$HITS" ]; then
  ok "process.env (biến bí mật) chỉ đọc trong lib/config"
else
  warn "process.env đọc ngoài lib/config (kiểm tra xem có phải biến công khai):"
  echo "$HITS" | sed 's/^/        /'
fi

# Khóa bí mật không được lọt vào file commit
if [ -f app/.env ] && git check-ignore -q app/.env 2>/dev/null; then
  ok "app/.env bị gitignore (không lọt vào commit)"
elif [ -f app/.env ]; then
  bad "app/.env TỒN TẠI và KHÔNG bị gitignore - nguy cơ lộ khóa"
else
  ok "Không có app/.env trong cây làm việc"
fi

HITS=$(grep -rnE "0x[a-fA-F0-9]{64}" app/src/ packages/*/src/ 2>/dev/null || true)
if [ -z "$HITS" ]; then
  ok "Không có private key dạng hex 64 ký tự nhúng trong mã nguồn"
else
  bad "Nghi vấn private key nhúng trong mã nguồn:"; echo "$HITS" | sed 's/^/        /'
fi

# -----------------------------------------------------------------------------
head1 "LUẬT 3 - Mọi kiểm quyền đi qua RBAC can()"
# -----------------------------------------------------------------------------
HITS=$(grep -rnE "role ===|role ==|role!==|role !==" app/src/ 2>/dev/null \
        | grep -v "app/src/lib/rbac/" || true)
if [ -z "$HITS" ]; then
  ok "Không có so sánh role cứng ngoài lib/rbac"
else
  bad "So sánh role cứng ngoài lib/rbac:"; echo "$HITS" | sed 's/^/        /'
fi

# Mỗi server action nên có guard
if [ -f app/src/app/actions/bank.ts ]; then
  N_ACTION=$(grep -cE "^export async function" app/src/app/actions/bank.ts 2>/dev/null || echo 0)
  ok "actions/bank.ts có $N_ACTION server action (guard nằm ở tầng service, xem lớp 1)"
fi

# -----------------------------------------------------------------------------
head1 "MỘT NGUỒN SỰ THẬT - ABI và địa chỉ contract"
# -----------------------------------------------------------------------------
HITS=$(grep -rlE "\"(abi|inputs)\"[[:space:]]*:" app/src/ 2>/dev/null || true)
if [ -z "$HITS" ]; then
  ok "Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)"
else
  bad "ABI bị nhúng trong app/src:"; echo "$HITS" | sed 's/^/        /'
fi

# Địa chỉ EVM hardcode ngoài shared và ngoài test
HITS=$(grep -rnE "0x[a-fA-F0-9]{40}" app/src/ 2>/dev/null \
        | grep -vE "test|\.test\.|mock|0x0{40}" || true)
if [ -z "$HITS" ]; then
  ok "Không có địa chỉ EVM hardcode trong app/src"
else
  warn "Địa chỉ EVM hardcode trong app/src (xác nhận có chủ đích):"
  echo "$HITS" | sed 's/^/        /'
fi

# Contract ID Stellar (C... 56 ký tự) hardcode ngoài shared
HITS=$(grep -rnE "\bC[A-Z2-7]{55}\b" app/src/ 2>/dev/null || true)
if [ -z "$HITS" ]; then
  ok "Không có contract ID Stellar hardcode trong app/src"
else
  bad "Contract ID Stellar hardcode trong app/src (phải đặt ở packages/shared):"
  echo "$HITS" | sed 's/^/        /'
fi

# -----------------------------------------------------------------------------
head1 "KHÔNG SỬA CONTRACT ĐÃ PASS TEST"
# -----------------------------------------------------------------------------
BASE_REF="${BASE_REF:-}"
if [ -n "$BASE_REF" ]; then
  CHANGED=$(git diff --name-only "$BASE_REF"..HEAD -- \
            'packages/contracts-evm/contracts/**/*.sol' \
            'packages/contracts-stellar/contracts/**/*.rs' 2>/dev/null | grep -v spec_tests || true)
  if [ -z "$CHANGED" ]; then
    ok "Contract không bị sửa so với $BASE_REF"
  else
    bad "Contract bị sửa so với $BASE_REF (spec yêu cầu giữ nguyên, phải có DEVIATION):"
    echo "$CHANGED" | sed 's/^/        /'
  fi
else
  warn "Chưa đặt BASE_REF nên bỏ qua so sánh contract. Dùng: BASE_REF=<commit> bash $0"
fi

# T-REX phải tách toolchain
if [ -d packages/contracts-evm/trex ]; then
  HITS=$(grep -rn "trex/" packages/contracts-evm/contracts/ 2>/dev/null || true)
  if [ -z "$HITS" ]; then
    ok "Contract chính không import từ trex/ (toolchain tách biệt)"
  else
    bad "Contract chính import từ trex/ (trộn Solidity 0.8.17/OZ4 với 0.8.28/OZ5):"
    echo "$HITS" | sed 's/^/        /'
  fi
fi

# -----------------------------------------------------------------------------
head1 "CHAIN ĐƯỢC PHÉP - Polygon đã loại bỏ vĩnh viễn"
# -----------------------------------------------------------------------------
HITS=$(grep -rniE "polygon|amoy|mumbai" app/src/ packages/shared/src/ 2>/dev/null \
        | grep -v "^.*://" | grep -viE "//|/\*|\*" || true)
if [ -z "$HITS" ]; then
  ok "Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)"
else
  warn "Còn tham chiếu Polygon (xác nhận chỉ là comment giải thích):"
  echo "$HITS" | sed 's/^/        /'
fi

# -----------------------------------------------------------------------------
head1 "KÝ HIỆU TOKEN - WPT / VNDB (ký hiệu cũ SPT / tVND đã bỏ)"
# -----------------------------------------------------------------------------
HITS=$(grep -rnoE "\bSPT\b|tVND" app/src/ app/e2e/ app/test/ packages/ 2>/dev/null \
        | grep -v node_modules | grep -v target/ || true)
if [ -z "$HITS" ]; then
  ok "Không còn ký hiệu cũ SPT / tVND"
else
  N=$(echo "$HITS" | wc -l | tr -d ' ')
  bad "Còn $N chỗ dùng ký hiệu cũ SPT / tVND (nợ P1 - phải đổi sang WPT / VNDB):"
  echo "$HITS" | head -20 | sed 's/^/        /'
  [ "$N" -gt 20 ] && echo "        ... và $((N-20)) chỗ nữa"
fi

# -----------------------------------------------------------------------------
head1 "CẤU TRÚC SPEC VÀ STEERING"
# -----------------------------------------------------------------------------
for d in .kiro/steering .kiro/specs docs; do
  if [ -d "$d" ]; then ok "Có $d"; else bad "Thiếu $d"; fi
done

for s in p4-mint-testnet p7-profit-distribution p12-redemption \
         p4-mint-stellar p7-profit-distribution-stellar p12-redemption-stellar; do
  if [ -d ".kiro/specs/$s" ]; then
    MISS=""
    for f in requirements.md design.md tasks.md; do
      [ -f ".kiro/specs/$s/$f" ] || MISS="$MISS $f"
    done
    if [ -z "$MISS" ]; then ok "spec $s đủ 3 file"; else bad "spec $s thiếu:$MISS"; fi
  else
    warn "spec $s chưa có (chưa tới lượt làm thì bỏ qua)"
  fi
done

# Lock file phải được commit vì Dockerfile dùng npm ci
if git ls-files --error-unmatch app/package-lock.json >/dev/null 2>&1; then
  ok "app/package-lock.json đã được commit (npm ci trong Docker chạy được)"
else
  bad "app/package-lock.json CHƯA commit nhưng Dockerfile dùng npm ci - clone sạch sẽ fail (nợ P1)"
fi

# -----------------------------------------------------------------------------
head1 "TỔNG KẾT"
# -----------------------------------------------------------------------------
echo "  PASS: $PASS_N   FAIL: $FAIL   WARN: $WARN"
if [ "$FAIL" -gt 0 ]; then
  c_red "  => KHÔNG ĐẠT. Phải sửa $FAIL mục trước khi nộp checkpoint."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  c_yel "  => ĐẠT nhưng có $WARN cảnh báo cần xác nhận có chủ đích."
  exit 2
else
  c_grn "  => ĐẠT toàn bộ."
  exit 0
fi
