// The cards' contents (25d, Revision 4 of #355): built from the card's parts (js/card.js) and what the planner says;
// the planner keeps the actions. A card shows only what can be done now: in the route's view, what works there and
// the planner's note with Edit.
import { h, icon, toast } from './ui.js';
import { nums, group, rows, acts, item, lockNote, segIcons, mainButton } from './card.js';
import { pointNums } from './facts.js';
import { ACTIVITIES, CRAFTS } from './config.js';
import { fmtDist } from './geo.js';
import { isNight, staysNear, DEFAULT_BREAK, DEFAULT_ON, hhmm } from './stops.js';

// the point's own marker, as the map draws it
export function pointMark(pl, i) {
  const n = pl.points.length, last = i === n - 1 && i > 0, loop = last && pl.isLoop();
  return h('span', { class: `wp ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${loop ? ' wp-loop' : ''}` }, i === 0 || last ? '' : String(i));
}

// one choice of several, in a list of rows: a radio group named for screen readers
function choices(label, items) {
  const list = rows(...items);
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-label', label);
  return list;
}

// − 30 min + in one box, the number typable (the round trip's Other… field, #356)
function stepper({ value, unit, step, min = 0, max = 1440, label, set, line = null, lead = null }) {
  const put = (v) => { v = Math.max(min, Math.min(max, Math.round(v))); if (v !== value) set(v); };
  return h('div', { class: 'rt-step' }, lead ? h('span', {}, lead) : null,
    h('div', { class: 'rt-len' },
      h('button', { type: 'button', class: 'tool', 'aria-label': `${step} minutes less`, disabled: value <= min, onclick: () => put(value - step), html: icon('minus', 20) }),
      h('input', { type: 'text', inputmode: 'numeric', enterkeyhint: 'done', value: String(value), 'aria-label': label,
        onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
        onchange: (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (Number.isFinite(v)) put(v); else e.target.value = String(value); } }), h('span', {}, unit),
      h('button', { type: 'button', class: 'tool', 'aria-label': `${step} minutes more`, disabled: value >= max, onclick: () => put(value + step), html: icon('plus', 20) })),
    line ? h('small', {}, line) : null);
}

// A point's card [p-point, r-stop, r-night, r-change, r-start, r-end, r-view-point]
export function pointCard(pl, p) {
  const card = {
    kind: 'point', key: p, pill: null,
    get i() { return pl.points.indexOf(card.key); },
    get title() { return card.renaming ? card.nameField() : pl.nameOf(card.i); },
    get label() { return pl.nameOf(card.i); },
    get sub() { const i = card.i, kind = i === 0 ? 'Start' : i === pl.points.length - 1 ? 'End' : `Via ${i}`; return pl.nameOf(i) === kind || pl.nameOf(i) === pl.label(i) ? '' : kind; }, // (no name of its own: "Via 1" once)
    get save() { return card.renaming ? h('button', { type: 'button', class: 'btn primary', onclick: () => card.endRename(true) }, 'Save') : null; },
    mark: () => pointMark(pl, card.i),
    at: () => card.key,
    alive: () => pl.findPoint(card),
    build: (body) => pointBody(pl, card, body),
  };
  // Rename: the name typed where it's shown, with Save; Enter saves, Escape leaves it as it was
  card.nameField = () => {
    if (!card.input) {
      const i = card.i;
      card.input = h('input', { class: 'name-field', type: 'text', value: pl.pname.get(card.key) || '', placeholder: pl.autoName(i) || pl.label(i), maxlength: 60, spellcheck: 'false', 'aria-label': 'The point’s name',
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); card.endRename(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); card.endRename(false); } } });
    }
    return card.input;
  };
  card.endRename = (keep) => {
    if (!card.renaming) return;
    const v = card.input.value;
    card.renaming = false;
    card.input = null;
    pl.cards.box?.querySelector('.way-hint')?.focus({ preventScroll: true }); // (out of the field, so the card is built again)
    const k = card.i;
    if (keep && k >= 0) pl.setName(k, v);
    pl.cards.refresh();
    pl.cards.box?.querySelector('.way-hint')?.focus({ preventScroll: true });
  };
  return card;
}

