// Route styles: presets and fine-tuning per sport, turned into what each
// router understands. BRouter takes `profile:name=value` parameters that
// override a stock profile's variables (any global one: BRouter injects them
// before the profile's own assignments); Valhalla, the stand-in, gets the
// nearest costing options; paddling steers Polku's own water router.
//
// Every control here was checked to change real routes (tools/style_probe.py
// against a local BRouter, 2026-10-13); the ones that didn't were left out.
// "Balanced" is the stock profile with nothing added, except road cycling,
// whose stock profile treats gravel main roads like asphalt: there "Paved
// roads" is the default, through Polku's own profile (profiles/polku-road.brf).
//
// A style is { p: preset key, v: { control: step | [flags] } (changes from the
// preset), wet: 'auto' | 'yes' | 'no' }. No DOM in here: tools and tests use it.

// Polku's road profile: the stock fastbike-lowtraffic plus unpaved_mainroad_factor.
// Uploaded to the routing server under this id (bump the number when the file changes).
export const CUSTOM_PROFILES = {
  'custom_polku-road-1': { file: 'profiles/polku-road.brf', stock: 'fastbike-lowtraffic' },
};

// [key, label, BRouter variables, Valhalla options, extra] — extra: { profile } or { water }
const step = ([key, text, br = {}, vh = {}, extra = {}]) => ({ key, text, br, vh, ...extra });
const control = (id, label, help, steps, def) => ({ id, label, help, steps: steps.map(step), def: def || steps[0][0] });
// several independent switches in one row ("prefer forest", "along water"…)
const flags = (id, label, help, list) => ({ id, label, help, type: 'flags', flags: list.map(step), def: [] });

const WET = { mtb: 'iswet', gravel: 'assume_wet_conditions', hike: 'iswet', trailrun: 'iswet' };

const footControls = (extra = []) => [
  control('d', 'Difficulty', 'Easy keeps to paths without scrambling (SAC T1). Mountain lets demanding paths in. SAC grades are mostly tagged in the fells.', [
    ['easy', 'Easy paths', { SAC_scale_limit: 1, SAC_scale_preferred: 0 }, { max_hiking_difficulty: 1 }],
    ['normal', 'Normal', {}, { max_hiking_difficulty: 3 }],
    ['mountain', 'Mountain', { SAC_scale_limit: 5, SAC_scale_preferred: 2 }, { max_hiking_difficulty: 5 }],
  ], 'normal'),
  control('h', 'Paths', 'Marked trails keeps to signposted hiking routes where there are some; any path takes the most direct footpath.', [
    ['any', 'Any path', { hiking_routes_preference: 0.05 }, { use_tracks: 0.8 }],
    ['balanced', 'Balanced', {}],
    ['marked', 'Marked trails', { hiking_routes_preference: 1.0 }],
  ], 'balanced'),
  control('c', 'Climbs', 'Fewer counts every metre of climbing against the route.', [
    ['any', 'Don’t mind', {}],
    ['fewer', 'Fewer', { consider_elevation: 1 }, { use_hills: 0.1 }],
  ]),
  ...extra,
  flags('f', 'Prefer', 'Small detours for nicer surroundings.', [
    ['forest', 'Forest', { consider_forest: 1 }],
    ['water', 'Along water', { consider_river: 1 }],
    ['quiet', 'Quiet', { consider_noise: 1 }],
    ['towns', 'Away from towns', { consider_town: 1 }],
  ]),
];

