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

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  read(slots);
  for (const fn of listeners) fn();
});