function pointBody(pl, card, body) {
  const i = card.i, n = pl.points.length, last = i === n - 1 && i > 0, via = i > 0 && !last, loop = pl.isLoop(), view = pl.inView();
  const name = pl.nameOf(i);
  // (while a leg is routed, or the analysis is of the route before it, what isn't known yet waits in its place)
  const pending = pl.points.length > 1 && !pl.analysisFits();
  const when = i === 0 ? pl.startSec() : pl.analysis ? pl.arriveAt(i) : null;
  body.append(nums(pointNums(pl.analysis, i, { when, along: pl.lengthTo(i), clock: (s) => pl.clockOf(s), pending })));
  // …and once routing has ended, numbers along a leg that couldn't be routed, or waits for the router, say so
  const before = pl.legs.slice(0, i), failed = before.some((l) => l.status === 'error'), waits = before.some((l) => l.status === 'waiting');
  if (!pending && (failed || waits)) {
    body.append(h('p', { class: 'rt-cost' }, failed ? 'A leg before it couldn’t be routed, so these are along a straight line there. Check has a Retry.'
      : 'A leg before it waits for the router, so these are along a straight line there for now.'));
  }
  // At this point: Pass by · Stop · Night, and the stop's minutes or the night's morning hour under it
  if (via) {
    const stop = pl.stopAt(i), night = isNight(stop);
    const set = (st) => { pl.setStop(i, st); pl.cards.refresh(); };
    body.append(h('h4', { class: 'menu-h' }, 'At this point'), segIcons('At this point', [
      { k: 'pass', label: 'Pass by', icon: 'pass', on: !stop },
      { k: 'stop', label: 'Stop', icon: 'pause', on: !!stop && !night },
      { k: 'night', label: 'Night', icon: 'moon', on: night },
    ], (k) => set(k === 'night' ? { on: (stop && stop.on) ?? DEFAULT_ON } : k === 'stop' ? { min: (stop && stop.min) || DEFAULT_BREAK } : null)));
    const arrive = pl.analysis ? pl.arriveAt(i) : null, w = pl.analysis && (pl.analysis.waits || []).find((x) => x.i === i);
    if (stop && !night) {
      body.append(stepper({ value: stop.min, unit: 'min', step: 5, min: 1, label: `Minutes of the stop at ${name}`, set: (min) => set({ min }),
        line: arrive ? `You get here at ${pl.clockOf(arrive)}${w ? ` and go on at ${pl.clockOf(arrive + w.sec)}` : ''}` : null }));
    }
    if (night) {
      // Go on at: the morning's hour, a choice with its value (as Route style), its hours a card of their own [r-goon]
      body.append(h('div', { class: 'rt-step' }, h('span', {}, 'Go on at'),
        h('button', { type: 'button', class: 'stylebtn', 'aria-label': `Go on from ${name} at ${hhmm(stop.on)}`, onclick: () => pl.cards.open(goOnCard(pl, card), { at: card.key, from: card }), html: icon('chevronDown', 14) }, h('span', {}, hhmm(stop.on))),
        h('span', {}, 'the next morning')));
      if (!view) body.append(rows(item({ icon: 'hut', label: 'Places to sleep nearby', line: 'Lean-tos, huts and campsites within 3 km', chev: true, onclick: () => pl.cards.open(staysCard(pl, card), { at: card.key, from: card }) })));
    }
  }
  // the start: when you leave
  if (i === 0 && n > 1) {
    body.append(rows(item({ icon: 'clock', label: 'Leave at', line: 'Sets the times and the weather along the route', val: pl.departLabel(), chev: true, onclick: () => pl.cards.open(leaveCard(pl, card), { at: card.key, from: card }) })));
  }
  // Next stretch, to Via 4: where it goes, in its name, so a desktop says it too (its line is a tooltip there; 2026-10-22)
  const after = pl.legs[i] ? item({ icon: 'route', label: `Next stretch, to ${pl.nameOf(i + 1)}`, line: 'Its sport, how it’s drawn and its style', chev: true, onclick: () => pl.openLegAfter(i) }) : null;
  if (view) { body.append(rows(after), lockNote('You’re not editing: the route stays as it is.', () => { pl.setEditing(true); pl.cards.refresh(); })); return; }
  // the sport from here on, and at a change of sport its minutes and the gear
  if (pl.legs[i]) {
    const sp = pl.legSport(i);
    body.append(rows(item({ icon: pl.sportIcon(sp), label: 'Sport from here', line: 'To the next change of sport, or the end', val: ACTIVITIES[sp].label, chev: true, onclick: () => pl.cards.open(sportCard(pl, card), { at: card.key, from: card }) })));
  }
  const ch = pl.changeAt(i);
  if (ch) {
    body.append(stepper({ lead: 'Changeover', value: ch.min, unit: 'min', step: 5, min: 0, max: 600, label: `Minutes to change to ${ACTIVITIES[ch.to].label} at ${name}`, set: (min) => { pl.setChangeMin(i, min); pl.cards.refresh(); } }));
    const what = pl.gearAt(i);
    if (what) {
      body.append(h('label', { class: 'tg' }, h('span', { class: 'tg-text' }, `Take ${what} along`, h('small', {}, 'Off: it stays here, and Check makes sure you come back for it')),
        h('input', { type: 'checkbox', role: 'switch', checked: pl.carryAt(i), onchange: (e) => pl.setCarry(i, e.target.checked) }),
        h('span', { class: 'tg-ui', 'aria-hidden': 'true' })));
    }
  }
  if (after) body.append(rows(after));
  // The route: the start and the end turn it round; the end, not on a loop, goes back to the start
  const undo = { label: 'Undo', fn: () => pl.undo() };
  const reverse = item({ icon: 'reverse', label: 'Reverse', line: 'The route runs the other way, from the end to the start', k: 'reverse', onclick: () => { pl.reverse(); toast('The route runs the other way now', { ms: 7000, action: undo }); } });
  if (last) body.append(...group('The route', loop ? null : item({ icon: 'loop', label: 'Back to start', line: 'Adds a leg back to the start', k: 'back', onclick: () => { pl.backToStart(); toast('A leg back to the start is added', { ms: 7000, action: undo }); } }), reverse));
  if (i === 0 && n > 1) body.append(...group('The route', reverse));
  // Edit this point; Start here and End here say what they remove; Remove apart, in red
  body.append(h('h4', { class: 'menu-h' }, 'Edit this point'), acts(
    item({ icon: 'move', label: 'Move', line: `${pl.coarse() ? 'Tap' : 'Click'} where it goes`, k: 'move', onclick: () => pl.moveOnCard(card) }),
    item({ icon: 'pencil', label: 'Rename', line: 'Give it a name of your own', k: 'rename', onclick: () => { card.renaming = true; pl.cards.refresh(); card.input?.focus(); card.input?.select(); } }),
    via ? item({ icon: 'flag', label: 'Start here', line: loop ? 'The same loop, starting from this point' : 'The part before it is removed, Undo brings it back', k: 'start', onclick: () => pl.startAt(card.i) }) : null,
    via && !loop ? item({ icon: 'flagend', label: 'End here', line: 'The part after it is removed, Undo brings it back', k: 'end', onclick: () => pl.finishAt(card.i) }) : null));
  body.append(h('hr'), acts(item({ icon: 'trash', label: 'Remove', line: 'Undo brings it back', danger: true, k: 'remove', onclick: () => pl.removeOnCard(card) })));
}

