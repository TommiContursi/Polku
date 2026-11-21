// My speeds: what the time estimate assumes, per sport, in the user's own terms.
// Normal is the model's default; Easy and Fast scale it; Custom is yours.
// Stored on this device only (never in share links).

import { CRAFT } from './config.js';
import { h, store, settleControls } from './ui.js';

// Normal values. Bikes: flat km/h on paved / gravel (unpaved) / trail and the
// climbing rate in m/h; running: flat km/h on paved / trail; hiking: walking
// km/h on the flat (Tobler's function, which peaks on a gentle downhill);
// paddling: km/h per craft.
export const SPEED_DEFAULTS = {
  mtb: { paved: 20, unpaved: 16, trail: 11, vam: 600 },
  gravel: { paved: 25, unpaved: 20, trail: 12, vam: 700 },
  road: { paved: 27, unpaved: 15, trail: 8, vam: 800 },
  hike: { walk: 5.04 }, // Tobler on the flat, so Normal is exactly the model
  trailrun: { paved: 10, trail: 8.5 },
  run: { paved: 10.5, trail: 9.5 },
  paddle: Object.fromEntries(Object.entries(CRAFT).map(([k, v]) => [k, v.kmh])),
  swim: { swim: 2.5 }, // open water, about 2:25 per 100 m
};
export const PRESETS = [['easy', 'Easy', 0.8], ['normal', 'Normal', 1], ['fast', 'Fast', 1.2], ['custom', 'Custom']];

const FIELDS = {
  bike: [['paved', 'Paved', 'km/h'], ['unpaved', 'Gravel', 'km/h'], ['trail', 'Trail', 'km/h'], ['vam', 'Climbing', 'm/h']],
  run: [['paved', 'Paved', 'pace'], ['trail', 'Trail', 'pace']],
  hike: [['walk', 'Walking, flat', 'km/h']],
  swim: [['swim', 'Open water', 'pace100']],
};
const fieldsOf = (sport, craft) => (sport === 'paddle' ? [[craft, CRAFT[craft].label, 'km/h']]
  : sport === 'swim' ? FIELDS.swim : sport === 'hike' ? FIELDS.hike : sport === 'run' || sport === 'trailrun' ? FIELDS.run : FIELDS.bike);

const choiceOf = (sport) => (store.get('speeds', {})[sport]) || { preset: 'normal' };

/** The values the time estimate uses for `sport`, and how they were chosen. */
export function speedsFor(sport) {
  const base = SPEED_DEFAULTS[sport] || SPEED_DEFAULTS.mtb;
  const c = choiceOf(sport);
  if (c.preset === 'custom') return { ...base, ...c.custom, preset: 'custom' };
  const f = (PRESETS.find(([k]) => k === c.preset) || PRESETS[1])[2];
  return { ...Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v * f])), preset: c.preset };
}

function save(sport, choice) {
  store.set('speeds', { ...store.get('speeds', {}), [sport]: choice });
}

