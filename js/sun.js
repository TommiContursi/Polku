// Sunrise, sunset and civil twilight from the solar position (the sunrise
// equation, as in NOAA's calculator): no service to ask, a few lines of maths.
// Good to a minute or two in Finland; in the far north it says when the sun
// doesn't set (or rise) at all.

const RAD = Math.PI / 180;
const J2000 = 2451545;

/**
 * The sun on the day that contains epoch second `at`, seen from [lon, lat].
 * Returns epoch seconds { rise, set, dawn, dusk } (dawn and dusk: civil twilight,
 * the sun 6° below the horizon), any of them null when it doesn't happen, plus
 * `day: 'polar-day' | 'polar-night' | null`.
 */
export function sunTimes(at, [lon, lat]) {
  // the day number whose solar noon falls on this date at this longitude
  const jd = at / 86400 + 2440587.5;
  const n = Math.round(jd - J2000 - 0.0009 + lon / 360);
  const jStar = n + 0.0009 - lon / 360;
  const M = ((357.5291 + 0.98560028 * jStar) % 360) * RAD;
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * RAD;
  const lambda = (M + C + Math.PI + 102.9372 * RAD) % (2 * Math.PI);
  const transit = J2000 + jStar + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * lambda);
  const decl = Math.asin(Math.sin(lambda) * Math.sin(23.4397 * RAD));
  const phi = lat * RAD;
  const hourAngle = (h0) => (Math.sin(h0 * RAD) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  const toSec = (j) => (j - 2440587.5) * 86400;
  const at0 = (h0) => {
    const c = hourAngle(h0);
    if (c < -1 || c > 1) return [null, null, c < -1 ? 'up' : 'down'];
    const w = Math.acos(c) / (2 * Math.PI);
    return [toSec(transit - w), toSec(transit + w), null];
  };
  const [rise, set, sun] = at0(-0.833); // the sun's disc and refraction
  const [dawn, dusk] = at0(-6);
  return { rise, set, dawn, dusk, noon: toSec(transit), day: sun === 'up' ? 'polar-day' : sun === 'down' ? 'polar-night' : null };
}

/**
 * The stretches of a trip in the dark: [{ from, to, kind }] in epoch seconds
 * between `start` and `end` (kind: 'twilight' after sunset or before sunrise,
 * 'dark' past civil dusk or before dawn). Looks at each day the trip touches.
 */
export function darkness(start, end, ll) {
  const out = [];
  for (let day = start - 86400; day < end + 86400; day += 86400) {
    const s = sunTimes(day, ll);
    const next = sunTimes(day + 86400, ll);
    if (s.day === 'polar-day') continue;
    if (s.day === 'polar-night') {
      // kaamos: no sunrise, but civil twilight around noon on most days
      if (s.dawn && s.dusk) out.push({ from: s.noon - 43200, to: s.dawn, kind: 'dark' }, { from: s.dawn, to: s.dusk, kind: 'twilight' }, { from: s.dusk, to: s.noon + 43200, kind: 'dark' });
      else out.push({ from: s.noon - 43200, to: s.noon + 43200, kind: 'dark' });
      continue;
    }
    // evening twilight, the night, morning twilight
    const nightFrom = s.dusk || s.set, nightTo = next.dawn || next.rise;
    if (s.set && s.dusk) out.push({ from: s.set, to: s.dusk, kind: 'twilight' });
    if (nightFrom && nightTo && nightTo > nightFrom) out.push({ from: nightFrom, to: nightTo, kind: 'dark' });
    if (next.dawn && next.rise) out.push({ from: next.dawn, to: next.rise, kind: 'twilight' });
  }
  // clip to the trip, merge what overlaps
  return out.map((x) => ({ ...x, from: Math.max(start, x.from), to: Math.min(end, x.to) })).filter((x) => x.to > x.from)
    .sort((a, b) => a.from - b.from)
    .reduce((acc, x) => { const l = acc[acc.length - 1]; if (l && l.kind === x.kind && x.from <= l.to + 1) l.to = Math.max(l.to, x.to); else acc.push({ ...x }); return acc; }, []);
}
