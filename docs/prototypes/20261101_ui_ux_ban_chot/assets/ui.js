// BIDV RWA, bản chốt. Phần nội dung: biểu tượng, nền, hiệu ứng, minh hoạ và biểu đồ.
// Thanh bên và thanh đầu do assets/shell.js dựng (nạp trước tệp này). Không có chức năng thật: mọi nút chỉ để xem.
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
  if (!window.V4) root.dataset.theme = saved === 'dark' ? 'dark' : 'light';


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
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    badgecheck: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    snow: '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    play: '<path d="M6 3l14 9-14 9V3z"/>',
    tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42Z"/><circle cx="7.5" cy="7.5" r=".5"/>',
    vault: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1M8 12h1M15 12h1"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  };
  // pathLength="1" cho mọi nét để hiệu ứng "vẽ lại nét" khi rê chuột dùng chung một độ dài.
  const icon = (n, cls = '') => `<svg class="${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(I[n] || I.info).replace(/<(path|line|circle|polyline|polygon|rect|ellipse)\b/g, '<$1 pathLength="1"')}</svg>`;
  const turbine = (color = 'currentColor', speed = '') => `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="19" y="18" width="2" height="20" rx="1" fill="${color}" opacity=".7"/><g class="blades ${speed}"><path d="M20 18 L19 4 L21 18Z M20 18 L32 25 L19.4 19Z M20 18 L8 25 L20.6 19Z" fill="${color}"/><circle cx="20" cy="18" r="2.4" fill="#e0b44a"/></g></svg>`;
  const nf = (v, d = 0) => Number(v).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Lò xo vật lý: khi đích đổi giữa chừng vẫn giữ vận tốc đang có, nên chuyển động liền mạch, không giật.
  // k: độ cứng, c: lực cản. k cao thì nhanh, c thấp thì nảy nhiều hơn.
  const spring = (set, { k = 180, c = 24 } = {}) => {
    let x = null, v = 0, to = 0, raf = 0, last = 0;
    const tick = (t) => {
      const dt = Math.min(.032, (t - last) / 1000) || .016; last = t;
      v += (-k * (x - to) - c * v) * dt; x += v * dt;
      if (Math.abs(v) < .02 && Math.abs(x - to) < .02) { x = to; v = 0; set(x, 0); raf = 0; return; }
      set(x, v); raf = requestAnimationFrame(tick);
    };
    return {
      to(t, jump) { to = t; if (x === null || jump || reduce) { x = t; v = 0; cancelAnimationFrame(raf); raf = 0; set(x, 0); return; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } },
      get v() { return v; },
    };
  };
  // Đổi sáng tối: một vòng tròn lan ra từ chính nút bấm (View Transitions), trình duyệt cũ thì đổi ngay.
  const swapTheme = (btn, after) => {
    const flip = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('bidv-theme', root.dataset.theme); } catch {} after?.(); };
    if (reduce || !document.startViewTransition || !btn) { flip(); return; }
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('vt-theme');
    const t = document.startViewTransition(flip);
    t.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] }, { duration: 800, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
    t.finished.finally(() => root.classList.remove('vt-theme'));
  };


  // ===== Minh hoạ SVG tự vẽ (tạm thay ảnh thật, chủ dự án sẽ thay) =====
  // Cánh đồng gió ven biển: đồi, biển, mặt trời, hàng tua-bin quay ở nhiều độ xa, luồng gió chạy.
  const scene = ({ tone = 'onDark', turbines = 7, sun = true, sea = true, wind = true } = {}) => {
    const ink = tone === 'onDark' ? '#ffffff' : 'var(--g600)';
    const T = [];
    const seed = [[.08, .78, .34, .45], [.2, .7, .5, .6], [.34, .76, .4, .5], [.5, .66, .62, .8], [.63, .74, .44, .55], [.76, .64, .7, .9], [.9, .72, .5, .65], [.43, .8, .3, .38], [.97, .78, .36, .45]].slice(0, turbines);
    seed.forEach(([x, by, h, op], i) => {
      const X = x * 800, B = by * 300, H = h * 300, R = H * .42, s = [7, 5.5, 9, 4.6, 6.4, 3.8, 5, 8, 6.8][i];
      T.push(`<g opacity="${op}"><path d="M${X - 2.2} ${B} L${X - .9} ${B - H} L${X + .9} ${B - H} L${X + 2.2} ${B}Z" fill="${ink}"/><g style="transform-origin:${X}px ${B - H}px;animation:spin ${s}s linear infinite ${-i}s"><path d="M${X} ${B - H} L${X - 2} ${B - H - R} L${X + 2.4} ${B - H - R * .92}Z" fill="${ink}"/><path d="M${X} ${B - H} L${X + R * .86} ${B - H + R * .5} L${X + R * .78} ${B - H + R * .56 + 3}Z" fill="${ink}"/><path d="M${X} ${B - H} L${X - R * .86} ${B - H + R * .5} L${X - R * .8} ${B - H + R * .46 - 3}Z" fill="${ink}"/></g><circle cx="${X}" cy="${B - H}" r="3" fill="#e0b44a"/></g>`);
    });
    const streaks = wind ? [60, 110, 150, 205].map((y, i) => `<path class="streak" style="animation-delay:${-i * 1.7}s" d="M-40 ${y} C 160 ${y - 26}, 320 ${y + 22}, 520 ${y - 6} S 760 ${y - 24}, 860 ${y}" fill="none" stroke="${tone === 'onDark' ? 'rgba(255,255,255,.45)' : 'rgba(23, 110, 109, .35)'}" stroke-width="1.4" stroke-linecap="round"/>`).join('') : '';
    return `<svg class="scene" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      ${sun ? `<circle cx="660" cy="86" r="70" fill="#e0b44a" opacity=".16"/><circle cx="660" cy="86" r="34" fill="#efd28a" opacity=".55"/>` : ''}
      <path d="M0 230 C 120 190, 230 214, 340 196 S 560 176, 660 198 S 760 214, 800 204 V300 H0Z" fill="${ink}" opacity="${tone === 'onDark' ? .08 : .06}"/>
      ${T.join('')}
      <path d="M0 252 C 140 232, 260 250, 400 238 S 650 222, 800 242 V300 H0Z" fill="${ink}" opacity="${tone === 'onDark' ? .12 : .08}"/>
      ${sea ? `<g class="sea" opacity="${tone === 'onDark' ? .35 : .25}"><path d="M30 276 h90 M170 284 h120 M360 278 h70 M480 288 h110 M640 280 h90" stroke="${ink}" stroke-width="2" stroke-linecap="round"/></g>` : ''}
      ${streaks}
    </svg>`;
  };
  // Cột đồng xu VNDB: đồng xu rơi lần lượt, đồng trên cùng có chữ V.
  const coins = (n = 5) => {
    let g = '';
    for (let i = 0; i < n; i++) {
      const y = 150 - i * 15;
      g += `<g class="coin" style="animation-delay:${.15 + i * .12}s"><ellipse cx="80" cy="${y + 6}" rx="46" ry="14" fill="#8a6406"/><rect x="34" y="${y - 6}" width="92" height="12" fill="#b07f0b"/><ellipse cx="80" cy="${y - 6}" rx="46" ry="14" fill="url(#cg)"/><ellipse cx="80" cy="${y - 6}" rx="34" ry="9.5" fill="none" stroke="#fff3c9" stroke-opacity=".55" stroke-width="1.5"/></g>`;
    }
    const top = 150 - (n - 1) * 15 - 6;
    return `<svg class="coins" viewBox="0 0 160 190" aria-hidden="true"><defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="#f5d27a"/><stop offset=".55" stop-color="#e0b44a"/><stop offset="1" stop-color="#c9971c"/></linearGradient></defs>${g}<text class="coin" style="animation-delay:${.15 + (n - 1) * .12}s" x="80" y="${top + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="#6e4b00" font-family="Roboto, sans-serif">VNDB</text><g class="spark"><path d="M128 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#fff6d6"/><path d="M28 70 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fff6d6"/></g></svg>`;
  };
  // Huy hiệu token WPT: lục giác xanh có tua-bin.
  const emblem = () => `<svg class="emblem" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#37a7a5"/><stop offset="1" stop-color="#0d4f4e"/></linearGradient></defs><path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="url(#eg)"/><path d="M32 7.5 53 19.7v24.6L32 56.5 11 44.3V19.7Z" fill="none" stroke="#e0b44a" stroke-opacity=".7"/><rect x="31" y="30" width="2" height="18" rx="1" fill="#fff" opacity=".8"/><g style="transform-origin:32px 30px;animation:spin 5s linear infinite"><path d="M32 30 31 14 33 30Z M32 30 46 38 31.5 31Z M32 30 18 38 32.5 31Z" fill="#fff"/></g><circle cx="32" cy="30" r="2.6" fill="#e0b44a"/></svg>`;

  // ===== Vai và menu: đúng nav-config.ts =====
  const ROLES = {
    investor: { label: 'Nhà đầu tư', code: 'NDT001', key: 'INVESTOR', home: 'portfolio.html', mood: 'view' },
    seller: { label: 'Người bán', code: 'NB001', key: 'SELLER', home: 'seller.html', mood: 'plant' },
    teller: { label: 'Giao dịch viên', code: 'GDV001', key: 'TELLER', home: 'dashboard.html', mood: 'control' },
    controller: { label: 'Kiểm soát viên', code: 'KSV001', key: 'CONTROLLER', home: 'dashboard.html', mood: 'control' },
  };

  const body = document.body;
  const allowed = (body.dataset.roles || 'teller').split(',');
  const q = new URLSearchParams(location.search);
  const role = allowed.includes(q.get('role')) ? q.get('role') : allowed[0];
  body.dataset.mood = ROLES[role].mood;
  let chain = 'mock';
  try { chain = localStorage.getItem('bidv-chain') || 'mock'; } catch {}
  const withRole = (href, r = role) => `${href}?role=${r}`;

  // Favicon cho trang không có khung (trang giới thiệu); trang có khung lấy favicon từ shell.js.
  const markTile = (sz) => { const m = window.BIDV.LOGO.mark, pad = m[3] * .16; return `<svg viewBox="${m[0] - pad} ${m[1] - pad} ${m[2] + pad * 2} ${m[3] + pad * 2}" width="${sz}" height="${sz}" aria-hidden="true"><rect x="${m[0] - pad}" y="${m[1] - pad}" width="${m[2] + pad * 2}" height="${m[3] + pad * 2}" rx="${m[3] * .26}" fill="#016b69"/><path fill="#fec629" fill-rule="evenodd" d="${window.BIDV.LOGO.flower}"/></svg>`; };
  if (!window.V4) { const ico = document.createElement('link'); ico.rel = 'icon'; ico.type = 'image/svg+xml'; ico.href = 'data:image/svg+xml,' + encodeURIComponent(markTile(64).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); document.head.appendChild(ico); }

  // Nền chung: quầng sáng lục vàng trôi chậm và đường gió mảnh.
  const bg = document.createElement('div');
  bg.className = 'bgfx';
  bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = '<i></i><i></i><i></i><svg viewBox="0 0 1440 900" preserveAspectRatio="none"><path d="M-60 180 C 260 120, 520 240, 820 170 S 1300 110, 1500 190"/><path d="M-60 420 C 300 360, 600 480, 900 410 S 1320 350, 1500 430"/><path d="M-60 700 C 280 640, 560 760, 880 690 S 1300 630, 1500 710"/></svg>';
  body.prepend(bg);

  const content = document.querySelector('main.content');

  // Liên kết nội bộ giữ vai đang xem.
  document.querySelectorAll('a[data-go]').forEach((a) => { a.href = withRole(a.dataset.go); });
  // Nút và liên kết không có chức năng: chặn để không nhảy trang.
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href="#"]'); if (a) e.preventDefault(); });
  document.querySelectorAll('form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));

  // ===== Thay biểu tượng, tua-bin, minh hoạ khai báo trong HTML =====
  document.querySelectorAll('[data-icon]').forEach((n) => { n.outerHTML = icon(n.dataset.icon, n.className); });
  document.querySelectorAll('[data-turbine]').forEach((n) => { n.innerHTML = turbine(n.dataset.turbine || 'currentColor', n.dataset.speed || ''); });
  document.querySelectorAll('[data-scene]').forEach((n) => { n.innerHTML = scene({ tone: n.dataset.scene || 'onDark', turbines: +(n.dataset.turbines || 7), sun: n.dataset.sun !== 'no', sea: n.dataset.sea !== 'no' }); });
  document.querySelectorAll('[data-coins]').forEach((n) => { n.innerHTML = coins(+(n.dataset.coins || 5)); });
  document.querySelectorAll('[data-emblem]').forEach((n) => { n.innerHTML = emblem(); });
  document.querySelectorAll('.gauge[data-value]').forEach((g) => {
    const C = 2 * Math.PI * 34, v = +g.dataset.value;
    g.setAttribute('role', 'img'); g.setAttribute('aria-label', `${g.dataset.label || ''} ${nf(v, 1)}%`);
    g.innerHTML = `<svg viewBox="0 0 80 80"><circle class="trk" cx="40" cy="40" r="34"/><circle class="arc" cx="40" cy="40" r="34" stroke="${g.dataset.color || 'var(--p1)'}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - Math.min(100, v) / 100)}"/></svg><span class="t">${nf(v, 1)}%${g.dataset.label ? `<small>${g.dataset.label}</small>` : ''}</span>`;
  });
  document.querySelectorAll('[data-copy]').forEach((b) => {
    if (!b.innerHTML.trim()) b.innerHTML = icon('copy');
    b.classList.add('copy'); b.setAttribute('aria-label', 'Chép');
    b.insertAdjacentHTML('beforeend', `${icon('check', 'ok')}<span class="bub" role="status">Đã chép</span>`);
    b.addEventListener('click', () => { navigator.clipboard?.writeText(b.dataset.copy).catch(() => {}); b.classList.add('done'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('done'), 1500); });
  });
  // Font thương hiệu Roboto: số tiền, số lượng, ngày giờ dùng Roboto với chữ số đều cột (tabular-nums);
  // chỉ địa chỉ ví, mã băm, UUID và mã kỹ thuật dạng "a:b" mới dùng Roboto Mono để dễ dò từng ký tự.
  const CODE = /0x[0-9a-f]|^[0-9a-f]{8}(-|$)|^[a-z]+:[a-z0-9]/i;
  const tagMono = () => document.querySelectorAll('.mono').forEach((m) => m.classList.toggle('code', CODE.test(m.textContent.trim())));
  tagMono();
  let monoRaf = 0;
  new MutationObserver(() => { if (!monoRaf) monoRaf = requestAnimationFrame(() => { monoRaf = 0; tagMono(); }); }).observe(body, { subtree: true, childList: true, characterData: true });
  // Biểu tượng 3D cạnh tiêu đề trang (Fluent Emoji 3D, MIT, tạm để thử; thay bằng bộ chính thức sau).
  const P3D = { config: 'coin', recall: 'outbox', 'wallet-binding': 'id', dashboard: 'leaf', draft: 'memo', transactions: 'ledger', 'transaction-detail': 'receipt', distribution: 'moneybag', vault: 'classic', 'demo-payment': 'banknote', account: 'id', approvals: 'scales', 'approval-detail': 'check', portfolio: 'bars', 'token-detail': 'coin', trade: 'chart', orders: 'clipboard', 'order-detail': 'receipt', withdraw: 'outbox', wallet: 'card', seller: 'office', 'seller-transactions': 'ledger', 'seller-withdraw': 'flymoney' };
  const ph = document.querySelector('.pagehead > div:first-child'), p3 = P3D[body.dataset.page];
  if (ph && p3) { ph.classList.add('has3d'); ph.insertAdjacentHTML('afterbegin', `<span class="p3d" aria-hidden="true"><img src="assets/3d/${p3}.webp" alt="" width="56" height="56"></span>`); }
  document.querySelectorAll('img[data-3d]').forEach((m) => { m.src = `assets/3d/${m.dataset['3d']}.webp`; m.alt = ''; m.width = m.height = 64; });
  // Trang giới thiệu: cuộn mượt có quán tính (Lenis, MIT). Trang nghiệp vụ giữ cuộn gốc để thao tác bảng nhanh, chính xác.
  if (body.classList.contains('lp') && window.Lenis && !reduce) {
    const lenis = new window.Lenis({ lerp: .09, wheelMultiplier: .9, anchors: { offset: -80 } });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  }
  // Nhóm nút chuyển (Mua và Bán, tab): chỉ đổi trạng thái hiển thị.
  document.querySelectorAll('.seg, .tabs').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !g.contains(b)) return;
    const attr = g.classList.contains('tabs') ? 'aria-selected' : 'aria-pressed';
    g.querySelectorAll('button').forEach((x) => x.setAttribute(attr, String(x === b)));
    if (b.dataset.show) { document.querySelectorAll(`[data-panel-group="${g.dataset.group}"]`).forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.show; reveal(p, 0); }); }
  }));

  // Viên nang chỉ mục đang chọn trượt theo lò xo (như "animated background" của Motion Primitives).
  // Theo dõi thuộc tính aria nên các trang tự đổi trạng thái bằng script riêng cũng chạy đúng.
  document.querySelectorAll('.seg, .tabs').forEach((g) => {
    if (!g.querySelector('button')) return;
    const ind = document.createElement('span'); ind.className = 'ind'; ind.setAttribute('aria-hidden', 'true'); g.prepend(ind); g.classList.add('has-ind');
    const st = { x: 0, y: 0, w: 0, h: 0 }, paint = () => { ind.style.transform = `translate(${st.x}px, ${st.y}px)`; ind.style.width = `${st.w}px`; ind.style.height = `${st.h}px`; };
    const sp = Object.fromEntries(['x', 'y', 'w', 'h'].map((k) => [k, spring((v) => { st[k] = v; paint(); }, { k: 260, c: 26 })]));
    let first = true;
    const sync = () => {
      const b = g.querySelector('button[aria-selected="true"], button[aria-pressed="true"]');
      if (!b || !b.offsetWidth) { ind.style.opacity = 0; return; }
      ind.style.opacity = 1;
      sp.x.to(b.offsetLeft, first); sp.y.to(b.offsetTop, first); sp.w.to(b.offsetWidth, first); sp.h.to(b.offsetHeight, first); first = false;
    };
    new MutationObserver(sync).observe(g, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed'] });
    new ResizeObserver(() => { first = true; sync(); }).observe(g);
    sync();
  });

  // Video giới thiệu: mở trình phát trong hộp nổi.
  const canEmbed = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  document.querySelectorAll('[data-video]').forEach((b) => b.addEventListener('click', () => {
    if (!canEmbed) { window.open(`https://www.youtube.com/watch?v=${b.dataset.video}`, '_blank', 'noopener'); return; }
    const d = document.createElement('div');
    d.className = 'vmodal';
    d.innerHTML = `<div class="vbox" role="dialog" aria-label="Video giới thiệu"><button class="iconbtn vclose" type="button" aria-label="Đóng">${icon('x')}</button><div class="vframe"><iframe src="https://www.youtube-nocookie.com/embed/${b.dataset.video}?autoplay=1&rel=0&modestbranding=1" title="Video giới thiệu dự án điện gió" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div><div class="vfoot"><span>Video tạm để thử giao diện, sẽ thay bằng video chính thức.</span><a href="https://www.youtube.com/watch?v=${b.dataset.video}" target="_blank" rel="noopener">Không xem được? Mở trên YouTube</a></div></div>`;
    const close = () => { d.classList.add('out'); setTimeout(() => d.remove(), 300); };
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.vclose')) close(); });
    addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc); } });
    body.appendChild(d);
  }));

  // ===== Biên đạo chuyển động "theo hướng gió" =====
  // Mỗi loại khối có kiểu vào riêng; khối chỉ chạy khi cuộn tới; trong cùng một đợt, khối bên trái
  // và phía trên tới trước như một cơn gió lướt qua hàng tua-bin; hàng trong bảng, danh sách đi sau khối.
  const kindOf = (n) => (n.dataset.reveal ? n.dataset.reveal : n.matches('.pagehead') ? 'title'
    : n.matches('.kpi.hl, .kpi.au, .card.hero') ? 'unveil'
    : n.matches('.kpi') ? 'gust'
    : n.matches('.alert') ? 'slide'
    : 'lift');
  const DIG = [...'01234567890123456789'].map((n) => `<span>${n}</span>`).join('');
  const countUp = (el) => {
    const s = nf(+el.dataset.count, +(el.dataset.d || 0));
    if (reduce) { el.textContent = s; return; }
    el.classList.add('odo'); el.setAttribute('aria-label', s); el.setAttribute('role', 'text');
    el.innerHTML = [...s].map((ch) => (/\d/.test(ch) ? `<span class="od" aria-hidden="true"><span class="og">${ch}</span><span class="os">${DIG}</span></span>` : `<span class="oc" aria-hidden="true">${ch}</span>`)).join('');
    const cols = [...el.querySelectorAll('.os')], digits = s.replace(/\D/g, '');
    requestAnimationFrame(() => requestAnimationFrame(() => cols.forEach((c, i) => {
      c.style.transitionDelay = `${(cols.length - 1 - i) * 70}ms`;
      c.style.transform = `translateY(${-(10 + +digits[i]) * 5}%)`;
    })));
  };
  const fill = (scope) => {
    scope.querySelectorAll('.bar i[data-w]').forEach((b) => { b.style.width = `${b.dataset.w}%`; });
    scope.querySelectorAll('.gauge .arc').forEach((a) => { a.style.strokeDashoffset = a.dataset.off; });
    scope.querySelectorAll('[data-count]').forEach((c) => { if (!c._done) { c._done = 1; countUp(c); } });
    scope.querySelectorAll('.chart').forEach((c) => c._go?.());
  };
  const splitWords = (h) => {
    if (h._split) return; h._split = 1; let i = 0;
    const walk = (n) => [...n.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const f = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) { f.append(w); return; } const sp = document.createElement('span'); sp.className = 'w'; sp.style.setProperty('--wi', i++); sp.textContent = w; f.append(sp); });
        c.replaceWith(f);
      } else if (c.nodeType === 1) walk(c);
    });
    walk(h);
  };
  if (!reduce) document.querySelectorAll('.pagehead h1, .hero h1, .blk h2.t, .cta h2').forEach(splitWords);
  const KIDS = '.tbl tbody tr, .kv > div, .list > *, .checks li, .timeline li, .steps li, .kv-grid > div';
  function reveal(n, delay) {
    if (n._shown) return; n._shown = 1;
    if (reduce) { n.classList.remove('pre'); fill(n); return; }
    n.style.setProperty('--d', `${delay}s`);
    n.classList.add('in', `in-${kindOf(n)}`);
    n.classList.remove('pre');
    [...n.querySelectorAll(KIDS)].slice(0, 16).forEach((k, i) => { k.classList.add('kid'); k.style.setProperty('--d', `${delay + .3 + i * .045}s`); });
    setTimeout(() => fill(n), (delay + .25) * 1000);
    n.addEventListener('animationend', (e) => { if (e.target === n) n.classList.add('done'); }, { once: true });
  }
  const revealItems = [...(content ? content.children : []), ...document.querySelectorAll('[data-reveal]')];
  if (revealItems.length) {
    const items = revealItems;
    if (reduce) { items.forEach((n) => fill(n)); }
    else {
      items.forEach((n) => n.classList.add('pre'));
      const vw = innerWidth;
      const io = new IntersectionObserver((ents) => {
        const vis = ents.filter((e) => e.isIntersecting).map((e) => e.target);
        vis.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        const t0 = vis.length ? vis[0].getBoundingClientRect().top : 0;
        vis.forEach((n, i) => { const r = n.getBoundingClientRect(); reveal(n, Math.min(.9, .06 + (r.left / vw) * .32 + ((r.top - t0) / innerHeight) * .5 + i * .03)); io.unobserve(n); });
      }, { threshold: .08, rootMargin: '0px 0px -6% 0px' });
      items.forEach((n) => io.observe(n));
    }
  }
  // Ánh sáng theo chuột trên thẻ và độ nghiêng nhẹ trên ô số liệu: chạy bằng lò xo nên đuổi theo chuột mềm,
  // thả ra thì về chỗ chậm rãi. Nút chính có lực hút nhẹ về phía con trỏ (magnetic).
  if (!reduce && matchMedia('(hover: hover)').matches) {
    const rig = (c) => {
      if (c._rig) return c._rig;
      const set = (k, u) => (v) => c.style.setProperty(k, `${v}${u}`);
      const isKpi = c.matches('.kpi');
      return (c._rig = {
        mx: spring(set('--mx', '%'), { k: 120, c: 20 }), my: spring(set('--my', '%'), { k: 120, c: 20 }),
        rx: isKpi ? spring(set('--rx', 'deg'), { k: 140, c: 14 }) : null, ry: isKpi ? spring(set('--ry', 'deg'), { k: 140, c: 14 }) : null,
      });
    };
    document.addEventListener('pointermove', (e) => {
      const c = e.target.closest?.('.card, .kpi'); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, R = rig(c);
      const fresh = !c._in; c._in = 1;
      R.mx.to(x * 100, fresh); R.my.to(y * 100, fresh);
      if (R.rx) { R.rx.to((.5 - y) * 5); R.ry.to((x - .5) * 6); }
    }, { passive: true });
    document.addEventListener('pointerout', (e) => { const c = e.target.closest?.('.card, .kpi'); if (c && !c.contains(e.relatedTarget)) { c._in = 0; const R = rig(c); R.rx?.to(0); R.ry?.to(0); } });
    const MAG = '.btn.primary, .btn.gold, .btn.lg, .bigplay, .play';
    document.querySelectorAll(MAG).forEach((b) => {
      const sx = spring((v) => b.style.setProperty('--tx', `${v}px`), { k: 200, c: 12 }), sy = spring((v) => b.style.setProperty('--ty', `${v}px`), { k: 200, c: 12 });
      b.classList.add('mag');
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); sx.to((e.clientX - r.left - r.width / 2) * .22); sy.to((e.clientY - r.top - r.height / 2) * .3); });
      b.addEventListener('pointerleave', () => { sx.to(0); sy.to(0); });
    });
  }
  // Gợn sóng khi bấm nút.
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn, .nav a, .tabs button, .seg button'); if (!b || reduce) return;
    const r = b.getBoundingClientRect(), s = document.createElement('span');
    s.className = 'ripple'; s.style.left = `${e.clientX - r.left}px`; s.style.top = `${e.clientY - r.top}px`;
    b.appendChild(s); setTimeout(() => s.remove(), 700);
  });

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
          s.values.forEach((v, i) => { const bx = x(i) - (bw * bars.length) / 2 + k * bw, by = y(side, v); marks += `<rect class="br" style="--i:${i + k * .5}" x="${bx + 2}" y="${by}" width="${bw - 4}" height="${Math.max(0, y(side, 0) - by)}" rx="8" fill="${col}" opacity="${s.highlight == null || s.highlight === i ? 1 : .35}"/>`; });
          return;
        }
        const pts = s.values.map((v, i) => [x(i), y(side, v)]);
        if (s.type === 'area') {
          defs += `<linearGradient id="g${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".38"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>`;
          marks += `<path class="ar" d="${smooth(pts)} L${x(n - 1)},${y(side, 0)} L${x(0)},${y(side, 0)} Z" fill="url(#g${si})"/>`;
        }
        marks += `<path class="ln" pathLength="1" style="--s:${si}" d="${smooth(pts)}" fill="none" stroke="${col}" stroke-width="2.5"/>`;
        if (s.dots) marks += pts.map(([px, py], i) => `<circle class="dt" style="--i:${n === 1 ? 0 : i / (n - 1)}" cx="${px}" cy="${py}" r="4" fill="var(--surface)" stroke="${col}" stroke-width="2"/>`).join('');
      });
      el.insertAdjacentHTML('afterbegin', `<svg class="${animate ? 'anim' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cfg.label || cfg.series.map((s) => s.name).join(', ')}"><defs>${defs}</defs>${g}<g>${marks}</g><line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="3 4" opacity="0"/><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/></svg>`);
      const s = el.querySelector('svg'), hit = s.querySelector('.hit'), cross = s.querySelector('.cross');
      tip.style.top = `${T + 10}px`;
      const cx = spring((v) => { cross.setAttribute('x1', v); cross.setAttribute('x2', v); }, { k: 300, c: 30 });
      const tx = spring((v) => { tip.style.left = `${v}px`; }, { k: 240, c: 26 });
      let on = false, last = -1;
      hit.addEventListener('mousemove', (e) => {
        const r = s.getBoundingClientRect(), px = e.clientX - r.left;
        const i = Math.max(0, Math.min(n - 1, hasBars ? Math.floor((px - L) / band) : Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
        cross.setAttribute('opacity', 1);
        if (i !== last) { last = i; tip.innerHTML = `<b>${cfg.tipTitle ? cfg.tipTitle(i) : cfg.labels[i]}</b>${cfg.series.map((sr) => `<span><i style="background:${sr.color || 'var(--c-gen)'}"></i>${sr.name}: ${sr.fmt ? sr.fmt(sr.values[i]) : nf(sr.values[i])}</span>`).join('<br>')}`; }
        cx.to(x(i), !on); tx.to(x(i) > W - 260 ? x(i) - 250 : x(i) + 14, !on); on = true; tip.classList.add('on');
      });
      hit.addEventListener('mouseleave', () => { cross.setAttribute('opacity', 0); tip.classList.remove('on'); on = false; last = -1; });
    };
    if (cfg.legend !== false && !el.nextElementSibling?.classList.contains('legend')) {
      el.insertAdjacentHTML('afterend', `<div class="legend">${cfg.series.map((s) => `<span><i style="background:${s.color || 'var(--c-gen)'}"></i>${s.name}</span>`).join('')}</div>`);
    }
    el._go = () => { if (el._anim) return; el._anim = 1; draw(!reduce); };
    if (el.closest('.pre')) draw(false); else el._go();
    charts.push(draw);
  };
  addEventListener('themechange', () => charts.forEach((f) => f(false)));
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => charts.forEach((f) => f(false)), 150); });

  window.UI = { icon, turbine, scene, coins, emblem, nf, chart, role, ROLES, withRole, spring, swapTheme };
})();