export const STYLES = {
  mtb: {
    controls: [
      control('t', 'Terrain', 'How much trails are worth over roads and cycleways.', [
        ['roads', 'Roads ok', { MTB_factor: -1.5 }, { use_roads: 0.6 }],
        ['balanced', 'Balanced', {}],
        ['trails', 'More trails', { MTB_factor: 1 }, { use_roads: 0.1 }],
        ['first', 'Trails first', { MTB_factor: 2, path_preference: 40 }, { use_roads: 0, avoid_bad_surfaces: 0 }],
      ], 'balanced'),
      control('x', 'Technical trails', 'Avoid: S2 and harder cost much more and S4+ is never used. Fine: no extra cost for difficulty or rough surfaces.', [
        ['avoid', 'Avoid', {}],
        ['fine', 'Fine', { consider_smoothness: 0 }, { avoid_bad_surfaces: 0 }],
      ]),
      control('c', 'Climbs', 'Fewer counts climbs steeper than 3 % extra.', [
        ['any', 'Don’t mind', {}],
        ['fewer', 'Fewer', { hills: 1 }, { use_hills: 0.1 }],
      ]),
      control('m', 'Main roads', 'Avoid main roads without a bike lane or path.', [
        ['ok', 'If needed', {}],
        ['avoid', 'Avoid', { avoid_unsafe: 1 }, { use_roads: 0.05 }],
      ]),
    ],
    presets: [
      ['balanced', 'Balanced', {}],
      ['flowy', 'Flowy trails', { t: 'trails' }],
      ['technical', 'Technical', { t: 'first', x: 'fine' }],
      ['easy', 'Smooth & easy', { c: 'fewer', m: 'avoid' }],
      ['transfer', 'Roads to the trail', { t: 'roads' }],
    ],
  },
  gravel: {
    controls: [
      control('u', 'Surface', 'More gravel takes unpaved paths and tracks where it can.', [
        ['mixed', 'Balanced', {}],
        ['unpaved', 'More gravel', { prefer_unpaved_paths: 1 }, { avoid_bad_surfaces: 0 }],
      ]),
      control('c', 'Climbs', 'Fewer counts climbing against the route; Avoid steep also keeps off steep pitches.', [
        ['any', 'Don’t mind', {}],
        ['fewer', 'Fewer', { consider_elevation: 1 }, { use_hills: 0.15 }],
        ['flat', 'Avoid steep', { consider_elevation: 1, avoid_steep_inclines: 1 }, { use_hills: 0.05 }],
      ]),
      control('r', 'Traffic', 'Avoid roads that usually carry traffic.', [
        ['ok', 'Don’t mind', {}],
        ['avoid', 'Avoid', { consider_traffic_estimate: 1 }, { use_roads: 0.1 }],
      ]),
      control('k', 'Cycle routes', 'Follow signed cycle routes — mostly paved.', [
        ['ok', 'Don’t mind', {}],
        ['prefer', 'Prefer', { prefer_cycle_routes: 1 }],
      ]),
      flags('f', 'Prefer', 'Small detours for nicer surroundings.', [
        ['forest', 'Forest', { prefer_forests: 1 }],
        ['water', 'Along water', { prefer_rivers: 1 }],
        ['towns', 'Away from towns', { avoid_towns: 1 }],
        ['quiet', 'Quiet', { avoid_noise: 1 }],
      ]),
    ],
    presets: [
      ['balanced', 'Balanced', {}],
      ['grinder', 'Gravel grinder', { u: 'unpaved' }],
      ['paved', 'Mostly paved', { k: 'prefer' }],
      ['scenic', 'Scenic', { f: ['forest', 'water', 'towns'] }],
      ['flat', 'Flatter', { c: 'flat' }],
    ],
  },
  road: {
    note: 'Paved roads is the routing service’s road-bike profile with one change of Polku’s: gravel main roads count as rough.',
    controls: [
      control('u', 'Surface', 'Many Finnish main roads are gravel; Paved only keeps off them (a longer way round if needed).', [
        ['paved', 'Paved only', { unpaved_mainroad_factor: 6 }, { avoid_bad_surfaces: 1 }, { profile: 'custom_polku-road-1' }],
        ['any', 'Gravel roads ok', {}],
      ], 'paved'),
      control('r', 'Traffic', 'Main roads ok lets busier roads in when they’re more direct.', [
        ['quiet', 'Avoid busy', {}],
        ['direct', 'Main roads ok', { consider_traffic: 0 }, { use_roads: 0.6 }],
      ]),
      control('c', 'Climbs', 'Fewer counts every climb against the route.', [
        ['any', 'Don’t mind', {}],
        ['fewer', 'Fewer', { uphillcost: 60 }, { use_hills: 0.1 }],
      ]),
    ],
    presets: [
      ['balanced', 'Paved roads', {}],
      ['flat', 'Flatter', { c: 'fewer' }],
      ['gravel', 'Gravel roads ok', { u: 'any' }],
    ],
  },
  hike: {
    controls: footControls(),
    presets: [
      ['balanced', 'Balanced', {}],
      ['nature', 'Nature paths', { h: 'marked', f: ['forest', 'water', 'quiet'] }],
      ['easy', 'Easy paths', { d: 'easy', c: 'fewer' }],
      ['mountain', 'Mountain', { d: 'mountain' }],
    ],
  },
  trailrun: {
    controls: footControls(),
    presets: [
      ['balanced', 'Balanced', {}],
      ['trails', 'Trails', { h: 'any', f: ['forest'] }],
      ['flat', 'Flatter', { c: 'fewer' }],
      ['nature', 'Nature', { h: 'marked', f: ['forest', 'water'] }],
    ],
  },
  run: {
    controls: [
      control('c', 'Climbs', 'Fewer counts every metre of climbing against the route.', [
        ['any', 'Don’t mind', {}],
        ['fewer', 'Fewer', { consider_elevation: 1 }, { use_hills: 0.1 }],
      ]),
      control('s', 'Stairs', 'Avoid keeps off steps.', [
        ['ok', 'Fine', {}],
        ['avoid', 'Avoid', { allow_steps: 0 }, { step_penalty: 600 }],
      ]),
      control('h', 'Paths', 'Any path takes the most direct footpath; Balanced favours signposted routes a little.', [
        ['balanced', 'Balanced', {}],
        ['any', 'Any path', { hiking_routes_preference: 0.05 }, { use_tracks: 0.8 }],
      ]),
      flags('f', 'Prefer', 'Small detours for nicer surroundings.', [
        ['forest', 'Green', { consider_forest: 1 }],
        ['water', 'Along water', { consider_river: 1 }],
        ['quiet', 'Quiet', { consider_noise: 1 }],
        ['towns', 'Away from town', { consider_town: 1 }],
      ]),
    ],
    presets: [
      ['balanced', 'Balanced', {}],
      ['green', 'Green & quiet', { f: ['forest', 'quiet'] }],
      ['water', 'Along water', { f: ['water'] }],
      ['flat', 'Flat', { c: 'fewer' }],
      ['direct', 'Direct', { h: 'any' }],
    ],
  },
  paddle: {
    controls: [
      control('n', 'Shore', 'Near the shore keeps within easy reach of land (cold water, wind); open water takes the straighter line.', [
        ['open', 'Open water ok', {}],
        ['near', 'Near the shore', {}, {}, { water: { shore: 'near' } }],
      ]),
      control('p', 'Carries', 'How readily the route carries over land between waters.', [
        ['fine', 'When shorter', {}],
        ['avoid', 'Avoid', {}, {}, { water: { carry: 70 } }],
        ['never', 'Never', {}, {}, { water: { carry: 400 } }],
      ]),
    ],
    presets: [
      ['balanced', 'Balanced', {}],
      ['shore', 'Near the shore', { n: 'near' }],
      ['nocarry', 'No carries', { p: 'never' }],
    ],
  },
};

