// The cards' contents (25d, Revision 4 of #355): built from the card's parts (js/card.js) and what the planner says;
// the planner keeps the actions. A card shows only what can be done now: in the route's view, what works there and
// the planner's note with Edit.
import { h, icon, toast } from './ui.js';
import { nums, group, rows, acts, item, lockNote, segIcons, mainButton } from './card.js';
import { pointNums, headline, wayFacts, SPORT_FACTS } from './facts.js';
import { ACTIVITIES, CRAFTS } from './config.js';
import { STYLES, styleName } from './styles.js';
import { fmtDist, fmtDuration } from './geo.js';
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
  // the start while drawing: Back to start first, one tap from a route that comes back (#334's A, 2026-10-24)
  if (i === 0 && n > 1 && !view && !loop) {
    body.append(acts(item({ icon: 'loop', label: 'Back to start', line: 'Adds a leg back to the start', k: 'back', onclick: () => { pl.backToStart(); toast('A leg back to the start is added', { ms: 7000, action: { label: 'Undo', fn: () => pl.undo() } }); } })));
  }
  // the start: when you leave
  if (i === 0 && n > 1) {
    body.append(rows(item({ icon: 'clock', label: 'Leave at', line: 'Sets the times and the weather along the route', val: pl.departLabel(), chev: true, onclick: () => pl.cards.open(leaveCard(pl, card), { at: card.key, from: card }) })));
  }
  // Next stretch, to Via 4: where it goes, in its name, so a desktop says it too (its line is a tooltip there; 2026-10-22).
  // A stretch runs to the next point you see (1b): from a point that only shapes the line, the stretch it's on.
  const str = pl.legs[i] ? pl.stretchAt(i) : null;
  const after = str ? item({ icon: 'route', label: `Next stretch, to ${pl.nameOf(str.to)}`, line: 'Its sport, how it’s drawn and its style', chev: true,
    onclick: () => { const s = pl.stretchAt(card.i); pl.cards.open(stretchCard(pl, s), { at: pl.stretchMiddle(s), from: card }); } }) : null;
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

