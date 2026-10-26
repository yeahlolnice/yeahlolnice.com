/* ─────────────────────────────────────────────
   yeahlolnice games — shared kit
   Players, pass-the-mouse handoff, podium, hall of fame.
   Everything is saved in this browser only (localStorage).
   ───────────────────────────────────────────── */
const YLN = (() => {
  const KEY_PLAYERS = 'yln.players';
  const KEY_HOF = 'yln.hof';
  const COLORS = ['#c8f04b', '#f04b8a', '#4bc8f0', '#f0b84b', '#a46bff', '#4bf0a2', '#f06a4b', '#e8e8e0'];
  const GAME_NAMES = {
    blackjack: 'Blackjack',
    roulette: 'Roulette',
    trivia: 'Trivia Night',
    'pin-drop': 'Pin Drop',
    life: 'Colony Clash',
  };

  // ── storage (never trust it to exist) ──
  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
    catch { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode etc. */ }
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function overlay(inner) {
    const o = el(`<div class="overlay"><div class="box">${inner}</div></div>`);
    document.body.appendChild(o);
    return o;
  }

  // ── players ──
  function savedPlayers() {
    const p = load(KEY_PLAYERS, null);
    if (Array.isArray(p) && p.length) return p;
    return [{ name: 'Player 1', color: COLORS[0] }, { name: 'Player 2', color: COLORS[1] }];
  }

  /**
   * Show the "who's playing?" screen.
   * opts.options = [{ key, label, choices: [{value, label}], value }]
   * Resolves { players: [{name,color}], settings: {key: value} }
   */
  function setupPlayers({ game, min = 1, max = 8, intro = '', options = [], cancel = false } = {}) {
    return new Promise(resolve => {
      let players = savedPlayers().slice(0, max);
      while (players.length < min) players.push({ name: `Player ${players.length + 1}`, color: COLORS[players.length % COLORS.length] });
      const settings = {};
      options.forEach(o => settings[o.key] = o.value);

      const o = overlay(`
        <p class="eyebrow" style="opacity:1;animation:none">// ${esc(GAME_NAMES[game] || game)}</p>
        <h2>who's <span>playing?</span></h2>
        ${intro ? `<p class="desc" style="opacity:1;animation:none;margin:0">${intro}</p>` : ''}
        <div class="plist"></div>
        <div class="row"><button class="btn small" data-add>+ add player</button><span class="muted" style="font-size:10px">${min}–${max} players · click a colour to change it</span></div>
        <div class="opts"></div>
        <div class="row" style="margin-top:26px">${cancel ? '<button class="btn" data-cancel>← back</button>' : ''}<span class="spacer"></span><button class="btn accent big" data-go>let's go →</button></div>
      `);
      const list = o.querySelector('.plist');
      const optsBox = o.querySelector('.opts');

      function draw() {
        list.innerHTML = '';
        players.forEach((p, i) => {
          const r = el(`<div class="prow">
            <button class="swatch" title="change colour" style="background:${p.color}"></button>
            <input type="text" maxlength="14" value="${esc(p.name)}" aria-label="player ${i + 1} name">
            <button class="btn small" title="remove" ${players.length <= min ? 'disabled' : ''}>✕</button>
          </div>`);
          const [sw, inp, rm] = [r.children[0], r.children[1], r.children[2]];
          sw.onclick = () => { p.color = COLORS[(COLORS.indexOf(p.color) + 1) % COLORS.length]; draw(); };
          inp.oninput = () => { p.name = inp.value; };
          inp.onkeydown = e => { if (e.key === 'Enter') go(); };
          rm.onclick = () => { players.splice(i, 1); draw(); };
          list.appendChild(r);
        });
        o.querySelector('[data-add]').disabled = players.length >= max;
      }
      function drawOpts() {
        optsBox.innerHTML = '';
        options.forEach(opt => {
          const wrap = el(`<div style="margin-top:20px"><div class="label">${esc(opt.label)}</div><div class="opt-row"></div></div>`);
          opt.choices.forEach(c => {
            const b = el(`<button class="btn small ${settings[opt.key] === c.value ? 'on' : ''}">${esc(c.label)}</button>`);
            b.onclick = () => { settings[opt.key] = c.value; drawOpts(); };
            wrap.lastElementChild.appendChild(b);
          });
          optsBox.appendChild(wrap);
        });
      }
      function go() {
        players.forEach((p, i) => { p.name = (p.name || '').trim() || `Player ${i + 1}`; });
        // de-dupe names so scores don't collide
        const seen = {};
        players.forEach(p => { const k = p.name.toLowerCase(); if (seen[k]) p.name += ' ' + (++seen[k]); else seen[k] = 1; });
        save(KEY_PLAYERS, players);
        o.remove();
        resolve({ players: players.map(p => ({ ...p })), settings });
      }
      o.querySelector('[data-add]').onclick = () => {
        const used = players.map(p => p.color);
        players.push({ name: `Player ${players.length + 1}`, color: COLORS.find(c => !used.includes(c)) || COLORS[0] });
        draw();
        list.lastElementChild.querySelector('input').select();
      };
      o.querySelector('[data-go]').onclick = go;
      if (cancel) o.querySelector('[data-cancel]').onclick = () => { o.remove(); resolve(null); };
      draw(); drawOpts();
    });
  }

  // ── pass-the-mouse cover screen ──
  function handoff(player, { title = 'pass to', sub = '', button = "I'm ready" } = {}) {
    return new Promise(resolve => {
      const o = overlay(`<div class="handoff">
        <p class="label">${esc(title)}</p>
        <div class="who" style="color:${player.color}">${esc(player.name)}</div>
        ${sub ? `<p class="sub">${sub}</p>` : ''}
        <button class="btn accent big" style="margin-top:24px">${esc(button)} →</button>
        <p class="hint">click anywhere · or press space</p>
      </div>`);
      o.querySelector('.box').style.maxWidth = '640px';
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        document.removeEventListener('keydown', onKey, true);
        o.remove(); resolve();
      };
      const onKey = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(); } };
      // tiny delay so the click that opened it doesn't also close it
      setTimeout(() => {
        o.addEventListener('click', finish);
        document.addEventListener('keydown', onKey, true);
      }, 250);
    });
  }

  // ── hall of fame ──
  function hof() { return load(KEY_HOF, {}); }
  function recordWin(game, names) {
    const h = hof();
    names.forEach(n => {
      const k = n.trim();
      h[k] = h[k] || { total: 0, games: {} };
      h[k].total++;
      h[k].games[game] = (h[k].games[game] || 0) + 1;
    });
    save(KEY_HOF, h);
  }
  function resetHof() { save(KEY_HOF, {}); }

  /**
   * End-of-game screen. results = [{ player, score, display }] (higher score = better
   * unless lowerWins). Records the winner(s) in the hall of fame.
   */
  function podium(game, results, { lowerWins = false, onAgain, note = '' } = {}) {
    const sorted = [...results].sort((a, b) => lowerWins ? a.score - b.score : b.score - a.score);
    const best = sorted[0].score;
    const winners = sorted.filter(r => r.score === best);
    if (results.length > 1 || game === 'life') recordWin(game, winners.map(w => w.player.name));
    confetti(winners[0].player.color);

    const top = sorted.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const cls = r => 's' + (top.indexOf(r) + 1);
    const o = overlay(`
      <p class="eyebrow" style="opacity:1;animation:none;text-align:center">// ${esc(GAME_NAMES[game] || game)} · game over</p>
      <h2 style="text-align:center">${winners.length > 1 ? 'it\'s a <span>tie</span>' : `<span style="color:${winners[0].player.color}">${esc(winners[0].player.name)}</span> wins`}</h2>
      ${note ? `<p class="rest" style="margin:0">${note}</p>` : ''}
      <div class="podium">${order.map(r => `
        <div class="step ${cls(r)}" style="--pc:${r.player.color}">
          <div class="nm" style="color:${r.player.color}">${esc(r.player.name)}</div>
          <div class="sc">${esc(r.display ?? r.score)}</div>
          <div class="blk">${top.indexOf(r) + 1}</div>
        </div>`).join('')}
      </div>
      ${sorted.length > 3 ? `<div class="rest">${sorted.slice(3).map((r, i) => `${i + 4}. ${esc(r.player.name)} — ${esc(r.display ?? r.score)}`).join('<br>')}</div>` : ''}
      <div class="row" style="justify-content:center">
        <a class="btn" href="/games/" style="text-decoration:none">← all games</a>
        <button class="btn accent" data-again>play again</button>
      </div>
    `);
    o.querySelector('.box').style.maxWidth = '600px';
    o.querySelector('[data-again]').onclick = () => { o.remove(); onAgain ? onAgain() : location.reload(); };
  }

  // ── little helpers ──
  function scorebar(container, players, { active = -1, score = () => '', out = () => false } = {}) {
    container.classList.add('scorebar');
    container.innerHTML = players.map((p, i) => `
      <div class="p ${i === active ? 'active' : ''} ${out(p, i) ? 'out' : ''}" style="--pc:${p.color}">
        <div class="name">${esc(p.name)}</div>
        <div class="score">${score(p, i)}</div>
      </div>`).join('');
  }

  let toastTimer;
  function toast(msg, ms = 2200) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = el(`<div class="toast">${msg}</div>`);
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), ms);
  }

  function confetti(color) {
    const cols = [color, '#c8f04b', '#f04b8a', '#e8e8e0'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = cols[i % cols.length];
      c.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      c.style.animationDelay = (Math.random() * 0.6) + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }

  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  return { COLORS, GAME_NAMES, setupPlayers, handoff, podium, hof, recordWin, resetHof, scorebar, toast, confetti, esc, el, shuffle, sleep, load, save };
})();
