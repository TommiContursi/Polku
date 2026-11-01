// The cards' contents (25d, Revision 4 of #355): built from the card's parts (js/card.js) and what the planner says;
// the planner keeps the actions. A card shows only what can be done now: in the route's view, what works there and
// the planner's note with Edit.
import { h, icon, sign, toast, store } from './ui.js';
import { nums, group, rows, acts, item, pickRow, lockNote, segIcons, mainButton } from './card.js';
import { pointNums, headline, wayFacts, SPORT_FACTS, placeGroups, wayGroups, unmapped, areaFacts } from './facts.js';
import { newPick, resolvePick, modesOf, modeOf, setMode, loadWeather } from './pick.js';
import { breakdownRows, colorAt, PICK_MODES, COLOR_MODES, NO_TERRAIN, ProfileChart } from './chart.js';
import { notRight, isHttp, thingOf } from './inspect.js';
import { elevation } from './dem.js';
import { iconUrl } from './icons.js';
import { darkWords } from './palette.js';
import { ACTIVITIES, CRAFTS, LIPAS_TYPES, DIFF_COLORS } from './config.js';
import { STYLES, styleName } from './styles.js';
import { fmtDist, fmtDuration, compass, bearing, lineLength } from './geo.js';
import { isNight, staysNear, DEFAULT_BREAK, DEFAULT_ON, MAX_NIGHTS, hhmm, parseHhmm } from './stops.js';
import { LONG_HOURS } from './weather.js';

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
function stepper({ value, unit, step, min = 0, max = 1440, label, set, line = null, lead = null, less = `${step} minutes less`, more = `${step} minutes more` }) {
  const put = (v) => { v = Math.max(min, Math.min(max, Math.round(v))); if (v !== value) set(v); };
  return h('div', { class: 'rt-step' }, lead ? h('span', {}, lead) : null,
    h('div', { class: 'rt-len' },
      h('button', { type: 'button', class: 'tool', 'aria-label': less, disabled: value <= min, onclick: () => put(value - step), html: icon('minus', 20) }),
      h('input', { type: 'text', inputmode: 'numeric', enterkeyhint: 'done', value: String(value), 'aria-label': label,
        onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
        onchange: (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (Number.isFinite(v)) put(v); else e.target.value = String(value); } }), h('span', {}, unit),
      h('button', { type: 'button', class: 'tool', 'aria-label': more, disabled: value >= max, onclick: () => put(value + step), html: icon('plus', 20) })),
    line ? h('small', {}, line) : null);
}