// pace for runners (min/km), km/h or m/h for the rest
export const pace = (kmh) => { const s = Math.round(3600 / kmh); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const parsePace = (txt) => {
  const m = String(txt).trim().match(/^(\d{1,2})(?:[:.,](\d{1,2}))?$/);
  if (!m) return null;
  const sec = +m[1] * 60 + (m[2] ? +m[2].padEnd(2, '0') : 0);
  return sec >= 120 && sec <= 1200 ? 3600 / sec : null;
};
// swimmers count minutes per 100 m
export const pace100 = (kmh) => { const s = Math.round(360 / kmh); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const parsePace100 = (txt) => {
  const m = String(txt).trim().match(/^(\d{1,2})(?:[:.,](\d{1,2}))?$/);
  if (!m) return null;
  const sec = +m[1] * 60 + (m[2] ? +m[2].padEnd(2, '0') : 0);
  return sec >= 50 && sec <= 600 ? 360 / sec : null;
};
const show = (v, unit) => (unit === 'pace' ? pace(v) : unit === 'pace100' ? pace100(v) : unit === 'm/h' ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
const unitText = (unit) => (unit === 'pace' ? 'min/km' : unit === 'pace100' ? 'min/100 m' : unit);

/** One line for the stats: "Normal · 20 / 16 / 11 km/h · 600 m/h up". */
export function speedSummary(sport, craft) {
  const s = speedsFor(sport);
  const name = (PRESETS.find(([k]) => k === s.preset) || PRESETS[1])[1];
  let txt;
  if (sport === 'paddle') txt = `${CRAFT[craft].label} · ${show(s[craft], 'km/h')} km/h`;
  else if (sport === 'swim') txt = `${pace100(s.swim)} /100 m`;
  else if (sport === 'hike') txt = `${show(s.walk, 'km/h')} km/h on the flat`;
  else if (sport === 'run' || sport === 'trailrun') txt = `${pace(s.paved)} /km paved · ${pace(s.trail)} trail`;
  else txt = `${show(s.paved)} / ${show(s.unpaved)} / ${show(s.trail)} km/h · ${Math.round(s.vam)} m/h up`;
  return { name, txt };
}

// How the estimate works, in plain words, per sport.
export const HOW = {
  bike: (sport) => `Riding speed on the flat depends on the surface: paved, gravel or trail${sport === 'mtb' ? ' (smooth trails roll faster, S2+ slower)' : ''}. Climbs go at your climbing rate (vertical metres per hour) unless that's faster than the flat speed; descents are quicker but capped (${sport === 'road' ? '50' : '35'} km/h on roads, ${sport === 'road' ? '14' : '16'} on trails). A headwind costs about 1.2 km/h per m/s in the open and less on sheltered trails; a tailwind helps the same way. Stops aren't included.`,
  run: (sport) => `Your flat pace on paved and on trail, slowed uphill and quickened gently downhill by the energy cost of running on that gradient (Minetti et al. 2002: +10 % costs about 40 % of your speed).${sport === 'trailrun' ? ' On steep climbs you walk: never slower than a brisk hike.' : ''} Wind changes it a little. Stops aren't included.`,
  hike: () => 'Tobler’s hiking function: fastest on a gentle downhill (−5 %), slower up and steeply down; 12 % slower on paths than on roads. Your walking speed scales it. Breaks aren’t included.',
  paddle: () => 'Your craft’s cruising speed on flat water. Headwind slows you about 0.35 km/h per m/s (down to a quarter of your speed), tailwind helps up to +35 %. Carries go at walking pace (2.5 km/h). Breaks aren’t included.',
  swim: () => 'Your open-water pace per 100 m (slower than in a pool: no walls, sighting, waves). Waves into your face slow you a little. Land between swims goes at walking pace. Breaks aren’t included.',
};
const howOf = (sport) => (sport === 'paddle' ? HOW.paddle() : sport === 'swim' ? HOW.swim() : sport === 'hike' ? HOW.hike() : sport === 'run' || sport === 'trailrun' ? HOW.run(sport) : HOW.bike(sport));

/**
 * Preset buttons, the values (editable; editing makes them Custom) and the
 * explanation. `opts.craft` / `opts.onCraft` for paddling; `opts.onChange`
 * after any change.
 */
export function renderSpeedEditor(box, sport, opts = {}) {
  const craft = opts.craft || 'kayak';
  box.innerHTML = '';
  const s = speedsFor(sport);
  // (drawn again on a change: the preset and the craft pressed move to their new state, and keep the focus)
  const rerender = () => { const settle = settleControls(box); renderSpeedEditor(box, sport, opts); settle(); if (opts.onChange) opts.onChange(); };
  if (sport === 'paddle' && opts.onCraft) {
    box.append(h('div', { class: 'seg small full', role: 'group', 'aria-label': 'Craft' },
      ...Object.entries(CRAFT).map(([k, v]) => h('button', { type: 'button', 'aria-pressed': String(craft === k), onclick: () => { opts.onCraft(k); opts.craft = k; rerender(); } }, v.label))));
  }
  box.append(h('div', { class: 'seg small full speed-presets', role: 'group', 'aria-label': 'Speed' },
    ...PRESETS.map(([k, label]) => h('button', {
      type: 'button', 'aria-pressed': String(s.preset === k),
      onclick: () => {
        if (k === 'custom') save(sport, { preset: 'custom', custom: Object.fromEntries(Object.entries(s).filter(([f]) => f !== 'preset')) });
        else save(sport, { preset: k });
        rerender();
      },
    }, label))));
  const grid = h('div', { class: 'speed-fields' });
  for (const [key, label, unit] of fieldsOf(sport, craft)) {
    const input = h('input', {
      type: 'text', inputmode: unit === 'pace' || unit === 'pace100' ? 'text' : 'decimal', value: show(s[key], unit), 'aria-label': `${label} (${unitText(unit)})`,
      onchange: (e) => {
        const raw = e.target.value.replace(',', '.');
        const v = unit === 'pace' ? parsePace(raw) : unit === 'pace100' ? parsePace100(raw) : +raw;
        const ok = v && Number.isFinite(v) && v > 0 && (unit === 'm/h' ? v <= 3000 : v <= 80);
        if (!ok) { e.target.value = show(s[key], unit); e.target.classList.add('bad'); setTimeout(() => e.target.classList.remove('bad'), 900); return; }
        const cur = speedsFor(sport);
        save(sport, { preset: 'custom', custom: { ...Object.fromEntries(Object.entries(cur).filter(([f]) => f !== 'preset')), [key]: v } });
        rerender();
      },
    });
    grid.append(h('label', { class: 'speed-field' }, h('span', {}, label), input, h('small', {}, unitText(unit))));
  }
  box.append(grid, h('p', { class: 'note speed-how' }, howOf(sport)));
}