export const hasWet = (sport) => !!WET[sport];
export const defaultStyle = () => ({ p: 'balanced', v: {}, wet: 'auto' });
const catalogue = (sport) => STYLES[sport] || STYLES.mtb;
const presetOf = (sport, key) => catalogue(sport).presets.find(([k]) => k === key) || catalogue(sport).presets[0];

/** Every control's value for a style: preset over defaults, your changes over the preset. */
export function valuesOf(sport, style) {
  const c = catalogue(sport);
  const out = {};
  for (const ctl of c.controls) out[ctl.id] = ctl.def;
  Object.assign(out, presetOf(sport, style && style.p)[2], (style && style.v) || {});
  for (const ctl of c.controls) {
    const v = out[ctl.id];
    if (ctl.type === 'flags') out[ctl.id] = Array.isArray(v) ? v.filter((f) => ctl.flags.some((x) => x.key === f)) : [];
    else if (!ctl.steps.some((s) => s.key === v)) out[ctl.id] = ctl.def;
  }
  return out;
}

/** Is it exactly a preset (no changes of your own)? */
export const isCustom = (sport, style) => {
  const preset = valuesOf(sport, { p: style.p, v: {} });
  const mine = valuesOf(sport, style);
  return Object.keys(mine).some((k) => JSON.stringify(mine[k]) !== JSON.stringify(preset[k]));
};

