/* ─────────────────────────────────────────────
   js paint — a whiteboard for drawing and explaining things
   Everything on the board is kept as a list of shapes, so it can be
   undone, redrawn at any size, flipped between dark/light and autosaved.
   ───────────────────────────────────────────── */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const wrap = $('#boardWrap');
  const board = $('#board');
  const overlay = $('#overlay');
  const ring = $('#ring');
  const bctx = board.getContext('2d');
  const octx = overlay.getContext('2d');
  const cache = document.createElement('canvas'); // finished shapes
  const cctx = cache.getContext('2d');
  const measure = document.createElement('canvas').getContext('2d');

  // ── config ──
  const THEMES = {
    dark:  { bg: '#141414', ink: '#e8e8e0', line: 'rgba(255,255,255,0.07)', dot: 'rgba(255,255,255,0.16)' },
    light: { bg: '#f3f2ea', ink: '#161616', line: 'rgba(0,0,0,0.08)',       dot: 'rgba(0,0,0,0.2)' },
  };
  const COLORS = { lime: '#c8f04b', pink: '#f04b8a', cyan: '#4bc8f0', gold: '#f0b84b' };
  const COLOR_KEYS = ['ink', 'lime', 'pink', 'cyan', 'gold', 'custom'];
  const SIZES = [2, 4, 8, 16];
  const SIZE_NAMES = ['S', 'M', 'L', 'XL'];
  const TEXT_SIZES = [18, 26, 38, 60];
  const PATTERNS = ['grid', 'dots', 'plain'];
  const KEYS = { p: 'pen', h: 'highlighter', l: 'line', a: 'arrow', r: 'rect', o: 'ellipse', t: 'text', e: 'eraser', k: 'laser' };
  const TOOL_NAMES = { pen: 'pen', highlighter: 'highlighter', line: 'line', arrow: 'arrow', rect: 'box', ellipse: 'ellipse', text: 'text', eraser: 'eraser', laser: 'laser' };
  const FREEHAND = ['pen', 'highlighter', 'eraser'];
  const LASER = '#f04b8a';
  const LASER_LIFE = 800;
  const FONT = (px) => `${px}px "DM Mono", monospace`;
  const STORE = 'yeahlolnice-paint-v1';
  const MAX_UNDO = 300;

  const state = { tool: 'pen', color: 'ink', custom: '#ff6b3d', size: 1, theme: 'dark', pattern: 'grid' };
  let objects = [];
  let undoStack = [];
  let redoStack = [];
  let dpr = 1, W = 1, H = 1;
  let current = null;       // shape being drawn right now
  let editor = null;        // open text box
  let skipTextUp = false;
  let frame = 0;

  // ── helpers ──
  const r1 = (v) => Math.round(v * 10) / 10;
  const inkColor = () => THEMES[state.theme].ink;
  const resolve = (c) => (c === 'ink' ? inkColor() : c);
  const pickedColor = () =>
    state.color === 'ink' ? 'ink' : state.color === 'custom' ? state.custom : COLORS[state.color];

  function toolWidth(tool = state.tool) {
    const s = SIZES[state.size];
    if (tool === 'highlighter') return s * 3 + 8;
    if (tool === 'eraser') return s * 4 + 10;
    return s;
  }

  // ── persistence ──
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!d) return;
      const s = d.settings || {};
      if (s.theme in THEMES) state.theme = s.theme;
      if (PATTERNS.includes(s.pattern)) state.pattern = s.pattern;
      if (Object.values(KEYS).includes(s.tool)) state.tool = s.tool;
      if (COLOR_KEYS.includes(s.color)) state.color = s.color;
      if (/^#[0-9a-f]{6}$/i.test(s.custom)) state.custom = s.custom;
      if (Number.isInteger(s.size) && s.size >= 0 && s.size < SIZES.length) state.size = s.size;
      if (Array.isArray(d.objects)) objects = d.objects.filter((o) => o && typeof o.type === 'string');
    } catch (_) { /* storage blocked or corrupt: start blank */ }
  }

  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify({ settings: state, objects }));
      } catch (_) { /* full or blocked: drawing still works, just isn't kept */ }
    }, 250);
  }

  // ── sizing ──
  function resize() {
    const rect = wrap.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    for (const c of [board, overlay, cache]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    rebuild();
  }

  // ── drawing ──
  function strokePath(ctx, pts) {
    const n = pts.length / 2;
    if (n === 1 || (n === 2 && pts[0] === pts[2] && pts[1] === pts[3])) {
      ctx.beginPath();
      ctx.arc(pts[0], pts[1], ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i < n - 1; i++) {
      const x = pts[2 * i], y = pts[2 * i + 1];
      ctx.quadraticCurveTo(x, y, (x + pts[2 * i + 2]) / 2, (y + pts[2 * i + 3]) / 2);
    }
    ctx.lineTo(pts[2 * n - 2], pts[2 * n - 1]);
    ctx.stroke();
  }

  function drawArrow(ctx, o) {
    const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ang = Math.atan2(dy, dx);
    const head = Math.min(len * 0.6, Math.max(12, o.w * 3.5));
    const back = head * 0.75;
    ctx.beginPath();
    ctx.moveTo(o.x1, o.y1);
    ctx.lineTo(o.x2 - Math.cos(ang) * back, o.y2 - Math.sin(ang) * back);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x2, o.y2);
    ctx.lineTo(o.x2 - head * Math.cos(ang - 0.45), o.y2 - head * Math.sin(ang - 0.45));
    ctx.lineTo(o.x2 - head * Math.cos(ang + 0.45), o.y2 - head * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.lineWidth = Math.min(o.w, 3);
    ctx.fill();
    ctx.stroke();
  }

  function drawObj(ctx, o) {
    ctx.save();
    const col = resolve(o.color);
    ctx.strokeStyle = ctx.fillStyle = col;
    ctx.lineWidth = o.w;
    ctx.lineCap = ctx.lineJoin = 'round';
    switch (o.type) {
      case 'pen':
        strokePath(ctx, o.pts);
        break;
      case 'highlighter':
        ctx.globalAlpha = 0.35;
        strokePath(ctx, o.pts);
        break;
      case 'eraser':
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = ctx.fillStyle = '#000';
        strokePath(ctx, o.pts);
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();
        break;
      case 'arrow':
        drawArrow(ctx, o);
        break;
      case 'rect': {
        const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2);
        ctx.strokeRect(x, y, Math.abs(o.x2 - o.x1), Math.abs(o.y2 - o.y1));
        break;
      }
      case 'ellipse': {
        ctx.beginPath();
        ctx.ellipse((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2,
          Math.abs(o.x2 - o.x1) / 2, Math.abs(o.y2 - o.y1) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.font = FONT(o.fs);
        ctx.textBaseline = 'top';
        String(o.text).split('\n').forEach((ln, i) => ctx.fillText(ln, o.x, o.y + i * o.fs * 1.3));
        break;
      }
    }
    ctx.restore();
  }

  function rebuild() {
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, cache.width, cache.height);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const o of objects) drawObj(cctx, o);
    present();
  }

  function present() {
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, board.width, board.height);
    bctx.drawImage(cache, 0, 0);
    if (current) {
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawObj(bctx, current);
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; present(); });
  }

  // ── history ──
  function remember() {
    undoStack.push(objects);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  }

  function commit(o) {
    remember();
    objects = objects.concat([o]);
    drawObj(cctx, o);
    present();
    save();
    updateUI();
  }

  function undo() {
    commitEditor();
    if (!undoStack.length || current) return;
    redoStack.push(objects);
    objects = undoStack.pop();
    rebuild(); save(); updateUI();
  }

  function redo() {
    if (!redoStack.length || current) return;
    undoStack.push(objects);
    objects = redoStack.pop();
    rebuild(); save(); updateUI();
  }

  function clearAll() {
    commitEditor();
    if (!objects.length) return;
    remember();
    objects = [];
    rebuild(); save(); updateUI();
    toast('board cleared · ctrl+z to undo');
  }

  // ── pointer input ──
  let boardRect = null;
  function pos(e) {
    if (!boardRect) boardRect = overlay.getBoundingClientRect();
    return { x: e.clientX - boardRect.left, y: e.clientY - boardRect.top };
  }

  function constrain(o, shift) {
    if (!shift) return;
    const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
    if (o.type === 'line' || o.type === 'arrow') {
      const step = Math.PI / 4;
      const ang = Math.round(Math.atan2(dy, dx) / step) * step;
      const len = Math.hypot(dx, dy);
      o.x2 = o.x1 + Math.cos(ang) * len;
      o.y2 = o.y1 + Math.sin(ang) * len;
    } else {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      o.x2 = o.x1 + (dx < 0 ? -d : d);
      o.y2 = o.y1 + (dy < 0 ? -d : d);
    }
  }

  overlay.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (current || laserDown) return; // ignore a second finger
    e.preventDefault();
    boardRect = overlay.getBoundingClientRect();
    if (editor) { commitEditor(); skipTextUp = true; return; }
    const p = pos(e);
    if (state.tool === 'text') return; // opens on pointerup, once focus has settled
    overlay.setPointerCapture(e.pointerId);

    if (state.tool === 'laser') {
      laserDown = true;
      laserPts.push({ x: p.x, y: p.y, t: performance.now(), start: true });
      laserHead = p;
      kickLaser();
      return;
    }

    const color = state.tool === 'eraser' ? '#000' : pickedColor();
    const w = toolWidth();
    current = FREEHAND.includes(state.tool)
      ? { type: state.tool, color, w, pts: [r1(p.x), r1(p.y)] }
      : { type: state.tool, color, w, x1: r1(p.x), y1: r1(p.y), x2: r1(p.x), y2: r1(p.y) };
    present();
  });

  overlay.addEventListener('pointermove', (e) => {
    const p = pos(e);
    moveRing(e, p);

    if (state.tool === 'laser') {
      laserHead = p;
      if (laserDown) {
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        const now = performance.now();
        for (const ev of evs.length ? evs : [e]) {
          const q = pos(ev);
          laserPts.push({ x: q.x, y: q.y, t: now });
        }
      }
      kickLaser();
      return;
    }

    if (!current) return;
    if (FREEHAND.includes(current.type)) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const q = pos(ev);
        const n = current.pts.length;
        if (Math.hypot(q.x - current.pts[n - 2], q.y - current.pts[n - 1]) < 0.75) continue;
        current.pts.push(r1(q.x), r1(q.y));
      }
    } else {
      current.x2 = r1(p.x);
      current.y2 = r1(p.y);
      constrain(current, e.shiftKey);
    }
    schedule();
  });

  function endStroke(e) {
    if (state.tool === 'text' && e.type === 'pointerup') {
      if (skipTextUp) { skipTextUp = false; return; }
      const p = pos(e);
      openEditor(p.x, p.y);
      return;
    }
    if (laserDown) { laserDown = false; kickLaser(); return; }
    if (!current) return;
    const o = current;
    current = null;
    if (e.type === 'pointercancel') { present(); return; }
    if (!FREEHAND.includes(o.type)) {
      const tiny = o.type === 'line' || o.type === 'arrow'
        ? Math.hypot(o.x2 - o.x1, o.y2 - o.y1) < 3
        : Math.abs(o.x2 - o.x1) < 2 && Math.abs(o.y2 - o.y1) < 2;
      if (tiny) { present(); return; }
      o.x2 = r1(o.x2); o.y2 = r1(o.y2);
    }
    commit(o);
  }
  overlay.addEventListener('pointerup', endStroke);
  overlay.addEventListener('pointercancel', endStroke);

  overlay.addEventListener('pointerleave', () => {
    ring.style.display = 'none';
    if (!laserDown) { laserHead = null; kickLaser(); }
  });

  function moveRing(e, p) {
    if (!FREEHAND.includes(state.tool) || e.pointerType === 'touch') {
      ring.style.display = 'none';
      return;
    }
    const d = Math.max(6, toolWidth());
    ring.style.display = 'block';
    ring.style.width = ring.style.height = d + 'px';
    ring.style.left = p.x + 'px';
    ring.style.top = p.y + 'px';
  }

  // ── laser pointer (overlay only, never saved) ──
  let laserPts = [];
  let laserHead = null;
  let laserDown = false;
  let laserLoop = 0;

  function kickLaser() {
    if (!laserLoop) laserLoop = requestAnimationFrame(laserTick);
  }

  function laserTick() {
    const now = performance.now();
    laserPts = laserPts.filter((p) => now - p.t < LASER_LIFE);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.lineCap = octx.lineJoin = 'round';
    octx.strokeStyle = octx.fillStyle = LASER;
    octx.shadowColor = LASER;
    octx.shadowBlur = 14;
    for (let i = 1; i < laserPts.length; i++) {
      const a = laserPts[i - 1], b = laserPts[i];
      if (b.start) continue;
      const life = 1 - (now - b.t) / LASER_LIFE;
      octx.globalAlpha = life;
      octx.lineWidth = 1.5 + 4.5 * life;
      octx.beginPath();
      octx.moveTo(a.x, a.y);
      octx.lineTo(b.x, b.y);
      octx.stroke();
    }
    const showHead = laserHead && state.tool === 'laser';
    if (showHead) {
      octx.globalAlpha = 1;
      octx.beginPath();
      octx.arc(laserHead.x, laserHead.y, laserDown ? 6 : 4.5, 0, Math.PI * 2);
      octx.fill();
    }
    octx.globalAlpha = 1;
    octx.shadowBlur = 0;
    laserLoop = laserPts.length || showHead ? requestAnimationFrame(laserTick) : 0;
  }

  // ── text ──
  function openEditor(x, y) {
    const fs = TEXT_SIZES[state.size];
    const color = pickedColor();
    const top = y - fs * 0.65;
    const ta = document.createElement('textarea');
    ta.className = 'text-editor';
    ta.spellcheck = false;
    ta.rows = 1;
    Object.assign(ta.style, {
      left: x + 'px',
      top: (top - fs * 0.15) + 'px',
      fontSize: fs + 'px',
      color: resolve(color),
      caretColor: resolve(color),
    });
    editor = { ta, x: r1(x), y: r1(top), fs, color };
    const fit = () => {
      measure.font = FONT(fs);
      const lines = ta.value.split('\n');
      const widest = Math.max(...lines.map((l) => measure.measureText(l).width));
      ta.style.width = Math.max(fs, widest + fs * 0.6) + 'px';
      ta.style.height = lines.length * fs * 1.3 + 'px';
    };
    ta.addEventListener('input', fit);
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { cancelEditor(); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditor(); }
    });
    ta.addEventListener('blur', () => commitEditor());
    wrap.appendChild(ta);
    fit();
    ta.focus();
  }

  function commitEditor() {
    if (!editor) return;
    const { ta, x, y, fs, color } = editor;
    editor = null;
    const text = ta.value.replace(/\s+$/, '');
    ta.remove();
    if (text.trim()) commit({ type: 'text', x, y, fs, color, text });
  }

  function cancelEditor() {
    if (!editor) return;
    const { ta } = editor;
    editor = null;
    ta.remove();
  }

  // ── export ──
  function drawPattern(ctx) {
    const th = THEMES[state.theme];
    if (state.pattern === 'grid') {
      ctx.fillStyle = th.line;
      for (let x = 0; x < W; x += 32) ctx.fillRect(x, 0, 1, H);
      for (let y = 0; y < H; y += 32) ctx.fillRect(0, y, W, 1);
    } else if (state.pattern === 'dots') {
      ctx.fillStyle = th.dot;
      for (let x = 12; x < W; x += 24) {
        for (let y = 12; y < H; y += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function exportPng() {
    commitEditor();
    const out = document.createElement('canvas');
    out.width = board.width;
    out.height = board.height;
    const x = out.getContext('2d');
    x.fillStyle = THEMES[state.theme].bg;
    x.fillRect(0, 0, out.width, out.height);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPattern(x);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(cache, 0, 0);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `yeahlolnice-paint-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('saved ' + name);
    }, 'image/png');
  }

  // ── settings ──
  function setTool(t) {
    if (t === state.tool) return;
    commitEditor();
    state.tool = t;
    ring.style.display = 'none';
    if (t !== 'laser') { laserHead = null; kickLaser(); }
    updateUI(); save();
  }
  function setColor(c) { state.color = c; updateUI(); save(); }
  function setSize(i) {
    state.size = Math.max(0, Math.min(SIZES.length - 1, i));
    updateUI(); save();
  }
  function toggleTheme() {
    commitEditor();
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    rebuild(); updateUI(); save();
  }
  function cyclePattern() {
    state.pattern = PATTERNS[(PATTERNS.indexOf(state.pattern) + 1) % PATTERNS.length];
    updateUI(); save();
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function updateUI() {
    $$('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === state.tool));
    $$('.swatch').forEach((b) => b.classList.toggle('on', b.dataset.color === state.color));
    $$('.size').forEach((b) => b.classList.toggle('on', +b.dataset.size === state.size));
    $('#customColor').value = state.custom;
    $('.swatch.custom i').style.setProperty('--c', state.custom);
    document.documentElement.style.setProperty('--ink', inkColor());
    wrap.dataset.theme = state.theme;
    wrap.dataset.pattern = state.pattern;
    wrap.classList.toggle('ringmode', FREEHAND.includes(state.tool));
    wrap.classList.toggle('texting', state.tool === 'text');
    wrap.classList.toggle('lasering', state.tool === 'laser');
    $('#theme').textContent = state.theme + ' board';
    $('#pattern').textContent = state.pattern;
    $('#undo').disabled = !undoStack.length;
    $('#redo').disabled = !redoStack.length;
    $('#clear').disabled = !objects.length;
    const colorName = state.color === 'custom' ? state.custom : state.color;
    $('#status').innerHTML =
      `<b>${TOOL_NAMES[state.tool]}</b> · ${SIZE_NAMES[state.size]} · ${colorName}` +
      (state.tool === 'text' ? ' · click to type, enter to place, shift+enter for a new line' : '');
  }

  // ── wiring ──
  $$('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $$('.swatch:not(.custom)').forEach((b) => b.addEventListener('click', () => setColor(b.dataset.color)));
  $$('.size').forEach((b) => b.addEventListener('click', () => setSize(+b.dataset.size)));
  const custom = $('#customColor');
  custom.addEventListener('click', () => setColor('custom'));
  custom.addEventListener('input', () => { state.custom = custom.value; setColor('custom'); });
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#clear').addEventListener('click', clearAll);
  $('#save').addEventListener('click', exportPng);
  $('#theme').addEventListener('click', toggleTheme);
  $('#pattern').addEventListener('click', cyclePattern);

  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('textarea, input, select')) return;
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 's') { e.preventDefault(); exportPng(); return; }
    if (mod || e.altKey) return;
    if (k === 'escape' && current) { current = null; present(); return; }
    if (KEYS[k]) { setTool(KEYS[k]); return; }
    if (k >= '1' && k <= '6') { setColor(COLOR_KEYS[+k - 1]); return; }
    if (k === '[') { setSize(state.size - 1); return; }
    if (k === ']') { setSize(state.size + 1); return; }
    if (k === 'b') { toggleTheme(); return; }
    if (k === 'g') { cyclePattern(); return; }
  });

  window.addEventListener('scroll', () => { boardRect = null; }, true);
  new ResizeObserver(() => { boardRect = null; resize(); }).observe(wrap);

  // ── start ──
  load();
  updateUI();
  resize();
  // canvas text needs the web font loaded before it can draw with it
  if (document.fonts && document.fonts.load) {
    document.fonts.load(FONT(26)).then(rebuild, () => {});
  }
})();