// Go on at ›: the morning's hour of a night [r-goon]
function goOnCard(pl, point) {
  const stop = () => pl.stopAt(point.i);
  return {
    kind: 'goon', get key() { return point.key; }, pill: null, title: 'Go on at', sub: 'the next morning',
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point) && isNight(stop()),
    build: (body) => {
      const on = stop().on, hours = [...new Set([...Array.from({ length: 6 }, (_, k) => (5 + k) * 60), on])].sort((a, b) => a - b); // (05:00 to 10:00, and the hour set now)
      body.append(choices('Go on at', hours.map((m) => item({ icon: 'clock', label: hhmm(m), role: 'radio', checked: m === on, onclick: () => { const k = point.i; pl.cards.back(); if (k >= 0) pl.setStop(k, { on: m }); } }))));
    },
  };
}

// Sport from here ›: the sports, the one in force ticked, "your route" on the route's own [r-sport]
// A sport with crafts (Paddle) has them under its row once it's picked, and the card stays open at them, as the pill's
// menu does: the craft is the whole route's (it decides how calm the water must be, and the time)
function sportCard(pl, point) {
  const sports = pl.app.sports ? pl.app.sports() : Object.keys(ACTIVITIES).map((k) => ({ k, label: ACTIVITIES[k].label, icon: 'route' }));
  const card = {
    kind: 'sport', get key() { return point.key; }, pill: null, title: 'Sport from here', span: null, get sub() { return `From ${pl.nameOf(point.i)} to the next change of sport, or the end`; },
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point),
    build: (body) => {
      const i = point.i, cur = pl.legSport(i), route = pl.mainSport();
      // a second pick in this card changes the legs the first one did, no more (the end of them kept by who it is)
      const pick = (k, sport) => {
        const s = card.span, last = s ? pl.points.findIndex((q) => pl.pid.get(q) === s) - 1 : null;
        const j = pl.setSportFrom(k, sport, { last: last != null && last >= k ? last : null });
        if (!s && j != null) card.span = pl.pidOf(pl.points[j + 1]);
      };
      body.append(choices('Sport from here', sports.flatMap((x) => {
        const row = item({
          icon: x.icon, label: x.label, line: (ACTIVITIES[x.k].line || '').replace(/ · /g, ', '), role: 'radio', checked: x.k === cur, cur: x.k === route ? 'your route' : null,
          onclick: () => { const k = point.i; if (k < 0) return; if (CRAFTS[x.k]) { pick(k, x.k); pl.cards.refresh(); } else { pl.cards.back(); pick(k, x.k); } },
        });
        const crafts = x.k === cur && CRAFTS[x.k];
        if (!crafts) return [row];
        return [row, h('div', { class: 'way-chips', role: 'group', 'aria-label': `${x.label}: the craft` },
          ...Object.entries(crafts).map(([k, c]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pl.craft === k),
            onclick: () => { pl.setCraft(k); pl.cards.refresh(); }, html: pl.craft === k ? icon('check', 15) : '' }, h('span', {}, c.label)))),
        h('p', { class: 'rt-cost' }, `For all your ${x.label.toLowerCase()} legs. Polku keeps a canoe or a SUP to calmer water than a sea kayak, and times the route at its speed.`)];
      })));
    },
  };
  return card;
}