// ------------------------------------------------------------------ the route and its stretches (25d's 1b)
// the thing's own mark, as the map draws it: the line with the spot on it, a stretch between two points, the whole route
const svg = (inner) => h('span', { html: `<svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true">${inner}</svg>` });
const LINE = (color) => `<path d="M7 22C15 22 18 8 27 8" fill="none" style="stroke:${color}" stroke-width="4.5" stroke-linecap="round"/>`;
const END = (x, y) => `<circle cx="${x}" cy="${y}" r="4.6" style="fill:var(--surface-solid);stroke:var(--text)" stroke-width="2.6"/>`;
const wayMark = () => svg(`<path d="M2 23C13 23 19 7 32 7" fill="none" style="stroke:var(--route)" stroke-width="4.5" stroke-linecap="round"/><circle cx="16.5" cy="15" r="5.5" style="fill:var(--accent-bg);stroke:#fff" stroke-width="2.6"/>`);
const stretchMark = () => svg(LINE('var(--route)') + END(7, 22) + END(27, 8));
const editMark = () => svg(LINE('var(--accent-bg)') + END(7, 22) + END(27, 8));
const routeMark = () => svg(`${LINE('var(--route)')}<circle cx="7" cy="22" r="5.2" style="fill:#2e9e5b;stroke:#fff" stroke-width="2.2"/><circle cx="27" cy="8" r="5.2" style="fill:#111;stroke:#fff" stroke-width="2.2"/>`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// a warning on a stretch: its box in its group's colour, opening its card (Journey C's warn-row)
const TIER = { read: ['danger', 'warnf', 'Read before you go'], look: ['look', 'eye', 'Worth a look'], not: ['unk', 'unk', 'Not checked'] };
function warnBox(pl, x, from) {
  const [cls, ic, say] = TIER[x.g];
  return h('button', { type: 'button', class: `warn-row ${cls}`, onclick: () => pl.openItemCard(x, { from }) },
    h('span', { 'aria-hidden': 'true', html: icon(ic, 20) }), h('span', {}, h('em', {}, say), h('b', {}, x.w.text), x.w.ranges !== null && pl.analysis ? h('small', {}, `at km ${(x.w.at / 1000).toFixed(1)}`) : null),
    h('span', { 'aria-hidden': 'true', html: icon('chevronRight', 18) }));
}

// A tap on the route [p-route, d-route, w-hike, r6-route-b]: the way at the spot, three numbers for your sport, a
// warning on its stretch, then This stretch, What's here and Edit this stretch; On the profile and Avoid this spot
// (#364's B); The whole route › (#90's B). The pill adds a point at the spot. `ll` is the spot: the card finds its leg
// again by it after every change (route()), and closes when the route no longer passes there.
export function routeCard(pl, li, ll) {
  const card = {
    kind: 'route', key: ll, li,
    get spot() { return pl.routeSpot(card.key); },
    get title() { const x = card.spot; return x ? x.name || cap(x.kind) : 'The route'; },
    get label() { return card.title; },
    get sub() { const x = card.spot; return x ? `${x.name ? `${cap(x.kind)}, ` : ''}${fmtDist(x.along)} from the start` : ''; },
    get pill() { return pl.inView() ? null : { label: 'Add a point here', icon: 'plus', fn: () => pl.addOnCard(card) }; },
    mark: wayMark, at: () => card.key,
    alive: () => { const k = pl.legNear(card.key); if (k == null) return false; card.li = k; return true; },
    get stretch() { return pl.stretchAt(card.li); },
    build: (body) => routeBody(pl, card, body),
  };
  return card;
}

// what each of the route's numbers is, while it waits for the route to be worked out
const WAITING = { clock: 'there at', grade: 'uphill', mtb: 'difficulty', sac: 'trail grade', surface: 'surface', wind: 'wind', temp: 'temperature' };
function routeBody(pl, card, body) {
  const view = pl.inView(), x = card.spot, s = card.stretch, sport = pl.legSport(card.li);
  body.append(nums(x ? headline(pl.analysis, x.i, sport, { when: pl.atSample(x.i), clock: (t) => pl.clockOf(t) })
    : (SPORT_FACTS[sport] || SPORT_FACTS.mtb).map((k) => ({ value: '–', label: WAITING[k], wait: true }))));
  // the most serious warning on its stretch
  const warn = pl.itemsOn(s)[0];
  if (warn) body.append(warnBox(pl, warn, card));
  body.append(rows(
    item({ icon: 'route', label: 'This stretch', line: `${pl.nameOf(s.from)} → ${pl.nameOf(s.to)}`, chev: true, onclick: () => pl.cards.open(stretchCard(pl, s, { spot: card.key }), { at: card.key, from: card }) }),
    item({ icon: 'info', label: 'What’s here', line: x && x.kind === 'open water' ? 'The water, as the map knows it' : 'The trail, as the map knows it', chev: true, onclick: () => pl.cards.open(hereCard(pl, card), { at: card.key, from: card }) }),
    view ? null : item({ icon: 'pencil', label: 'Edit this stretch', line: 'Sport, how it’s drawn, style', chev: true, onclick: () => pl.cards.open(editCard(pl, s, { spot: card.key }), { at: card.key, from: card }) })));
  body.append(acts(
    pl.analysis ? item({ icon: 'mountain', label: 'On the profile', line: 'Zooms the profile to this stretch', k: 'profile', onclick: () => pl.showStretchOnProfile(card.stretch) }) : null,
    view ? null : item({ icon: 'avoid', label: 'Avoid this spot', line: 'The route goes around it, 40 m', k: 'avoid', onclick: () => { pl.cards.close(); pl.addNogo(card.key, 40, 'Avoided place'); } })));
  body.append(h('hr'), rows(item({ icon: 'more', label: 'The whole route', line: view ? 'Share, export or save it offline' : 'Share, export, save offline, reverse or clear it', chev: true, onclick: () => pl.cards.open(wholeCard(pl), { at: card.key, from: card }) })));
  if (view) body.append(lockNote('You’re not editing: the route stays as it is.', () => { pl.setEditing(true); pl.cards.refresh(); }));
}

// a stretch's two ends, kept by who they are through an edit, Undo and Redo, as a point's card keeps its point
function stretchKeys(pl, s) {
  const ends = { a: pl.points[s.from], b: pl.points[s.to] };
  return {
    ends,
    get s() { return { from: pl.points.indexOf(ends.a), to: pl.points.indexOf(ends.b) }; },
    alive: () => pl.findPoint({ get key() { return ends.a; }, set key(p) { ends.a = p; } }) && pl.findPoint({ get key() { return ends.b; }, set key(p) { ends.b = p; } }) && pl.points.indexOf(ends.a) < pl.points.indexOf(ends.b),
  };
}

// This stretch › [p-stretch, r6-stretch]: both ends, its distance, time and climb, what to look out for, Edit this
// stretch, On the profile. `spot`: where it was opened on the line (for Stop here and Avoid this spot), or null.
export function stretchCard(pl, s, { spot = null } = {}) {
  const k = stretchKeys(pl, s);
  const card = {
    kind: 'stretch', key: k.ends, spot,
    get s() { return k.s; },
    get title() { const t = k.s; return `${pl.nameOf(t.from)} → ${pl.nameOf(t.to)}`; },
    get label() { return card.title; },
    sub: 'This stretch', mark: stretchMark, at: () => spot || pl.stretchMiddle(k.s), alive: k.alive,
    build: (body) => {
      const t = k.s, n = pl.stretchNums(t);
      body.append(nums(n ? [{ value: fmtDist(n.len), label: 'distance' }, { value: fmtDuration(n.sec), label: 'time' }, n.up == null ? { value: '?', label: 'climb not known yet', missing: true } : { value: `↑${Math.round(n.up)} m`, label: 'climb' }]
        : [{ value: '–', label: 'distance', wait: true }, { value: '–', label: 'time', wait: true }, { value: '–', label: 'climb', wait: true }]));
      const look = pl.itemsOn(t);
      if (look.length) body.append(h('h4', { class: 'menu-h' }, 'Look out for'), ...look.map((x) => warnBox(pl, x, card)));
      if (pl.inView()) body.append(lockNote('You’re not editing: the route stays as it is.', () => { pl.setEditing(true); pl.cards.refresh(); }));
      else body.append(mainButton('Edit this stretch', 'pencil', () => pl.cards.open(editCard(pl, k.s, { spot }), { at: card.at(), from: card })));
      if (pl.analysis) body.append(rows(item({ icon: 'mountain', label: 'On the profile', line: 'Zooms the profile to this stretch', onclick: () => pl.showStretchOnProfile(k.s) })));
    },
  };
  return card;
}

// Edit this stretch [p-edit, jd-stretch]: what it applies to (its legs), its sport, how it's drawn (only what fits:
// nothing on a fixed line) and its style; Other ways for one leg, Stop here, Avoid this spot (Avoid a spot here, picked
// on the map, when it was opened with no spot), On the profile. Each change is one step of Undo for every leg in it.
export function editCard(pl, s, { spot = null } = {}) {
  const k = stretchKeys(pl, s);
  const card = {
    kind: 'edit', key: k.ends, spot, title: 'Edit this stretch',
    get s() { return k.s; },
    get sub() { const t = k.s; return `${pl.nameOf(t.from)} → ${pl.nameOf(t.to)}`; },
    mark: editMark, at: () => spot || pl.stretchMiddle(k.s), alive: k.alive,
    build: (body) => {
      const t = k.s, legs = pl.legs.slice(t.from, t.to), leg = legs[0], n = legs.length, sport = pl.legSport(t.from), route = pl.app.activity();
      const own = sport !== route, water = ['paddle', 'swim'].includes(sport), fixed = leg.mode === 'fixed';
      body.append(h('p', { class: 'rt-cost' }, `Changes apply to this stretch: its ${n === 1 ? 'one leg' : `${n} legs`}`));
      body.append(h('h4', { class: 'menu-h' }, 'How you go'),
        rows(item({ icon: pl.sportIcon(sport), label: 'Sport', line: own ? `This stretch only, the route is ${ACTIVITIES[route].label}` : 'Like the rest of the route', val: ACTIVITIES[sport].label, chev: true, k: 'sport',
          onclick: () => pl.cards.open(stretchSportCard(pl, card), { at: card.at(), from: card }) })));
      if (fixed) body.append(h('p', { class: 'rt-cost' }, leg.src ? 'Its own line, from LIPAS' : 'Its own line, from the file you imported'));
      else {
        const ways = water ? ['water', 'line'] : ['auto', 'line'];
        body.append(segIcons('How it’s drawn', ways.map((m) => ({ k: m, label: { auto: 'Follow paths', line: 'Straight line', water: 'Over water' }[m], icon: { auto: 'auto', line: 'straight', water: 'water' }[m], on: leg.mode === m })),
          (m) => pl.setStretch(k.s, { mode: m })));
        if (leg.mode !== 'line') {
          const base = pl.styleOf(sport);
          body.append(rows(item({ icon: 'sliders', label: 'Route style', line: leg.style ? 'This stretch’s own' : `${ACTIVITIES[sport].label}’s style, the same as the route`, val: styleName(sport, leg.style || base), chev: true, k: 'style',
            onclick: () => pl.cards.open(stretchStyleCard(pl, card), { at: card.at(), from: card }) })));
        }
      }
      const one = n === 1 && leg.mode === 'auto' && leg.status === 'ok' && leg.result && leg.result.provider !== 'valhalla';
      body.append(h('h4', { class: 'menu-h' }, 'On this stretch'), acts(
        one ? item({ icon: 'route', label: 'Other ways', line: 'Up to two, on the map', k: 'other', onclick: () => { pl.cards.close(); pl.offerAlts(k.s.from, true); } }) : null,
        item({ icon: 'pause', label: 'Stop here', line: spot ? 'A break or a night at this spot' : `A break or a night: ${pl.coarse() ? 'tap' : 'click'} where`, k: 'stophere', onclick: () => pl.stopOnStretch(card) }),
        item({ icon: 'avoid', label: spot ? 'Avoid this spot' : 'Avoid a spot here', line: spot ? 'The route goes around it, 40 m' : `${pl.coarse() ? 'Tap' : 'Click'} where: the route goes around it, 40 m`, k: 'avoid', onclick: () => pl.avoidOnStretch(card) }),
        pl.analysis ? item({ icon: 'mountain', label: 'On the profile', line: 'Zooms the profile to this stretch', k: 'profile', onclick: () => pl.showStretchOnProfile(k.s) }) : null));
    },
  };
  return card;
}

// Edit this stretch › Sport: the sports, the stretch's ticked, "your route" on the route's own; a pick is one step of
// Undo and goes back
function stretchSportCard(pl, edit) {
  const sports = pl.app.sports ? pl.app.sports() : Object.keys(ACTIVITIES).map((k) => ({ k, label: ACTIVITIES[k].label, icon: 'route' }));
  return {
    kind: 'esport', get key() { return edit.key; }, get s() { return edit.s; }, title: 'Sport for this stretch', get sub() { return edit.sub; },
    mark: editMark, at: () => edit.at(), alive: () => edit.alive(),
    build: (body) => {
      const cur = pl.legSport(edit.s.from), route = pl.app.activity();
      body.append(choices('Sport for this stretch', sports.map((x) => item({
        icon: x.icon, label: x.label, line: (ACTIVITIES[x.k].line || '').replace(/ · /g, ', '), role: 'radio', checked: x.k === cur, cur: x.k === route ? 'your route' : null,
        onclick: () => { const s = edit.s; pl.cards.back(); pl.setStretch(s, { sport: x.k }); },
      }))));
    },
  };
}

// Edit this stretch › Route style: the route's, or a style of its own for this stretch; Fine-tune… opens How you go's
function stretchStyleCard(pl, edit) {
  return {
    kind: 'estyle', get key() { return edit.key; }, get s() { return edit.s; }, title: 'Route style', get sub() { return edit.sub; },
    mark: editMark, at: () => edit.at(), alive: () => edit.alive(),
    build: (body) => {
      const s = edit.s, sport = pl.legSport(s.from), own = pl.legs[s.from].style, base = pl.styleOf(sport), cat = STYLES[sport] || STYLES.mtb;
      const pick = (style) => { pl.cards.back(); pl.setStretch(s, { style }); };
      body.append(choices('Route style', [
        item({ icon: 'sliders', label: `The route’s, ${styleName(sport, base)}`, role: 'radio', checked: !own, onclick: () => pick(null) }),
        ...cat.presets.map(([k, label]) => item({ icon: 'sliders', label, role: 'radio', checked: !!own && own.p === k, onclick: () => pick({ p: k, v: {}, wet: base.wet || 'auto' }) })),
      ]), rows(item({ icon: 'sliders', label: 'Fine-tune', line: 'Its terrain, climbs and roads, in How you go', chev: true, onclick: () => { pl.cards.close(); pl.styleLeg = s.from; pl.renderStyle(); pl.reveal('style'); } })));
    },
  };
}

// What's here › [p-under]: the way under the line, as the route's own tags know it, in groups, your sport's first;
// OpenStreetMap's own data on demand (part 6 makes this its levels)
function hereCard(pl, route) {
  const card = {
    kind: 'here', get key() { return route.key; }, get stretch() { return route.stretch; }, get title() { return route.title; }, get sub() { const x = route.spot; return x && x.name ? cap(x.kind) : ''; }, // (a way with no name is its kind, once)
    mark: wayMark, at: () => route.key, alive: () => route.alive(), osm: null,
    build: (body) => {
      const x = route.spot;
      if (!x) { body.append(h('p', { class: 'rt-cost' }, 'The route is being worked out…')); return; }
      // (on open water there's no trail to grade: it says so, rather than every grade "not mapped")
      const water = x.kind === 'open water';
      body.append(h('p', { class: 'rt-cost' }, water ? 'Open water: the map has no trail here.' : 'From OpenStreetMap, along your route'));
      let g = null;
      for (const f of wayFacts(x.tags, pl.legSport(route.li)).filter((f) => !water || ['In winter', 'Last checked'].includes(f.group))) {
        if (f.group !== g) { g = f.group; body.append(h('h4', { class: 'menu-h' }, g)); }
        body.append(h('div', { class: 'insp-row' }, h('span', {}, f.label), h('b', {}, f.value)));
      }
      if (card.osm && card.osm.rows) body.append(h('h4', { class: 'menu-h' }, 'All OpenStreetMap details'), ...card.osm.rows.map(([k, v]) => h('div', { class: 'insp-row' }, h('span', {}, k), h('b', {}, v))));
      else body.append(rows(item({ icon: 'details', label: 'All OpenStreetMap details', line: card.osm ? card.osm.state : 'The map’s own data, as tags', k: 'osm', onclick: () => pl.osmOnCard(card, route.key) })));
    },
  };
  return card;
}

// The whole route › [r6-whole-b, r6-whole-menu]: what ⋯ has, in its groups and order, as rows; Clear route apart, in
// red. In the route's view, what works there: taking it along.
export function wholeCard(pl) {
  const done = (fn) => () => { pl.cards.close(); fn(); };
  const undo = { label: 'Undo', fn: () => pl.undo() };
  return {
    kind: 'whole', key: 'whole', get title() { return pl.routeTitle(); }, sub: 'Kept on this device', mark: routeMark, at: () => pl.points[0], alive: () => pl.points.length > 1,
    build: (body) => {
      const view = pl.inView(), shared = pl.shareSub();
      body.append(...group('Take it along',
        item({ icon: 'link', label: 'Share link', line: shared || 'Copies a link to this route', k: 'share', onclick: done(() => pl.share()) }),
        item({ icon: 'download', label: 'Export GPX', line: 'For a GPS watch or another app', k: 'gpx', onclick: done(() => pl.exportGpx()) }),
        item({ icon: 'offline', label: 'Save offline…', line: 'The map and terrain, for no signal', k: 'offline', onclick: done(() => pl.app.saveOffline()) })));
      if (view) { body.append(lockNote('You’re not editing: the route stays as it is.', () => { pl.setEditing(true); pl.cards.refresh(); })); return; }
      body.append(...group('The whole route',
        pl.loopsHere() ? item({ icon: 'roundtrip', label: 'Round trip from the start', line: 'Loops of the length you choose, from the start', k: 'loop', onclick: done(() => pl.openLoop()) }) : null,
        item({ icon: 'reverse', label: 'Reverse', line: 'The route runs the other way, from the end to the start', k: 'reverse', onclick: done(() => { pl.reverse(); toast('The route runs the other way now', { ms: 7000, action: undo }); }) }),
        pl.isLoop() ? null : item({ icon: 'loop', label: 'Back to start', line: 'Adds a leg back to the start', k: 'back', onclick: done(() => { pl.backToStart(); toast('A leg back to the start is added', { ms: 7000, action: undo }); }) }),
        item({ icon: 'upload', label: 'Import GPX or KML…', line: 'Shows a file’s track, to plan on', k: 'import', onclick: done(() => pl.importFile()) })));
      body.append(h('hr'), acts(item({ icon: 'trash', label: 'Clear route', line: 'Undo brings it back', danger: true, k: 'clear', onclick: done(() => pl.clear()) })));
    },
  };
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
    // (found again in each analysis; while its source is asked again for a new one, the last seen stands)
    get it() { const x = pl.itemByKey(card.itemKey); if (x) card.last = x; return x || (card.last && pl.itemKept(card.last) ? card.last : null); },
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
  else if (main) {
    // Retry says it's asking, and if the source still didn't answer (its card stays), says so (the terrain's has its own);
    // a card built again while it's asked says so too (a.asking: notChecked())
    const b = mainButton(main.label, main.icon, async () => {
      if (b.disabled) return;
      b.disabled = true;
      b.setAttribute('aria-busy', 'true');
      b.querySelector('span').textContent = main.label === 'Retry' ? 'Asking…' : main.label;
      try { await main.fn(); } finally {
        b.disabled = false;
        b.removeAttribute('aria-busy');
        b.querySelector('span').textContent = main.label;
      }
      if (g === 'not' && w.key !== 'terrain' && w.key !== 'water' && pl.itemByKey(card.itemKey)) toast(`${w.who || w.by} still didn’t answer: try again later`, { ms: 5000 });
    });
    if (g === 'not' && a && a.asking && a.asking.has(w.key)) { b.disabled = true; b.setAttribute('aria-busy', 'true'); b.querySelector('span').textContent = 'Asking…'; }
    body.append(b);
  }
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

