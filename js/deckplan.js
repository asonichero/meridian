// Project Meridian — the deck plan, as the Captain sees it between scenes (day.html; docs/day.md): the ship's general arrangement drawn from
// above (docs/ship-general-arrangement.html), every room on the one deck, who's where at this hour, the Captain's routine and the Proctor's
// suggestion of what's next. A room is chosen to go there. It comes up when a scene ends, or from the plan button; nothing in the world shows
// it (it reads as the Captain's tablet from its frame alone).
//
//   const plan = DeckPlan.create(parent, { go(room), wait(to), close() })
//   plan.show({ state, next, hint, who(t) → [{ id, room, doing, asleep }], name(id), canClose }) · plan.hide() · plan.shown
(function (root) {
'use strict';
const D = () => root.Day, C = () => root.Crew;

// ── The drawing (the general arrangement's deck plan, shield and roof cut away) ──────────────────────────────────────────────────────────
const fins = y0 => Array.from({ length: 13 }, (_, i) => `<line x1="${583 + 25 * i}" y1="${y0}" x2="${583 + 25 * i}" y2="${y0 + 56}"/>`).join('');
const DRAWING = `
<polygon points="192,52 936,52 936,388 192,388 166,362 166,78" class="dash"/>
<rect x="558" y="66" width="350" height="56" class="wing"/><rect x="558" y="318" width="350" height="56" class="wing"/>
<g class="fin">${fins(66)}${fins(318)}</g>
<text x="124" y="128" text-anchor="end" class="lbl hd">STBD</text><text x="124" y="225" text-anchor="end" class="lbl hd">FORE</text><text x="124" y="322" text-anchor="end" class="lbl hd">PORT</text>
<polygon points="152,122 922,122 922,318 152,318 138,290 138,150" class="hull"/>
<rect x="250" y="206" width="504" height="28" class="corr"/>
<line x1="250" y1="122" x2="250" y2="318" class="room"/>
<line x1="144" y1="170" x2="144" y2="270" class="screen"/>
<text x="152" y="163" class="lbl sm dk">viewscreen</text>
<text x="200" y="142" text-anchor="middle" class="lbl hd">BRIDGE</text>
<rect x="166" y="212" width="14" height="16" rx="2" class="furn"/><rect x="182" y="178" width="16" height="12" rx="2" class="furn"/><rect x="182" y="250" width="16" height="12" rx="2" class="furn"/>
<rect x="212" y="207" width="22" height="26" rx="4" class="furn"/><rect x="204" y="197" width="38" height="46" class="rail"/>
<text x="210" y="286" text-anchor="middle" class="lbl sm mut">viewport</text><text x="210" y="298" text-anchor="middle" class="lbl sm mut">overhead</text>
<rect x="250" y="122" width="42" height="84" class="room"/><rect x="292" y="122" width="42" height="84" class="room"/><rect x="334" y="122" width="42" height="84" class="room"/>
<rect x="255" y="126" width="32" height="11" rx="2" class="furn"/><rect x="297" y="126" width="32" height="11" rx="2" class="furn"/><rect x="339" y="126" width="32" height="11" rx="2" class="furn"/>
<rect x="254" y="186" width="14" height="16" class="furn"/><rect x="296" y="186" width="14" height="16" class="furn"/><rect x="338" y="186" width="14" height="16" class="furn"/>
<line x1="272" y1="206" x2="286" y2="206" class="door"/><line x1="314" y1="206" x2="328" y2="206" class="door"/><line x1="356" y1="206" x2="370" y2="206" class="door"/>
<text x="271" y="160" text-anchor="middle" class="lbl sm">KIT</text><text x="313" y="160" text-anchor="middle" class="lbl sm">ROWAN</text><text x="355" y="160" text-anchor="middle" class="lbl sm">SEFA</text>
<rect x="250" y="234" width="49" height="84" class="room"/>
<text x="274" y="270" text-anchor="middle" class="lbl sm">READY</text>
<line x1="250" y1="280" x2="250" y2="300" class="door"/>
<rect x="299" y="234" width="77" height="84" class="room"/>
<rect x="352" y="296" width="20" height="18" class="furn"/><rect x="330" y="300" width="16" height="14" class="furn"/>
<line x1="306" y1="234" x2="322" y2="234" class="door"/><line x1="299" y1="246" x2="299" y2="262" class="door"/>
<text x="337" y="266" text-anchor="middle" class="lbl sm">CAPTAIN</text><text x="337" y="280" text-anchor="middle" class="lbl sm mut">head · shower</text>
<rect x="376" y="122" width="196" height="84" class="room"/>
<text x="474" y="140" text-anchor="middle" class="lbl sm">GALLEY &amp; MESS</text>
<rect x="380" y="126" width="84" height="8" class="furn"/><rect x="396" y="150" width="50" height="11" rx="2" class="furn"/><rect x="474" y="164" width="66" height="14" rx="2" class="furn"/>
<line x1="474" y1="159" x2="540" y2="159" class="bh"/><line x1="474" y1="183" x2="540" y2="183" class="bh"/>
<rect x="556" y="132" width="10" height="56" rx="2" class="furn"/>
<line x1="392" y1="206" x2="552" y2="206" class="door"/>
<rect x="376" y="234" width="126" height="84" class="room"/>
<text x="439" y="276" text-anchor="middle" class="lbl sm">SUIT BAY</text><text x="439" y="290" text-anchor="middle" class="lbl sm mut">airlock fwd</text>
<line x1="452" y1="234" x2="468" y2="234" class="door"/>
<path d="M420,318 A12,12 0 0 0 444,318" class="hull"/><line x1="422" y1="318" x2="442" y2="318" class="door"/>
<text x="432" y="348" text-anchor="middle" class="lbl">airlock · docking collar</text>
<rect x="502" y="234" width="70" height="84" class="room"/>
<text x="537" y="276" text-anchor="middle" class="lbl sm">MED BAY</text>
<line x1="502" y1="288" x2="502" y2="304" class="door"/><line x1="522" y1="234" x2="538" y2="234" class="door"/>
<rect x="572" y="122" width="42" height="84" class="room"/><rect x="614" y="122" width="42" height="84" class="room"/><rect x="656" y="122" width="42" height="84" class="room"/>
<rect x="577" y="126" width="32" height="11" rx="2" class="furn"/><rect x="619" y="126" width="32" height="11" rx="2" class="furn"/><rect x="661" y="126" width="32" height="11" rx="2" class="furn"/>
<rect x="576" y="186" width="14" height="16" class="furn"/><rect x="618" y="186" width="14" height="16" class="furn"/><rect x="660" y="186" width="14" height="16" class="furn"/>
<line x1="594" y1="206" x2="608" y2="206" class="door"/><line x1="636" y1="206" x2="650" y2="206" class="door"/><line x1="678" y1="206" x2="692" y2="206" class="door"/>
<text x="593" y="160" text-anchor="middle" class="lbl sm">MORGAN</text><text x="635" y="160" text-anchor="middle" class="lbl sm">NOOR</text><text x="677" y="160" text-anchor="middle" class="lbl sm">SAM</text>
<rect x="698" y="122" width="56" height="84" class="room"/>
<line x1="704" y1="206" x2="732" y2="206" class="door"/>
<text x="726" y="160" text-anchor="middle" class="lbl sm">SHOWERS</text><text x="726" y="173" text-anchor="middle" class="lbl sm mut">communal</text>
<rect x="572" y="234" width="112" height="84" class="room"/>
<line x1="600" y1="234" x2="616" y2="234" class="door"/>
<text x="628" y="272" text-anchor="middle" class="lbl sm">HYDROPONICS</text><text x="628" y="286" text-anchor="middle" class="lbl sm mut">&amp; life support</text>
<rect x="684" y="234" width="70" height="84" class="room"/>
<line x1="700" y1="234" x2="716" y2="234" class="door"/>
<text x="719" y="272" text-anchor="middle" class="lbl sm">WORKSHOP</text><text x="719" y="286" text-anchor="middle" class="lbl sm mut">spares</text>
<text x="470" y="224" text-anchor="middle" class="lbl sm mut">spine corridor</text>
<rect x="750" y="122" width="8" height="196" class="solid"/>
<text x="840" y="142" text-anchor="middle" class="lbl hd">REACTOR</text>
<circle cx="840" cy="220" r="54" class="rail"/><circle cx="840" cy="220" r="38" class="drive"/>
<text x="840" y="224" text-anchor="middle" class="lbl sm drv">core</text>
<text x="840" y="300" text-anchor="middle" class="lbl sm mut">walkway · rail</text>`;

// Where each room is on the drawing (its outline, for choosing it and lighting it), and where people stand in it (markers, in order).
const AREA = {
  bridge: { d: 'M152,122 L250,122 L250,318 L152,318 L138,290 L138,150 Z', at: [[172, 186], [172, 254], [228, 168], [228, 272], [190, 300], [160, 220]], cap: [223, 220] },
  ready: { r: [250, 234, 49, 84], at: [[262, 300], [287, 300]], cap: [274, 292] },
  captain: { r: [299, 234, 77, 84], at: [[318, 296]], cap: [314, 299] },
  mess: { r: [376, 122, 196, 84], at: [[486, 152], [508, 152], [530, 152], [486, 190], [508, 190], [530, 190], [420, 178], [548, 160]], cap: [462, 190] },
  suitbay: { r: [376, 234, 126, 84], at: [[400, 256], [478, 256]], cap: [410, 300] },
  medbay: { r: [502, 234, 70, 84], at: [[524, 254], [550, 300]], cap: [520, 300] },
  hydro: { r: [572, 234, 112, 84], at: [[598, 300], [656, 300], [656, 254]], cap: [598, 256] },
  reactor: { r: [758, 122, 164, 196], at: [[790, 178], [890, 178], [890, 262], [790, 262]], cap: [800, 272] },
};
// (in the drawing's order; the Captain's own room's marker sits where they'd be in it)
const CABIN_AT = { pilot: [276, 178], scientist: [318, 178], comms: [360, 178], medic: [598, 178], lifesupport: [640, 178], engineer: [682, 178] };
const CABIN_R = { pilot: [250, 122, 42, 84], scientist: [292, 122, 42, 84], comms: [334, 122, 42, 84], medic: [572, 122, 42, 84], lifesupport: [614, 122, 42, 84], engineer: [656, 122, 42, 84] };

const CSS = `
.dp-wrap { position: fixed; inset: 0; z-index: 8; display: none; align-items: center; justify-content: center; background: rgba(4, 6, 9, 0.62); backdrop-filter: blur(3px);
  padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)); box-sizing: border-box; }
.dp-wrap.on { display: flex; }
.dp { --paper: #0f161c; --sheet: #141d24; --ink: #d4dee5; --muted: #8b9ca9; --rule: #2b3843; --grid: rgba(212, 222, 229, 0.045); --hull: #1c2730; --corr: rgba(212, 222, 229, 0.07);
  --deck: #55b9b1; --deckfill: rgba(85, 185, 177, 0.17); --drive: #ec9c45; --drivefill: rgba(236, 156, 69, 0.24); --amber: #e8a84a;
  --display: "Saira Condensed", "Arial Narrow", "Roboto Condensed", sans-serif; --body: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  width: min(1180px, 100%); max-height: 100%; display: flex; flex-direction: column; background: var(--paper); color: var(--ink); font: 400 14px/1.45 var(--body);
  border-radius: 26px; border: 1px solid #2a3540; box-shadow: 0 0 0 10px #06090c, 0 0 0 11px #222c35, 0 30px 80px rgba(0, 0, 0, 0.6); overflow: hidden; }
.dp-top { display: flex; align-items: flex-end; gap: 16px; padding: 14px 20px 10px; border-bottom: 2px solid var(--ink); }
.dp-top .eb { font: 500 11px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.dp-top h1 { font: 700 26px/1 var(--display); letter-spacing: 0.04em; text-transform: uppercase; margin: 2px 0 0; }
.dp-top .clk { margin-left: auto; text-align: right; } .dp-top .clk b { display: block; font: 600 30px/1 var(--mono); font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.dp-top .x { align-self: center; margin-left: 6px; }
.dp button { font: 500 13px var(--body); color: var(--ink); background: var(--sheet); border: 1px solid var(--rule); border-radius: 10px; padding: 7px 12px; cursor: pointer; }
.dp button:hover { border-color: var(--deck); } .dp button.go { background: rgba(85, 185, 177, 0.18); border-color: var(--deck); color: #dff6f3; } .dp button:disabled { opacity: 0.4; cursor: default; }
.dp-body { display: grid; grid-template-columns: minmax(0, 1fr) 270px; gap: 0; min-height: 0; flex: 1 1 auto; overflow: hidden; }
.dp-map { background-color: var(--sheet); background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 14px 14px;
  overflow: auto; min-width: 0; border-right: 1px solid var(--rule); }
.dp-map svg { display: block; width: 100%; min-width: 700px; height: auto; color: var(--ink); }
.dp-side { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; overflow-y: auto; min-height: 0; }
.dp-side h2 { font: 600 14px var(--display); letter-spacing: 0.09em; text-transform: uppercase; margin: 0; color: var(--muted); }
.dp-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; font-size: 13px; }
.dp-steps li { display: grid; grid-template-columns: 46px 1fr 16px; gap: 6px; padding: 3px 4px; border-radius: 6px; color: var(--muted); }
.dp-steps li .tm { font: 400 12px var(--mono); font-variant-numeric: tabular-nums; } .dp-steps li .st { text-align: center; }
.dp-steps li.done { color: var(--ink); } .dp-steps li.done .st { color: var(--deck); } .dp-steps li.missed .st { color: var(--drive); } .dp-steps li.missed .nm { text-decoration: line-through; opacity: 0.7; }
.dp-steps li.now { background: var(--deckfill); color: var(--ink); } .dp-steps li.now .st { color: var(--deck); }
.dp-steps li small { display: block; color: var(--muted); font-size: 11px; }
.dp-sel { border: 1px solid var(--rule); border-radius: 12px; padding: 10px 12px; display: none; flex-direction: column; gap: 6px; }
.dp-sel.on { display: flex; } .dp-sel b { font: 600 16px var(--display); letter-spacing: 0.06em; text-transform: uppercase; }
.dp-sel ul { list-style: none; margin: 0; padding: 0; font-size: 13px; } .dp-sel li span { color: var(--muted); }
.dp-sel .what { font-size: 12px; color: var(--muted); }
.dp-bot { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-top: 1px solid var(--rule); background: var(--sheet); }
.dp-bot .who { font: 500 11px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--deck); white-space: nowrap; }
.dp-bot .txt { flex: 1 1 auto; min-width: 0; } .dp-bot .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.dp svg .hull { fill: var(--hull); stroke: currentColor; stroke-width: 1.5; } .dp svg .wing { fill: var(--hull); stroke: currentColor; stroke-width: 1; }
.dp svg .fin { stroke: currentColor; stroke-width: 0.8; opacity: 0.5; } .dp svg .room { fill: none; stroke: currentColor; stroke-width: 1; }
.dp svg .corr { fill: var(--corr); } .dp svg .furn { fill: var(--hull); stroke: currentColor; stroke-width: 1; } .dp svg .solid { fill: currentColor; }
.dp svg .screen { stroke: var(--deck); stroke-width: 4; stroke-linecap: round; } .dp svg .door { stroke: var(--deck); stroke-width: 3; }
.dp svg .drive { fill: var(--drivefill); stroke: var(--drive); stroke-width: 1.5; } .dp svg .dash { stroke: var(--muted); stroke-width: 1; fill: none; stroke-dasharray: 4 4; }
.dp svg .bh { stroke: currentColor; stroke-width: 1; opacity: 0.55; } .dp svg .rail { fill: none; stroke: currentColor; stroke-width: 1; stroke-dasharray: 3 3; }
.dp svg .lbl { fill: currentColor; font: 500 11px var(--mono); letter-spacing: 0.02em; } .dp svg .sm { font-size: 10px; } .dp svg .mut { fill: var(--muted); }
.dp svg .dk { fill: var(--deck); } .dp svg .drv { fill: var(--drive); } .dp svg .hd { font: 600 13px var(--display); letter-spacing: 0.09em; }
.dp svg .hit { fill: transparent; stroke: none; cursor: pointer; } .dp svg .hit:hover, .dp svg .hit.sel { fill: var(--deckfill); }
.dp svg .hit.cab { cursor: default; } .dp svg .hit.cab:hover { fill: rgba(212, 222, 229, 0.04); }
.dp svg .sugg { fill: none; stroke: var(--deck); stroke-width: 2.5; pointer-events: none; animation: dp-pulse 1.6s ease-in-out infinite; }
@keyframes dp-pulse { 0%, 100% { stroke-opacity: 0.25; } 50% { stroke-opacity: 1; } }
.dp svg .mk circle { stroke: #0f161c; stroke-width: 1.5; } .dp svg .mk text { font: 600 8.5px var(--mono); fill: #0f161c; pointer-events: none; }
.dp svg .mk.sleep circle { opacity: 0.45; } .dp svg .mk.sleep text { opacity: 0.6; }
.dp svg .cap circle { fill: none; stroke: var(--amber); stroke-width: 2.4; } .dp svg .cap text { fill: var(--amber); font: 700 8px var(--mono); }
@media (max-width: 860px) { .dp-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto; overflow-y: auto; } .dp-map { border-right: 0; border-bottom: 1px solid var(--rule); } .dp-side { overflow: visible; } }
@media (max-width: 560px) { .dp { border-radius: 18px; } .dp-top { padding: 10px 14px 8px; } .dp-top h1 { font-size: 20px; } .dp-top .clk b { font-size: 24px; } .dp-bot { flex-wrap: wrap; } .dp-bot .who { width: 100%; } }
@media (max-height: 520px) { .dp-top { padding: 6px 14px 6px; } .dp-top h1 { font-size: 18px; } .dp-top .clk b { font-size: 20px; } }
`;

function create(parent, cb) {
  if (!document.getElementById('dp-css')) { const s = document.createElement('style'); s.id = 'dp-css'; s.textContent = CSS; document.head.append(s); }
  const wrap = document.createElement('div'); wrap.className = 'dp-wrap'; parent.append(wrap);
  wrap.innerHTML = `<div class="dp" role="dialog" aria-label="Deck plan">
    <div class="dp-top"><div><div class="eb" id="dpEb">Meridian · one deck</div><h1>Deck plan</h1></div><div class="clk"><span class="eb" id="dpDay"></span><b id="dpClk"></b></div><button class="x" id="dpX" aria-label="Close">✕</button></div>
    <div class="dp-body"><div class="dp-map"><svg viewBox="70 44 870 352" role="img" aria-label="The deck from above: the bridge at the bow, the reactor at the stern, every room off the spine corridor; who's where now, and the room suggested next">
      <g>${DRAWING}</g><g id="dpHits"></g><g id="dpSugg"></g><g id="dpMk"></g></svg></div>
      <div class="dp-side"><div class="dp-sel" id="dpSel"></div><h2>Today</h2><ul class="dp-steps" id="dpSteps"></ul></div></div>
    <div class="dp-bot"><span class="who">The Proctor</span><span class="txt" id="dpHint"></span><span class="acts" id="dpActs"></span></div></div>`;
  const $ = id => wrap.querySelector('#' + id), NS = 'http://www.w3.org/2000/svg';
  const el = (tag, at, parentEl) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parentEl) parentEl.append(e); return e; };
  let cur = null, sel = null;
  $('dpX').onclick = () => cb.close && cb.close();
  addEventListener('keydown', e => { if (!wrap.classList.contains('on')) return; if (e.key === 'Escape' && cur && cur.canClose) cb.close && cb.close(); });
  // the rooms to choose, and the cabins (who's in each)
  const hits = $('dpHits');
  for (const [room, A] of Object.entries(AREA)) {
    const h = A.d ? el('path', { d: A.d, class: 'hit' }, hits) : el('rect', { x: A.r[0], y: A.r[1], width: A.r[2], height: A.r[3], class: 'hit' }, hits);
    h.dataset.room = room; h.onclick = () => select(room);
  }
  for (const [id, r] of Object.entries(CABIN_R)) { const h = el('rect', { x: r[0], y: r[1], width: r[2], height: r[3], class: 'hit cab' }, hits); h.dataset.room = 'cabin:' + id; h.onclick = () => select('cabin:' + id); }
  const rname = room => (room.startsWith('cabin:') ? `${C().ROSTER[room.slice(6)].name.split(' ')[0]}’s cabin` : D().ROOMS[room].name);
  const dur = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);
  function select(room) {
    sel = room; hits.querySelectorAll('.hit').forEach(h => h.classList.toggle('sel', h.dataset.room === room));
    const s = cur.state, box = $('dpSel'), here = cur.who(s.t).filter(w => w.room === room);
    const people = here.length ? `<ul>${here.map(w => `<li>${cur.name(w.id)} <span>· ${w.doing}</span></li>`).join('')}</ul>` : '<div class="what">Nobody here now.</div>';
    let what = '', go = '';
    if (room.startsWith('cabin:')) what = '<div class="what">Their own space: not visited.</div>';
    else if (room === cur.at) what = '<div class="what">You’re here.</div>';
    else {
      const r = D().resolve(s, room);
      if (r.kind === 'step') { const st = r.step; what = `<div class="what">${st.name}${st.rooms ? ': ' + rname(room).toLowerCase() : ''} · ${D().clock(Math.max(s.t, st.at))}${st.dur ? ' · ' + dur(st.dur) : ''}</div>`; }
      else what = `<div class="what">A visit · ${dur(D().VISIT)}${warn(s, D().VISIT)}</div>`;
      go = `<button class="go" id="dpGo">Go to ${rname(room)}</button>`;
    }
    box.innerHTML = `<b>${rname(room)}</b>${people}${what}${go}`; box.classList.add('on');
    const g = box.querySelector('#dpGo'); if (g) g.onclick = () => cb.go(room);
  }
  // (a visit that would run past the start of what's next: said, not stopped)
  function warn(s, m) { const n = D().next(s); if (n.kind !== 'free' && n.kind !== 'step') return ''; const end = s.t + m, st = n.step; return st.id !== 'lights' && end > st.until ? ` · you’d miss ${st.name.toLowerCase()}` : end > st.at && n.kind === 'free' ? ` · runs into ${st.name.toLowerCase()}` : ''; }
  function show(o) {
    cur = o; const s = o.state, n = o.next, st = D().STEPS;
    $('dpDay').textContent = `Day ${s.day} · ${D().light(s.t) === 'day' ? 'ship’s day' : 'ship’s night'}`; $('dpClk').textContent = D().clock(s.t);
    $('dpX').style.display = o.canClose ? '' : 'none';
    // the routine, each step with how it went (or that it's now)
    $('dpSteps').innerHTML = st.map(x => {
      const cls = s.done[x.id] === true ? 'done' : s.done[x.id] ? 'done part' : s.missed[x.id] ? 'missed' : n.step && n.step.id === x.id ? 'now' : '';
      const mark = s.done[x.id] === true ? '✓' : s.done[x.id] ? '½' : s.missed[x.id] ? '✕' : cls === 'now' ? '▸' : '';
      const sub = x.rooms ? `<small>${x.rooms.map(r => (s.rounds[r] ? '✓ ' : '') + D().ROOMS[r].name).join(' · ')}</small>` : x.id === 'briefing' ? `<small>${o.name(D().watchFor(s.day))} hands over</small>` : x.id === 'handover' ? `<small>${o.name(D().watchFor(s.day + 1))} takes the watch</small>` : '';
      return `<li class="${cls}"><span class="tm">${D().clock(x.at)}</span><span class="nm">${x.name}${sub}</span><span class="st">${mark}</span></li>`;
    }).join('');
    // the suggestion, lit on the plan
    const sg = $('dpSugg'); sg.innerHTML = '';
    if (n.room && AREA[n.room]) { const A = AREA[n.room]; if (A.d) el('path', { d: A.d, class: 'sugg' }, sg); else el('rect', { x: A.r[0] + 1.5, y: A.r[1] + 1.5, width: A.r[2] - 3, height: A.r[3] - 3, class: 'sugg' }, sg); }
    // who's where: each crew member a dot in their department's colour, their initial in it; asleep, faded; the Captain a ring
    const mk = $('dpMk'); mk.innerHTML = ''; const used = {};
    for (const w of o.who(s.t)) {
      let p;
      if (w.room.startsWith('cabin:')) p = CABIN_AT[w.id];
      else { const A = AREA[w.room]; if (!A) continue; const i = used[w.room] = (used[w.room] || 0) + 1; p = A.at[(i - 1) % A.at.length]; }
      const g = el('g', { class: 'mk' + (w.asleep ? ' sleep' : '') }, mk), r = C().ROSTER[w.id];
      el('circle', { cx: p[0], cy: p[1], r: 7.5, fill: r.dept }, g); const t = el('text', { x: p[0], y: p[1] + 3, 'text-anchor': 'middle' }, g); t.textContent = r.name[0];
      const ti = el('title', {}, g); ti.textContent = `${o.name(w.id)} · ${w.doing}`;
    }
    if (o.at && AREA[o.at]) { const p = AREA[o.at].cap, g = el('g', { class: 'cap' }, mk); el('circle', { cx: p[0], cy: p[1], r: 8 }, g); const t = el('text', { x: p[0], y: p[1] + 3, 'text-anchor': 'middle' }, g); t.textContent = 'YOU'; t.setAttribute('font-size', '6'); }
    // the Proctor's line, and its actions: go where it suggests; or, with time in hand, pass it until then
    $('dpHint').textContent = o.hint;
    const acts = $('dpActs'); acts.innerHTML = '';
    if (n.kind === 'step' && n.room && n.room !== o.at) { const b = document.createElement('button'); b.className = 'go'; b.textContent = `Go to ${rname(n.room)}`; b.onclick = () => cb.go(n.room); acts.append(b); }
    else if (n.kind === 'step' && n.room === o.at) { const b = document.createElement('button'); b.className = 'go'; b.textContent = n.step.name; b.onclick = () => cb.go(n.room); acts.append(b); }
    if (n.kind === 'free') {
      const w = document.createElement('button'); w.textContent = `Pass the time until ${D().clock(n.at)}`; w.onclick = () => cb.wait(n.at); acts.append(w);
      if (n.room && AREA[n.room]) { const b = document.createElement('button'); b.textContent = `${n.step.name}: ${rname(n.room)}`; b.onclick = () => select(n.room); acts.append(b); }
    }
    $('dpSel').classList.remove('on'); sel = null; hits.querySelectorAll('.hit').forEach(h => h.classList.remove('sel'));
    wrap.classList.add('on');
    // (on a narrow screen the plan scrolls: to the suggestion)
    const m = wrap.querySelector('.dp-map'); if (m.scrollWidth > m.clientWidth && n.room && AREA[n.room]) { const A = AREA[n.room], x = A.r ? A.r[0] : 150; m.scrollLeft = Math.max(0, (x - 70) / 870 * m.scrollWidth - m.clientWidth / 2); }
  }
  return { show, hide: () => { wrap.classList.remove('on'); }, get shown() { return wrap.classList.contains('on'); }, select };
}

root.DeckPlan = { create, AREA };
})(typeof window !== 'undefined' ? window : globalThis);
