// Khung dùng chung: biểu tượng, sidebar theo vai, đổi giao diện sáng/tối, menu điện thoại.
(() => {
  // Giao diện: Light mặc định, Dark là lựa chọn thứ hai, nhớ theo trình duyệt.
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('bidv-theme'); } catch {}
  if (saved === 'dark') root.dataset.theme = 'dark';

  const I = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    updown: '<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;
  window.icon = icon;

  const LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#1a6b3c"/><circle cx="20" cy="20" r="15" fill="none" stroke="#b8860b" stroke-width="1.5"/><path d="M13 12h7.5c2.5 0 4 1.2 4 3.2 0 1.4-.8 2.4-2 2.9 1.6.4 2.6 1.6 2.6 3.2C25.1 23.8 23.4 25 20.5 25H13V12zm3 5.2h3.8c1.1 0 1.8-.5 1.8-1.5s-.7-1.5-1.8-1.5H16v3zm0 5.6h4.2c1.2 0 2-.6 2-1.6s-.8-1.6-2-1.6H16v3.2z" fill="#fff"/><rect x="10" y="31" width="20" height="2.5" rx="1.25" fill="#b8860b"/></svg>';
  const brand = `<a class="brand" href="index.html">${LOGO}<div><b>BIDV RWA</b><span>Điện gió An Viên</span></div></a>`;

  const D = window.DATA;
  const ROLES = {
    controller: {
      who: 'Kiểm soát viên', code: 'KSV001', person: 'Phạm Thu Hà', initials: 'PH', tint: '',
      groups: [
        { label: null, items: [
          { href: 'index.html', page: 'dashboard', label: 'Bảng điều khiển', icon: 'dashboard' },
          { href: 'approvals.html', page: 'approvals', label: 'Phê duyệt lệnh', icon: 'shield', count: D.pending.length },
          { label: 'Giao dịch', icon: 'swap' },
          { label: 'Chia lợi nhuận', icon: 'trend' },
          { label: 'Vault thanh toán SPV', icon: 'banknote' },
        ] },
        { label: 'Tài khoản', items: [{ label: 'Thông tin tài khoản', icon: 'user' }] },
      ],
    },
    investor: {
      who: 'Nhà đầu tư', code: 'NDT001', person: D.investor.name, initials: 'TK', tint: 'b',
      groups: [
        { label: null, items: [
          { href: 'portfolio.html', page: 'portfolio', label: 'Tài sản', icon: 'dashboard' },
          { label: 'Mua bán WPT', icon: 'cart' },
          { label: 'Lệnh của tôi', icon: 'list' },
          { label: 'Rút VNDB', icon: 'banknote' },
        ] },
        { label: 'Tài khoản', items: [{ label: 'Ví và thông tin tài khoản', icon: 'wallet' }] },
      ],
    },
  };

  const body = document.body, role = ROLES[body.dataset.role], page = body.dataset.page;
  const nav = role.groups.map((g) => `${g.label ? `<div class="group-label">${g.label}</div>` : ''}${g.items.map((it) => it.href
    ? `<a class="nav-item" href="${it.href}"${it.page === page ? ' aria-current="page"' : ''}>${icon(it.icon)}<span>${it.label}</span>${it.count ? `<span class="count" aria-label="${it.count} yêu cầu chờ duyệt">${it.count}</span>` : ''}</a>`
    : `<a class="nav-item" href="#" title="Ngoài phạm vi bản thử nghiệm" aria-disabled="true">${icon(it.icon)}<span>${it.label}</span></a>`).join('')}`).join('');
  const other = body.dataset.role === 'controller' ? { href: 'portfolio.html', label: 'Xem như Nhà đầu tư NDT001' } : { href: 'index.html', label: 'Xem như Kiểm soát viên KSV001' };

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';
  sidebar.setAttribute('aria-label', 'Điều hướng');
  sidebar.innerHTML = `
    <button class="close" type="button" aria-label="Đóng menu">${icon('x')}</button>
    ${brand}
    <div class="scope">
      <a href="${other.href}" title="${other.label}"><div><small>Vai trò</small><strong>${role.who} ${role.code}</strong></div>${icon('updown').replace('<svg', '<svg class="chev"')}</a>
      <button type="button" title="Đổi chain"><div><small>Chain</small><strong>${D.token.chain} (EVM testnet)</strong></div><span class="dot" aria-hidden="true"></span></button>
    </div>
    <nav>${nav}</nav>
    <div class="bottom">
      <button class="theme-btn" type="button" data-theme-toggle></button>
      <div class="user"><span class="avatar ${role.tint}">${role.initials}</span><div>${role.person}<small>${role.who}</small></div></div>
    </div>`;
  const appEl = document.querySelector('.app');
  appEl.prepend(sidebar);

  const bar = document.createElement('div');
  bar.className = 'phonebar';
  bar.innerHTML = `${brand}<button class="menu-toggle" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Mở menu">${icon('menu')}</button>`;
  appEl.before(bar);
  const toggle = bar.querySelector('.menu-toggle');
  const setOpen = (open) => { sidebar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setOpen(true));
  sidebar.querySelector('.close').addEventListener('click', () => setOpen(false));
  sidebar.querySelectorAll('[aria-disabled="true"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

  const themeBtn = sidebar.querySelector('[data-theme-toggle]');
  const paintTheme = () => { const dark = root.dataset.theme === 'dark'; themeBtn.innerHTML = `${icon(dark ? 'sun' : 'moon')}<span>${dark ? 'Giao diện sáng' : 'Giao diện tối'}</span>`; };
  themeBtn.addEventListener('click', () => {
    if (root.dataset.theme === 'dark') delete root.dataset.theme; else root.dataset.theme = 'dark';
    try { localStorage.setItem('bidv-theme', root.dataset.theme || 'light'); } catch {}
    paintTheme();
    window.dispatchEvent(new Event('resize')); // vẽ lại biểu đồ theo màu mới
  });
  paintTheme();
})();