// Leave at ›: now, or an hour of the next two days (as Go's Depart)
function leaveCard(pl, point) {
  return {
    kind: 'leave', get key() { return point.key; }, pill: null, title: 'Leave at', sub: 'Sets the times and the weather along the route',
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point),
    build: (body) => body.append(choices('Leave at', pl.departChoices().map(({ k, label }) => item({
      icon: 'clock', label, role: 'radio', checked: k === pl.startOffsetH, onclick: () => { pl.cards.back(); pl.setStartOffset(k); },
    })))),
  };
}

// Places to sleep nearby ›: lean-tos, huts and campsites within 3 km (LIPAS and OpenStreetMap); a tap moves the night there [r-stays]
function staysCard(pl, point) {
  const card = {
    kind: 'stays', get key() { return point.key; }, pill: null, title: 'Places to sleep nearby', get sub() { return pl.nameOf(point.i); },
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point), found: null, state: 'looking',
    build: (body) => {
      const list = (card.found || []).map((x) => item({ icon: 'hut', label: x.name, line: `${x.kind}, ${fmtDist(x.d)}`, chev: true, onclick: () => {
        const k = point.i;
        pl.cards.back();
        if (k >= 0) { pl.moveToStay(k, x); toast(`The night moved to ${x.name}`, { ms: 7000, action: { label: 'Undo', fn: () => pl.undo() } }); }
      } }));
      body.append(rows(...list) || h('p', { class: 'rt-cost' }, { looking: 'Looking in LIPAS and OpenStreetMap…', none: 'No lean-tos, huts or campsites within 3 km in LIPAS or OpenStreetMap.', failed: 'LIPAS and OpenStreetMap didn’t answer.' }[card.state] || ''));
      if (card.state === 'looking' && list.length) body.append(h('p', { class: 'rt-cost' }, 'Still looking…'));
      if (list.length) body.append(h('p', { class: 'rt-cost' }, 'From LIPAS and OpenStreetMap. Tap one to move the night there.'));
      if (card.state === 'failed') body.append(h('button', { type: 'button', class: 'btn', onclick: () => look(), html: icon('reverse', 16) }, h('span', {}, 'Try again')));
    },
  };
  const look = async () => {
    const p = point.key;
    card.state = 'looking';
    card.found = null;
    const show = () => { if (pl.cards.current === card) pl.cards.refresh(); };
    try {
      card.found = await staysNear(p, 3, (part) => { card.found = part; show(); });
      card.state = card.found.length ? 'done' : 'none';
    } catch { card.state = 'failed'; }
    show();
  };
  look();
  return card;
}

