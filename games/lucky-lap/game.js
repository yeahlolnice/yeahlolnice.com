/* ─────────────────────────────────────────────
   Lucky Lap — race round a 40-tile loop.
   Roll two dice, move by one. Dodge the bad tiles.
   ───────────────────────────────────────────── */
(() => {
  const $ = id => document.getElementById(id);
  const esc = YLN.esc;
  const N = 40;

  const TILES = {
    start:  { icon: '🏁', name: 'start', desc: 'pass it for +1 🍀', kind: 'start' },
    blank:  { icon: '', name: 'safe', desc: 'nothing happens. enjoy it', kind: 'neutral' },
    boost:  { icon: '🚀', name: 'boost', desc: 'zoom forward 3', kind: 'good' },
    ladder: { icon: '🪜', name: 'shortcut', desc: 'climb forward 6', kind: 'good' },
    luck:   { icon: '🍀', name: 'lucky', desc: '+1 luck token', kind: 'good' },
    item:   { icon: '🎁', name: 'item box', desc: 'grab an item', kind: 'good' },
    pit:    { icon: '🕳️', name: 'pit', desc: 'fall back 3', kind: 'bad' },
    chute:  { icon: '🐍', name: 'snake', desc: 'slide back 7', kind: 'bad' },
    freeze: { icon: '🧊', name: 'freeze', desc: 'skip your next turn', kind: 'bad' },
    tax:    { icon: '💸', name: 'tax', desc: 'lose a 🍀 (broke? back 2)', kind: 'bad' },
    chance: { icon: '❓', name: 'chance', desc: 'draw a chance card', kind: 'chaos' },
    gamble: { icon: '🎰', name: 'gamble', desc: 'call high or low: +4 or −4', kind: 'chaos' },
    swap:   { icon: '🌀', name: 'swap', desc: 'swap places with a random player', kind: 'chaos' },
  };
  // how much a bot likes landing on each tile (on top of the distance moved)
  const VALUE = { start: 0, blank: 0, boost: 3, ladder: 6, luck: 2, item: 2.5, pit: -3, chute: -7, freeze: -4.5, tax: -1.5, chance: 0.3, gamble: 0, swap: 0 };

  const CLASSIC = [
    'start', 'blank', 'luck', 'pit', 'item', 'chance', 'blank', 'ladder', 'freeze', 'gamble', 'boost',
    'blank', 'pit', 'luck', 'item', 'tax', 'chance', 'boost', 'chute', 'blank', 'swap',
    'item', 'luck', 'pit', 'ladder', 'freeze', 'chance', 'blank', 'gamble', 'tax', 'boost',
    'item', 'pit', 'luck', 'chance', 'blank', 'chute', 'freeze', 'item', 'pit',
  ];

  const ITEMS = {
    mushroom:  { icon: '🍄', name: 'mushroom', desc: 'zoom forward 3', target: 'self' },
    magnet:    { icon: '🧲', name: 'magnet', desc: 'drag a player of your choice back 3', target: 'pick' },
    freezeRay: { icon: '❄️', name: 'freeze ray', desc: 'a player of your choice skips their next turn', target: 'pick' },
    swapper:   { icon: '🔄', name: 'swapper', desc: 'swap places with a player of your choice', target: 'pick' },
    bomb:      { icon: '💣', name: 'chaos bomb', desc: 'a random player goes back 5', target: 'random' },
    shell:     { icon: '🐢', name: 'shell', desc: 'hunts down the leading rival: back 4', target: 'leader' },
    storm:     { icon: '🌩️', name: 'storm', desc: 'everyone else goes back 2', target: 'all' },
  };
  // rubber-banding: the further back you are, the nastier your items
  const ITEM_WEIGHTS = {
    front: { mushroom: 3, magnet: 3, freezeRay: 3, bomb: 2, swapper: 0.5, shell: 0.5, storm: 1 },
    mid:   { mushroom: 2, magnet: 2, freezeRay: 2, bomb: 2, swapper: 2, shell: 2, storm: 2 },
    back:  { mushroom: 2, magnet: 1, freezeRay: 2, bomb: 2, swapper: 3, shell: 3, storm: 3 },
  };

  const BOT_NAMES = ['Rollo', 'Clank', 'Beep Boop', 'Dicey', 'Sir Bumps', 'Nahbot', 'Snake Eyes', 'Lil Chip'];

  let players = [], board = [], laps = 2, speed = 0.6, turn = 0, round = 1, over = false, winner = null, deck = [];
  let pending = null;
  const tileEls = [];
  const tokenEls = new Map();

  const d6 = () => 1 + Math.floor(Math.random() * 6);
  const goal = () => laps * N;
  const cur = () => players[turn];
  const rivals = p => players.filter(o => o !== p);
  const nm = p => `<b style="color:${p.color}">${esc(p.name)}</b>`;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const wait = ms => YLN.sleep(cur() && cur().bot ? ms * speed : ms);
  const standings = () => [...players].sort((a, b) => b.pos - a.pos);
  const leaderOf = list => list.reduce((a, b) => (b.pos > a.pos ? b : a));
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;

  /* ── chance deck ── */
  const CARDS = [
    { t: 'tailwind', d: 'forward 4', fx: p => move(p, 4) },
    { t: 'banana peel', d: 'slip back 3', fx: p => move(p, -3) },
    { t: 'pothole', d: 'back 5. ouch', fx: p => move(p, -5) },
    { t: 'lucky penny', d: '+2 🍀', fx: p => { p.luck += 2; } },
    { t: 'pickpocket', d: 'steal a 🍀 from the leading rival', fx: p => {
      const l = leaderOf(rivals(p));
      if (l.luck) { l.luck--; p.luck++; log(`🫳 ${nm(p)} pinches a 🍀 off ${nm(l)}`); }
      else log(`🫳 ${nm(l)}'s pockets are empty`);
    } },
    { t: 'rush hour', d: 'everyone else back 1', fx: p => Promise.all(rivals(p).map(o => move(o, -1))) },
    { t: 'care package', d: 'a free item', fx: p => giveItem(p) },
    { t: 'charity', d: 'give a 🍀 to whoever is last (if that\'s you, take one)', fx: p => {
      const last = standings().at(-1);
      if (last === p) p.luck++;
      else if (p.luck) { p.luck--; last.luck++; log(`🤝 ${nm(p)} hands a 🍀 to ${nm(last)}`); }
      else log(`🤝 ${nm(p)} has nothing to give`);
    } },
    { t: 'teleporter', d: 'warp to just behind the leading rival', fx: async p => {
      const l = leaderOf(rivals(p));
      if (l.pos - 1 > p.pos) { p.pos = l.pos - 1; await warp([p]); }
      else log(`📡 ${nm(p)} is already out front. nothing happens`);
    } },
    { t: 'cold snap', d: 'whoever is leading freezes for a turn', fx: () => {
      const l = leaderOf(players); l.frozen = true; log(`🧊 ${nm(l)} is frozen`);
    } },
    { t: 'second wind', d: 'take another turn after this one', fx: p => { p.extra = true; } },
    { t: 'butterfingers', d: 'drop all your items', fx: p => { p.items = []; } },
  ];

  /* ── board ── */
  function coord(i) { // tile index → [row, col], clockwise from top-left
    if (i <= 10) return [0, i];
    if (i <= 20) return [i - 10, 10];
    if (i <= 30) return [10, 30 - i];
    return [40 - i, 0];
  }

  function buildBoard() {
    const el = $('board');
    el.querySelectorAll('.tile, .token').forEach(n => n.remove());
    tileEls.length = 0; tokenEls.clear();
    board.forEach((t, i) => {
      const T = TILES[t];
      const [r, c] = coord(i);
      const d = YLN.el(`<div class="tile k-${T.kind}" title="${esc(T.name)}: ${esc(T.desc)}">${T.icon}</div>`);
      d.style.gridArea = `${r + 1} / ${c + 1}`;
      el.appendChild(d);
      tileEls.push(d);
    });
    players.forEach(p => {
      const t = YLN.el('<div class="token"></div>');
      t.style.setProperty('--pc', p.color);
      el.appendChild(t);
      tokenEls.set(p, t);
    });
    placeTokens();
  }

  function placeTokens() {
    players.forEach((p, k) => {
      const tile = tileEls[p.pos % N];
      const tok = tokenEls.get(p);
      if (!tile || !tok) return;
      const w = tile.offsetWidth, h = tile.offsetHeight, s = tok.offsetWidth;
      const x = tile.offsetLeft + w * (0.22 + 0.28 * (k % 3)) - s / 2;
      const y = tile.offsetTop + h * (0.64 + 0.22 * Math.floor(k / 3)) - s / 2;
      tok.style.transform = `translate(${x}px, ${y}px)`;
      tok.classList.toggle('on', p === cur() && !over);
    });
  }

  function render() {
    const p = cur();
    const st = standings();
    YLN.scorebar($('scorebar'), players, {
      active: over ? -1 : turn,
      score: q => `#${st.indexOf(q) + 1} · lap ${Math.min(laps, Math.floor(q.pos / N) + 1)}/${laps} · tile ${q.pos % N}<br>🍀 ${q.luck}${q.items.length ? ' · ' + q.items.map(k => ITEMS[k].icon).join(' ') : ''}${q.frozen ? ' · 🧊 frozen' : ''}`,
    });
    if (p) {
      $('board').style.setProperty('--pc', p.color);
      $('who').textContent = p.name;
      $('meta').textContent = `round ${round} · ${laps} lap race`;
    }
    placeTokens();
  }

  function log(html) {
    const ul = $('log');
    ul.insertAdjacentHTML('afterbegin', `<li>${html}</li>`);
    while (ul.children.length > 60) ul.lastElementChild.remove();
  }
  const hint = html => { $('hint').innerHTML = html; };

  /* ── input: buttons (and dice / glowing tiles) carry data-v ── */
  function choose(opts) {
    $('actions').innerHTML = opts.map(o => `<button class="btn ${o.cls || ''}" data-v="${o.v}" ${o.title ? `title="${esc(o.title)}"` : ''}>${o.label}</button>`).join('');
    return new Promise(r => { pending = r; });
  }
  $('board').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b || !pending || b.disabled) return;
    const r = pending; pending = null;
    $('actions').innerHTML = '';
    r(b.dataset.v);
  });
  document.addEventListener('keydown', e => {
    if (document.querySelector('.overlay') || !pending) return;
    if (e.key === ' ' || e.key === 'Enter') {
      const b = $('actions').querySelector('.btn.accent');
      if (b) { e.preventDefault(); b.click(); }
    }
  });

  /* ── dice ── */
  function landLabel(p, d) {
    const np = p.pos + d;
    if (np >= goal()) return '🏁 finish!';
    const T = TILES[board[np % N]];
    const bump = rivals(p).some(o => o.pos % N === np % N) ? ' · 💥 bump' : '';
    return `${T.icon} ${T.name}${bump}`;
  }

  function showDice(dice, p, pickable = false) {
    const human = pickable && !p.bot;
    const nudge = human && p.luck > 0;
    $('dice').innerHTML = dice.map((d, i) => `<div class="dwrap">
      ${nudge ? `<button class="nudge" data-v="n${i}-" title="nudge down · costs 1 🍀" ${d <= 1 ? 'disabled' : ''}>−</button>` : '<span></span>'}
      <button class="die ${pickable ? 'pick' : ''}" ${human ? `data-v="m${d}"` : 'disabled'}>${d}</button>
      ${nudge ? `<button class="nudge" data-v="n${i}+" title="nudge up · costs 1 🍀" ${d >= 6 ? 'disabled' : ''}>+</button>` : '<span></span>'}
      <div class="land">${pickable ? landLabel(p, d) : ''}</div>
    </div>`).join('');
  }

  async function rollAnim(final, p) {
    for (let f = 0; f < 7; f++) {
      showDice(final.map(d6), p);
      $('dice').querySelectorAll('.die').forEach(d => d.classList.add('rolling'));
      await YLN.sleep(55);
    }
    showDice(final, p);
  }

  function preview(p, dice) {
    clearPreview();
    [...new Set(dice)].forEach(d => {
      const np = p.pos + d;
      const t = tileEls[np >= goal() ? 0 : np % N];
      t.classList.add('pv');
      t.dataset.pv = t.dataset.pv ? `${t.dataset.pv}/${d}` : d;
      if (!p.bot) t.dataset.v = 'm' + d;
    });
  }
  function clearPreview() {
    tileEls.forEach(t => { t.classList.remove('pv'); delete t.dataset.pv; delete t.dataset.v; });
  }

  /* ── movement ── */
  async function move(p, d, { hop = 120 } = {}) {
    const step = Math.sign(d);
    for (let k = 0; k < Math.abs(d); k++) {
      if (p.pos + step < 0) break;
      p.pos += step;
      if (step > 0 && p.pos % N === 0 && p.pos / N > p.lapsDone && p.pos < goal()) {
        p.lapsDone = p.pos / N;
        p.luck++;
        log(`🏁 ${nm(p)} finishes lap ${p.lapsDone}. +1 🍀`);
        YLN.toast(`${esc(p.name)} starts lap ${p.lapsDone + 1}/${laps}`);
      }
      placeTokens();
      if (p.pos >= goal()) { over = true; winner = p; render(); return; }
      await wait(hop);
    }
    render();
  }

  async function warp(list) {
    list.forEach(p => tokenEls.get(p).classList.add('warp'));
    render();
    await YLN.sleep(650);
    list.forEach(p => tokenEls.get(p).classList.remove('warp'));
  }

  async function swap(a, b) {
    [a.pos, b.pos] = [b.pos, a.pos];
    await warp([a, b]);
  }

  async function bumpCheck(p) {
    const hit = rivals(p).filter(o => o.pos % N === p.pos % N);
    if (!hit.length) return;
    log(`💥 ${nm(p)} bumps ${hit.map(nm).join(' & ')} back 2`);
    YLN.toast(`💥 bump!`);
    await Promise.all(hit.map(o => move(o, -2)));
  }

  /* ── items ── */
  function giveItem(p) {
    if (p.items.length >= 2) { log(`🎁 ${nm(p)}'s pockets are full. item wasted`); return; }
    const st = standings();
    const r = players.length > 1 ? st.indexOf(p) / (players.length - 1) : 0;
    const w = ITEM_WEIGHTS[r < 0.34 ? 'front' : r > 0.66 ? 'back' : 'mid'];
    let x = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
    const key = Object.keys(w).find(k => (x -= w[k]) < 0) || 'mushroom';
    p.items.push(key);
    log(`🎁 ${nm(p)} grabs ${ITEMS[key].icon} ${ITEMS[key].name}`);
  }

  async function useItem(p, key, target) {
    p.items.splice(p.items.indexOf(key), 1);
    const it = ITEMS[key];
    const others = rivals(p);
    const tag = `${it.icon} ${nm(p)} uses ${it.name}`;
    hint(`${tag}`);
    switch (key) {
      case 'mushroom': log(`${tag}: forward 3`); await move(p, 3); break;
      case 'magnet': log(`${tag} on ${nm(target)}: back 3`); await move(target, -3); break;
      case 'freezeRay': target.frozen = true; log(`${tag}: ${nm(target)} skips their next turn`); break;
      case 'swapper': log(`${tag}: swaps places with ${nm(target)}`); await swap(p, target); break;
      case 'bomb': { const t = pick(others); log(`${tag}… it lands on ${nm(t)}: back 5`); await move(t, -5); break; }
      case 'shell': { const t = leaderOf(others); log(`${tag}. it hunts down ${nm(t)}: back 4`); await move(t, -4); break; }
      case 'storm': log(`${tag}: everyone else back 2`); await Promise.all(others.map(o => move(o, -2))); break;
    }
    render();
  }

  async function humanTarget(p, it) {
    hint(`${it.icon} <b>${it.name}</b>: ${it.desc}. pick a target, or let the dice decide.`);
    const others = rivals(p);
    const v = await choose([
      ...others.map(o => ({ v: 't' + players.indexOf(o), label: `<span style="color:${o.color}">${esc(o.name)}</span>` })),
      { v: 'rand', label: '🎲 random' },
      { v: 'x', label: 'cancel' },
    ]);
    if (v === 'x') return null;
    if (v === 'rand') { const t = pick(others); YLN.toast(`🎲 the dice pick ${esc(t.name)}`); return t; }
    return players[+v.slice(1)];
  }

  async function humanPreRoll(p) {
    for (;;) {
      hint(p.items.length ? 'use an item first, or just roll.' : 'roll two dice, then move by <b>one</b> of them.');
      const v = await choose([
        { v: 'roll', label: 'roll the dice', cls: 'accent big' },
        ...p.items.map(k => ({ v: 'i' + k, label: `${ITEMS[k].icon} ${ITEMS[k].name}`, title: ITEMS[k].desc })),
      ]);
      if (v === 'roll') return;
      const key = v.slice(1), it = ITEMS[key];
      let target = null;
      if (it.target === 'pick') { target = await humanTarget(p, it); if (!target) continue; }
      await useItem(p, key, target);
      if (over) return;
    }
  }

  async function botPreRoll(p) {
    for (const key of [...p.items]) {
      if (over) return;
      const others = rivals(p), lead = leaderOf(others);
      let target = null;
      if (ITEMS[key].target === 'pick') {
        // mostly goes after the leader, sometimes just picks someone at random
        target = Math.random() < 0.75 ? lead : pick(others);
        if (key === 'swapper' && target.pos - p.pos < 4) continue;
      }
      await wait(500);
      await useItem(p, key, target);
      await wait(500);
    }
  }

  /* ── picking a die ── */
  function score(p, d) {
    const np = p.pos + d;
    if (np >= goal()) return 100 + d;
    const t = board[np % N];
    let s = d + VALUE[t];
    if (t === 'tax' && !p.luck) s = d - 2;
    if (t === 'item' && p.items.length >= 2) s = d;
    if (t === 'swap') s = d + (avg(rivals(p).map(o => o.pos)) - np) * 0.8;
    if (rivals(p).some(o => o.pos % N === np % N)) s += 1.5;
    return s;
  }

  async function humanPick(p, dice) {
    for (;;) {
      showDice(dice, p, true);
      preview(p, dice);
      hint(`pick a die to move by: click it, a glowing tile, or a button.${p.luck ? ` you have 🍀 ${p.luck}: spend one to reroll or nudge a die ±1.` : ''}`);
      const opts = [...new Set(dice)].map(d => ({ v: 'm' + d, label: `move ${d} → ${landLabel(p, d)}`, cls: 'accent' }));
      if (p.luck) opts.push({ v: 'reroll', label: 'reroll both · 🍀1' });
      const v = await choose(opts);
      if (v[0] === 'm') return +v.slice(1);
      p.luck--;
      if (v === 'reroll') {
        dice[0] = d6(); dice[1] = d6();
        await rollAnim(dice, p);
        log(`🍀 ${nm(p)} rerolls: ${dice[0]} & ${dice[1]}`);
      } else {
        const i = +v[1], before = dice[i];
        dice[i] = Math.min(6, Math.max(1, dice[i] + (v[2] === '+' ? 1 : -1)));
        log(`🍀 ${nm(p)} nudges a ${before} into a ${dice[i]}`);
      }
      render();
    }
  }

  async function botPick(p, dice) {
    let spent = 0;
    showDice(dice, p, true);
    preview(p, dice);
    await wait(800);
    for (;;) {
      const best = Math.max(...dice.map(d => score(p, d)));
      if (p.luck > 0 && spent < 2) {
        let nb = -Infinity, nudge = null;
        dice.forEach((d, i) => [-1, 1].forEach(dir => {
          const nd = d + dir;
          if (nd < 1 || nd > 6) return;
          const s = score(p, nd);
          if (s > nb) { nb = s; nudge = [i, nd]; }
        }));
        if (nb - best >= 3) {
          const before = dice[nudge[0]];
          dice[nudge[0]] = nudge[1]; p.luck--; spent++;
          log(`🍀 ${nm(p)} nudges a ${before} into a ${nudge[1]}`);
          showDice(dice, p, true); preview(p, dice); render();
          await wait(800);
          continue;
        }
        if (best < 0.5) {
          p.luck--; spent++;
          dice[0] = d6(); dice[1] = d6();
          await rollAnim(dice, p);
          log(`🍀 ${nm(p)} doesn't like it and rerolls: ${dice[0]} & ${dice[1]}`);
          showDice(dice, p, true); preview(p, dice); render();
          await wait(800);
          continue;
        }
      }
      return dice.reduce((a, d) => (score(p, d) > score(p, a) ? d : a));
    }
  }

  /* ── tiles ── */
  async function gamble(p) {
    let call;
    if (p.bot) {
      await wait(700);
      call = Math.random() < 0.65 ? pick(['hi', 'lo']) : 'walk';
    } else {
      hint('🎰 <b>double or nothing</b>: call it right and go forward 4. wrong and go back 4.');
      call = await choose([
        { v: 'hi', label: 'call high · 4–6', cls: 'accent' },
        { v: 'lo', label: 'call low · 1–3' },
        { v: 'walk', label: 'walk away' },
      ]);
    }
    if (call === 'walk') { log(`🎰 ${nm(p)} walks away from the table`); return; }
    const r = d6();
    await rollAnim([r], p);
    const win = call === 'hi' ? r >= 4 : r <= 3;
    log(`🎰 ${nm(p)} calls ${call === 'hi' ? 'high' : 'low'}, rolls a ${r}: ${win ? 'winner! +4' : 'nope. −4'}`);
    hint(`🎰 rolled a ${r}. ${win ? 'winner!' : 'house wins.'}`);
    await wait(700);
    await move(p, win ? 4 : -4);
  }

  async function drawCard(p) {
    if (!deck.length) deck = YLN.shuffle([...CARDS]);
    const c = deck.pop();
    hint(`<div class="chance"><span class="t">❓ ${c.t}</span><br>${c.d}</div>`);
    log(`❓ ${nm(p)} draws <b>${c.t}</b>: ${c.d}`);
    await wait(1400);
    await c.fx(p);
  }

  async function landOn(p) {
    const key = board[p.pos % N], T = TILES[key];
    if (key === 'blank' || key === 'start') return;
    if (key !== 'chance' && key !== 'gamble') {
      log(`${T.icon} ${nm(p)} hits ${T.name}: ${T.desc}`);
      hint(`${T.icon} <b>${T.name}</b>: ${T.desc}`);
    }
    await wait(450);
    switch (key) {
      case 'boost': await move(p, 3); break;
      case 'ladder': await move(p, 6, { hop: 70 }); break;
      case 'pit': await move(p, -3); break;
      case 'chute': await move(p, -7, { hop: 70 }); break;
      case 'luck': p.luck++; break;
      case 'tax': if (p.luck) p.luck--; else await move(p, -2); break;
      case 'freeze': p.frozen = true; break;
      case 'item': giveItem(p); break;
      case 'chance': await drawCard(p); break;
      case 'gamble': await gamble(p); break;
      case 'swap': {
        const t = pick(rivals(p));
        log(`🌀 ${nm(p)} swaps places with ${nm(t)}`);
        await swap(p, t);
        break;
      }
    }
    render();
  }

  /* ── turns ── */
  async function takeTurn() {
    const p = cur();
    p.turns++;
    clearPreview();
    $('dice').innerHTML = ''; $('actions').innerHTML = '';
    render();
    if (p.frozen) {
      p.frozen = false;
      hint(`🧊 ${nm(p)} is frozen solid. turn skipped.`);
      log(`🧊 ${nm(p)} thaws out (turn skipped)`);
      render();
      await wait(1300);
      return;
    }
    if (p.bot) { hint(`${nm(p)} is thinking…`); await wait(500); await botPreRoll(p); }
    else await humanPreRoll(p);
    if (over) return;

    const dice = [d6(), d6()];
    await rollAnim(dice, p);
    log(`🎲 ${nm(p)} rolls ${dice[0]} & ${dice[1]}`);
    const d = p.bot ? await botPick(p, dice) : await humanPick(p, dice);
    clearPreview();
    showDice(dice, p);
    hint(`${nm(p)} moves ${d}`);
    await move(p, d);
    if (over) return;
    await bumpCheck(p);
    await landOn(p);
    await wait(500);
  }

  async function loop() {
    while (!over) {
      await takeTurn();
      if (over) break;
      if (cur().extra) { cur().extra = false; log(`💨 ${nm(cur())} goes again`); continue; }
      turn = (turn + 1) % players.length;
      if (turn === 0) round++;
    }
    await finishRace();
  }

  /* ── end of race ── */
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

  // tied players play push-your-luck blackjack with a d6. returns them best-first.
  async function dice21(group, place) {
    const o = YLN.el('<div class="overlay"><div class="box d21"></div></div>');
    document.body.appendChild(o);
    const box = o.firstElementChild;
    const res = new Map();
    let act = null;
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (b && act) { const r = act; act = null; r(b.dataset.a); }
    });
    const ask = () => new Promise(r => { act = r; });

    function draw(now, total, rolls, buttons, msg) {
      box.innerHTML = `
        <p class="eyebrow" style="opacity:1;animation:none">// tie for ${ordinal(place)} place</p>
        <h2>dice <span>21</span></h2>
        <p class="muted" style="font-size:12px;line-height:1.7">Roll a die as many times as you dare. Closest to 21 without going over takes the higher spot. Bust and you drop to the bottom.</p>
        <div style="margin:18px 0">${group.map(p => {
          const live = p === now, r = res.get(p);
          const t = live ? total : r ? r.total : null;
          const rs = live ? rolls : r ? r.rolls : [];
          return `<div class="rowp ${live ? 'on' : ''}" style="--pc:${p.color}">
            <span style="color:${p.color}">${esc(p.name)}</span>
            <span class="rolls">${rs.join(' + ')}</span>
            <span class="tot">${t == null || (live && !rolls.length) ? '–' : t > 21 ? 'bust' : t}</span>
          </div>`;
        }).join('')}</div>
        <p style="min-height:1.5em;font-size:13px">${msg || ''}</p>
        <div class="row">${buttons}</div>`;
    }

    for (const p of group) {
      let total = 0;
      const rolls = [];
      while (total < 21) {
        let a;
        if (p.bot) {
          draw(p, total, rolls, '', `${esc(p.name)} is thinking…`);
          await YLN.sleep(650 * speed + 250);
          a = total >= 17 ? 'stick' : 'roll';
        } else {
          draw(p, total, rolls,
            `<button class="btn accent" data-a="roll">roll</button><button class="btn" data-a="stick" ${rolls.length ? '' : 'disabled'}>stick${rolls.length ? ` at ${total}` : ''}</button>`,
            `<span style="color:${p.color}">${esc(p.name)}</span>, your go.`);
          box.querySelector('[data-a=roll]').focus();
          a = await ask();
        }
        if (a === 'stick') break;
        const r = d6();
        rolls.push(r);
        total += r;
      }
      res.set(p, { total, rolls });
      p.tb = total > 21 ? 'bust' : total;
      draw(null, 0, [], '', total > 21 ? `💥 ${esc(p.name)} busts with ${total}` : `${esc(p.name)} ${total === 21 ? 'hits 21!' : `sticks on ${total}`}`);
      await YLN.sleep(1100);
    }

    const val = p => (res.get(p).total > 21 ? -1 : res.get(p).total);
    const sorted = [...group].sort((a, b) => val(b) - val(a));
    const reTie = sorted.some((p, i) => i && val(p) === val(sorted[i - 1]));
    draw(null, 0, [], '<button class="btn accent" data-a="ok">continue →</button>',
      reTie ? 'still tied! the tied ones go again.' : `${esc(sorted[0].name)} takes ${ordinal(place)}.`);
    box.querySelector('[data-a=ok]').focus();
    await ask();
    o.remove();

    const out = [];
    for (let i = 0; i < sorted.length;) {
      let j = i;
      while (j < sorted.length && val(sorted[j]) === val(sorted[i])) j++;
      const g = sorted.slice(i, j);
      out.push(...(g.length > 1 ? await dice21(g, place + i) : g));
      i = j;
    }
    return out;
  }

  async function finishRace() {
    clearPreview();
    $('actions').innerHTML = '';
    render();
    hint(`🏁 ${nm(winner)} crosses the line and wins the race!`);
    log(`🏁 ${nm(winner)} crosses the line after ${winner.turns} turns`);
    YLN.toast(`🏁 ${esc(winner.name)} wins the race!`);
    await YLN.sleep(1800);

    // everyone else ranks by how far round they got. ties go to dice 21.
    const rest = players.filter(p => p !== winner).sort((a, b) => b.pos - a.pos);
    const order = [winner];
    for (let i = 0; i < rest.length;) {
      let j = i;
      while (j < rest.length && rest[j].pos === rest[i].pos) j++;
      const g = rest.slice(i, j);
      order.push(...(g.length > 1 ? await dice21(g, order.length + 1) : g));
      i = j;
    }

    YLN.podium('lucky-lap', order.map((p, k) => ({
      player: p,
      score: order.length - k,
      display: k === 0 ? `🏁 finished · ${p.turns} turns` : `${goal() - p.pos} tiles short${p.tb != null ? ` · dice 21: ${p.tb}` : ''}`,
    })), { note: `${laps} lap${laps > 1 ? 's' : ''} · ${round} rounds` });
  }

  /* ── setup ── */
  function drawLegend() {
    $('legendTiles').innerHTML = Object.values(TILES).filter(T => T.kind !== 'neutral')
      .map(T => `<div class="it k-${T.kind}"><span class="ic">${T.icon}</span><span><b>${T.name}</b>${T.desc}</span></div>`).join('');
    $('legendItems').innerHTML = Object.values(ITEMS)
      .map(it => `<div class="it"><span class="ic">${it.icon}</span><span><b>${it.name}</b>${it.desc}</span></div>`).join('');
  }

  async function start() {
    const { players: humans, settings } = await YLN.setupPlayers({
      game: 'lucky-lap', min: 1, max: 6,
      intro: 'Add the humans. Empty seats get filled with bots 🤖.',
      options: [
        { key: 'seats', label: 'seats at the table', value: 4, choices: [4, 5, 6].map(v => ({ value: v, label: String(v) })) },
        { key: 'laps', label: 'laps', value: 2, choices: [1, 2, 3, 5].map(v => ({ value: v, label: String(v) })) },
        { key: 'board', label: 'board', value: 'classic', choices: [{ value: 'classic', label: 'classic' }, { value: 'shuffled', label: 'shuffled' }] },
        { key: 'speed', label: 'bot speed', value: 0.6, choices: [{ value: 1, label: 'chill' }, { value: 0.6, label: 'normal' }, { value: 0.25, label: 'zoom' }] },
      ],
    });
    laps = settings.laps;
    speed = settings.speed;

    const seats = Math.max(settings.seats, humans.length);
    const used = humans.map(h => h.color);
    const free = YLN.COLORS.filter(c => !used.includes(c));
    const names = YLN.shuffle([...BOT_NAMES]);
    const all = [...humans];
    while (all.length < seats) all.push({ name: '🤖 ' + names.pop(), color: free.shift() || pick(YLN.COLORS), bot: true });
    players = all.map(p => ({ ...p, pos: 0, luck: 1, items: [], frozen: false, extra: false, lapsDone: 0, turns: 0, tb: null }));

    board = settings.board === 'classic' ? [...CLASSIC] : ['start', ...YLN.shuffle(CLASSIC.slice(1))];
    turn = 0; round = 1; over = false; winner = null;
    deck = YLN.shuffle([...CARDS]);
    buildBoard();
    render();
    log(`🏁 ${laps} lap${laps > 1 ? 's' : ''}. everyone starts with 1 🍀. good luck.`);
    loop();
  }

  $('newGame').onclick = () => location.reload();
  window.addEventListener('resize', placeTokens);
  drawLegend();
  start();
})();