export const styleName = (sport, style) => (style && isCustom(sport, style) ? 'Custom' : presetOf(sport, style && style.p)[1]);

/**
 * What the routers get for this style: { profile (BRouter, if not the sport's
 * stock one), params (BRouter variables), valhalla (costing options), water
 * (Polku's water router), key (what the route depends on) }.
 */
export function routerOf(sport, style, wetNow = false) {
  const c = catalogue(sport);
  const vals = valuesOf(sport, style);
  const out = { profile: null, params: {}, valhalla: {}, water: {} };
  const take = (s) => {
    Object.assign(out.params, s.br);
    Object.assign(out.valhalla, s.vh);
    if (s.profile) out.profile = s.profile;
    if (s.water) Object.assign(out.water, s.water);
  };
  for (const ctl of c.controls) {
    if (ctl.type === 'flags') { for (const f of ctl.flags) if (vals[ctl.id].includes(f.key)) take(f); } else take(ctl.steps.find((s) => s.key === vals[ctl.id]));
  }
  const wet = style && style.wet === 'yes' ? true : style && style.wet === 'no' ? false : wetNow;
  if (WET[sport] && wet) out.params[WET[sport]] = 1;
  const p = Object.keys(out.params).sort().map((k) => `${k}=${out.params[k]}`).join('&');
  out.key = [out.profile || '', p, JSON.stringify(out.water)].join('|');
  return out;
}

// ---------------------------------------------------------------- share links
// A style as a few characters: the preset's key, then ~ and a control id with
// a step number (or a flags bitmask), and ~W a|y|n for wet ground when it isn't
// auto. "" for the default style, so old links and untouched routes stay short.
export function encodeStyle(sport, style) {
  if (!style) return '';
  const c = catalogue(sport);
  const base = valuesOf(sport, { p: style.p, v: {} });
  const mine = valuesOf(sport, style);
  let out = presetOf(sport, style.p)[0];
  for (const ctl of c.controls) {
    if (JSON.stringify(mine[ctl.id]) === JSON.stringify(base[ctl.id])) continue;
    out += `~${ctl.id}${ctl.type === 'flags' ? ctl.flags.reduce((m, f, i) => m | (mine[ctl.id].includes(f.key) ? 1 << i : 0), 0) : ctl.steps.findIndex((s) => s.key === mine[ctl.id])}`;
  }
  if (style.wet && style.wet !== 'auto') out += `~W${style.wet[0]}`;
  return out === 'balanced' ? '' : out;
}

export function decodeStyle(sport, code) {
  const st = defaultStyle();
  if (!code) return st;
  const c = catalogue(sport);
  const [p, ...rest] = String(code).split('~');
  if (c.presets.some(([k]) => k === p)) st.p = p;
  for (const r of rest) {
    if (r[0] === 'W') { st.wet = { a: 'auto', y: 'yes', n: 'no' }[r[1]] || 'auto'; continue; }
    const ctl = c.controls.find((x) => x.id === r[0]);
    const n = parseInt(r.slice(1), 10);
    if (!ctl || !Number.isFinite(n)) continue;
    if (ctl.type === 'flags') st.v[ctl.id] = ctl.flags.filter((_, i) => n & (1 << i)).map((f) => f.key);
    else if (ctl.steps[n]) st.v[ctl.id] = ctl.steps[n].key;
  }
  return st;
}