// ------------------------------------------------------------------ an item of Check (25d part 3)
const GROUP = { read: ['Read before you go', 'warnf'], look: ['Worth a look', 'eye'], not: ['Not checked', 'unk'] };
// where an item comes from, in words: "Live · Fintraffic, 18:40", "From the map · OpenStreetMap", "An estimate · …"
const SRC = { live: ['Live', 'live'], map: ['From the map', 'mapsrc'], estimate: ['An estimate', 'est'], calculated: ['Calculated', 'check'], router: ['Routing', 'route'] };
// a note as a sentence: its first letter up, unless it begins with a tag (foot=private) or a name; a full stop
const sentence = (t) => { t = String(t || '').trim(); return t ? `${/^[a-zäöå]+(?![=:_\w])/.test(t) ? t[0].toUpperCase() + t.slice(1) : t}${/[.!?:]$/.test(t) ? '' : '.'}` : ''; };

// An item's card [r-item, jc-step, jc-desk-sel]: its group's mark and name, where it is and how long, where it comes from,
// its note, its one main action, the rest of its actions as rows; on a phone ‹ › along the route and All in Check ›.
// `key`: itemKey(), which finds it again in a new analysis; closed when it's gone.
export function itemCard(pl, key, from) {
  const card = {
    kind: 'item', itemKey: key, from,
    get it() { return pl.itemByKey(card.itemKey); },
    get title() { return card.it ? card.it.w.text : ''; },
    get sub() { return card.it ? GROUP[card.it.g][0] : ''; },
    mark: () => (card.it.g === 'not' ? h('span', { class: 'heads-mark not' }, '?') : h('span', { class: `heads-mark ${card.it.g}`, html: icon(GROUP[card.it.g][1], 18) })),
    at: () => (card.it ? pl.itemPlace(card.it.w) : null),
    alive: () => !!card.it,
    build: (body) => itemBody(pl, card, body),
  };
  return card;
}