// A point's card [p-point, r-stop, r-night, r-change, r-start, r-end, r-view-point]. A tap gives when you're there, how far
// along and the profile up to it (#574); `actions` (a hold, a right-click, the list) adds what you can do there.
export function pointCard(pl, p, { actions = true } = {}) {
  const card = {
    kind: 'point', key: p, pill: null, actions,
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
  // the route's profile, coloured as the route is up to the point and grey after it
  const a = !pending && pl.analysis, k = a && Number.isFinite(a.minE) ? a.along.findIndex((d) => d >= pl.lengthTo(i) - 1) : -1;
  if (k >= 0) body.append(profileOf(a, pl.colorMode, k));
  if (!card.actions) {
    // On the profile: the legs on both sides of it
    if (k >= 0) body.append(h('div', { class: 'insp-actions card-foot' }, h('button', { type: 'button', class: 'btn quiet', html: icon('mountain', 16),
      onclick: () => pl.showStretchOnProfile({ from: Math.max(0, card.i - 1), to: Math.min(pl.points.length - 1, card.i + 1) }) }, h('span', {}, 'On the profile'))));
    if (view) body.append(lockNote('You’re not editing: the route stays as it is.', () => { pl.setEditing(true); pl.cards.refresh(); }));
    return;
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
      // Stay · N nights with the stepper, then Go on at by the phone's own clock, its line the day (#364's C) [r6-night-c, r6-night-c2]
      const n = stop.n || 1, go = w ? w.arrive + w.sec : null, after = n === 1 ? 'the next morning' : `after ${n} nights`;
      body.append(stepper({ lead: 'Stay', value: n, unit: n === 1 ? 'night' : 'nights', step: 1, min: 1, max: MAX_NIGHTS, label: `Nights at ${name}`,
        less: 'One night less', more: 'One night more', set: (k) => set({ on: stop.on, n: k }) }));
      const goOn = pickRow({ icon: 'clock', label: 'Go on at', type: 'time', set: (v) => {
        const m = parseHhmm(v), k = card.i;
        if (m != null && k >= 0) pl.setStop(k, { on: m, n });
        put();
      } });
      const put = () => { const on = hhmm((pl.stopAt(card.i) || stop).on); goOn.put({ line: go ? `${pl.dayOf(go)}, ${after}` : `${after[0].toUpperCase()}${after.slice(1)}`, val: on, value: on, set: true }); };
      put();
      body.append(rows(goOn.el));
      if (!view) body.append(rows(item({ icon: 'hut', label: 'Places to sleep nearby', line: 'Lean-tos, huts and campsites within 3 km', chev: true, onclick: () => pl.cards.open(staysCard(pl, card), { at: card.key, from: card }) })));
    }
  }
  // the start while drawing: Back to start first, one tap from a route that comes back (#334's A, 2026-10-24)
  if (i === 0 && n > 1 && !view && !loop) {
    body.append(acts(item({ icon: 'loop', label: 'Back to start', line: 'Adds a leg back to the start', k: 'back', onclick: () => { pl.backToStart(); toast('A leg back to the start is added', { ms: 7000, action: { label: 'Undo', fn: () => pl.undo() } }); } })));
  }
  // the start: when you leave
  if (i === 0 && n > 1) { const lv = leaveBlock(pl); lv.put(); body.append(lv.el); }
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

// Sport from here ›: the sports, the one in force ticked, "your route" on the route's own [r-sport]
// A sport with crafts (Paddle) has them under its row once it's picked, and the card stays open at them, as the pill's
// menu does: the craft is the whole route's (it decides how calm the water must be, and the time)
function sportCard(pl, point) {
  const sports = pl.app.sports ? pl.app.sports() : Object.keys(ACTIVITIES).map((k) => ({ k, label: ACTIVITIES[k].label, icon: 'route' }));
  const card = {
    kind: 'sport', get key() { return point.key; }, pill: null, title: 'Sport from here', span: null, get sub() { return `From ${pl.nameOf(point.i)} to the next change of sport, or the end`; },
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point), fold: () => [ACTIVITIES[pl.legSport(point.i)].label],
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

// Leave ›, on the start's card and in Go (#364's C) [r6-leave-c, r6-leave-c-set, r6-leave-c-far, r6-leave-c-passed]: the
// phone's own date and time for any day ahead. Once set, the date is the row's line, the time its value, and Now on
// that line (2026-10-24's detail); past the forecast's reach, or a date that had passed, a note under it. Only the start
// has a date: the rest counts from it.
export function leaveBlock(pl) {
  const local = (sec) => { const d = new Date(sec * 1000), z = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
  const row = pickRow({ icon: 'clock', label: 'Leave', type: 'datetime-local', now: () => pl.setLeave(null), set: (v) => {
    const sec = v ? new Date(v).getTime() / 1000 : null;
    if (sec != null && sec <= Date.now() / 1000) toast('That time has passed, so it leaves now');
    pl.setLeave(sec);
    put();
  } });
  const note = h('p', { class: 'pick-note', hidden: true });
  const put = () => {
    const at = pl.leaveAt, now = Date.now() / 1000, passed = at == null && pl.leavePassed, far = at != null && at - now >= LONG_HOURS * 3600;
    row.put({ line: at == null ? 'Sets the times and the weather along the route' : pl.dayOf(at, true), val: at == null ? 'Now' : pl.timeOf(at),
      value: local(at ?? Math.ceil(now / 900) * 900), min: local(Math.floor(now / 900) * 900), set: at != null }); // (min on the clock's quarter hour: the field's steps count from it)
    note.hidden = !far && !passed;
    note.classList.toggle('info', !!passed);
    note.replaceChildren(h('span', { 'aria-hidden': 'true', html: icon(far ? 'cloudSun' : 'info', 16) }),
      h('span', {}, far ? `No forecast yet for ${pl.dayOf(at)}. Sunset and the dark still count.` : passed ? `Planned for ${pl.dayOf(passed)}, ${pl.timeOf(passed)}. That’s passed, so it leaves now: pick a new time above.` : ''));
  };
  return { el: h('div', { class: 'pick-leave' }, rows(row.el), note), put };
}

// Places to sleep nearby ›: lean-tos, huts and campsites within 3 km (LIPAS and OpenStreetMap); a tap moves the night there [r-stays]
function staysCard(pl, point) {
  const card = {
    kind: 'stays', get key() { return point.key; }, pill: null, title: 'Places to sleep nearby', get sub() { return pl.nameOf(point.i); },
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point), found: null, state: 'looking',
    fold: () => [{ done: String((card.found || []).length), none: 'none' }[card.state]],
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
    get lit() { return { from: card.li, to: card.li + 1 }; }, // on the map, the leg between the two points around the spot (#83)
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
    mark: editMark, at: () => spot || pl.stretchMiddle(k.s), alive: k.alive, fold: () => [card.sub],
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
    mark: editMark, at: () => edit.at(), alive: () => edit.alive(), fold: () => [ACTIVITIES[pl.legSport(edit.s.from)].label],
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
    fold: () => { const s = edit.s, sport = pl.legSport(s.from); return [styleName(sport, pl.legs[s.from].style || pl.styleOf(sport))]; },
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

// What's here's folded line: how many details it lists
const details = (box) => { const n = box.querySelectorAll('.insp-row').length; return `${n} detail${n === 1 ? '' : 's'}`; };

// What's here › [p-under]: the way under the line, as the route's own tags know it, in groups, your sport's first;
// OpenStreetMap's own data on demand (part 6 makes this its levels)
function hereCard(pl, route) {
  const card = {
    kind: 'here', get key() { return route.key; }, get stretch() { return route.stretch; }, get lit() { return route.lit; }, get title() { return route.title; }, get sub() { const x = route.spot; return x && x.name ? cap(x.kind) : ''; }, // (a way with no name is its kind, once)
    mark: wayMark, at: () => route.key, alive: () => route.alive(), osm: null, fold: (box) => (route.spot ? [details(box)] : []),
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
    sum: () => pl.els.sum,
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


// ------------------------------------------------------------------ a spot and a place on the map (25d part 5)
// [p-spot, p-place, p-none, r-near, d-spot]: what's there and its line, three numbers, What's here ›, Your route (Start
// here, End here, Round trip from here, Avoid this spot, each with its line), and the pill: + Add to my route where it
// fits, + Add a point here by the line, + Start a route here with no route. In the route's view no pill, no Your route,
// and the planner's note with Edit. `spot`: { ll, title, line, tags, place } from the planner (openSpotCard()).
const PLACE_ICON = { campsite: 'hut', shelter: 'hut', lodging: 'hut', picnic_site: 'hut', drinking_water: 'drop', toilets: 'pin', information: 'info', parking: 'car', harbor: 'buoy', ranger_station: 'hut', swimming: 'water', peak: 'mountain' };
// the place's own icon as the map draws it, where Polku draws it (LIPAS's, the trail details'); else the app's
function placeMark(spot) {
  const url = spot.image ? iconUrl(spot.image) : '';
  return url ? h('img', { src: url, alt: '', width: 28, height: 28 }) : h('span', { html: icon(PLACE_ICON[spot.kind] || 'pin', 24) });
}

export function spotCard(pl, spot) {
  if (!spot.place) return pickCard(pl, spot);
  const card = {
    kind: 'place', key: spot.ll, spot, ele: undefined, pinned: !!spot.pin, osm: null,
    get title() { return spot.title; }, get label() { return spot.title; }, get sub() { return spot.line; },
    mark: () => placeMark(spot), at: () => spot.ll, fold: () => [spot.line],
    build: (body) => spotBody(pl, card, body),
  };
  elevation(spot.ll).then((e) => { card.ele = Number.isFinite(e) ? e : null; }, () => { card.ele = null; }).then(() => { if (pl.cards.stack.some((x) => x.card === card)) pl.cards.refresh(); });
  return card;
}

// ------------------------------------------------------------------ a pick: a way joined from its pieces, and what else is known there (#574)
// The card for a tap or a hold on a way (or on nothing): its name or kind and how you get along it, its length with the
// profile coloured by Colour by, the facts in groups, the weather here now, the places at the spot, and in one quiet
// line what OpenStreetMap doesn't have. The same facts for every sport. It shows what the map's own tile knows at once
// and fills in as the ways, the heights and the weather come, saying so while it waits.
export function pickCard(pl, spot) {
  const pick = newPick(spot, { hold: !!spot.hold, sport: pl.app.activity(), sec: pl.app.weatherSec(), zoom: pl.map.getZoom(), touch: !!spot.touch });
  const here = () => pl.cards.stack.some((e) => e.card === card);
  const card = {
    kind: 'spot', key: spot.ll, spot, pick, osm: null, pinned: true,
    get title() { return pick.title || spot.title; }, get label() { return this.title; }, get sub() { return pick.line || spot.line; },
    mark: () => h('span', { class: 'pick-mark', style: `--c:${markColour(pick)}` }), at: () => spot.ll, fold: () => [card.sub],
    build: (body) => pickBody(pl, card, body),
    gone: () => { pick.dead = true; pl.drawPick(null); },
  };
  // (as a card, or as the line at the spot before it's opened)
  const changed = () => { const line = pl.picked === card; if (here() || line) pl.drawPick(pick); if (here()) pl.cards.refresh(); if (line) pl.renderLine(); };
  pick.again = () => { pick.ways = pick.a = pick.area = pick.depth = undefined; pl.cards.refresh(); resolvePick(pick, changed); };
  pick.weather = () => loadWeather(pick, changed);
  resolvePick(pick, changed);
  return card;
}
const PLAIN = '#374151';
const markColour = (pick) => (pick.a && pick.a !== 'failed' && (breakdownRows(pick.a, modeOf(pick.a))[0] || [])[2]) || PLAIN;
// The map's other things (#564): road works, an incident, road conditions, a busy road, a military area, a sea mark and its
// kin, on the same card as a way, highlighted on the map: what it is, its facts, where they come from, and the card's last row
// (Share, Weather here ›, and the source's own page where it has one). The water is a pick's (pickBody()), with its depth.
export function thingCard(pl, f, ll) {
  const t = thingOf(f, pl.map), spot = { ll, title: t.title, line: t.sub || '' };
  const card = {
    kind: 'thing', key: ll, spot, pinned: true,
    get title() { return t.title; }, get label() { return t.title; }, get sub() { return t.sub || ''; },
    mark: () => h('span', { class: 'pick-mark dot', style: '--c:#f59e0b' }), at: () => ll, fold: () => [t.sub || t.title],
    build: (body) => {
      if (t.src) body.append(h('p', { class: 'rt-cost' }, t.src));
      body.append(...factGroup(t.group || 'About it', t.rows));
      if (t.info) body.append(h('p', { class: 'insp-info' }, t.info));
      const btn = (label, ic, fn) => h('button', { type: 'button', class: 'btn quiet', onclick: fn, html: icon(ic, 16) }, h('span', {}, label));
      body.append(h('div', { class: 'insp-actions card-foot' }, btn('Share', 'share', () => pl.shareSpot(spot)), btn('Weather here ›', 'cloudSun', () => pl.weatherHere(ll)),
        t.link ? btn(t.link[0], 'external', () => window.open(t.link[1], '_blank', 'noopener')) : null));
    },
    gone: () => pl.drawThing(null),
  };
  return card;
}

// The line at the spot (#574): on a phone, a tap while browsing picks the thing and says what it is above the spot, in rows as
// the hover does: its name, how you get along it, its height and grade where you tapped, the weather. A tap on it opens the
// card. `update()` says it again as the pick fills in.
export function pickLine(card, open) {
  const el = h('button', { type: 'button', class: 'spot-line', onclick: open });
  for (const ev of ['mousedown', 'touchstart', 'pointerdown', 'click', 'dblclick']) el.addEventListener(ev, (e) => e.stopPropagation()); // (the map's, not a tap on it)
  const update = () => {
    const { pick, spot } = card, a = pick.a && pick.a !== 'failed' ? pick.a : null, w = pick.wx && pick.wx !== 'failed' ? pick.wx : null;
    const k = a && nearestSample(a, spot.ll), gr = a && !(a.eleGap && a.eleGap[k]) ? Math.round(a.grade[k]) || 0 : null;
    const rows = [card.sub, gr != null ? `${Math.round(a.ele[k])} m · ${gr >= 0 ? '+' : '−'}${Math.abs(gr)} % here` : null,
      w ? `Wind ${w.speed.toFixed(0)} m/s from the ${compass(w.dir)} · ${w.temp.toFixed(0)} °C · ${w.precip >= 0.1 ? `${w.temp < 0.5 ? 'snow' : 'rain'} ${w.precip.toFixed(1)} mm/h` : 'dry'}` : null].filter(Boolean);
    el.setAttribute('aria-label', `${card.title}. ${rows.join('. ')}. Open its card`);
    el.replaceChildren(h('span', {}, h('b', {}, card.title), ...rows.map((r) => h('small', {}, r))), h('span', { class: 'ic', 'aria-hidden': 'true', html: icon('chevronUp', 18) }));
  };
  update();
  return { el, update };
}

// facts as rows: the name, its value, and where it changes how much of each
const factGroup = (title, list) => {
  const kept = list.filter(Boolean);
  return kept.length ? [h('h4', { class: 'menu-h' }, title), h('div', { class: 'pick-facts', role: 'group', 'aria-label': title }, ...kept.map(([k, v, note, parts]) => h('div', { class: 'insp-row' }, h('span', {}, k), h('b', {}, ...(parts ? factParts(k, parts) : [v])), note ? h('small', {}, note) : null)))] : [];
};
// A fact's pictures (#574), each before its words and kept on a line with the first of them: how bikes get along and one way
// as signs, a grade (MTB, hiking, uphill) as the badge on its difficulty's colour. The words say the same.
const SIGN_OF = { Cycling: { separate: 'separated', shared: 'shared', cycleway: 'bikepath', lane: 'lane', track: 'track', beside: 'track', walk: 'footway', no: 'nobikes' }, 'One way': { one: 'oneway', cars: 'bikesboth' } };
function factParts(label, parts) {
  return parts.flatMap(([key, text], i) => {
    const g = /^(MTB|Hiking|Uphill)$/.test(label) && /^↑?([ST])([0-6])/.exec(key), name = (SIGN_OF[label] || {})[key];
    let mark = null, words = text;
    if (g) {
      const c = DIFF_COLORS[+g[2] - (g[1] === 'T' ? 1 : 0)]; // (hiking's T1 is the scale's first colour)
      mark = h('span', { class: `badge${darkWords(c) ? ' ink' : ''}`, style: `background:${c}` }, g[0]);
      words = text.slice(g[0].length).trimStart();
      if (!i) words = cap(words); // ("S2 difficult path": the badge, then "Difficult path")
    } else if (name) mark = h('span', { html: sign(name) }).firstChild;
    const [first, ...rest] = words.split(' ');
    // (a space after a badge, read with its grade; a sign is hidden from screen readers and has its own margin)
    return [i ? ', ' : '', ...(mark ? [h('span', { class: 'fw' }, mark, g && first ? ' ' : '', first), rest.length ? ` ${rest.join(' ')}` : ''] : [text])];
  });
}
const failed = (text, retry) => h('p', { class: 'pick-fail' }, text, retry ? h('button', { type: 'button', class: 'btn quiet', onclick: retry }, 'Try again') : null);

// the sample of an analysis nearest a spot
export const nearestSample = (a, ll) => a.pts.reduce((b, q, k) => (Math.hypot(q[0] - ll[0], q[1] - ll[1]) < Math.hypot(a.pts[b][0] - ll[0], a.pts[b][1] - ll[1]) ? k : b), 0);
// a route's small profile, coloured as the route up to its sample `upTo`, grey after it, a dashed line there
function profileOf(a, mode, upTo) {
  const W = 300, H = 60, n = a.pts.length, lo = a.minE, hi = Math.max(a.maxE, a.minE + 10), total = a.along[n - 1] || 1;
  const X = (i) => (a.along[i] / total) * W, Y = (i) => H - 4 - ((a.ele[i] - lo) / (hi - lo)) * (H - 10);
  const cs = a.pts.map((_, i) => (!i ? null : i > upTo ? NO_TERRAIN : colorAt(a, i, mode)));
  let paths = '', start = 1;
  for (let i = 1; i <= n; i++) {
    if (i < n && cs[i] === cs[start]) continue;
    let d = `M${X(start - 1).toFixed(1)},${H} `;
    for (let k = start - 1; k < i; k++) d += `L${X(k).toFixed(1)},${Y(k).toFixed(1)} `;
    paths += `<path d="${d}L${X(i - 1).toFixed(1)},${H}Z" fill="${cs[start]}" opacity="0.92"/>`;
    start = i;
  }
  let ink = '';
  for (let k = 0; k < n; k++) ink += `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(k).toFixed(1)} `;
  const sx = X(upTo).toFixed(1);
  const box = h('div', { class: 'pick-prof', role: 'img', 'aria-label': `Height profile, ${Math.round(a.minE)} to ${Math.round(a.maxE)} m, coloured by ${COLOR_MODES[mode].toLowerCase()} up to here` });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${paths}<path d="${ink}" fill="none" stroke="var(--chart-ink)" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`
    + `<line x1="${sx}" x2="${sx}" y1="0" y2="${H}" stroke="var(--chart-ink)" stroke-width="1.5" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/></svg><span class="ax top">${Math.round(a.maxE)} m</span><span class="ax bot">${Math.round(a.minE)} m</span>`;
  return box;
}

// A pick's profile is the route's own (js/chart.js), kept by its card: a pointer or a finger along it shows the spot on the
// map and says where it is, and the map's pointer on the pick shows it here (planner.onMapMove())
function pickChart(pl, card, a, mode) {
  if (!card.chart) {
    const canvas = h('canvas', { class: 'pick-chart' }), tip = h('div', { class: 'profile-tip', hidden: true });
    card.chartBox = h('div', { class: 'profile-box', role: 'img' }, canvas, tip);
    card.chart = new ProfileChart(canvas, tip);
    card.chart.onHover = (i) => pl.pickSpot(card, i);
    card.chart.onClick = (i) => pl.map.easeTo({ center: card.chart.a.pts[i], duration: 500 });
  }
  card.chartBox.setAttribute('aria-label', `Height profile, ${Math.round(a.minE)} to ${Math.round(a.maxE)} m, coloured by ${PICK_MODES[mode].toLowerCase()}`);
  card.chart.setData(a, mode);
  return card.chartBox;
}

// The profile, Colour by and its words in one group that folds (the planner's sections' control), remembered. Folded, no
// chart is drawn and the weather along the way isn't asked (js/pick.js); its line says what the map's colours are.
// (`a` null while the ways or the heights come: its shapes, and `say` what's asked; it folds then too)
function profileGroup(pl, card, a, say = '') {
  const open = store.get('pickProfile', true), mode = a && modeOf(a);
  const head = h('button', { type: 'button', class: 'sec-head', 'aria-expanded': String(open), onclick: () => {
    store.set('pickProfile', !open);
    if (!open && a && !a.wind && !a.windError) card.pick.weather();
    pl.cards.refresh();
  } }, h('span', { class: 'sec-title' }, 'Profile'), h('span', { class: 'sec-sum' }, a ? [PICK_MODES[mode], Number.isFinite(a.minE) ? `${Math.round(a.minE)}–${Math.round(a.maxE)} m` : ''].filter(Boolean).join(' · ') : say || 'Loading'),
  h('span', { class: 'sec-chev', 'aria-hidden': 'true', html: icon('chevronDown', 16) }));
  const inside = a ? [pickChart(pl, card, a, mode), ...colourBy(pl, card.pick)] : [skeleton(card.pick, say, h('i', { class: 'pick-skel-chart', 'aria-hidden': 'true' }), h('i', { class: 'pick-skel-by', 'aria-hidden': 'true' }))];
  return h('section', { class: 'sec', 'data-open': String(open) }, head, open ? h('div', { class: 'sec-body' }, ...inside) : null);
}

// Colour by under it: every fact that changes along the way, where this pick has data, grouped as the route's are; then the
// words of each colour with their lengths (never colour alone)
function colourBy(pl, pick) {
  const a = pick.a, mode = modeOf(a);
  // (the route's own Colour by, the profile's dropdown)
  const sel = h('select', { 'aria-label': 'Colour the profile by', onchange: (e) => { setMode(e.target.value); pl.drawPick(pick); pl.cards.refresh(); } },
    ...modesOf(a).map(([title, modes]) => h('optgroup', { label: title }, ...modes.map((k) => h('option', { value: k }, PICK_MODES[k])))));
  sel.value = mode;
  const chips = h('label', { class: 'mode-select pick-by' }, h('span', { class: 'mode-select-label' }, 'Colour by'),
    h('span', { class: 'mode-select-box' }, sel, h('span', { class: 'mode-select-chev', 'aria-hidden': 'true', html: icon('chevronDown', 14) })));
  const legend = h('div', { class: 'bd-legend' }, ...breakdownRows(a, mode).filter((r) => r[1] > 0).map(([words, d, color, key]) => h('span', { class: 'bd-item', 'data-category': String(key) },
    h('i', { style: `background:${color}`, 'aria-hidden': 'true' }), h('span', {}, `${cap(String(words))} `), h('b', {}, fmtDist(d)))));
  // (a pick has no direction of its own: head and tail are for going from its west end to its east end)
  const dir = mode === 'wind' ? h('p', { class: 'pick-note' }, `Headwind and tailwind are for going ${compass(bearing(a.pts[0], a.pts[a.pts.length - 1]))} along it.`) : null;
  return [chips, legend, dir].filter(Boolean);
}

// the weather here, at the hour the map's weather shows
function weatherGroup(pick) {
  const now = Math.abs(pick.sec - Date.now() / 1000) < 1800, title = now ? 'Weather here now' : `Weather here at ${new Date(pick.sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (pick.wx === undefined) return factGroup(title, [['Weather', 'Asking the forecast']]);
  if (pick.wx === 'failed') return [h('h4', { class: 'menu-h' }, title), failed('The forecast didn’t load.')];
  const w = pick.wx;
  return factGroup(title, [['Wind', `${w.speed.toFixed(0)} m/s from the ${compass(w.dir)}`, `Gusts ${w.gust.toFixed(0)} m/s`], ['Rain', w.precip >= 0.1 ? `${w.precip.toFixed(1)} mm an hour${w.temp < 0.5 ? ', snow' : ''}` : 'Dry'],
    ['Temperature', `${w.temp.toFixed(0)} °C`, 'Open-Meteo’s forecast for its 3 km square']]);
}
// LIPAS's places at the spot, each its own card
function placesGroup(pl, pick) {
  if (!pick.places || !pick.places.length) return [];
  if (pick.places === 'failed') return [h('h4', { class: 'menu-h' }, 'At this spot'), failed('LIPAS didn’t answer, so places here aren’t shown.')];
  return [h('h4', { class: 'menu-h' }, 'At this spot'), rows(...pick.places.map((x) => item({ icon: 'pin', label: x.name, line: (LIPAS_TYPES[x.type] || {}).name || 'From LIPAS', chev: true,
    onclick: () => pl.openLipasCard({ type: x.type, lipasId: x.id, name: x.name, typeName: (LIPAS_TYPES[x.type] || {}).name || '', icon: (LIPAS_TYPES[x.type] || {}).icon || '' }, x.at || pick.ll, {}) })))];
}

function pickBody(pl, card, body) {
  const { pick, spot } = card, w = pick.ways, view = pl.inView(), a = pick.a && pick.a !== 'failed' ? pick.a : null;
  const way = w && typeof w === 'object', ar = pick.area && typeof pick.area === 'object' ? pick.area : null, water = !way && spot.area === 'water';
  if (ar) spot.osm = { type: ar.id.split('/')[0], id: +ar.id.split('/')[1] };
  if (way) {
    spot.osm = { type: 'way', id: w.seed.id };
    const pieces = new Set(w.chain.map((x) => x.w.id)).size;
    // (while the tiles its ends run into come, its length so far: it may grow)
    body.append(nums([{ value: fmtDist(w.len), label: `${w.growing ? 'long so far' : 'long'}${pieces > 1 ? `, ${pieces} pieces` : ''}` },
      a ? { value: `${Math.round(a.up)} m`, label: 'up' } : pick.a === 'failed' ? { value: '?', label: 'heights didn’t load', missing: true } : { value: '–', label: 'up', wait: true },
      a ? { value: `${Math.round(a.down)} m`, label: 'down' } : pick.a === 'failed' ? null : { value: '–', label: 'down', wait: true }]));
    if (a) body.append(profileGroup(pl, card, a));
    else if (pick.a === 'failed') body.append(failed('The terrain didn’t load: no profile or grades yet. ', pick.again));
    else body.append(profileGroup(pl, card, null, 'Loading the heights for its profile'));
    const stops = Object.values(w.stops);
    if (stops.some((s) => s.unloaded)) body.append(failed('It may go on: the ways beyond didn’t load.'));
    if (stops.some((s) => s.why === 'long')) body.append(failed('It goes on for more than 25 km: the card stops there.'));
  } else if (w === undefined) body.append(skeleton(pick, 'Loading the whole way from OpenStreetMap', h('div', { class: 'pick-skel-nums', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))), profileGroup(pl, card, null));
  else if (w === 'failed') body.append(failed('OpenStreetMap didn’t answer: what shows is the map’s own. ', pick.again));
  else {
    // (an area's edge only when all of it came: a big lake's outline is cut some kilometres off)
    body.append(nums([pick.ele === undefined ? { value: '–', label: 'height here', wait: true } : pick.ele == null ? { value: '?', label: 'height not known', missing: true } : { value: `${Math.round(pick.ele)} m`, label: 'height here' },
      ar && ar.whole ? { value: fmtDist(ar.outer.reduce((m, l) => m + lineLength(l), 0)), label: 'round its edge' } : null]));
    if (pick.area === 'failed') body.append(failed('OpenStreetMap didn’t answer: its outline and facts aren’t shown. ', pick.again));
  }
  // what a hold opens it for: your route's actions (in the route's view, the planner's note with Edit)
  if (view) body.append(lockNote('You’re not editing: the route stays as it is.', () => { pl.setEditing(true); pl.cards.refresh(); }));
  else if (pick.hold) body.append(...yourRoute(pl, spot, { add: true }));
  // (the map tile's own way while the ways come; no way's facts where there's none)
  const g = way ? wayGroups(w.chain, a) : spot.way ? wayGroups([{ w: { tags: spot.tags || {}, len: 1 } }]) : { along: [], surface: [], diff: [] };
  // the incline where you tapped, whatever the sport (what the hover says, #561)
  if (a && !(a.eleGap && a.eleGap[nearestSample(a, spot.ll)])) { const gr = Math.round(a.grade[nearestSample(a, spot.ll)]) || 0; g.diff.unshift(['Grade here', `${gr >= 0 ? '+' : '−'}${Math.abs(gr)} %`, gr >= 0 ? 'uphill, where you tapped' : 'downhill, where you tapped']); }
  body.append(...factGroup('The way', g.along), ...factGroup('Surface', g.surface), ...factGroup('Difficulty', g.diff));
  // an area's own facts; the water's depth from Traficom's chart (shown, never routed on) and Paddle from here, whatever OpenStreetMap says
  body.append(...factGroup('About it', [...(ar ? areaFacts(ar.tags).rows : []),
    water ? ['Depth', pick.depth === undefined ? 'Asking Traficom' : pick.depth === null ? 'Traficom didn’t answer' : pick.depth, 'From Traficom’s chart'] : null]));
  if (water && !view) body.append(acts(item({ icon: 'paddle', label: 'Paddle from here', line: 'A route over the water, from here', k: 'paddle', onclick: () => pl.paddleFrom(spot.ll) })));
  body.append(...weatherGroup(pick), ...placesGroup(pl, pick));
  if (card.osm && card.osm.rows) body.append(h('h4', { class: 'menu-h' }, 'All OpenStreetMap details'), ...card.osm.rows.map(([k, v]) => h('div', { class: 'insp-row' }, h('span', {}, k), h('b', {}, v))));
  const miss = way ? unmapped(w.chain) : ar ? areaFacts(ar.tags).missing : [];
  // (only what OpenStreetMap's own ways or area say can be "not mapped": while they load or didn't come, no claim)
  body.append(h('p', { class: 'pick-unmapped' }, h('span', {}, way || ar ? (miss.length ? `Not mapped: ${miss.join(', ')}.` : 'From OpenStreetMap.') : w === 'none' && !spot.area ? 'Nothing is mapped right here.' : ''),
    h('button', { type: 'button', class: 'btn quiet', onclick: () => pl.cards.open(notRightCard(pl, card, spot), { at: spot.ll, from: card }) }, 'Not right?')));
  body.append(osmState(card), pickFoot(pl, card, spot));
}
// While the ways or the heights come: what's asked, in words (`say`), and the card's own shapes for what will come, so nothing
// jumps when they're in. They show after 300 ms and breathe, as the busy bar does; a rebuild (the weather came) goes on
// where it was, as the delays count from the tap (--since).
const skeleton = (pick, say, ...shapes) => h('div', { class: 'pick-skel', style: `--since:${Date.now() - pick.at}ms` },
  say ? h('p', { class: 'pick-note', role: 'status' }, `${say}…`) : null, ...shapes);
// the card's last row: Share and Weather here ›; a hold adds All OpenStreetMap details and Copy
function pickFoot(pl, card, spot) {
  const btn = (label, ic, fn) => h('button', { type: 'button', class: 'btn quiet', onclick: fn, html: icon(ic, 16) }, h('span', {}, label));
  return h('div', { class: 'insp-actions card-foot' }, btn('Share', 'share', () => pl.shareSpot(spot)), btn('Weather here ›', 'cloudSun', () => pl.weatherHere(spot.ll)),
    ...(card.pick.hold ? [spot.osm && !osmIn(card) ? btn('All OpenStreetMap details', 'details', () => pl.osmOnCard(card, spot.ll, spot.osm.id ? spot.osm : null)) : null, btn('Copy', 'pin', () => copyText(coords(spot.ll)))] : []));
}

// Your route: only what can be done now (with no route, a round trip from here). `add`: the spot's one action first, as the
// pill was (Add to my route, Add a point here by the line, Start a route here with no route).
function yourRoute(pl, spot, { add = false } = {}) {
  const n = pl.points.length, undo = { label: 'Undo', fn: () => pl.undo() };
  const pill = !add ? null : !n ? { label: 'Start a route here', fn: () => pl.startRouteAt(spot.ll) } : { label: pl.byTheLine(spot.ll) ? 'Add a point here' : 'Add to my route', fn: () => pl.addWhereItFits(spot.ll) };
  const yours = acts(
    pill ? item({ icon: 'plus', label: pill.label, line: 'In your route, where it fits', k: 'add', onclick: pill.fn }) : null,
    n ? item({ icon: 'flag', label: 'Start here', line: 'Adds a new start point', k: 'start', onclick: () => pl.startFrom(spot.ll) }) : null,
    n ? item({ icon: 'flagend', label: 'End here', line: 'Adds a new end point', k: 'end', onclick: () => { pl.cards.close(); pl.endAt(spot.ll); toast('A new end is added', { ms: 7000, action: undo }); } }) : null,
    pl.loopsHere() ? item({ icon: 'roundtrip', label: 'Round trip from here', line: 'Loops of the length you choose, from here', k: 'loop', onclick: () => { pl.cards.close(); pl.openLoop(spot.ll); } }) : null,
    n ? item({ icon: 'avoid', label: 'Avoid this spot', line: 'The route goes around it, 40 m', k: 'avoid', onclick: () => { pl.cards.close(); if (!pl.active) pl.setActive(true); pl.addNogo(spot.ll, 40, spot.place ? spot.title : 'Avoided place'); } }) : null);
  return yours ? [h('h4', { class: 'menu-h' }, 'Your route'), yours] : [];
}

// A place's card (#574: What's here's facts on the card): its height, where it comes from, its facts in groups (LIPAS's,
// or OpenStreetMap's once its tags are asked for, a fact its kind would have and doesn't saying so), its pages; a hold adds
// Your route; the last row as every card's.
function spotBody(pl, card, body) {
  const { spot } = card, osm = card.osm && card.osm.w, tags = { ...spot.tags, ...(osm ? osm.tags : {}) };
  body.append(nums([card.ele === undefined ? { value: '–', label: 'height', wait: true } : card.ele === null ? { value: '?', label: 'height not known', missing: true } : { value: `${Math.round(card.ele)} m`, label: 'height' }]));
  if (spot.src) body.append(h('p', { class: 'rt-cost' }, spot.src));
  if (pl.inView()) body.append(lockNote('You’re not editing: the route stays as it is.', () => { pl.setEditing(true); pl.cards.refresh(); }));
  else if (spot.hold) body.append(...yourRoute(pl, spot, { add: true }));
  body.append(...factsIn(spot.lipas ? lipasFacts(spot.lipas) : placeGroups(tags, spot.kind, { known: !!osm })));
  if (spot.lipas && spot.lipas.info) body.append(h('p', { class: 'insp-info' }, spot.lipas.info));
  body.append(rows(spot.partOf ? item({ icon: 'route', label: `Part of ${spot.partOf.props.name}`, line: 'A marked route, from LIPAS', chev: true, onclick: () => pl.cards.open(lipasCard(pl, spot.partOf.props, spot.ll, { click: spot.ll }), { at: spot.ll, from: card }) }) : null,
    ...(spot.lipas ? lipasLinks(spot.lipas) : [])) || '');
  if (osm) body.append(h('h4', { class: 'menu-h' }, 'All OpenStreetMap details'), ...card.osm.rows.map(([k, v]) => h('div', { class: 'insp-row' }, h('span', {}, k), h('b', {}, v))));
  body.append(osmState(card), foot(pl, card, spot));
}
// [{ group, label, value, missing }] as the card's groups
const factsIn = (list) => [...new Set(list.map((f) => f.group))].flatMap((g) => factGroup(g, list.filter((f) => f.group === g).map((f) => [f.label, f.missing ? `? ${f.value}` : f.value])));

// LIPAS's facts of a place or a route, and its pages
function lipasFacts(p) {
  return [p.length ? { group: 'From LIPAS', label: 'Length', value: `${p.length} km` } : null, p.surface ? { group: 'From LIPAS', label: 'Surface', value: p.surface } : null,
    p.wc ? { group: 'From LIPAS', label: 'Toilet', value: p.wc === 'true' ? 'Yes' : 'No' } : null, p.city ? { group: 'From LIPAS', label: 'Where', value: p.city } : null].filter(Boolean);
}
function link(o) { const a = item({ ...o, el: 'a' }); a.href = o.href; a.target = '_blank'; a.rel = 'noopener'; return a; }
function lipasLinks(p) {
  const www = isHttp(p.www);
  return [link({ icon: 'external', label: 'LIPAS', line: 'LIPAS’s page for this place', href: `https://www.lipas.fi/liikuntapaikat/${p.lipasId}` }),
    www ? link({ icon: 'external', label: 'Website', line: 'The place’s own page', href: www }) : null];
}

// the card's last row [p-spot]: Share, Weather here › and Not right?
function foot(pl, card, spot) {
  const btn = (label, ic, fn) => h('button', { type: 'button', class: 'btn quiet', onclick: fn, html: ic ? icon(ic, 16) : '' }, h('span', {}, label));
  return h('div', { class: 'insp-actions card-foot' }, btn('Share', 'share', () => pl.shareSpot(spot)), btn('Weather here ›', 'cloudSun', () => pl.weatherHere(spot.ll)),
    btn('Not right?', null, () => pl.cards.open(notRightCard(pl, card, spot), { at: spot.ll, from: card })),
    ...(spot.hold ? [spot.osm && !osmIn(card) ? btn('All OpenStreetMap details', 'details', () => pl.osmOnCard(card, spot.ll, spot.osm.type === 'way' && !spot.osm.id ? null : spot.osm)) : null, btn('Copy', 'pin', () => copyText(coords(spot.ll)))] : []));
}
// All OpenStreetMap details asked for, or in: its button goes (a failure keeps it, saying so on the card)
const osmIn = (card) => !!(card.osm && (card.osm.rows || card.osm.asking));
const osmState = (card) => (card.osm && card.osm.state && !card.osm.rows ? failed(card.osm.state) : '');

// Not right? [p-notright]: where the details come from, and how to tell: OpenStreetMap's note page at the spot (no
// account), or its editor for that way or place; LIPAS's page for a LIPAS place
function notRightCard(pl, from, spot) {
  return {
    kind: 'notright', key: spot.ll, title: 'Not right?', sub: spot.title, mark: from.mark, at: () => spot.ll,
    build: (body) => {
      const osm = (from.osm && from.osm.w) || (spot.osm && spot.osm.id ? spot.osm : null);
      if (spot.lipas) {
        body.append(h('p', { class: 'rt-cost' }, 'These details come from LIPAS, Finland’s register of sports places. Its keepers can fix what you tell them.'),
          rows(link({ icon: 'external', label: 'LIPAS’s page', line: 'Where you can send them a correction', href: `https://www.lipas.fi/liikuntapaikat/${spot.lipas.lipasId}` })));
        return;
      }
      body.append(h('p', { class: 'rt-cost' }, 'These details come from OpenStreetMap. Its mappers can fix what you tell them.'),
        rows(link({ icon: 'external', label: 'Leave a note on OpenStreetMap', line: 'No account needed. It opens at this spot.', k: 'note', href: notRight(spot.ll) }),
          osm ? link({ icon: 'external', label: 'Edit it on OpenStreetMap', line: 'With an OpenStreetMap account.', k: 'edit', href: notRight(spot.ll, osm) }) : null));
    },
  };
}

// A LIPAS route [d-lipas]: from LIPAS, how long, what following it gives once LIPAS has sent all its parts (one request,
// kept); Follow this route, Add to my route and Start a route here; LIPAS's facts and pages. A ski track, a skating
// or snowmobile route says what it's for instead of Follow (#306: in words for every sport).
const WINTER_LIPAS_NOTE = {
  4402: 'A ski track: keep off it on foot and by bike. Whether it’s groomed: the operator’s website.',
  4421: 'A snowmobile route: for snowmobiles, not a way to walk or ride.',
  1550: 'A skating route on natural ice. Polku never says ice is safe: check the operator’s status before you go.',
};
export function lipasCard(pl, props, ll, { click = null, near = null } = {}) {
  const winter = (LIPAS_TYPES[props.type] || {}).winter;
  const spot = { ll, title: props.name, line: [props.typeName, props.city].filter(Boolean).join(', '), src: 'From LIPAS', image: props.icon ? `lipas-${props.icon}` : null, lipas: props, place: true, tags: {} };
  const card = {
    kind: 'lipas', key: ll, props, ride: null, spot, title: spot.title, sub: spot.line, mark: () => placeMark(spot), at: () => ll, ele: undefined, fold: () => [spot.line],
    build: (body) => {
      const r = card.ride, tap = pl.coarse() ? 'tap' : 'click';
      body.append(h('p', { class: 'rt-cost' }, winter ? WINTER_LIPAS_NOTE[props.type] || ''
        : !r ? 'Checking the route…' : r.failed ? 'LIPAS isn’t answering: following it may not work right now.' : r.none ? 'From LIPAS'
          : r.network ? `A network of trails: following it takes the ${click ? `stretch you ${tap}ped` : 'longest stretch'}, ${km(r.km)} km. ${cap(tap)} another to follow that one.`
            : `${km(r.km)} km, ${r.loop ? 'a loop' : 'one way'}${r.left >= 0.3 ? `, side trails of ${r.left.toFixed(1)} km left out` : ''}. It follows LIPAS’s line: no routing needed.`));
      if (!winter) {
        body.append(mainButton(r && r.network ? 'Follow this stretch' : 'Follow this route', 'route', () => { pl.cards.close(); pl.app.rideLipas(props, { click, near }); }));
        // (on the card, not in a hold's: a hold over a route gives the way under it, #574)
        if (!pl.inView()) {
          body.append(h('h4', { class: 'menu-h' }, 'Your route'), acts(
            pl.points.length ? item({ icon: 'plus', label: 'Add to my route', line: 'Your route goes to it and follows it', k: 'add', onclick: () => { pl.cards.close(); pl.app.rideLipas(props, { click, near, add: true }); } }) : null,
            item({ icon: 'flag', label: 'Start a route here', line: 'A new route, from this spot', k: 'start', onclick: () => { pl.cards.close(); pl.setActive(true, { edit: true }); pl.clear(); pl.addPoint(click || ll); } })));
        }
      }
      body.append(...factsIn(lipasFacts(props)), rows(...lipasLinks(props)) || '', foot(pl, card, spot));
    },
  };
  elevation(ll).then((e) => { card.ele = Number.isFinite(e) ? e : null; }, () => { card.ele = null; }).then(() => { if (pl.cards.stack.some((e) => e.card === card)) pl.cards.refresh(); });
  if (!winter) pl.app.lipasRide(props, click).then((r) => { card.ride = r || { none: true }; }, () => { card.ride = { failed: true }; }).then(() => { if (pl.cards.stack.some((e) => e.card === card)) pl.cards.refresh(); });
  return card;
}
const km = (x) => (x >= 10 ? Math.round(x) : x.toFixed(1));

const coords = (ll) => `${ll[1].toFixed(5)}, ${ll[0].toFixed(5)}`;
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { toast(`Couldn’t copy: ${t}`); }
}
