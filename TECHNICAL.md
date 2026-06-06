# TECHNICAL.md — Hướng dẫn kỹ thuật

> BIDV RWA Admin Console — Phase 1  
> Cập nhật: 06/06/2026

---

## Mục lục

1. [Cấu trúc dự án](#1-cấu-trúc-dự-án)
2. [Chạy local dev](#2-chạy-local-dev)
3. [Lấy API Keys](#3-lấy-api-keys)
4. [Deploy smart contract](#4-deploy-smart-contract)
5. [Deploy lên Vercel](#5-deploy-lên-vercel)
6. [Biến môi trường](#6-biến-môi-trường)
7. [Stack & Dependencies](#7-stack--dependencies)

---

## 1. Cấu trúc dự án

```
tokenizeplatform/
├── app/                        # Next.js 16 application
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   │   ├── page.tsx            # Dashboard (/)
│   │   │   ├── assets/page.tsx     # Niêm yết tài sản
│   │   │   ├── reconciliation/page.tsx
│   │   │   └── kyc/page.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── app-layout.tsx
│   │   │   │   ├── sidebar.tsx     # Nav + BIDV logo
│   │   │   │   └── header.tsx      # Breadcrumb + dark/light toggle + wallet
│   │   │   ├── pages/
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── assets.tsx
│   │   │   │   ├── reconciliation.tsx
│   │   │   │   └── kyc.tsx
│   │   │   ├── ui/                 # shadcn/ui (Base UI)
│   │   │   ├── bidv-logo.tsx       # BIDV SVG logo
│   │   │   └── providers.tsx       # Wagmi + RainbowKit + TanStack + next-themes
│   │   └── lib/
│   │       ├── wagmi.ts            # Polygon Amoy config
│   │       ├── mock-data.ts        # Mock data Phase 1
│   │       └── utils.ts
│   └── .env.local
│
├── contracts/
│   ├── AssetRegistry.sol           # Smart contract (Solidity 0.8.24)
│   └── deploy.ts                   # Deploy script (Viem)
│
├── .claude/launch.json             # Dev server config cho Claude preview
├── URD-v1.md                       # User Requirements Document
├── TECHNICAL.md                    # File này
└── README.md                       # Quick start
```

---

## 2. Chạy local dev

### Yêu cầu
- Node.js >= 20
- npm >= 10

### Bước 1 — Install
```bash
cd app
npm install
```

### Bước 2 — Env
```bash
# Điền key vào .env.local (xem mục 3)
nano app/.env.local
```

> App vẫn chạy khi chưa có key — WalletConnect option bị disable nhưng MetaMask vẫn hoạt động.

### Bước 3 — Dev server
```bash
cd app && npm run dev
# → http://localhost:3000
```

---

## 3. Lấy API Keys

### 3.1. Alchemy API Key

1. Vào [dashboard.alchemy.com](https://dashboard.alchemy.com) → Sign up (free)
2. **Create new app** → Chain: Polygon → Network: **Polygon Amoy**
3. Copy **API Key** → điền `NEXT_PUBLIC_ALCHEMY_ID`

**Free tier:** 300M compute units/tháng.

---

### 3.2. WalletConnect Project ID

1. Vào [cloud.walletconnect.com](https://cloud.walletconnect.com) → Sign up (free)
2. **Create project** → Type: App
3. Thêm allowed domains: `localhost:3000`, `*.vercel.app`
4. Copy **Project ID** → điền `NEXT_PUBLIC_WC_PROJECT_ID`

---

### 3.3. Test MATIC

- Faucet: [faucet.polygon.technology](https://faucet.polygon.technology) → chọn **Amoy**

---

## 4. Deploy smart contract

### Setup Hardhat
```bash
mkdir hardhat && cd hardhat
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-viem viem dotenv
npx hardhat init  # chọn TypeScript project
```

### hardhat.config.ts
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-viem";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    amoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
  },
};
export default config;
```

### Compile & Deploy
```bash
# Copy contract
cp ../contracts/AssetRegistry.sol contracts/

# Compile
npx hardhat compile

# Deploy (cần DEPLOYER_PRIVATE_KEY và ALCHEMY_KEY trong .env)
npx hardhat run scripts/deploy.ts --network amoy
```

### Output
```
✅ AssetRegistry deployed at: 0xContractAddress
   Explorer: https://amoy.polygonscan.com/address/0xContractAddress
```

Sau đó điền vào `app/.env.local`:
```
NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS=0xContractAddress
```

---

## 5. Deploy lên Vercel

```bash
npm install -g vercel
cd app
vercel --prod
```

**Environment Variables cần thêm trong Vercel Dashboard:**
```
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_ALCHEMY_ID
NEXT_PUBLIC_WC_PROJECT_ID
NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS
```

---

## 6. Biến môi trường

| Biến | Phase | Mô tả |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | 1 | `80002` (Amoy) / `137` (Mainnet) |
| `NEXT_PUBLIC_ALCHEMY_ID` | 1 | Alchemy API key |
| `NEXT_PUBLIC_WC_PROJECT_ID` | 1 | WalletConnect Project ID |
| `NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS` | 2 | Địa chỉ contract sau deploy |
| `DATABASE_URL` | 3 | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | 3 | Random string cho NextAuth |
| `NEXTAUTH_URL` | 3 | URL app (`http://localhost:3000`) |

---

## 7. Stack & Dependencies

| Package | Version | Mục đích |
|---|---|---|
| `next` | 16.x | Framework |
| `typescript` | 5.x | Type safety |
| `tailwindcss` | 4.x | Styling |
| `@rainbow-me/rainbowkit` | 2.x | Wallet UI |
| `wagmi` | 2.x | Web3 hooks |
| `viem` | 2.x | Ethereum library |
| `@tanstack/react-query` | 5.x | Data fetching |
| `next-themes` | 0.4.x | Dark/Light mode |
| `recharts` | 2.x | Charts |
| `react-hook-form` | 7.x | Forms (Phase 2) |
| `zod` | 3.x | Validation (Phase 2) |
| `lucide-react` | latest | Icons |

---

## Ghi chú hydration (next-themes + RainbowKit)

RainbowKitProvider nhận `theme` prop — nếu theme thay đổi giữa server và client sẽ gây lỗi hydration. Fix: dùng `mounted` state trong `RainbowWithTheme`, pin về `darkTheme` trước khi mount (khớp với `defaultTheme="dark"`), chỉ switch sau khi client đã hydrate.

```typescript
const walletTheme = mounted && resolvedTheme === "light"
  ? LIGHT_WALLET_THEME
  : DARK_WALLET_THEME; // server + pre-mount luôn dark
```

---

*Không commit file `.env.local`.*
