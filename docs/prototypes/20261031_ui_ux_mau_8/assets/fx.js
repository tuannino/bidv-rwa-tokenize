// BIDV RWA Tokenize Platform, bản mẫu 6: lớp chuyển động và điểm nhấn (lấy từ bản 3) đặt lên khung bản 4.
// Nạp sau shell.js và sau script dựng dữ liệu của trang.
(() => {
  const { spring, reduce } = window.V4;
  const body = document.body, root0 = document.documentElement;
  const scene = ({ tone = 'onDark', turbines = 7, sun = true, sea = true, wind = true } = {}) => {
    const ink = tone === 'onDark' ? '#ffffff' : 'var(--g600)';
    const T = [];
    const seed = [[.08, .78, .34, .45], [.2, .7, .5, .6], [.34, .76, .4, .5], [.5, .66, .62, .8], [.63, .74, .44, .55], [.76, .64, .7, .9], [.9, .72, .5, .65], [.43, .8, .3, .38], [.97, .78, .36, .45]].slice(0, turbines);
    seed.forEach(([x, by, h, op], i) => {
      const X = x * 800, B = by * 300, H = h * 300, R = H * .42, s = [7, 5.5, 9, 4.6, 6.4, 3.8, 5, 8, 6.8][i];
      T.push(`<g opacity="${op}"><path d="M${X - 2.2} ${B} L${X - .9} ${B - H} L${X + .9} ${B - H} L${X + 2.2} ${B}Z" fill="${ink}"/><g style="transform-origin:${X}px ${B - H}px;animation:spin ${s}s linear infinite ${-i}s"><path d="M${X} ${B - H} L${X - 2} ${B - H - R} L${X + 2.4} ${B - H - R * .92}Z" fill="${ink}"/><path d="M${X} ${B - H} L${X + R * .86} ${B - H + R * .5} L${X + R * .78} ${B - H + R * .56 + 3}Z" fill="${ink}"/><path d="M${X} ${B - H} L${X - R * .86} ${B - H + R * .5} L${X - R * .8} ${B - H + R * .46 - 3}Z" fill="${ink}"/></g><circle cx="${X}" cy="${B - H}" r="3" fill="#fec629"/></g>`);
    });
    const streaks = wind ? [60, 110, 150, 205].map((y, i) => `<path class="streak" style="animation-delay:${-i * 1.7}s" d="M-40 ${y} C 160 ${y - 26}, 320 ${y + 22}, 520 ${y - 6} S 760 ${y - 24}, 860 ${y}" fill="none" stroke="${tone === 'onDark' ? 'rgba(255,255,255,.45)' : 'rgba(26,107,60,.35)'}" stroke-width="1.4" stroke-linecap="round"/>`).join('') : '';
    return `<svg class="scene" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      ${sun ? `<circle cx="660" cy="86" r="70" fill="#fec629" opacity=".16"/><circle cx="660" cy="86" r="34" fill="#ffdb73" opacity=".55"/>` : ''}
      <path d="M0 230 C 120 190, 230 214, 340 196 S 560 176, 660 198 S 760 214, 800 204 V300 H0Z" fill="${ink}" opacity="${tone === 'onDark' ? .08 : .06}"/>
      ${T.join('')}
      <path d="M0 252 C 140 232, 260 250, 400 238 S 650 222, 800 242 V300 H0Z" fill="${ink}" opacity="${tone === 'onDark' ? .12 : .08}"/>
      ${sea ? `<g class="sea" opacity="${tone === 'onDark' ? .35 : .25}"><path d="M30 276 h90 M170 284 h120 M360 278 h70 M480 288 h110 M640 280 h90" stroke="${ink}" stroke-width="2" stroke-linecap="round"/></g>` : ''}
      ${streaks}
    </svg>`;
  };
  // ===== Nền, cơn gió mở trang =====
  const bg = document.createElement('div'); bg.className = 'bgfx'; bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = '<i></i><i></i><svg viewBox="0 0 1440 900" preserveAspectRatio="none"><path d="M-60 180 C 260 120, 520 240, 820 170 S 1300 110, 1500 190"/><path d="M-60 520 C 300 460, 600 580, 900 510 S 1320 450, 1500 530"/><path d="M-60 800 C 280 740, 560 860, 880 790 S 1300 730, 1500 810"/></svg>';
  body.prepend(bg);
  if (!reduce) {
    const g = document.createElement('div'); g.className = 'gust'; g.setAttribute('aria-hidden', 'true');
    g.innerHTML = '<svg viewBox="0 0 1200 360" preserveAspectRatio="none" width="100%" height="100%"><path d="M-100 120 C 200 60, 500 180, 800 110 S 1150 60, 1300 130"/><path d="M-100 220 C 260 170, 560 280, 860 210 S 1180 160, 1300 230"/><path d="M-100 300 C 220 250, 520 350, 820 290 S 1160 250, 1300 310"/></svg>';
    body.appendChild(g); setTimeout(() => g.remove(), 2400);
  }

  // ===== Minh hoạ cánh đồng gió (vẽ SVG, tạm thay ảnh thật) =====
  document.querySelectorAll('[data-scene]').forEach((n) => { n.innerHTML = scene({ tone: 'onDark', turbines: +(n.dataset.turbines || 7), sun: n.dataset.sun !== 'no', sea: n.dataset.sea !== 'no' }); });

  // ===== Kiểu điểm nhấn của khối trọng tâm (bản mẫu: có bộ chọn để chủ dự án so sánh) =====
  const HERO = [['edge', 'A. Viền sáng'], ['lift', 'B. Nổi khối'], ['rail', 'C. Đèn nền']];
  // Chủ dự án giữ kiểu A (viền sáng), bỏ bộ chọn (31/10/2026)
  const hk = 'edge';
  root0.dataset.hero = hk;
  document.querySelectorAll('.hero').forEach((h) => h.insertAdjacentHTML('afterbegin', '<span class="backlight" aria-hidden="true"></span><span class="dots" aria-hidden="true"></span>'));

  // Đường gió mảnh chạy trong mọi khối trọng tâm: nét chính của ý tưởng Gió hoá dòng tiền
  document.querySelectorAll('.hero').forEach((h) => h.insertAdjacentHTML('afterbegin', `<svg class="windlines" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">${[40, 95, 150, 205, 260].map((y, i) => `<path style="animation-delay:${-i * 2.3}s" d="M-40 ${y} C 220 ${y - 34}, 420 ${y + 30}, 640 ${y - 4} S 1000 ${y - 30}, 1240 ${y + 6}"/>`).join('')}</svg>`));

  // ===== Tiêu đề: biểu tượng 3D (Fluent Emoji 3D, MIT, tạm) và chữ hiện từng từ =====
  const tt = document.querySelector('.titlerow > div:first-child');
  if (tt && body.dataset.icon3d) { tt.classList.add('tt'); tt.insertAdjacentHTML('afterbegin', `<span class="p3d" aria-hidden="true"><img src="assets/3d/${body.dataset.icon3d}.webp" alt="" width="36" height="36"></span>`); }
  const splitWords = (h) => {
    let i = 0;
    const walk = (n) => [...n.childNodes].forEach((c) => {
      if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) { f.append(w); return; } const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--wi', i++); s.textContent = w; f.append(s); }); c.replaceWith(f); }
      else if (c.nodeType === 1) walk(c);
    });
    walk(h);
  };
  if (!reduce) document.querySelectorAll('.titlerow h1').forEach(splitWords);

  // ===== Số lăn: mỗi chữ số một cột cuộn rồi dừng bằng lò xo; trình đọc màn hình đọc số cuối =====
  const DIG = [...'01234567890123456789'].map((n) => `<span>${n}</span>`).join('');
  const odo = (el) => {
    if (el._done) return; el._done = 1;
    const s = el.textContent.trim(); if (reduce || !/\d/.test(s)) return;
    el.classList.add('odo'); el.setAttribute('aria-label', s); el.setAttribute('role', 'text');
    el.innerHTML = [...s].map((ch) => (/\d/.test(ch) ? `<span class="od" aria-hidden="true"><span class="og">${ch}</span><span class="os">${DIG}</span></span>` : `<span class="oc" aria-hidden="true">${ch}</span>`)).join('');
    const cols = [...el.querySelectorAll('.os')], dg = s.replace(/\D/g, '');
    requestAnimationFrame(() => requestAnimationFrame(() => cols.forEach((c, i) => { c.style.transitionDelay = `${(cols.length - 1 - i) * 70}ms`; c.style.transform = `translateY(${-(10 + +dg[i]) * 5}%)`; })));
  };

  // ===== Vào trang: khối trọng tâm mở màn, khối khác lướt lên; trái và trên tới trước như cơn gió =====
  const KIDS = 'tbody tr, .kv > div, .tk, .flow > .node';
  const fill = (n) => { n.querySelectorAll('[data-count]').forEach(odo); n.querySelectorAll('.chart.wait').forEach((c) => { c.classList.remove('wait'); c.classList.add('go'); }); };
  const kindOf = (n) => (n.matches('.titlerow') ? 'title' : n.matches('.hero') ? 'unveil' : n.matches('.kpis') ? 'gust' : 'lift');
  const reveal = (n, d) => {
    if (n._shown) return; n._shown = 1;
    if (reduce) { n.classList.remove('pre'); fill(n); return; }
    n.style.setProperty('--d', `${d}s`); n.classList.add('in', `in-${kindOf(n)}`); n.classList.remove('pre');
    [...n.querySelectorAll(KIDS)].slice(0, 16).forEach((k, i) => { k.classList.add('kid'); k.style.setProperty('--d', `${d + .3 + i * .05}s`); });
    setTimeout(() => fill(n), (d + .25) * 1000);
  };
  const items = [document.querySelector('.titlerow'), ...document.querySelectorAll('.grid > :not(.row2), .grid > .row2 > *')].filter(Boolean);
  document.querySelectorAll('.chart').forEach((c) => c.classList.add('wait'));
  if (reduce) items.forEach((n) => reveal(n, 0));
  else {
    items.forEach((n) => n.classList.add('pre'));
    const vw = innerWidth;
    const io = new IntersectionObserver((ents) => {
      const vis = ents.filter((e) => e.isIntersecting).map((e) => e.target);
      vis.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      const t0 = vis.length ? vis[0].getBoundingClientRect().top : 0;
      vis.forEach((n, i) => { const r = n.getBoundingClientRect(); reveal(n, Math.min(.8, .05 + (r.left / vw) * .25 + ((r.top - t0) / innerHeight) * .45 + i * .03)); io.unobserve(n); });
    }, { threshold: .08, rootMargin: '0px 0px -6% 0px' });
    items.forEach((n) => io.observe(n));
  }

  // ===== Ánh sáng theo chuột (lò xo), nút chính hút nhẹ, gợn sóng khi bấm =====
  if (!reduce && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.panel').forEach((p) => {
      if (p.matches('.hero')) p.classList.add('spot');
      const mx = spring((v) => p.style.setProperty('--mx', `${v}%`), { k: 120, c: 20 }), my = spring((v) => p.style.setProperty('--my', `${v}%`), { k: 120, c: 20 });
      let fresh = true;
      p.addEventListener('pointermove', (e) => { const r = p.getBoundingClientRect(); mx.to((e.clientX - r.left) / r.width * 100, fresh); my.to((e.clientY - r.top) / r.height * 100, fresh); fresh = false; });
      p.addEventListener('pointerleave', () => { fresh = true; });
      if (p.matches('.hero')) {
        const rx = spring((v) => p.style.setProperty('--rx', `${v}deg`), { k: 140, c: 14 }), ry = spring((v) => p.style.setProperty('--ry', `${v}deg`), { k: 140, c: 14 }), bx = spring((v) => p.style.setProperty('--bx', `${v}%`), { k: 60, c: 14 });
        p.addEventListener('pointermove', (e) => { const r = p.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; rx.to((.5 - y) * 4); ry.to((x - .5) * 3); bx.to(x * 100 - 18); });
        p.addEventListener('pointerleave', () => { rx.to(0); ry.to(0); });
      }
    });
    document.querySelectorAll('.btn.primary, .hero .btn').forEach((b) => {
      const sx = spring((v) => b.style.setProperty('--tx', `${v}px`), { k: 200, c: 12 }), sy = spring((v) => b.style.setProperty('--ty', `${v}px`), { k: 200, c: 12 });
      b.classList.add('mag');
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); sx.to((e.clientX - r.left - r.width / 2) * .22); sy.to((e.clientY - r.top - r.height / 2) * .3); });
      b.addEventListener('pointerleave', () => { sx.to(0); sy.to(0); });
    });
  }
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn, .nav a, .seg button, .switch-btn'); if (!b || reduce) return;
    const r = b.getBoundingClientRect(), s = document.createElement('span');
    s.className = 'ripple'; s.style.left = `${e.clientX - r.left}px`; s.style.top = `${e.clientY - r.top}px`;
    b.appendChild(s); setTimeout(() => s.remove(), 900);
  });
})();
