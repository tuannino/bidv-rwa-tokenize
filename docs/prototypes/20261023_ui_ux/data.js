// Dữ liệu mẫu cho bản thử nghiệm giao diện. Một nguồn duy nhất: mọi tổng đều cộng từ các dòng.
// Số liệu là MẪU, không phải số trên chuỗi. Danh sách cần thay bằng dữ liệu thật nằm trong tài liệu bàn giao.
window.DATA = (() => {
  const token = {
    symbol: 'WPT',
    project: 'Điện gió An Viên',
    chain: 'Sepolia',
    issuePrice: 100000, // VNDB mỗi WPT
    cap: 20000000, // trần phát hành
    totalSupply: 10000000, // đã phát hành vào vault
    circulating: 3412500, // trong ví nhà đầu tư
    holders: 128,
    capacityMw: 99.2,
    turbines: 62,
    targetYield: 0.058,
  };
  token.unsold = token.totalSupply - token.circulating; // WPT chưa bán, nằm trong vault

  // Sáu kỳ chia gần nhất. perWpt là VNDB chia cho mỗi WPT; quỹ của kỳ = perWpt nhân tổng cung tại ảnh chụp.
  const periods = [
    { label: '04/2026', mwh: 24180, perWpt: 350, paidOn: '05/05/2026' },
    { label: '05/2026', mwh: 27640, perWpt: 400, paidOn: '05/06/2026' },
    { label: '06/2026', mwh: 31900, perWpt: 462, paidOn: '06/07/2026' },
    { label: '07/2026', mwh: 29450, perWpt: 426, paidOn: '05/08/2026' },
    { label: '08/2026', mwh: 34720, perWpt: 502, paidOn: '07/09/2026' },
    { label: '09/2026', mwh: 33180, perWpt: 480, paidOn: null }, // kỳ hiện tại: đã chốt vault, chờ duyệt
  ].map((p) => ({ ...p, fund: p.perWpt * token.totalSupply }));
  const current = periods.at(-1), previous = periods.at(-2);
  current.toInvestors = current.perWpt * token.circulating;
  current.toVault = current.perWpt * token.unsold;
  console.assert(current.toInvestors + current.toVault === current.fund, 'phần chia cộng lại phải bằng quỹ kỳ');

  // Việc đang chờ Kiểm soát viên. minutes = số phút đã chờ tính tới lúc cập nhật.
  const updatedAt = '09:14, 23/10/2026';
  const requests = [
    { id: '7f3a21c0', kind: 'MINT', amount: 250000, maker: 'GDV001', reason: 'Phát hành đợt 2 theo QĐ 128/2026', doc: 'QĐ 128/2026/QĐ-BIDV', effective: '24/10/2026', createdAt: '06:12, 23/10/2026', minutes: 182, status: 'PENDING' },
    { id: '91bd0e44', kind: 'MINT', amount: 120000, maker: 'GDV002', reason: 'Bổ sung nguồn cung kênh bán lẻ', doc: 'TTr 54/2026/BIDV-NHBL', effective: '24/10/2026', createdAt: '08:05, 23/10/2026', minutes: 69, status: 'PENDING' },
    { id: 'c02f9a17', kind: 'BURN', amount: 50000, maker: 'GDV001', reason: 'Huỷ phần chưa phân phối của đợt 1', doc: 'QĐ 131/2026/QĐ-BIDV', effective: '23/10/2026', createdAt: '08:49, 23/10/2026', minutes: 25, status: 'PENDING', source: 'Phần chưa phân phối' },
    { id: '5e0c7b92', kind: 'MINT', amount: 400000, maker: 'GDV002', reason: 'Phát hành đợt 1 bổ sung', doc: 'QĐ 119/2026/QĐ-BIDV', effective: '22/10/2026', createdAt: '16:40, 22/10/2026', status: 'COMPLETED', checker: 'KSV001', decidedAt: '07:58, 23/10/2026', tx: '0x8c41e2d0' },
    { id: 'a4471f3d', kind: 'BURN', amount: 30000, maker: 'GDV001', reason: 'Huỷ do sai số lượng đợt 1', doc: 'QĐ 120/2026/QĐ-BIDV', effective: '22/10/2026', createdAt: '17:02, 22/10/2026', status: 'REJECTED', checker: 'KSV001', decidedAt: '08:02, 23/10/2026', rejectReason: 'Chứng từ chưa ký' },
  ];
  const pending = requests.filter((r) => r.status === 'PENDING');
  const decided = requests.filter((r) => r.status !== 'PENDING');

  const withdrawReview = { id: 'RT-0012', who: 'Người bán NB001', amount: 3399997, note: 'Mất mã giao dịch, cần xác nhận' };

  const vault = { vndb: 41250000000, lockPct: 0.2 };
  vault.locked = Math.round(vault.vndb * vault.lockPct);
  vault.free = vault.vndb - vault.locked;

  // Nhà đầu tư mẫu: mua 150 WPT ngày 18/03/2026, giữ suốt sáu kỳ.
  const investor = { id: 'NDT001', name: 'Trần Minh Khoa', wpt: 150, deposited: 17000000, withdrew: 500000 };
  investor.payouts = periods.filter((p) => p.paidOn).map((p) => ({ label: p.label, amount: p.perWpt * investor.wpt, paidOn: p.paidOn }));
  // Kỳ 09/2026 đã trả cho nhà đầu tư trong kịch bản của màn Nhà đầu tư (05/10/2026).
  investor.payouts.push({ label: current.label, amount: current.perWpt * investor.wpt, paidOn: '05/10/2026' });
  investor.received = investor.payouts.reduce((s, p) => s + p.amount, 0);
  investor.vndb = investor.deposited - investor.wpt * token.issuePrice + investor.received - investor.withdrew;
  investor.wptValue = investor.wpt * token.issuePrice;
  investor.total = investor.wptValue + investor.vndb;
  investor.yieldPa = (investor.received / investor.wptValue) * (12 / investor.payouts.length);
  investor.activity = [
    { what: 'Nhận lợi tức kỳ 09/2026', amount: investor.payouts.at(-1).amount, on: '05/10/2026' },
    { what: 'Rút VNDB về tài khoản BIDV', amount: -investor.withdrew, on: '12/09/2026' },
    { what: 'Nhận lợi tức kỳ 08/2026', amount: investor.payouts.at(-2).amount, on: '07/09/2026' },
    { what: 'Nhận lợi tức kỳ 07/2026', amount: investor.payouts.at(-3).amount, on: '05/08/2026' },
    { what: 'Mua 150 WPT', amount: -investor.wpt * token.issuePrice, on: '18/03/2026' },
  ];
  console.assert(investor.received === 393000, 'lợi tức sáu kỳ của 150 WPT là 393.000 VNDB');
  console.assert(investor.total === investor.wptValue + investor.vndb, 'tổng tài sản');

  return { token, periods, current, previous, updatedAt, requests, pending, decided, withdrawReview, vault, investor };
})();

// Định dạng số theo tiếng Việt: dấu chấm nghìn, dấu phẩy thập phân, đơn vị là hậu tố xám.
window.F = (() => {
  const nf = (o) => new Intl.NumberFormat('vi-VN', o);
  const MINUS = '−';
  return {
    int: (v) => nf({ maximumFractionDigits: 0 }).format(v),
    dec: (d) => (v) => nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v),
    signed: (v) => (v > 0 ? '+' : v < 0 ? MINUS : '') + nf({ maximumFractionDigits: 0 }).format(Math.abs(v)),
    pct: (v, d = 1) => nf({ style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(v),
    signedPct: (v, d = 1) => (v > 0 ? '+' : v < 0 ? MINUS : '') + nf({ style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v)),
    ty: (v) => nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v / 1e9),
    wait: (m) => (m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60 ? (m % 60) + ' phút' : ''}`.trim() : `${m} phút`),
  };
})();
