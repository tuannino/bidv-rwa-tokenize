const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat, TableOfContents
} = require("docx");
const fs = require("fs");

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGIN = { top: 100, bottom: 100, left: 140, right: 140 };

const heading1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, font: "Arial", color: "1B4F72" })],
  });

const heading2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, font: "Arial", color: "1A5276" })],
  });

const heading3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Arial", color: "2E4057" })],
  });

const para = (text) =>
  new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial" })],
  });

const bullet = (text) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, font: "Arial" })],
  });

const divider = () =>
  new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "BDC3C7" } },
    children: [],
  });

function buildTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        borders: BORDERS,
        width: { size: colWidths[i], type: WidthType.DXA },
        margins: CELL_MARGIN,
        shading: { fill: "1B4F72", type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, font: "Arial", color: "FFFFFF" })] })],
      })
    ),
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) =>
        new TableCell({
          borders: BORDERS,
          width: { size: colWidths[ci], type: WidthType.DXA },
          margins: CELL_MARGIN,
          shading: { fill: ri % 2 === 0 ? "F8F9FA" : "FFFFFF", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, font: "Arial" })] })],
        })
      ),
    })
  );

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ],
    }],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1B4F72" },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "1A5276" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2E4057" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1B4F72" } },
          children: [
            new TextRun({ text: "BIDV RWA Admin Console — Phân tích Baseline", size: 18, font: "Arial", color: "1B4F72", bold: true }),
            new TextRun({ text: "  |  Confidential", size: 18, font: "Arial", color: "999999" }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "BDC3C7" } },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Trang ", size: 18, font: "Arial", color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "888888" }),
            new TextRun({ text: " / ", size: 18, font: "Arial", color: "888888" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "888888" }),
            new TextRun({ text: "  —  06/06/2026", size: 18, font: "Arial", color: "888888" }),
          ],
        })],
      }),
    },
    children: [
      // Cover
      new Paragraph({ spacing: { before: 800, after: 200 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "BIDV RWA", size: 72, bold: true, font: "Arial", color: "1B4F72" })] }),
      new Paragraph({ spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Admin Console", size: 52, font: "Arial", color: "2980B9" })] }),
      new Paragraph({ spacing: { before: 0, after: 600 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Phân tích Baseline & Kế hoạch Rebuild", size: 30, font: "Arial", color: "7F8C8D" })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "1B4F72" }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "1B4F72" } },
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "PoC v2.0  ·  Polygon Mumbai Testnet  ·  Ngày phân tích: 06/06/2026", size: 22, font: "Arial", color: "555555" })],
      }),
      new Paragraph({ spacing: { before: 400, after: 0 }, children: [] }),
      new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-3" }),
      new Paragraph({ pageBreakBefore: true, children: [] }),

      // 1. Tổng quan
      heading1("1. Tổng quan hệ thống"),
      para("BIDV RWA Admin Console là giao diện quản trị nội bộ dành cho ngân hàng BIDV, phục vụ việc niêm yết, quản lý và đối soát các tài sản thực (Real World Assets — RWA) được token hóa trên blockchain. Đây là PoC v2.0 được deploy trên Vercel."),
      new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }),
      buildTable(["Thuộc tính", "Giá trị"], [
        ["Tên hệ thống", "BIDV RWA — Admin Console"],
        ["Phiên bản", "PoC v2.0"],
        ["URL", "https://loyalty-poc-2-0-sv19.vercel.app"],
        ["Deployment", "Vercel (serverless)"],
        ["Blockchain network", "Polygon Mumbai (Testnet)"],
        ["Smart contract", "AssetRegistry"],
        ["Ngôn ngữ giao diện", "Tiếng Việt"],
        ["Ngày phân tích", "06/06/2026"],
      ], [3000, 6026]),
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // 2. Kiến trúc & Công nghệ
      heading1("2. Kiến trúc & Công nghệ"),
      heading2("2.1. Technology Stack"),
      buildTable(["Layer", "Công nghệ", "Ghi chú"], [
        ["Frontend Framework", "Next.js", "SPA rendering, deploy trên Vercel"],
        ["Blockchain", "Polygon Mumbai", "Testnet — chuyển Mainnet khi production"],
        ["Wallet Integration", "MetaMask / WalletConnect", "WalletConnect bị tắt trong PoC"],
        ["Smart Contract", "AssetRegistry", "Quản lý niêm yết tài sản on-chain"],
        ["Oracle", "Price Oracle", "Cập nhật giá VND on-chain"],
        ["Styling", "Dark sidebar + monospace", "Font monospace cho dữ liệu blockchain"],
        ["Deployment", "Vercel", "Serverless, CI/CD tự động"],
      ], [2500, 2500, 4026]),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
      heading2("2.2. Cấu trúc Routes"),
      buildTable(["Route", "Tên trang", "Module"], [
        ["/", "Tổng quan (Dashboard)", "—"],
        ["/listed-property", "Niêm yết tài sản số", "Module E"],
        ["/batch-reconciliation", "Đối soát batch", "Module B"],
        ["/kyc", "Quản lý KYC nhà đầu tư", "Module A"],
      ], [3000, 3000, 3026]),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
      heading2("2.3. Blockchain Architecture"),
      bullet("Network: Polygon Mumbai Testnet (Block #5,284,729 tại thời điểm phân tích)"),
      bullet("Smart contract AssetRegistry xử lý toàn bộ vòng đời tài sản on-chain"),
      bullet("Oracle tích hợp để cập nhật giá VND tự động"),
      bullet("Admin ký giao dịch qua MetaMask; Production yêu cầu hardware wallet (Ledger/Trezor)"),
      bullet("ENS domain: admin.bidv.eth (địa chỉ ví Admin)"),
      bullet("Mỗi niêm yết tài sản đều có TX Hash lưu trên blockchain"),
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // 3. Các loại tài sản
      heading1("3. Các loại tài sản được token hóa"),
      buildTable(["Token", "Tên đầy đủ", "Backing", "Đơn vị", "Đặc điểm"], [
        ["BGT", "Vàng (Gold Token)", "SJC · DOJI · PNJ — 100% vật chất", "Chi (1 chi = 3.75g)", "Giá quy đổi theo Oracle; 950.000 đ/chi"],
        ["BRT", "Bất động sản", "Căn hộ · Văn phòng · Retail — qua SPV", "Token/m²", "Giá trị backing qua Special Purpose Vehicle"],
        ["BCT", "Carbon Credit Token", "VCS · Gold Standard", "1 BCT = 1 tCO2e", "Vintage year 2025; liên kết với hecta rừng"],
      ], [700, 2200, 2500, 1400, 2226]),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
      heading2("3.1. Dữ liệu tài sản tại thời điểm phân tích"),
      buildTable(["Mã tài sản", "Tên", "Loại", "Tổng phát hành", "Backing thực", "Giá hiện tại", "Trạng thái"], [
        ["BCT-CP073", "CC-2026-073", "Carbon (BCT)", "50.000 BCT", "2.500ha · 50.000 tCO2e", "120.000 tCO2e/ha", "Đang giao dịch"],
        ["BGT-GOLD-512", "GOLD-20260529-512", "Vàng (BGT)", "100.000 BGT", "3.750g · 1.000 chi", "950.000 đ/chi", "Đang giao dịch"],
        ["BRT-VOP3-991", "RE-20260529-991", "BĐS (BRT)", "185.000 BRT", "98.500m² · 185 tỷ", "1.050.000 tỷ VND", "Đang giao dịch"],
      ], [1400, 1800, 1200, 1400, 1800, 1400, 1026]),
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // 4. Chi tiết module
      heading1("4. Chi tiết từng Module"),
      heading2("4.1. Dashboard — Tổng quan (/)"),
      buildTable(["KPI", "Giá trị", "Mô tả"], [
        ["Tài sản đang niêm yết", "3", "+0 trong 7 ngày qua"],
        ["Tổng giá trị on-chain", "295,3 tỷ VND", "Quy đổi theo giá Oracle"],
        ["Giao dịch hôm nay", "0", "So với hôm qua"],
        ["Batch chưa đối soát", "0", "Cần xử lý"],
      ], [3000, 2000, 4026]),
      new Paragraph({ spacing: { before: 120, after: 80 }, children: [] }),
      heading3("Phân bổ tài sản (7 ngày qua):"),
      buildTable(["Loại tài sản", "Số lượng", "Giá trị", "Tỷ trọng"], [
        ["Bất động sản (BRT)", "1 dự án", "194,3 tỷ VND", "65,8%"],
        ["Vàng (BGT)", "1 lô", "95 tỷ VND", "32,2%"],
        ["Carbon Credit (BCT)", "1 đợt", "6 tỷ VND", "2,0%"],
      ], [2500, 1500, 2000, 3026]),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

      heading2("4.2. Niêm yết tài sản số — Module E (/listed-property)"),
      buildTable(["Cột", "Nội dung"], [
        ["Mã & Tên tài sản", "Mã định danh nội bộ + tên asset"],
        ["Loại", "Badge màu: Carbon (xanh lá), Vàng (vàng), Bất động sản (xanh dương)"],
        ["Tổng phát hành", "Số lượng token đã mint"],
        ["Backing thực", "Tài sản vật lý đảm bảo"],
        ["Giá hiện tại", "Giá quy đổi từ Oracle"],
        ["Trạng thái", "Đang giao dịch / Đang xử lý"],
        ["Niêm yết", "Ngày niêm yết + địa chỉ ví admin"],
        ["TX Hash", "Hash giao dịch on-chain (link Polygonscan)"],
      ], [2200, 6826]),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

      heading2("4.3. Đối soát batch — Module B (/batch-reconciliation)"),
      para("So sánh giao dịch on-chain với Core Banking BIDV theo ngày và loại tài sản."),
      buildTable(["Cột", "Nội dung"], [
        ["Ngày batch", "Ngày thực hiện đối soát"],
        ["Loại tài sản", "BGT / BRT / BCT"],
        ["Số GD", "Tổng số giao dịch trong batch"],
        ["Mint", "Số lượng token được tạo mới"],
        ["Burn", "Số lượng token bị hủy"],
        ["Transfer", "Số lượng token được chuyển nhượng"],
        ["Tổng VND", "Tổng giá trị quy đổi sang VND"],
      ], [2000, 7026]),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

      heading2("4.4. Quản lý KYC — Module A (/kyc)"),
      buildTable(["Cột", "Nội dung"], [
        ["Nhà đầu tư", "Họ tên"],
        ["CCCD", "Số CCCD/CMND"],
        ["Cấp KYC", "Level 1 / Level 2 / VIP"],
        ["Khẩu vị RR", "Risk Rating — mức độ rủi ro chấp nhận"],
        ["Địa chỉ ví", "Địa chỉ ví blockchain đã whitelist"],
        ["Danh mục", "Loại tài sản nhà đầu tư đang nắm giữ"],
        ["Trạng thái", "Hoạt động / Chờ duyệt / Đóng băng"],
        ["Đăng ký", "Ngày đăng ký"],
      ], [2200, 6826]),
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // 5. Luồng nghiệp vụ
      heading1("5. Luồng nghiệp vụ chính"),
      heading2("5.1. Luồng niêm yết tài sản"),
      buildTable(["Bước", "Hành động", "Actor", "Công nghệ"], [
        ["1", "Admin kết nối ví MetaMask (Ledger/Trezor cho Production)", "Admin BIDV", "MetaMask"],
        ["2", "Chọn loại tài sản: BGT / BRT / BCT", "Admin BIDV", "UI Dropdown"],
        ["3", "Nhập thông tin tài sản (backing, số lượng, giá...)", "Admin BIDV", "Form UI"],
        ["4", "Ký giao dịch on-chain bằng ví Admin", "Admin BIDV", "MetaMask"],
        ["5", "Smart contract AssetRegistry mint token", "Smart Contract", "Polygon"],
        ["6", "TX Hash được lưu và hiển thị trong danh sách", "System", "Polygonscan"],
        ["7", "Oracle cập nhật giá VND theo thời gian thực", "Oracle", "Price Feed"],
      ], [500, 3200, 2000, 3326]),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

      heading2("5.2. Luồng KYC nhà đầu tư"),
      buildTable(["Bước", "Hành động", "Actor"], [
        ["1", "Nhà đầu tư đăng ký và submit hồ sơ CCCD", "Nhà đầu tư"],
        ["2", "Admin xem xét hồ sơ trong Module A (KYC)", "Admin BIDV"],
        ["3", "Phân cấp KYC: Level 1 / Level 2 / VIP", "Admin BIDV"],
        ["4", "Whitelist địa chỉ ví on-chain (nếu approved)", "Smart Contract"],
        ["5", "Nhà đầu tư giao dịch theo hạn mức KYC", "Nhà đầu tư"],
        ["6", "Admin có thể Freeze/Unfreeze ví bất kỳ lúc nào", "Admin BIDV"],
      ], [500, 4500, 4026]),
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // 6. Đánh giá
      heading1("6. Đánh giá PoC hiện tại"),
      heading2("6.1. Điểm mạnh"),
      bullet("Kiến trúc blockchain rõ ràng: Polygon + MetaMask + AssetRegistry"),
      bullet("Giao diện tiếng Việt, phù hợp với người dùng BIDV"),
      bullet("Phân loại tài sản rõ ràng: BGT (Vàng), BRT (BĐS), BCT (Carbon)"),
      bullet("Oracle tích hợp cập nhật giá VND tự động"),
      bullet("Status bar hiển thị block number thời gian thực"),
      bullet("Deploy nhanh trên Vercel, CI/CD tự động"),
      new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }),
      heading2("6.2. Điểm yếu & Hạn chế"),
      buildTable(["#", "Vấn đề", "Mức độ"], [
        ["1", "Không có Authentication/Login", "Nghiêm trọng"],
        ["2", "Không có Detail page cho từng tài sản", "Cao"],
        ["3", "Form tạo niêm yết bị chặn ở bước kết nối ví", "Cao"],
        ["4", "Không có Audit Log", "Cao"],
        ["5", "KYC & Batch reconciliation không có data", "Trung bình"],
        ["6", "Không có trang Reports/Thống kê", "Trung bình"],
        ["7", "Sidebar không có role-based visibility", "Trung bình"],
        ["8", "Không có real-time updates", "Trung bình"],
        ["9", "UI chưa responsive (horizontal scroll)", "Thấp"],
        ["10", "WalletConnect bị tắt trong PoC", "Thấp"],
      ], [500, 5000, 3526]),
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // 7. Kế hoạch Rebuild
      heading1("7. Kế hoạch Rebuild — Phiên bản nâng cấp"),
      heading2("7.1. Technology Stack đề xuất"),
      buildTable(["Layer", "Công nghệ", "Lý do"], [
        ["Framework", "Next.js 15 (App Router)", "Tương thích Vercel, RSC, file-based routing"],
        ["Language", "TypeScript", "Type safety, tránh lỗi runtime"],
        ["Styling", "Tailwind CSS + shadcn/ui", "Component library chất lượng, dark mode sẵn"],
        ["Web3", "Wagmi v2 + Viem + RainbowKit", "Modern Web3 hooks, type-safe contract calls"],
        ["State", "Zustand", "Lightweight, dễ dùng"],
        ["Data fetching", "TanStack Query v5", "Caching, background refetch"],
        ["Forms", "React Hook Form + Zod", "Validation mạnh, performance tốt"],
        ["Charts", "Recharts", "Lightweight, responsive"],
        ["Auth", "NextAuth v5 (SIWE)", "Session management"],
        ["Theme", "next-themes", "Dark/Light mode, no hydration flash"],
        ["Database", "PostgreSQL + Prisma", "Local Docker → Supabase production"],
      ], [2000, 2500, 4526]),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

      heading2("7.2. Roadmap theo Phase"),
      buildTable(["Phase", "Nội dung", "Status"], [
        ["Phase 1 — Shell", "Setup Next.js + TypeScript + Tailwind + shadcn/ui + Dark/Light mode", "✅ Hoàn thành"],
        ["Phase 1 — Shell", "Layout: Sidebar (BIDV logo) + Header + Wallet Connect", "✅ Hoàn thành"],
        ["Phase 1 — Shell", "Dashboard KPIs + charts + asset breakdown", "✅ Hoàn thành"],
        ["Phase 1 — Shell", "Asset List với filter loại/trạng thái", "✅ Hoàn thành"],
        ["Phase 2 — Core", "Form tạo niêm yết multi-step (BGT/BRT/BCT)", "🔜 Tiếp theo"],
        ["Phase 2 — Core", "Detail page tài sản + lịch sử giao dịch", "🔜 Tiếp theo"],
        ["Phase 2 — Core", "Kết nối AssetRegistry contract thật (Polygon Amoy)", "🔜 Tiếp theo"],
        ["Phase 3 — Ops", "Auth: Sign In With Ethereum (SIWE) + NextAuth", "📅 Planned"],
        ["Phase 3 — Ops", "KYC full flow + Batch reconciliation data thật", "📅 Planned"],
        ["Phase 4 — Polish", "Reports, Export, Real-time, Mainnet switch", "📅 Planned"],
      ], [2500, 4500, 2026]),
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // 8. So sánh
      heading1("8. So sánh PoC vs Phiên bản mới (Phase 1)"),
      buildTable(["Tính năng", "PoC v2.0 (baseline)", "Phiên bản mới (Phase 1)"], [
        ["Authentication", "Không có", "Planned Phase 3"],
        ["Dark/Light mode", "Chỉ dark", "✅ Toggle button, BIDV theme"],
        ["Branding BIDV", "Chữ đơn giản", "✅ SVG logo xanh/vàng"],
        ["Dashboard chart", "Bar chart tĩnh", "✅ Area chart theo thời gian"],
        ["Asset Detail", "Click row = không làm gì", "Planned Phase 2"],
        ["Tạo niêm yết", "Bị block ở kết nối ví", "Planned Phase 2"],
        ["Batch reconciliation", "Bảng trống", "✅ UI sẵn sàng"],
        ["KYC management", "Bảng trống", "✅ UI + search + filter"],
        ["Blockchain", "Polygon Mumbai (deprecated)", "Polygon Amoy (current testnet)"],
        ["Wallet UI", "Custom button", "✅ RainbowKit (MetaMask + WalletConnect)"],
      ], [2500, 3000, 3526]),

      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),
      divider(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({
          text: "Tài liệu tổng hợp dựa trên phân tích trực tiếp BIDV RWA Admin Console (PoC v2.0) ngày 06/06/2026.",
          size: 18, font: "Arial", color: "888888", italics: true,
        })],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("BIDV_RWA_Analysis.docx", buffer);
  console.log("Done: BIDV_RWA_Analysis.docx");
});
