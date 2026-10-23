// BIDV RWA, bản xem thử mẫu C. Dựng khung (sidebar theo vai, thanh trên có dropdown Chain và Vai trò),
// biểu tượng, hiệu ứng và biểu đồ. Không có chức năng thật: mọi nút chỉ để xem.
//
// Cách dùng trong một trang:
//   <body data-page="draft" data-nav="draft.html" data-roles="teller" data-crumbs="Vận hành|Lập lệnh">
//     <main class="content"> ...nội dung... </main>
//     <script src="assets/ui.js"></script>
//   <i data-icon="coins"></i>                        thay bằng biểu tượng
//   <span data-count="335000" data-d="0"></span>     số đếm lên
//   <div class="bar"><i data-w="55.2"></i></div>     thanh chạy tới %
//   <div class="gauge" data-value="38.4" data-color="var(--p1)" data-label="hệ số"></div>
//   <span data-turbine="var(--p1)"></span>          tua-bin có cánh quay
//   UI.chart(el, { labels, series: [{ name, values, color, axis: 'left'|'right', type: 'area'|'line'|'bars' }], left: { max, step, fmt }, right: {...} })
(() => {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('bidv-theme'); } catch {}
  root.dataset.theme = saved === 'dark' ? 'dark' : 'light';


  const I = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    clip: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    swap: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
    trend: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
    bank: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
    usercog: '<circle cx="10" cy="7" r="4"/><path d="M10.3 15H7a4 4 0 0 0-4 4v2"/><circle cx="18" cy="18" r="3"/><path d="m21.7 19.4-.9-.3M15.2 16.9l-.9-.3M16.6 21.7l.3-.9M19.1 15.2l.3-.9M19.6 21.7l-.4-1M16.8 15.3l-.4-1M14.3 19.6l1-.4M20.7 16.8l1-.4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2M9.8 4.4A2 2 0 1 1 11 8H2"/>',
    link: '<path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    chevr: '<path d="m9 18 6-6-6-6"/>',
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    shieldx: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m14.5 9.5-5 5M9.5 9.5l5 5"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    gauge: '<path d="m12 14 4-4M3.34 19a10 10 0 1 1 17.32 0"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    pluscircle: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>',
    send: '<path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.03.94l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/>',
    pen: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  };
  const icon = (n, cls = '') => `<svg class="${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || I.info}</svg>`;
  const turbine = (color = 'currentColor', speed = '') => `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="19" y="18" width="2" height="20" rx="1" fill="${color}" opacity=".7"/><g class="blades ${speed}"><path d="M20 18 L19 4 L21 18Z M20 18 L32 25 L19.4 19Z M20 18 L8 25 L20.6 19Z" fill="${color}"/><circle cx="20" cy="18" r="2.4" fill="#e0b44a"/></g></svg>`;
  const nf = (v, d = 0) => Number(v).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== Vai và menu: đúng nav-config.ts =====
  const ROLES = {
    investor: { label: 'Nhà đầu tư', code: 'NDT001', key: 'INVESTOR', home: 'portfolio.html' },
    seller: { label: 'Người bán', code: 'NB001', key: 'SELLER', home: 'seller.html' },
    teller: { label: 'Giao dịch viên', code: 'GDV001', key: 'TELLER', home: 'dashboard.html' },
    controller: { label: 'Kiểm soát viên', code: 'KSV001', key: 'CONTROLLER', home: 'dashboard.html' },
  };
  const PENDING = { draft: 2, approval: 2 };
  const NAV = {
    investor: [{ g: null, items: [['portfolio.html', 'Tổng quan', 'dash', 'E'], ['trade.html', 'Giao dịch token', 'cart', 'G'], ['orders.html', 'Quản lý lệnh', 'list', 'Q'], ['withdraw.html', 'Rút VNDB', 'bank', 'R'], ['wallet.html', 'Kết nối ví', 'wallet', 'V'], ['account.html', 'Thông tin tài khoản', 'usercog', 'T']] }],
    seller: [{ g: null, items: [['seller.html', 'Tổng quan', 'dash', 'E'], ['seller-transactions.html', 'Danh sách giao dịch', 'receipt', 'D'], ['seller-withdraw.html', 'Tạo lệnh rút', 'bank', 'R'], ['wallet.html', 'Kết nối ví', 'wallet', 'V'], ['account.html', 'Thông tin tài khoản', 'usercog', 'T']] }],
    teller: [
      { g: 'Vận hành', items: [['dashboard.html', 'Bảng điều khiển', 'dash', 'E'], ['draft.html', 'Lập lệnh', 'clip', 'L', 'draft'], ['transactions.html', 'Giao dịch', 'swap', 'G'], ['distribution.html', 'Chia lợi nhuận (chỉ xem)', 'trend', 'C'], ['vault.html', 'Vault thanh toán SPV', 'bank', 'K'], ['demo-payment.html', 'Nạp VNDB (trình diễn)', 'coins', 'N']] },
      { g: 'Tài khoản', items: [['account.html', 'Thông tin tài khoản', 'usercog', 'T']] },
    ],
    controller: [
      { g: 'Vận hành', items: [['dashboard.html', 'Bảng điều khiển', 'dash', 'E'], ['transactions.html', 'Giao dịch', 'swap', 'G'], ['distribution.html', 'Chia lợi nhuận', 'trend', 'C'], ['vault.html', 'Vault thanh toán SPV', 'bank', 'K']] },
      { g: 'Kiểm soát', items: [['approvals.html', 'Phê duyệt lệnh', 'shield', 'P', 'approval']] },
      { g: 'Tài khoản', items: [['account.html', 'Thông tin tài khoản', 'usercog', 'T']] },
    ],
  };
  const CHAINS = [['mock', 'Mock (không cần chain)'], ['hardhat-local', 'Hardhat Local'], ['evm', 'EVM Testnet (Sepolia)'], ['stellar', 'Stellar (Soroban), chưa dùng được', true]];

  const body = document.body;
  const allowed = (body.dataset.roles || 'teller').split(',');
  const q = new URLSearchParams(location.search);
  const role = allowed.includes(q.get('role')) ? q.get('role') : allowed[0];
  let chain = 'mock';
  try { chain = localStorage.getItem('bidv-chain') || 'mock'; } catch {}
  const withRole = (href, r = role) => `${href}?role=${r}`;

  const LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#1a6b3c"/><circle cx="20" cy="20" r="15" fill="none" stroke="#b8860b" stroke-width="1.5"/><path d="M13 12h7.5c2.5 0 4 1.2 4 3.2 0 1.4-.8 2.4-2 2.9 1.6.4 2.6 1.6 2.6 3.2C25.1 23.8 23.4 25 20.5 25H13V12zm3 5.2h3.8c1.1 0 1.8-.5 1.8-1.5s-.7-1.5-1.8-1.5H16v3zm0 5.6h4.2c1.2 0 2-.6 2-1.6s-.8-1.6-2-1.6H16v3.2z" fill="#fff"/><rect x="10" y="31" width="20" height="2.5" rx="1.25" fill="#b8860b"/></svg>';

  const content = document.querySelector('main.content');
  if (content) {
    const navHtml = NAV[role].map((grp) => `${grp.g ? `<div class="grp">${grp.g}</div>` : ''}${grp.items.map(([href, label, ic, k, pend]) => {
      const on = (body.dataset.nav || '') === href;
      const c = pend ? PENDING[pend] : null;
      return `<a href="${withRole(href)}"${on ? ' aria-current="page"' : ''}>${icon(ic)}<span class="lbl">${label}</span>${c != null ? `<span class="cnt${c > 0 ? ' on' : ''}" aria-label="${c} việc đang chờ">${c}</span>` : ''}<span class="kbd">${k}</span></a>`;
    }).join('')}`).join('');
    const crumbs = (body.dataset.crumbs || '').split('|').filter(Boolean);
    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML = `
      <aside class="sb" id="sb" aria-label="Điều hướng">
        <a class="logo" href="index.html">${LOGO}<div><b>BIDV<span>RWA</span></b><small>Điện gió</small></div></a>
        <nav class="nav">${navHtml}</nav>
        <div class="net" title="Trạng thái mạng"><span class="pulse" aria-hidden="true"><i></i><i></i></span><div><b id="net-chain"></b><small id="net-sub"></small></div></div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="iconbtn menu-btn" type="button" id="menu" aria-controls="sb" aria-expanded="false" aria-label="Mở menu">${icon('menu')}</button>
          <nav class="crumb" aria-label="Đường dẫn">${crumbs.map((c, i) => (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>${icon('chevr', 'sep')}`)).join('')}</nav>
          <div class="tb-right">
            <label class="dd" title="Chọn chain">${icon('link')}<span class="k">Chain</span><select id="chain" aria-label="Chain">${CHAINS.map(([v, l, dis]) => `<option value="${v}"${v === chain ? ' selected' : ''}${dis ? ' disabled' : ''}>${l}</option>`).join('')}</select>${icon('chev', 'chev')}</label>
            <label class="dd" title="Chọn vai trò">${icon('user')}<span class="k">Vai trò</span><select id="role" aria-label="Vai trò">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}"${k === role ? ' selected' : ''}>${r.label} (${r.code})</option>`).join('')}</select>${icon('chev', 'chev')}</label>
            <button class="iconbtn" type="button" id="theme" aria-label="Đổi giao diện sáng tối"></button>
            <button class="btn gold" type="button">${icon('wallet')}Kết nối ví</button>
          </div>
        </header>
      </div>`;
    content.replaceWith(shell);
    shell.querySelector('.main').appendChild(content);

    const syncNet = () => { const c = CHAINS.find(([v]) => v === chain); document.getElementById('net-chain').textContent = c[1]; document.getElementById('net-sub').textContent = `${chain}, vai trò ${ROLES[role].key}`; };
    syncNet();
    document.getElementById('chain').addEventListener('change', (e) => { chain = e.target.value; try { localStorage.setItem('bidv-chain', chain); } catch {} syncNet(); document.querySelectorAll('[data-chain-label]').forEach((n) => { n.textContent = chain; }); });
    document.querySelectorAll('[data-chain-label]').forEach((n) => { n.textContent = chain; });
    document.getElementById('role').addEventListener('change', (e) => { location.href = withRole(ROLES[e.target.value].home, e.target.value); });
    const themeBtn = document.getElementById('theme');
    const paint = () => { themeBtn.innerHTML = icon(root.dataset.theme === 'dark' ? 'sun' : 'moon'); };
    paint();
    themeBtn.addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('bidv-theme', root.dataset.theme); } catch {} paint(); charts.forEach((f) => f(false)); });
    const sb = document.getElementById('sb'), menu = document.getElementById('menu');
    menu.addEventListener('click', () => { const o = sb.classList.toggle('open'); menu.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('click', (e) => { if (sb.classList.contains('open') && !sb.contains(e.target) && !menu.contains(e.target)) { sb.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); } });
  }

  // Liên kết nội bộ giữ vai đang xem.
  document.querySelectorAll('a[data-go]').forEach((a) => { a.href = withRole(a.dataset.go); });
  // Nút và liên kết không có chức năng: chặn để không nhảy trang.
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href="#"]'); if (a) e.preventDefault(); });
  document.querySelectorAll('form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));

  // ===== Thay biểu tượng và tua-bin khai báo trong HTML =====
  document.querySelectorAll('[data-icon]').forEach((n) => { n.outerHTML = icon(n.dataset.icon, n.className); });
  document.querySelectorAll('[data-turbine]').forEach((n) => { n.innerHTML = turbine(n.dataset.turbine || 'currentColor', n.dataset.speed || ''); });
  document.querySelectorAll('.gauge[data-value]').forEach((g) => {
    const C = 2 * Math.PI * 34, v = +g.dataset.value;
    g.setAttribute('role', 'img'); g.setAttribute('aria-label', `${g.dataset.label || ''} ${nf(v, 1)}%`);
    g.innerHTML = `<svg viewBox="0 0 80 80"><circle class="trk" cx="40" cy="40" r="34"/><circle class="arc" cx="40" cy="40" r="34" stroke="${g.dataset.color || 'var(--p1)'}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - Math.min(100, v) / 100)}"/></svg><span class="t">${nf(v, 1)}%${g.dataset.label ? `<small>${g.dataset.label}</small>` : ''}</span>`;
  });
  document.querySelectorAll('[data-copy]').forEach((b) => { if (!b.innerHTML.trim()) b.innerHTML = icon('copy'); b.classList.add('copy'); b.setAttribute('aria-label', 'Chép'); b.addEventListener('click', () => navigator.clipboard?.writeText(b.dataset.copy).catch(() => {})); });
  // Nhóm nút chuyển (Mua và Bán, tab): chỉ đổi trạng thái hiển thị.
  document.querySelectorAll('.seg, .tabs').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !g.contains(b)) return;
    const attr = g.classList.contains('tabs') ? 'aria-selected' : 'aria-pressed';
    g.querySelectorAll('button').forEach((x) => x.setAttribute(attr, String(x === b)));
    if (b.dataset.show) { document.querySelectorAll(`[data-panel-group="${g.dataset.group}"]`).forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.show; }); }
  }));

  // ===== Hiệu ứng xuất hiện lần lượt, số đếm lên, thanh và vòng đo =====
  if (content) [...content.children].forEach((n, i) => { n.classList.add('rise'); n.style.animationDelay = `${Math.min(0.6, 0.05 + i * 0.06)}s`; });
  document.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count, d = +(el.dataset.d || 0);
    if (reduce) { el.textContent = nf(to, d); return; }
    el.textContent = nf(0, d);
    const t0 = performance.now() + 150, dur = 1400;
    const step = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 4); el.textContent = nf(to * e, d); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  setTimeout(() => {
    document.querySelectorAll('.bar i[data-w]').forEach((b) => { b.style.width = `${b.dataset.w}%`; });
    document.querySelectorAll('.gauge .arc').forEach((a) => { a.style.strokeDashoffset = a.dataset.off; });
  }, 300);

  // ===== Biểu đồ: vùng, đường, cột; một hoặc hai trục; tooltip theo cột dọc =====
  const charts = [];
  const chart = (el, cfg) => {
    const draw = (animate) => {
      el.querySelector('svg')?.remove();
      let tip = el.querySelector('.tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; el.appendChild(tip); }
      const W = el.clientWidth, H = el.clientHeight, n = cfg.labels.length;
      const L = cfg.left ? 72 : 16, R = cfg.right ? 54 : 16, T = 12, B = 30;
      const ax = { left: cfg.left, right: cfg.right };
      const y = (side, v) => T + (H - T - B) * (1 - v / ax[side].max);
      const hasBars = cfg.series.some((s) => s.type === 'bars');
      const band = (W - L - R) / n;
      const x = (i) => (hasBars ? L + band * i + band / 2 : L + (W - L - R) * (n === 1 ? .5 : i / (n - 1)));
      const smooth = (pts) => pts.reduce((d, [px, py], i, a) => { if (!i) return `M${px},${py}`; const [qx, qy] = a[i - 1]; const cx = (qx + px) / 2; return `${d} C${cx},${qy} ${cx},${py} ${px},${py}`; }, '');
      let g = '';
      const main = ax.left ? 'left' : 'right';
      for (let v = 0; v <= ax[main].max + 1e-9; v += ax[main].step) {
        const yy = y(main, v);
        g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--grid)" stroke-dasharray="${v ? '4 6' : '0'}"/>`;
        if (ax.left) g += `<text x="${L - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${ax.left.fmt ? ax.left.fmt(v) : nf(v)}</text>`;
        if (ax.right) { const rv = v / ax[main].max * ax.right.max; g += `<text x="${W - R + 10}" y="${yy + 4}" font-size="11" fill="var(--muted)">${ax.right.fmt ? ax.right.fmt(rv) : nf(rv)}</text>`; }
      }
      cfg.labels.forEach((lb, i) => { if (W < 560 && n > 4 && i % 2) return; g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${lb}</text>`; });
      let marks = '', defs = '';
      const bars = cfg.series.filter((s) => s.type === 'bars');
      cfg.series.forEach((s, si) => {
        const side = s.axis || main, col = s.color || 'var(--c-gen)';
        if (s.type === 'bars') {
          const k = bars.indexOf(s), bw = Math.min(36, band * .62 / bars.length);
          s.values.forEach((v, i) => { const bx = x(i) - (bw * bars.length) / 2 + k * bw, by = y(side, v); marks += `<rect x="${bx + 2}" y="${by}" width="${bw - 4}" height="${Math.max(0, y(side, 0) - by)}" rx="8" fill="${col}" opacity="${s.highlight == null || s.highlight === i ? 1 : .35}"><animate attributeName="height" from="0" to="${Math.max(0, y(side, 0) - by)}" dur="${animate ? 1 : .01}s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1" keyTimes="0;1"/><animate attributeName="y" from="${y(side, 0)}" to="${by}" dur="${animate ? 1 : .01}s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1" keyTimes="0;1"/></rect>`; });
          return;
        }
        const pts = s.values.map((v, i) => [x(i), y(side, v)]);
        if (s.type === 'area') {
          defs += `<linearGradient id="g${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".38"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>`;
          marks += `<path d="${smooth(pts)} L${x(n - 1)},${y(side, 0)} L${x(0)},${y(side, 0)} Z" fill="url(#g${si})"/>`;
        }
        marks += `<path d="${smooth(pts)}" fill="none" stroke="${col}" stroke-width="2.5"/>`;
        if (s.dots) marks += pts.map(([px, py]) => `<circle cx="${px}" cy="${py}" r="4" fill="var(--surface)" stroke="${col}" stroke-width="2"/>`).join('');
      });
      el.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${cfg.label || cfg.series.map((s) => s.name).join(', ')}"><defs>${defs}<clipPath id="rv-${el.id}"><rect x="0" y="0" width="${W}" height="${H}">${animate ? `<animate attributeName="width" from="0" to="${W}" dur="1.6s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1" keyTimes="0;1"/>` : ''}</rect></clipPath></defs>${g}<g clip-path="url(#rv-${el.id})">${marks}</g><line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="3 4" opacity="0"/><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/></svg>`);
      const s = el.querySelector('svg'), hit = s.querySelector('.hit'), cross = s.querySelector('.cross');
      hit.addEventListener('mousemove', (e) => {
        const r = s.getBoundingClientRect(), px = e.clientX - r.left;
        const i = Math.max(0, Math.min(n - 1, hasBars ? Math.floor((px - L) / band) : Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1);
        tip.innerHTML = `<b>${cfg.tipTitle ? cfg.tipTitle(i) : cfg.labels[i]}</b>${cfg.series.map((sr) => `<span><i style="background:${sr.color || 'var(--c-gen)'}"></i>${sr.name}: ${sr.fmt ? sr.fmt(sr.values[i]) : nf(sr.values[i])}</span>`).join('<br>')}`;
        tip.style.left = `${x(i) > W - 260 ? x(i) - 250 : x(i) + 14}px`; tip.style.top = `${T + 10}px`; tip.classList.add('on');
      });
      hit.addEventListener('mouseleave', () => { cross.setAttribute('opacity', 0); tip.classList.remove('on'); });
    };
    if (cfg.legend !== false && !el.nextElementSibling?.classList.contains('legend')) {
      el.insertAdjacentHTML('afterend', `<div class="legend">${cfg.series.map((s) => `<span><i style="background:${s.color || 'var(--c-gen)'}"></i>${s.name}</span>`).join('')}</div>`);
    }
    draw(!reduce);
    charts.push(draw);
  };
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => charts.forEach((f) => f(false)), 150); });

  window.UI = { icon, turbine, nf, chart, role, ROLES, withRole };
})();
