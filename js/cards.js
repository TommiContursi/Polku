// The cards' contents (25d, Revision 4 of #355): built from the card's parts (js/card.js) and what the planner says;
// the planner keeps the actions. A card shows only what can be done now: in the route's view, what works there and
// the planner's note with Edit.
import { h, icon, toast } from './ui.js';
import { nums, group, rows, acts, item, lockNote, segIcons } from './card.js';
import { pointNums } from './facts.js';
import { ACTIVITIES } from './config.js';
import { fmtDist } from './geo.js';
import { isNight, staysNear, DEFAULT_BREAK, DEFAULT_ON, hhmm } from './stops.js';

// the point's own marker, as the map draws it
export function pointMark(pl, i) {
  const n = pl.points.length, last = i === n - 1 && i > 0, loop = last && pl.isLoop();
  return h('span', { class: `wp ${i === 0 ? 'wp-start' : last ? 'wp-end' : 'wp-via'}${loop ? ' wp-loop' : ''}` }, i === 0 || last ? '' : String(i));
}

// − 30 min + in one box, the number typable (the round trip's Other… field, #356)
function stepper({ value, unit, step, min = 0, max = 1440, label, set, line = null, lead = null }) {
  const put = (v) => { v = Math.max(min, Math.min(max, Math.round(v))); if (v !== value) set(v); };
  return h('div', { class: 'rt-step' }, lead ? h('span', {}, lead) : null,
    h('button', { type: 'button', class: 'tool ring', 'aria-label': `${step} minutes less`, disabled: value <= min, onclick: () => put(value - step), html: icon('minus', 20) }),
    h('label', { class: 'rt-len' }, h('input', { type: 'text', inputmode: 'numeric', enterkeyhint: 'done', value: String(value), 'aria-label': label,
      onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
      onchange: (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (Number.isFinite(v)) put(v); else e.target.value = String(value); } }), h('span', {}, unit)),
    h('button', { type: 'button', class: 'tool ring', 'aria-label': `${step} minutes more`, disabled: value >= max, onclick: () => put(value + step), html: icon('plus', 20) }),
    line ? h('small', {}, line) : null);
}

// A point's card [p-point, r-stop, r-night, r-change, r-start, r-end, r-view-point]
export function pointCard(pl, p) {
  const card = {
    kind: 'point', key: p, pill: null,
    get i() { return pl.points.indexOf(card.key); },
    get title() { return card.renaming ? card.nameField() : pl.nameOf(card.i); },
    get label() { return pl.nameOf(card.i); },
    get sub() { const i = card.i; return i === 0 ? 'Start' : i === pl.points.length - 1 ? 'End' : `Via ${i}`; },
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
  const when = i === 0 ? pl.startSec() : pl.analysis ? pl.arriveAt(i) : null;
  body.append(nums(pointNums(pl.analysis, i, { when, along: pl.lengthTo(i), clock: (s) => pl.clockOf(s) })));
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
  const after = pl.legs[i] ? item({ icon: 'route', label: 'The stretch after it', line: `${name} → ${pl.nameOf(i + 1)}`, chev: true, onclick: () => pl.openLegAfter(i) }) : null;
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
    kind: 'goon', key: point.key, pill: null, title: 'Go on at', sub: 'the next morning',
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point) && isNight(stop()),
    build: (body) => {
      const on = stop().on, hours = [...new Set([...Array.from({ length: 6 }, (_, k) => (5 + k) * 60), on])].sort((a, b) => a - b); // (05:00 to 10:00, and the hour set now)
      body.append(rows(...hours.map((m) => item({ icon: 'clock', label: hhmm(m), role: 'menuitemradio', checked: m === on, onclick: () => { const k = point.i; pl.cards.back(); if (k >= 0) pl.setStop(k, { on: m }); } }))));
    },
  };
}

// Sport from here ›: the sports, the one in force ticked, "your route" on the route's own [r-sport]
function sportCard(pl, point) {
  const i = point.i, cur = pl.legSport(i), route = pl.mainSport();
  const sports = pl.app.sports ? pl.app.sports() : Object.keys(ACTIVITIES).map((k) => ({ k, label: ACTIVITIES[k].label, icon: 'route' }));
  return {
    kind: 'sport', key: point.key, pill: null, title: 'Sport from here', sub: `From ${pl.nameOf(i)} to the next change of sport, or the end`,
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point),
    build: (body) => body.append(rows(...sports.map((x) => item({
      icon: x.icon, label: x.label, line: (ACTIVITIES[x.k].line || '').replace(/ · /g, ', '), role: 'menuitemradio', checked: x.k === cur, cur: x.k === route ? 'your route' : null,
      onclick: () => { const k = point.i; pl.cards.back(); if (k >= 0) pl.setSportFrom(k, x.k); },
    })))),
  };
}

// Leave at ›: now, or an hour of the next two days (as Go's Depart)
function leaveCard(pl, point) {
  return {
    kind: 'leave', key: point.key, pill: null, title: 'Leave at', sub: 'Sets the times and the weather along the route',
    mark: point.mark, at: () => point.key, alive: () => pl.findPoint(point),
    build: (body) => body.append(rows(...pl.departChoices().map(({ k, label }) => item({
      icon: 'clock', label, role: 'menuitemradio', checked: k === pl.startOffsetH, onclick: () => { pl.cards.back(); pl.setStartOffset(k); },
    })))),
  };
}

// Places to sleep nearby ›: lean-tos, huts and campsites within 3 km (LIPAS and OpenStreetMap); a tap moves the night there [r-stays]
function staysCard(pl, point) {
  const card = {
    kind: 'stays', key: point.key, pill: null, title: 'Places to sleep nearby', get sub() { return pl.nameOf(point.i); },
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
