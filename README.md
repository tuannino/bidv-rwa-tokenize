# BIDV RWA — Admin Console

> Giao diện quản trị nội bộ cho ngân hàng BIDV, phục vụ niêm yết, quản lý và đối soát tài sản thực (Real World Assets) được token hóa trên blockchain Ethereum/Stellar/Polygon.

![Homepage](/metadata/images/homepage.png)

![Phase 1](https://img.shields.io/badge/Phase-1%20✅%20Shell-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Polygon Amoy](https://img.shields.io/badge/Chain-Polygon%20Amoy-purple)

---

## Tính năng hiện tại (Phase 1)

| Module | Route | Trạng thái |
|---|---|---|
| 🏠 Dashboard | `/` | ✅ KPIs + area chart + phân bổ tài sản |
| 📋 Niêm yết tài sản | `/assets` | ✅ Danh sách + filter theo loại/trạng thái |
| 🔄 Đối soát batch | `/reconciliation` | ✅ UI sẵn sàng (data Phase 2) |
| 👤 Quản lý KYC | `/kyc` | ✅ UI sẵn sàng (data Phase 2) |
| 🌓 Dark / Light mode | Header | ✅ Toggle, BIDV green/gold theme |
| 🔗 Wallet Connect | Header | ✅ MetaMask qua RainbowKit |

---

## Quick Start

### Yêu cầu
- **Node.js** >= 20
- **npm** >= 10
- **MetaMask** extension để test wallet connection

### 1. Cài đặt
```bash
cd app
npm install
```

### 2. Cấu hình môi trường

Mở `app/.env.local` và điền key (xem mục **Lấy API Keys**):

```env
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_ALCHEMY_ID=       # Alchemy API key
NEXT_PUBLIC_WC_PROJECT_ID=    # WalletConnect Project ID
NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS=   # điền sau khi deploy contract
```

> **Note:** App chạy được khi chưa có key. WalletConnect bị disable nhưng MetaMask vẫn hoạt động.

### 3. Chạy dev server
```bash
cd app && npm run dev
# → http://localhost:3000
```

---

## Lấy API Keys

### Alchemy (RPC Provider)
1. [dashboard.alchemy.com](https://dashboard.alchemy.com) → Sign up (free)
2. Create app → Chain: **Polygon** → Network: **Polygon Amoy**
3. Copy **API Key** → `NEXT_PUBLIC_ALCHEMY_ID`

### WalletConnect Project ID
1. [cloud.walletconnect.com](https://cloud.walletconnect.com) → Sign up (free)
2. Create project → allowed domains: `localhost:3000`, `*.vercel.app`
3. Copy **Project ID** → `NEXT_PUBLIC_WC_PROJECT_ID`

### Test MATIC (cho deploy contract)
[faucet.polygon.technology](https://faucet.polygon.technology) → chọn **Amoy**

---

## Cấu trúc dự án

```
tokenizeplatform/
├── app/                      # Next.js 16 application
│   └── src/
│       ├── app/              # Routes: /, /assets, /reconciliation, /kyc
│       ├── components/
│       │   ├── layout/       # sidebar, header, app-layout
│       │   ├── pages/        # dashboard, assets, reconciliation, kyc
│       │   ├── bidv-logo.tsx # BIDV SVG logo (green + gold)
│       │   └── providers.tsx # Wagmi + RainbowKit + TanStack + next-themes
│       └── lib/
│           ├── wagmi.ts      # Polygon Amoy config
│           └── mock-data.ts  # Mock data Phase 1
│
├── contracts/
│   ├── AssetRegistry.sol     # Smart contract Solidity 0.8.24
│   └── deploy.ts             # Deploy script (Viem)
│
├── URD-v1.md                 # User Requirements Document
├── TECHNICAL.md              # Hướng dẫn kỹ thuật đầy đủ
└── README.md                 # File này
```

---

## Technology Stack

| Layer | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (Base UI) |
| Web3 | Wagmi v2 + Viem + RainbowKit |
| Theme | next-themes (dark/light, no flash) |
| Charts | Recharts |
| Blockchain | Polygon Amoy (testnet) |

---

## Deploy lên Vercel

```bash
cd app
npx vercel --prod
```

Thêm env vars trong Vercel Dashboard: `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_ALCHEMY_ID`, `NEXT_PUBLIC_WC_PROJECT_ID`, `NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS`.

---

## Smart Contract

`contracts/AssetRegistry.sol` — Solidity 0.8.24

**Tính năng:** tạo listing, mint/burn token BGT/BRT/BCT, KYC whitelist, freeze/unfreeze ví, oracle price feed.

**Deploy:** xem [TECHNICAL.md — mục 4](./TECHNICAL.md#4-deploy-smart-contract)

---

## Roadmap

| Phase | Status | Nội dung |
|---|---|---|
| **Phase 1** | ✅ Done | Shell — Layout, Dashboard, Asset List, Dark/Light, Wallet Connect |
| **Phase 2** | 🔜 Next | Detail page, Form tạo niêm yết multi-step, Contract integration |
| **Phase 3** | 📅 | Auth (SIWE), KYC full flow, Batch reconciliation |
| **Phase 4** | 📅 | Reports, Export, Real-time, Mainnet |

---

## ⚠️ TODO trước Phase 2

- [ ] Điền `NEXT_PUBLIC_ALCHEMY_ID` vào `app/.env.local`
- [ ] Điền `NEXT_PUBLIC_WC_PROJECT_ID` vào `app/.env.local`
- [ ] Setup Hardhat + deploy `AssetRegistry.sol` lên Polygon Amoy
- [ ] Điền `NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS` sau khi deploy

---

*BIDV RWA Admin Console — PoC v2.0 rebuild — 06/2026*
