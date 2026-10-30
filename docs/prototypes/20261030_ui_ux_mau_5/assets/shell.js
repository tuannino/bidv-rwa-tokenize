// BIDV RWA Tokenize Platform, bản mẫu 4: khung (thanh bên, dropdown Vai trò và Chain, đổi sáng tối) và phản hồi thao tác.
// Dùng: <body data-nav="dashboard.html" data-roles="teller,controller"><main class="canvas">...</main>, nạp logo.js rồi shell.js.
(() => {

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
  // ===== Hằng số theo app thật (nav-config.ts), giữ nguyên menu từng vai =====
  const ROLES = {
    investor: { label: 'Nhà đầu tư', code: 'NDT001', key: 'INVESTOR', home: 'portfolio.html', ini: 'NĐ' },
    seller: { label: 'Người bán', code: 'NB001', key: 'SELLER', home: 'seller.html', ini: 'NB' },
    teller: { label: 'Giao dịch viên', code: 'GDV001', key: 'TELLER', home: 'dashboard.html', ini: 'GD' },
    controller: { label: 'Kiểm soát viên', code: 'KSV001', key: 'CONTROLLER', home: 'dashboard.html', ini: 'KS' },
  };
  const PENDING = { draft: 2, approval: 2 };
  const NAV = {
    investor: [{ g: null, items: [['portfolio.html', 'Tổng quan', 'dash'], ['trade.html', 'Giao dịch token', 'cart'], ['orders.html', 'Quản lý lệnh', 'list'], ['withdraw.html', 'Rút VNDB', 'bank'], ['wallet.html', 'Kết nối ví', 'wallet'], ['account.html', 'Thông tin tài khoản', 'usercog']] }],
    seller: [{ g: null, items: [['seller.html', 'Tổng quan', 'dash'], ['seller-transactions.html', 'Danh sách giao dịch', 'receipt'], ['seller-withdraw.html', 'Tạo lệnh rút', 'bank'], ['wallet.html', 'Kết nối ví', 'wallet'], ['account.html', 'Thông tin tài khoản', 'usercog']] }],
    teller: [
      { g: 'Vận hành', items: [['dashboard.html', 'Bảng điều khiển', 'dash'], ['draft.html', 'Lập lệnh', 'clip', 'draft'], ['transactions.html', 'Giao dịch', 'swap'], ['distribution.html', 'Chia lợi nhuận (chỉ xem)', 'trend'], ['vault.html', 'Vault thanh toán SPV', 'bank'], ['demo-payment.html', 'Nạp VNDB (trình diễn)', 'coins']] },
      { g: 'Tài khoản', items: [['account.html', 'Thông tin tài khoản', 'usercog']] },
    ],
    controller: [
      { g: 'Vận hành', items: [['dashboard.html', 'Bảng điều khiển', 'dash'], ['transactions.html', 'Giao dịch', 'swap'], ['distribution.html', 'Chia lợi nhuận', 'trend'], ['vault.html', 'Vault thanh toán SPV', 'bank']] },
      { g: 'Kiểm soát', items: [['approvals.html', 'Phê duyệt lệnh', 'shield', 'approval']] },
      { g: 'Tài khoản', items: [['account.html', 'Thông tin tài khoản', 'usercog']] },
    ],
  };
  const CHAINS = [['mock', 'Mock (không cần chain)', 'Mock'], ['hardhat-local', 'Hardhat Local', 'Hardhat Local'], ['evm', 'EVM Testnet (Sepolia)', 'Sepolia'], ['stellar', 'Stellar (Soroban), chưa dùng được', 'Stellar', true]];
  // Bản mẫu 4 chỉ dựng ba màn; các mục khác trong menu giữ nguyên vị trí nhưng chưa mở.
  const BUILT = ['dashboard.html', 'approvals.html', 'portfolio.html'];

  const root = document.documentElement, body = document.body;
  try { root.dataset.theme = localStorage.getItem('bidv-v4-theme') === 'dark' ? 'dark' : 'light'; } catch { root.dataset.theme = 'light'; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icon = (n, cls = '') => `<svg class="${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || I.info}</svg>`;
  const nf = (v, d = 0) => Number(v).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const q = new URLSearchParams(location.search);
  const allowed = (body.dataset.roles || 'teller').split(',');
  const role = allowed.includes(q.get('role')) ? q.get('role') : allowed[0];
  const withRole = (href, r = role) => `${href}?role=${r}`;
  let chain = 'mock';
  try { chain = localStorage.getItem('bidv-chain') || 'mock'; } catch {}

  // Lò xo vật lý: chỉ dùng cho phản hồi thao tác (viên nang menu, nút chuyển), không có hiệu ứng vào trang.
  const spring = (set, { k = 260, c = 28 } = {}) => {
    let x = null, v = 0, to = 0, raf = 0, last = 0;
    const tick = (t) => {
      const dt = Math.min(.032, (t - last) / 1000) || .016; last = t;
      v += (-k * (x - to) - c * v) * dt; x += v * dt;
      if (Math.abs(v) < .02 && Math.abs(x - to) < .02) { x = to; v = 0; set(x); raf = 0; return; }
      set(x); raf = requestAnimationFrame(tick);
    };
    return { to(t, jump) { to = t; if (x === null || jump || reduce) { x = t; v = 0; cancelAnimationFrame(raf); raf = 0; set(x); return; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } } };
  };
  const swapTheme = (btn) => {
    const flip = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('bidv-v4-theme', root.dataset.theme); } catch {} window.dispatchEvent(new Event('themechange')); };
    if (reduce || !document.startViewTransition) { flip(); return; }
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('vt-theme');
    const t = document.startViewTransition(flip);
    t.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] }, { duration: 600, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
    t.finished.finally(() => root.classList.remove('vt-theme'));
  };

  // ===== Dựng khung =====
  const canvas = document.querySelector('main.canvas');
  // Favicon theo logo C (chủ dự án chốt 30/10/2026): ở cỡ 16 đến 32 px chữ không đọc được nên chỉ giữ bông mai trên nền xanh ngọc.
  { const L = window.BIDV.LOGO, m = L.mark, pad = m[3] * .16, ico = document.createElement('link');
    ico.rel = 'icon'; ico.type = 'image/svg+xml';
    ico.href = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m[0] - pad} ${m[1] - pad} ${m[2] + pad * 2} ${m[3] + pad * 2}"><rect x="${m[0] - pad}" y="${m[1] - pad}" width="${m[2] + pad * 2}" height="${m[3] + pad * 2}" rx="${m[3] * .26}" fill="#016b69"/><path fill="#fec629" fill-rule="evenodd" d="${L.flower}"/></svg>`);
    document.head.appendChild(ico); }
  const logo = (h = 26) => window.BIDV.logo({ word: 'var(--bidv-word, #016b69)', height: h });
  const navHtml = NAV[role].map((grp) => `${grp.g ? `<div class="grp">${grp.g}</div>` : ''}${grp.items.map(([href, label, ic, pend]) => {
    const on = body.dataset.nav === href, built = BUILT.includes(href), c = pend ? PENDING[pend] : null;
    return `<a href="${built ? withRole(href) : '#'}"${on ? ' aria-current="page"' : ''}${built ? '' : ' aria-disabled="true" title="Bản mẫu 4 chưa dựng màn này"'}>${icon(ic)}<span>${label}</span>${c ? `<span class="cnt" aria-label="${c} yêu cầu đang chờ">${c}</span>` : ''}</a>`;
  }).join('')}`).join('');
  const ch = () => CHAINS.find(([v]) => v === chain) || CHAINS[0];
  const app = document.createElement('div');
  app.className = 'app';
  app.innerHTML = `
    <aside class="sidebar" id="sb" aria-label="Điều hướng">
      <button class="btn ghost icon close" type="button" id="sb-close" aria-label="Đóng menu">${icon('x')}</button>
      <a class="brand" href="index.html" aria-label="BIDV RWA Tokenize Platform, về bảng duyệt bản mẫu">${logo(26)}<span class="prod"><b>RWA</b>Tokenize Platform</span></a>
      <div class="switch" data-switch="role">
        <button class="switch-btn" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="av">${ROLES[role].ini}</span><span class="tx"><small>Vai trò, ${ROLES[role].code}</small><b>${ROLES[role].label}</b></span>${icon('chev', 'chev')}</button>
        <ul class="menu" role="listbox" aria-label="Vai trò">${Object.entries(ROLES).map(([k, r]) => `<li role="option" tabindex="-1" data-v="${k}" aria-selected="${k === role}"><span><span>${r.label}</span><small>${r.code}</small></span>${icon('check', 'ok')}</li>`).join('')}</ul>
      </div>
      <nav class="nav" id="nav"><span class="pill-act" aria-hidden="true"></span><span class="pill-hov" aria-hidden="true"></span>${navHtml}</nav>
      <div class="side-foot">
        <div class="switch up net" data-switch="chain">
          <button class="switch-btn" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="dot" aria-hidden="true"></span><span class="tx"><small>Chain</small><b id="chain-v" title="${ch()[1]}">${ch()[2]}</b></span>${icon('chev', 'chev')}</button>
          <ul class="menu" role="listbox" aria-label="Chain">${CHAINS.map(([v, l, , dis]) => `<li role="option" tabindex="-1" data-v="${v}" aria-selected="${v === chain}"${dis ? ' aria-disabled="true"' : ''}><span>${l}</span>${icon('check', 'ok')}</li>`).join('')}</ul>
        </div>
        <div class="foot-row">
          <button class="btn" type="button">${icon('wallet')}Kết nối ví</button>
          <button class="btn icon" type="button" id="theme" aria-label="Đổi giao diện sáng tối">${icon('moon')}</button>
        </div>
      </div>
    </aside>
    <div class="work">
      <div class="mbar"><button class="btn ghost icon" type="button" id="menu-open" aria-label="Mở menu" aria-controls="sb">${icon('menu')}</button><span class="mlogo">${window.BIDV.logo({ word: 'var(--bidv-word, #016b69)', height: 16 })}<small><b>RWA</b> Tokenize Platform</small></span><span class="t">${document.title}</span></div>
    </div>`;
  canvas.replaceWith(app);
  app.querySelector('.work').appendChild(canvas);
  if (root.dataset.theme === 'dark') root.style.setProperty('--bidv-word', '#ffffff');
  const syncWord = () => root.style.setProperty('--bidv-word', root.dataset.theme === 'dark' ? '#ffffff' : '#016b69');
  syncWord(); addEventListener('themechange', syncWord);

  // Dropdown Vai trò và Chain: vẫn là dropdown như app thật, danh sách xổ trong khung, có phím mũi tên.
  const closeAll = (except) => document.querySelectorAll('.switch.open').forEach((s) => { if (s !== except) { s.classList.remove('open'); s.querySelector('.switch-btn').setAttribute('aria-expanded', 'false'); } });
  document.querySelectorAll('.switch').forEach((sw) => {
    const btn = sw.querySelector('.switch-btn'), opts = [...sw.querySelectorAll('[role=option]')];
    const open = (o) => { closeAll(sw); sw.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); if (o) (opts.find((x) => x.getAttribute('aria-selected') === 'true') || opts[0]).focus(); };
    const pick = (li) => {
      if (!li || li.getAttribute('aria-disabled') === 'true') return;
      opts.forEach((x) => x.setAttribute('aria-selected', String(x === li))); open(false); btn.focus();
      if (sw.dataset.switch === 'role') { if (li.dataset.v !== role) location.href = withRole(ROLES[li.dataset.v].home === 'seller.html' ? 'index.html' : ROLES[li.dataset.v].home, li.dataset.v); }
      else { chain = li.dataset.v; try { localStorage.setItem('bidv-chain', chain); } catch {} document.getElementById('chain-v').textContent = ch()[2]; document.getElementById('chain-v').title = ch()[1]; document.querySelectorAll('[data-chain-label]').forEach((n) => { n.textContent = chain; }); }
    };
    btn.addEventListener('click', () => open(!sw.classList.contains('open')));
    btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); open(true); } });
    sw.querySelector('.menu').addEventListener('click', (e) => pick(e.target.closest('[role=option]')));
    sw.querySelector('.menu').addEventListener('keydown', (e) => {
      const i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(document.activeElement); }
      else if (e.key === 'Escape' || e.key === 'Tab') { open(false); btn.focus(); }
    });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.switch')) closeAll(); });
  document.querySelectorAll('[data-chain-label]').forEach((n) => { n.textContent = chain; });
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href="#"]'); if (a) e.preventDefault(); });

  // Viên nang menu: nền xám trung tính (không tô màu thương hiệu), trượt bằng lò xo khi rê chuột.
  const nav = document.getElementById('nav'), pa = nav.querySelector('.pill-act'), ph = nav.querySelector('.pill-hov');
  // Viên nang kéo giãn theo vận tốc như giọt nước (bản 3), lướt nhanh qua nhiều mục vẫn liền một dải.
  const pill = (g, k = 230, c = 24) => { let y = 0, h = 0, py = null, vy = 0; const paint = () => { const st = Math.min(14, vy / 70); g.style.transform = `translateY(${y - st / 2}px)`; g.style.height = `${h + st}px`; }; const sy = spring((v) => { vy = py == null ? 0 : Math.abs(v - py) * 60; py = v; y = v; paint(); }, { k, c }), sh = spring((v) => { h = v; paint(); }, { k, c: c + 4 }); return (a, jump) => { if (!a) { g.style.opacity = 0; return; } g.style.opacity = 1; sy.to(a.offsetTop, jump); sh.to(a.offsetHeight, jump); }; };
  const placeA = pill(pa), placeH = pill(ph, 320, 28), cur = nav.querySelector('a[aria-current]');
  placeA(cur, true); document.fonts?.ready.then(() => placeA(cur, true));
  let hovOn = false;
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('mouseenter', () => { if (a === cur) { ph.style.opacity = 0; hovOn = false; return; } placeH(a, !hovOn); hovOn = true; }));
  nav.addEventListener('mouseleave', () => { ph.style.opacity = 0; hovOn = false; });

  document.getElementById('theme').addEventListener('click', (e) => swapTheme(e.currentTarget));
  document.getElementById('menu-open').addEventListener('click', () => body.classList.add('menu-open'));
  document.getElementById('sb-close').addEventListener('click', () => body.classList.remove('menu-open'));

  // Nút chuyển có viên nang trắng trượt theo lò xo.
  const segs = () => document.querySelectorAll('.seg').forEach((g) => {
    if (g._ind) return;
    const ind = document.createElement('span'); ind.className = 'ind'; ind.setAttribute('aria-hidden', 'true'); g.prepend(ind); g._ind = ind;
    const st = { x: 0, w: 0, h: 0, y: 0 }, paint = () => { ind.style.transform = `translate(${st.x}px, ${st.y}px)`; ind.style.width = `${st.w}px`; ind.style.height = `${st.h}px`; };
    const sp = Object.fromEntries(['x', 'w', 'h', 'y'].map((k) => [k, spring((v) => { st[k] = v; paint(); })]));
    let first = true;
    const sync = () => { const b = g.querySelector('button[aria-pressed="true"]'); if (!b || !b.offsetWidth) return; ['x', 'w', 'h', 'y'].forEach((k) => sp[k].to({ x: b.offsetLeft, w: b.offsetWidth, h: b.offsetHeight, y: b.offsetTop }[k], first)); first = false; };
    g.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); sync(); });
    new ResizeObserver(() => { first = true; sync(); }).observe(g);
    sync(); document.fonts?.ready.then(() => { first = true; sync(); });
  });
  segs();

  window.V4 = { icon, nf, role, withRole, ROLES, spring, reduce };
})();
