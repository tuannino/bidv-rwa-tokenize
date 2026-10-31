// BIDV RWA Tokenize Platform, bản mẫu 7: bốn kiểu nền động để chủ dự án chọn.
// net  = mạng lưới chuỗi khối: nút xanh ngọc nối nhau, nút vàng là token, gói tin vàng chạy trên cạnh, chuột kéo nút lại gần
// aura = cực quang: bốn mảng màu xanh ngọc, bạc hà, vàng trôi chậm dưới lớp hạt mịn
// wind = dòng gió: hàng nghìn hạt trôi theo trường gió, để lại vệt mảnh
// grid = lưới điểm có đèn chiếu theo chuột, vệt quét ngang chậm
// mix  = cực quang phía sau, mạng lưới phía trước (em đề xuất)
// Nền đậm ở phần đầu màn và nhạt dần xuống vùng dữ liệu; tạm dừng khi tab ẩn; "giảm chuyển động" thì vẽ một khung tĩnh.
(() => {
  const root = document.documentElement, body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Chủ dự án chốt chỉ dùng nền mạng lưới (31/10/2026); các kiểu khác giữ lại trong mã để tham khảo.
  const MODES = [['net', 'Mạng lưới']];
  let mode = 'net';
  const isNet = () => mode === 'net' || mode === 'mix';

  const host = document.createElement('div'); host.className = 'bgx'; host.setAttribute('aria-hidden', 'true');
  host.innerHTML = '<canvas></canvas><div class="aura"><i></i><i></i><i></i><i></i></div><div class="grain"></div><div class="dotgrid"></div><div class="dotlit"></div><div class="scan"></div>';
  body.prepend(host);
  document.querySelector('.bgfx')?.remove();
  const cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, mx = -9999, my = -9999, raf = 0, last = 0;
  const dark = () => root.dataset.theme === 'dark';
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); init(); };
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; host.style.setProperty('--px', `${mx}px`); host.style.setProperty('--py', `${my}px`); }, { passive: true });
  addEventListener('pointerleave', () => { mx = my = -9999; });

  // ---------- Mạng lưới chuỗi khối ----------
  let nodes = [], packets = [];
  const initNet = () => {
    const n = Math.max(36, Math.min(110, Math.round(W * H / 15000)));
    nodes = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H * .9, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: i % 9 === 0 ? 3.2 : 1.6 + Math.random(), gold: i % 9 === 0, ph: Math.random() * 6.28 }));
    packets = [];
  };
  const drawNet = (t, dt) => {
    const d = dark(), teal = d ? '63,182,174' : '1,107,105', R = 150;
    ctx.clearRect(0, 0, W, H);
    for (const p of nodes) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20; if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
      const dx = mx - p.x, dy = my - p.y, dd = Math.hypot(dx, dy);
      if (dd < 200 && dd > 1) { p.x += dx / dd * .25 * dt; p.y += dy / dd * .25 * dt; }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < R) {
          ctx.strokeStyle = `rgba(${teal},${(1 - dist / R) * (d ? .4 : .34)})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          if ((a.gold || b.gold) && Math.random() < .0016 * dt && packets.length < 14) packets.push({ a, b, k: 0 });
        }
      }
      const md = Math.hypot(a.x - mx, a.y - my);
      if (md < 190) { ctx.strokeStyle = `rgba(232,177,0,${(1 - md / 190) * .55})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke(); }
    }
    for (const p of nodes) {
      if (p.gold) {
        const pulse = (Math.sin(t / 700 + p.ph) + 1) / 2;
        ctx.fillStyle = `rgba(254,198,41,${.18 * pulse})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6 + pulse * 6, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#e8b100';
      } else ctx.fillStyle = `rgba(${teal},${d ? .8 : .55})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
    }
    packets = packets.filter((k) => (k.k += .012 * dt) < 1);
    for (const k of packets) {
      const x = k.a.x + (k.b.x - k.a.x) * k.k, y = k.a.y + (k.b.y - k.a.y) * k.k;
      ctx.fillStyle = 'rgba(254,198,41,.95)'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.28); ctx.fill();
      ctx.fillStyle = 'rgba(254,198,41,.25)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.28); ctx.fill();
    }
  };

  // ---------- Dòng gió ----------
  let parts = [];
  const field = (x, y, t) => Math.sin(x * .0042 + t * .00012) * 1.1 + Math.cos(y * .0061 - t * .0001) * .9 + Math.sin((x + y) * .0021) * .6;
  const initWind = () => {
    const n = Math.max(500, Math.min(1500, Math.round(W * H / 900)));
    parts = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, life: Math.random() * 200, gold: i % 14 === 0 }));
    ctx.fillStyle = getComputedStyle(root).getPropertyValue('--ground').trim() || '#f2f5f4'; ctx.fillRect(0, 0, W, H);
  };
  const drawWind = (t, dt) => {
    const d = dark();
    ctx.fillStyle = d ? 'rgba(10,14,14,.10)' : 'rgba(242,245,244,.10)'; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1.1;
    for (const p of parts) {
      const a = field(p.x, p.y, t), sp = 1.25 * dt;
      const nx = p.x + (Math.cos(a) * .55 + .9) * sp, ny = p.y + Math.sin(a) * .7 * sp;
      ctx.strokeStyle = p.gold ? 'rgba(232,177,0,.5)' : d ? 'rgba(63,182,174,.35)' : 'rgba(1,107,105,.22)';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny; p.life -= dt;
      if (p.x > W + 10 || p.y < -10 || p.y > H + 10 || p.life < 0) { p.x = Math.random() * W * .3 - 10; p.y = Math.random() * H; p.life = 120 + Math.random() * 220; }
    }
  };

  const init = () => { if (isNet()) initNet(); else if (mode === 'wind') initWind(); else ctx.clearRect(0, 0, W, H); };
  const frame = (t) => {
    const dt = Math.min(3, (t - last) / 16.7 || 1); last = t;
    if (isNet()) drawNet(t, dt); else if (mode === 'wind') drawWind(t, dt);
    raf = (isNet() || mode === 'wind') && !reduce ? requestAnimationFrame(frame) : 0;
  };
  const start = () => {
    cancelAnimationFrame(raf); host.dataset.mode = mode; root.dataset.bg = mode; init();
    if (isNet() || mode === 'wind') { if (reduce) { for (let i = 0; i < (mode === 'wind' ? 60 : 1); i++) frame(performance.now() + i * 16); } else { last = performance.now(); raf = requestAnimationFrame(frame); } }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else start(); });
  addEventListener('themechange', start);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  resize(); start();

  // Bộ chọn nền nằm cạnh bộ chọn kiểu điểm nhấn (chỉ trong bản mẫu)
  const addPicker = () => {
    const pk = document.querySelector('.picker'); if (!pk) return;
    pk.insertAdjacentHTML('afterbegin', `<span>Nền</span><div class="seg" role="group" aria-label="Kiểu nền">${MODES.map(([k, l]) => `<button type="button" aria-pressed="${k === mode}" data-bg="${k}">${l}</button>`).join('')}</div><i class="sep" aria-hidden="true"></i>`);
    pk.querySelector('[aria-label="Kiểu nền"]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.bg; try { localStorage.setItem('bidv-v7-bg', mode); } catch {} start(); });
    window.V4.segs?.();
  };
})();
