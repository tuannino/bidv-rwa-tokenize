#!/usr/bin/env bash
# =============================================================================
# CÁCH A — Token có kiểm soát bằng CLASSIC ASSET + cờ giao thức + SAC
# (KHÔNG viết hợp đồng token nào; mint/freeze/clawback là thao tác gốc của Stellar,
#  chỉ "bọc" bằng Stellar Asset Contract để dùng được trong Soroban.)
#
# Dùng để đối chiếu với Cách B (token Soroban tự viết trong contracts/spt_token).
# Chạy trên testnet. Yêu cầu: stellar-cli đã cài, đã `stellar network use testnet`.
# =============================================================================
set -euo pipefail
NET=testnet
CODE=SPT   # mã tài sản 1..12 ký tự

echo "== 1. Tạo và nạp ví: issuer (nhà phát hành) và investorA =="
stellar keys generate issuer    --network $NET --fund || true
stellar keys generate investorA --network $NET --fund || true
ISSUER=$(stellar keys address issuer)
INVA=$(stellar keys address investorA)
echo "ISSUER=$ISSUER"
echo "INVA=$INVA"

echo "== 2. Bật cờ trên tài khoản phát hành =="
# AUTH_REQUIRED (buộc whitelist), AUTH_REVOCABLE (cho đóng băng), CLAWBACK_ENABLED (cho thu hồi).
# Lưu ý: muốn bật clawback thì phải có revocable; và cờ áp cho MỌI trustline lập SAU khi bật.
stellar tx new set-options \
  --source issuer --network $NET \
  --set-required \
  --set-revocable \
  --set-clawback-enabled

echo "== 3. Triển khai SAC cho tài sản $CODE:$ISSUER =="
# SAC là hợp đồng dựng sẵn của giao thức; admin mặc định là tài khoản phát hành.
stellar contract asset deploy --asset "$CODE:$ISSUER" --source issuer --network $NET || true
SAC=$(stellar contract asset id --asset "$CODE:$ISSUER" --network $NET)
echo "SAC=$SAC"

echo "== 4. investorA lập trustline tới tài sản (bắt buộc với classic asset) =="
# Khác Cách B: classic asset yêu cầu người nắm giữ tự lập trustline trước khi nhận.
stellar tx new change-trust --line "$CODE:$ISSUER" --source investorA --network $NET

echo "== 5. Issuer whitelist (authorize) trustline của investorA =="
stellar tx new set-trustline-flags \
  --asset "$CODE:$ISSUER" --trustor "$INVA" \
  --set-authorize \
  --source issuer --network $NET

echo "== 6. MINT: phát hành 1.000 $CODE cho investorA qua hàm mint của SAC =="
# SAC cung cấp giao diện SEP-41 + phần quản trị (mint, clawback, set_authorized, set_admin).
# 1.000 đơn vị với 7 chữ số thập phân = 1000 * 1e7.
stellar contract invoke --id "$SAC" --source issuer --network $NET -- \
  mint --to "$INVA" --amount 10000000000

echo "   balance investorA:"
stellar contract invoke --id "$SAC" --source issuer --network $NET -- \
  balance --id "$INVA"

echo "== 7. FREEZE: đóng băng investorA (gỡ authorize) =="
stellar contract invoke --id "$SAC" --source issuer --network $NET -- \
  set_authorized --id "$INVA" --authorize false
# (tương đương thao tác classic: set-trustline-flags --clear-authorize)

echo "== 8. Mở băng lại =="
stellar contract invoke --id "$SAC" --source issuer --network $NET -- \
  set_authorized --id "$INVA" --authorize true

echo "== 9. CLAWBACK: thu hồi cưỡng chế 100 $CODE (đốt luôn) =="
stellar contract invoke --id "$SAC" --source issuer --network $NET -- \
  clawback --from "$INVA" --amount 1000000000

echo "   balance investorA sau clawback:"
stellar contract invoke --id "$SAC" --source issuer --network $NET -- \
  balance --id "$INVA"

echo "== 10. BURN: người nắm giữ tự đốt (hoặc chuyển về issuer sẽ tự burn) =="
stellar contract invoke --id "$SAC" --source investorA --network $NET -- \
  burn --from "$INVA" --amount 1000000000

echo "Hoàn tất Cách A. Đối chiếu chi phí và đánh đổi với Cách B trong guide."
