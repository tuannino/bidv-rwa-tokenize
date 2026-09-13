# Hardhat node + tự deploy bộ contract điện gió.
# CHỈ dùng ở chế độ VPS (docker compose). Free-tier không dựng node (docs/DEPLOYMENT.md).
FROM node:20-alpine

WORKDIR /app

# Cài deps trước để tận dụng layer cache.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY hardhat.config.js ./
COPY contracts ./contracts
COPY scripts ./scripts
COPY test ./test

# Compile lúc build để khởi động container nhanh.
RUN npx hardhat compile

EXPOSE 8545

# `entrypoint.sh` chờ node sẵn sàng rồi mới deploy — `sleep` cố định hay hỏng trên máy chậm.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
