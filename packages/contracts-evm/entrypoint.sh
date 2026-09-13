#!/bin/sh
# Khởi động hardhat node rồi deploy khi node đã nhận RPC.
#
# Vì sao không dùng `sleep 5`: trên máy chậm/CI, 5 giây có thể chưa đủ và deploy sẽ fail
# im lặng, để lại một chain trống mà web tưởng là đã deploy.
set -e

npx hardhat node --hostname 0.0.0.0 &
NODE_PID=$!

echo "Chờ RPC hardhat sẵn sàng tại http://127.0.0.1:8545 ..."
i=0
until wget -q -O /dev/null --header='Content-Type: application/json' \
  --post-data='{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
  http://127.0.0.1:8545 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "LỖI: hardhat node không phản hồi sau 60s." >&2
    kill "$NODE_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo "RPC sẵn sàng sau ${i}s — bắt đầu deploy."
npx hardhat run scripts/deploy.js --network localhost

echo "Deploy xong. Chain đang chạy ở cổng 8545."
wait "$NODE_PID"