function itemBody(pl, card, body) {
  const it = card.it, { g, w } = it, a = pl.analysis;
  // where: how far from the start and how long (and how steep, for the terrain's), or the whole route
  if (w.ranges === null) body.append(h('p', { class: 'heads-where' }, h('b', {}, 'The whole route')));
  else {
    const [i0, i1] = pl.itemSpan(w);
    let steep = 0;
    if (w.src && w.src.by === 'the terrain model') for (let i = i0; i <= i1; i++) steep = Math.max(steep, Math.abs(a.grade[i] || 0));
    body.append(nums([{ value: fmtDist(w.at), label: 'from the start' }, w.len > 5 ? { value: fmtDist(w.len), label: 'long' } : null, steep ? { value: `${Math.round(steep)} %`, label: 'steepest' } : null]));
    if (w.items) body.append(h('p', { class: 'heads-where' }, pl.whereOf(w)));
  }
  // where it comes from (Not checked says it in its group's name)
  if (g !== 'not' && w.src) {
    const [say, ic] = SRC[w.src.kind] || SRC.map, by = `${w.src.by}${w.src.kind === 'live' && w.src.at ? `, ${new Date(w.src.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`;
    body.append(h('p', { class: 'heads-src' }, h('span', { 'aria-hidden': 'true', html: icon(ic, 14) }),
      h('span', {}, `${say} · `, w.src.url ? h('a', { href: w.src.url, target: '_blank', rel: 'noopener' }, by) : by)));
  }
  if (w.note) body.append(h('p', { class: 'heads-note' }, sentence(w.note)));
  // the one main action; in the route's view only what doesn't change the route
  const { main, more } = pl.itemActions(it);
  if (main && pl.inView() && main.edits) body.append(lockNote('You’re not editing: the route stays as it is.', () => { pl.setEditing(true); pl.cards.refresh(); }));
  else if (main) body.append(mainButton(main.label, main.icon, () => main.fn()));
  // Got it: marked read, and on a phone the next unread along the route; once read, it says so and can be undone
  const read = pl.isRead(it);
  body.append(h('button', { type: 'button', class: `btn heads-got${read ? ' on' : ''}`, 'aria-pressed': String(read), onclick: () => pl.gotIt(card), html: icon('check', 20) }, h('span', {}, read ? 'Read · Mark unread' : 'Got it')));
  if (more.length) body.append(rows(...more.map((m) => item({ icon: m.icon, label: m.label, line: m.line, onclick: () => m.fn() }))));
  // the planner put away: the way to it, at this item [jc-closed]
  if (!pl.active) body.append(rows(item({ icon: 'route', label: 'Open the planner at it', line: 'Check and the route, at this item', chev: true, onclick: () => pl.openPlannerAt(card) })));
  // on a phone: ‹ › along the route, and All in Check › unless it was opened from Check at half
  if (pl.cards.where() !== 'peek') return;
  const [k, n] = pl.itemIndex(card.itemKey), saved = pl.cards.saved;
  const fromCheck = card.from === 'check' && !(saved && saved.sheet === 'peek');
  body.append(h('div', { class: 'heads-step' },
    h('button', { type: 'button', class: 'tool', 'aria-label': 'Previous', title: 'The one before, along the route', disabled: k <= 0, onclick: () => pl.stepItem(-1), html: icon('chevronLeft', 20) }),
    h('span', { 'aria-live': 'polite' }, `${k + 1} of ${n}`),
    h('button', { type: 'button', class: 'tool', 'aria-label': 'Next', title: 'The next one along the route', disabled: k >= n - 1, onclick: () => pl.stepItem(1), html: icon('chevronRight', 20) }),
    fromCheck ? null : h('button', { type: 'button', class: 'btn quiet heads-all', onclick: () => pl.allInCheck(card) }, h('span', {}, 'All in Check'), h('span', { 'aria-hidden': 'true', html: icon('chevronRight', 16) }))));
  // its stretch lit again for a new analysis (its samples move)
  if (pl.itemLit) pl.lightItem(w, { frame: false });
}

