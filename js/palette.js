// The colours the JavaScript draws with that mean something (the route, the warning colours, the colour
// scales) are values on :root in css/app.css (#382), so each has one home and dark mode can give it a version
// of its own. fromCss() puts each '--name' in a table in its value's place, in the same table, and does it
// again when the theme changes; onTheme()'s listeners come after that, to draw with the new values.

const slots = []; // [object, key, '--name']
const listeners = [];

function read(list) {
  const css = getComputedStyle(document.documentElement);
  for (const [at, key, name] of list) {
    const v = css.getPropertyValue(name).trim();
    // (none: a name that isn't there, or an app.css from before it, which the service worker gives a slow network)
    if (!v) console.error(`No ${name} in css/app.css`);
    at[key] = v || '#808080';
  }
}

export function fromCss(table) {
  const mine = [];
  const walk = (at) => {
    for (const [key, v] of Object.entries(at)) {
      if (typeof v === 'string' && v.startsWith('--')) mine.push([at, key, v]);
      else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(table);
  read(mine);
  slots.push(...mine);
  return table;
}

export const onTheme = (fn) => listeners.push(fn);

// Black words (--ink), not white, on a colour of the map's or a scale's (a climb's badge, a loop's letter): past this
// luminance black reads better than white, and the better of the two is always 4.58:1 or more (#376)
export function darkWords(hex) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const n = parseInt(String(hex).replace('#', ''), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) > 0.179;
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  read(slots);
  for (const fn of listeners) fn();
});
