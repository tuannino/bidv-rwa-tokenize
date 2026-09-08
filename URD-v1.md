# URD v1 — BIDV RWA Admin Console

> **Phiên bản:** 1.0  
> **Ngày:** 06/06/2026  
> **Baseline:** https://loyalty-poc-2-0-sv19.vercel.app (PoC v2.0)  
> **Mục tiêu:** Rebuild & nâng cấp BIDV RWA Admin Console theo lộ trình phân phase

---

## 1. Tổng quan hệ thống

BIDV RWA Admin Console là giao diện quản trị nội bộ dành cho ngân hàng BIDV, phục vụ việc niêm yết, quản lý và đối soát các tài sản thực (Real World Assets — RWA) được token hóa trên blockchain.

| Thuộc tính | Giá trị |
|---|---|
| Tên hệ thống | BIDV RWA — Admin Console |
| Baseline | PoC v2.0 (loyalty-poc-2-0-sv19.vercel.app) |
| Blockchain | Polygon Amoy Testnet (chainId: 80002) |
| Smart Contract | AssetRegistry |
| Ngôn ngữ giao diện | Tiếng Việt |

---

## 2. Các loại tài sản (Token Types)

| Token | Tên đầy đủ | Backing | Đơn vị |
|---|---|---|---|
| **BGT** | Vàng (Gold Token) | SJC · DOJI · PNJ — 100% vật chất | Chi (1 chi = 3.75g) |
| **BRT** | Bất động sản | Căn hộ · Văn phòng · Retail — qua SPV | Token/m² |
| **BCT** | Carbon Credit | VCS · Gold Standard | 1 BCT = 1 tCO2e |

---

## 3. Connections & Infrastructure

### Blockchain
- **Network:** Polygon Amoy Testnet (chainId: 80002) → Polygon Mainnet khi production
- **RPC:** Alchemy free tier
- **Explorer:** Polygonscan Amoy
- **Contract:** AssetRegistry (deploy trên Amoy — thật, không mock)

### Wallet
- **Provider:** MetaMask (thật) + RainbowKit UI
- **WalletConnect:** Cần Project ID (cloud.walletconnect.com — free)
- **Auth:** SIWE — Sign In With Ethereum
- **Production:** Ledger/Trezor hardware wallet cho Admin

### Database (Off-chain)
- **Local dev:** PostgreSQL qua Docker
- **Production:** Supabase (free tier: 500MB)
- **ORM:** Prisma + `@prisma/adapter-neon` (edge compatible)
- **Dùng cho:** KYC data, audit log, user sessions, batch reconciliation

### Storage
- **Local:** Local filesystem / MinIO
- **Production:** Supabase Storage (S3-compatible API)

---

## 4. Technology Stack

| Layer | Công nghệ | Lý do |
|---|---|---|
| Framework | Next.js 15 (App Router) | Vercel native, RSC, file-based routing |
| Language | TypeScript | Type safety, tránh lỗi runtime |
| Styling | Tailwind CSS + shadcn/ui | Component library chất lượng, dark mode sẵn |
| Web3 | Wagmi v2 + Viem + RainbowKit | Modern Web3 hooks, type-safe contract calls |
| State | Zustand | Lightweight, dễ dùng |
| Data fetching | TanStack Query v5 | Caching, background refetch |
| Forms | React Hook Form + Zod | Validation mạnh, performance tốt |
| Charts | Recharts | Lightweight, responsive |
| Auth | NextAuth v5 (SIWE) | Session management |
| Database | PostgreSQL + Prisma | Local Docker → Supabase production |
| Theme | next-themes | Dark/Light mode, no flash |

### Deploy targets
- **Primary:** Vercel (zero config với Next.js)
- **Alternative:** Cloudflare Pages
- **DB/Auth/Storage:** Supabase

### Environment config
```env
DATABASE_URL=
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_ALCHEMY_ID=
NEXT_PUBLIC_WC_PROJECT_ID=
NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS=
```

---

## 5. Routes & Pages

| Route | Tên trang | Phase | Tình trạng |
|---|---|---|---|
| `/login` | Đăng nhập (MetaMask SIWE) | 3 | Mới |
| `/` | Dashboard | 1 ✅ | Hoàn thành |
| `/assets` | Danh sách tài sản | 1 ✅ | Hoàn thành |
| `/assets/[id]` | Chi tiết tài sản + lịch sử GD | 2 | Mới |
| `/assets/new` | Form tạo niêm yết (multi-step) | 2 | Mới |
| `/assets/[id]/edit` | Chỉnh sửa tài sản | 2 | Mới |
| `/reconciliation` | Đối soát batch | 1 ✅ | UI sẵn sàng |
| `/kyc` | Quản lý KYC | 1 ✅ | UI sẵn sàng |
| `/kyc/[id]` | Chi tiết nhà đầu tư | 3 | Mới |
| `/reports` | Báo cáo & xuất Excel/PDF | 4 | Mới |
| `/audit-log` | Lịch sử hành động Admin | 3 | Mới |
| `/settings` | Cấu hình hệ thống | 4 | Mới |

---

## 6. Roadmap theo Phase

### Phase 1 — Shell ✅ HOÀN THÀNH
- [x] Setup Next.js + TypeScript + Tailwind + shadcn/ui
- [x] Layout: sidebar + header + dark theme
- [x] BIDV branding (logo SVG, màu green/gold)
- [x] Dark/Light mode toggle (next-themes)
- [x] Dashboard với mock data (KPIs + chart)
- [x] Bảng danh sách tài sản (filter loại/trạng thái)
- [x] Wallet connect button (MetaMask via RainbowKit)
- [x] Blockchain status bar (Polygon Amoy)

### Phase 2 — Core Flow
- [ ] Form tạo niêm yết multi-step (Vàng/BĐS/Carbon)
- [ ] Ký giao dịch thật trên Polygon Amoy
- [ ] Detail page tài sản + lịch sử giao dịch
- [ ] KYC list + approve/reject flow
- [ ] Kết nối AssetRegistry contract thật

### Phase 3 — Operations
- [ ] Auth: Sign In With Ethereum (SIWE) + NextAuth
- [ ] Role-based access (Admin / Viewer / Operator)
- [ ] Batch reconciliation với data thật
- [ ] Audit log
- [ ] KYC detail page + full flow

### Phase 4 — Polish
- [ ] Reports page + export Excel/PDF
- [ ] Real-time updates (TanStack Query polling)
- [ ] Notifications
- [ ] Settings page
- [ ] Switch Polygon Mainnet + Ledger/Trezor

---

## 7. Điểm yếu PoC cần khắc phục

| # | Vấn đề | Mức độ | Phase |
|---|---|---|---|
| 1 | Không có Authentication/Login | Nghiêm trọng | 3 |
| 2 | Không có Detail page cho tài sản | Cao | 2 |
| 3 | Form tạo niêm yết bị block ở kết nối ví | Cao | 2 |
| 4 | Không có Audit Log | Cao | 3 |
| 5 | KYC & Batch không có data thật | Trung bình | 2-3 |
| 6 | Không có Reports/Thống kê | Trung bình | 4 |
| 7 | Sidebar không có role-based visibility | Trung bình | 3 |
| 8 | Không có real-time updates | Trung bình | 4 |

---

*URD v1 — Xác nhận ngày 06/06/2026.*
