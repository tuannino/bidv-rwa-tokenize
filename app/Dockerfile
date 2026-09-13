# Web Next.js 16 cho chế độ VPS (docker compose).
# Build context là GỐC REPO, vì app/ phụ thuộc packages/shared qua "file:../packages/shared".
#   docker build -f app/Dockerfile .
FROM node:20-alpine AS deps
WORKDIR /repo

# Vài dependency có phần native tuỳ chọn (bufferutil/utf-8-validate của ws, do
# WalletConnect kéo theo) và cần biên dịch trên musl. Chỉ cài toolchain ở stage này,
# stage runtime vẫn sạch. libc6-compat cho binary native của Next/SWC trên alpine.
RUN apk add --no-cache python3 make g++ libc6-compat

# `npm ci` cần thấy packages/shared (dependency dạng file:) trước khi cài.
COPY app/package.json app/package-lock.json ./app/
COPY packages/shared ./packages/shared
WORKDIR /repo/app
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/app/node_modules ./app/node_modules
COPY packages/shared ./packages/shared
COPY app ./app
WORKDIR /repo/app

# NEXT_PUBLIC_* được inline lúc build -> phải có mặt ở bước này.
# Đây là RPC mà BROWSER gọi (cổng đã publish trên host), khác với RPC của server.
ARG NEXT_PUBLIC_RPC_HARDHAT=http://localhost:8545
ARG NEXT_PUBLIC_RPC_EVM=
ARG NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
ENV NEXT_PUBLIC_RPC_HARDHAT=$NEXT_PUBLIC_RPC_HARDHAT \
    NEXT_PUBLIC_RPC_EVM=$NEXT_PUBLIC_RPC_EVM \
    NEXT_PUBLIC_DEFAULT_CHAIN=$NEXT_PUBLIC_DEFAULT_CHAIN \
    NEXT_TELEMETRY_DISABLED=1

# Docker Desktop mặc định cấp VM khá nhỏ (máy dựng thử: 1.9GiB / 2 CPU) và
# worker chạy tsc của `next build` bị OOM-kill ở đó.
#
# Type-check KHÔNG bị bỏ, chỉ chuyển chỗ: chạy ở host/CI bằng `npm run typecheck`
# (cùng tsconfig). Trong image chỉ cần bundle.
ENV NODE_OPTIONS=--max-old-space-size=1280 \
    NEXT_SKIP_TYPECHECK=1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /repo/app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /repo/app/node_modules ./node_modules
COPY --from=builder /repo/app/.next ./.next
COPY --from=builder /repo/app/public ./public
COPY --from=builder /repo/app/package.json ./package.json
COPY --from=builder /repo/app/next.config.ts ./next.config.ts
# prisma/init.sql được postgres.store đọc lúc chạy để tạo bảng nếu chưa có.
COPY --from=builder /repo/app/prisma ./prisma
COPY --from=builder /repo/packages/shared /repo/packages/shared

EXPOSE 3000
CMD ["npm", "run", "start"]
