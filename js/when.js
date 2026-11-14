// When you leave (#364, #869): the departure and its one control. The planner holds one (`planner.when`); every time on
// the route counts from start(), and js/trip.js says them. A row (the first screen's and the start's card's) or a pill
// (Go's) opens the same menu, and When says the departure again in each of them after a change (put()). Arrive by
// (#219) holds the time to be there by: the planner works the departure back from it (settle()) and tells When (got).
import { h, icon, popMenu, toast, escapeHtml } from './ui.js';
import { LONG_HOURS } from './weather.js';
import { timeOf, dayOf, clockOf } from './trip.js';

// a departure as a datetime-local field writes it ("2026-11-07T09:00")
const local = (sec) => { const d = new Date(sec * 1000), z = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const caret = `<span class="caret" aria-hidden="true">${icon('caret', 12)}</span>`;

export class When {
  // changed({ opened }): after the departure changes; `opened` when it came with a route (open()), which the
  // planner draws next. coarse(): a phone, whose own picker the menu opens. there(): when the route's timed to end
  // (epoch seconds), or null: Arrive by…'s first time.
  constructor({ changed, coarse, there }) {
    this.at = null; // epoch seconds, or null to leave now
    this.by = null; // Arrive by (#219): epoch seconds to be there by, or null
    this.nights = false; // the route has nights: Arrive by is its last morning's then, and the first day leaves at `at` (the planner says)
    this.got = null; // what the planner worked out for Arrive by: { leave, there, late, about, go } (settle())
    this.passed = null; // a planned time that had passed when its route was opened (said until a new one)
    this.passedBy = false; // (an Arrive by's)
    this.changed = changed;
    this.coarse = coarse;
    this.there = there;
    this.controls = new Set(); // (WeakRefs to the controls, so a card's row goes with its card)
    this.puts = new WeakMap(); // (each control's put())
    this.pop = null;
    // (registered before the planner's moveOn(): a departure that passed leaves now first)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.expire(); });
  }

  // the departure: the time set, the one worked back from Arrive by (never before now), or the current minute
  start() {
    const now = Math.round(Date.now() / 60000) * 60;
    return this.by != null && !this.nights ? Math.max(now, this.got?.leave ?? now) : this.at ?? now;
  }
  // a time in words: "now" (none), "07:30" today, "Sun 1 Nov, 07:30" on another day
  words(at = this.at) {
    return at == null ? 'now' : new Date(at * 1000).toDateString() === new Date().toDateString() ? timeOf(at) : `${dayOf(at)}, ${timeOf(at)}`;
  }
  // Arrive by's other end, once it's worked out: "leave 19:19", "leave about 19:20" where the wind changes it, "leave now"
  // when it's too soon; on a trip with nights, the last morning, "go on at 07:40" ('' where it can't be met: the note says)
  leaving() {
    const g = this.got, about = g?.about ? 'about ' : '';
    if (this.by == null || !g) return '';
    if (this.nights) return g.go != null ? `go on at ${about}${clockOf(g.go, this.by)}` : '';
    return g.late ? 'leave now' : `leave ${about}${clockOf(g.leave, this.by)}`; // (with its day where it isn't Arrive by's)
  }
  // what's kept with a route: the departure and Arrive by, those that had passed too (Undo brings them back as they were)
  kept() {
    return { leave: this.at ?? (this.passedBy ? null : this.passed), arrive: this.by ?? (this.passedBy ? this.passed : null) };
  }
  // A time of your own: a time that has passed is now. It takes Arrive by's place, but on a trip with nights it's the
  // first day's, beside it
  set(sec) {
    sec = sec != null && sec > Date.now() / 1000 ? Math.round(sec / 60) * 60 : null;
    const was = this.at, by = this.by, passed = this.passed;
    this.passed = null; // (the note on one that had passed goes)
    if (!this.nights) this.by = null;
    if (sec === was && this.by === by) { if (passed) this.put(); return; }
    this.at = sec;
    this.done();
  }
  // Arrive by (#219): a time that has passed is none. It takes the departure's place, but on a trip with nights it's the
  // last day's, beside it
  setBy(sec) {
    sec = sec != null && sec > Date.now() / 1000 ? Math.round(sec / 60) * 60 : null;
    const was = this.by, at = this.at, passed = this.passed;
    this.passed = null;
    if (!this.nights && sec != null) this.at = null;
    if (sec === was && this.at === at) { if (passed) this.put(); return; }
    this.by = sec;
    this.got = null;
    this.done();
  }
  done() {
    this.put();
    this.expire();
    this.changed({});
  }
  // A route opened (saved, saved offline, a link, Undo) leaves when it was planned to, or arrives by its time; one whose
  // time has passed leaves now, saying when it was planned for
  open(sec, by = null) {
    const now = Date.now() / 1000, gone = (t) => !!t && t <= now;
    this.at = sec > now ? sec : null;
    this.by = by > now ? by : null;
    this.got = null;
    this.passed = gone(sec) ? sec : gone(by) ? by : null;
    this.passedBy = !gone(sec) && gone(by);
    this.put();
    this.expire();
    this.changed({ opened: true });
  }
  // A planned time that passes while Polku stays open goes, saying when it was planned for, as a reload says: on a
  // timer, when the page is shown again, and before a link or a file is made (the review of #475)
  expire() {
    clearTimeout(this.timer);
    const next = Math.min(this.at ?? Infinity, this.by ?? Infinity);
    if (next === Infinity) return;
    const left = next - Date.now() / 1000;
    if (left > 0) { this.timer = setTimeout(() => this.expire(), Math.min(left * 1000 + 500, 864e5)); return; }
    const by = next !== this.at;
    if (by) this.setBy(null); else this.set(null);
    this.passed = next;
    this.passedBy = by;
    this.put();
  }

  // Every control says it again: after a change, and when the planner draws (overnight "Tomorrow" becomes "Today")
  put() {
    for (const ref of this.controls) { const el = ref.deref(); if (el) this.puts.get(el)(); else this.controls.delete(ref); }
  }

  // The control, kept up to date: 'row', a row with the day as its line (the first screen's, the start's card's); 'pill',
  // the value with ▾ and a note under it past the forecast's reach, when a planned time had passed, or when Arrive by
  // can't be met (Go's)
  control(kind) {
    const b = h('button', { type: 'button', class: kind === 'row' ? 'row when-row' : 'rt-pill when-pill', 'data-k': 'when', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.menu(b) });
    const note = kind === 'pill' && h('p', { class: 'pick-note', hidden: true });
    const el = note ? h('div', { class: 'when-box' }, b, note) : b;
    const put = () => {
      const at = this.at, by = this.by, passed = this.passed, t = by ?? at, far = t != null && t - Date.now() / 1000 >= LONG_HOURS * 3600;
      const ic = by != null ? 'flagend' : at == null ? 'clock' : 'calendar';
      if (kind === 'row') {
        const name = by != null ? `Arrive by ${timeOf(by)}` : at == null ? 'Leave now' : `Leave at ${timeOf(at)}`;
        const line = t != null ? [dayOf(t, true), far ? 'no forecast yet' : '', this.leaving()].filter(Boolean).join(' · ') : passed ? `${dayOf(passed)}, ${timeOf(passed)} has passed` : 'Times and weather along the route';
        b.setAttribute('aria-label', `When: ${name}. ${line}`);
        b.innerHTML = `<span>${icon(ic, 20)}</span><span><b>${escapeHtml(name)}</b><small>${escapeHtml(line)}</small></span>${caret}`;
        return;
      }
      const name = by != null ? `Arrive by ${this.words(by)}` : `Leave ${this.words()}`, g = this.got, miss = by != null && g?.late;
      b.setAttribute('aria-label', `When: ${name}`);
      b.innerHTML = `<span>${icon(ic, 16)}</span><span>${escapeHtml(name)}</span>${caret}`;
      note.hidden = !miss && !far && !passed;
      note.classList.toggle('info', !miss && !far && !!passed);
      note.replaceChildren(h('span', { 'aria-hidden': 'true', html: icon(miss ? 'warn' : far ? 'cloudSun' : 'info', 16) }),
        h('span', {}, miss ? (this.nights ? `With your nights you’re there at ${clockOf(g.there, this.start())}.` : `Leave now and you’re there at ${clockOf(g.there, this.start())}.`)
          : far ? `No forecast yet for ${dayOf(t)}. Sunset and the dark still count.`
          : !passed ? '' : this.passedBy ? `Arrive by ${dayOf(passed)}, ${timeOf(passed)} has passed: pick a new time above.`
          : `Planned for ${dayOf(passed)}, ${timeOf(passed)}. That’s passed, so it leaves now: pick a new time above.`));
    };
    put();
    this.puts.set(el, put);
    this.controls.add(new WeakRef(el));
    return el;
  }

  // The menu: Leave now, Leave at… and Arrive by…; on a trip with nights, the first day's departure and the last day's
  // arrival, each a group of its own. On a phone a time's date field lies unseen over its item, so a tap opens the
  // phone's own picker (an iPhone has no showPicker()), and the field is what the keyboard and a screen reader reach;
  // the menu stays while the picker is open, and goes once a time is picked and the picker is put away. A desktop
  // browser's picker has no OK, so there the item shows the field itself in the menu, with Set (and Enter).
  menu(anchor) {
    if (this.pop) { this.pop.close(); return; }
    const at = this.at, by = this.by, now = Date.now() / 1000, phone = this.coarse(), keyed = anchor.matches(':focus-visible');
    const quarter = (sec) => Math.ceil(sec / 900) * 900;
    const leaveAt = this.timeItem({ label: 'Leave at', ic: 'calendar', sec: at, def: quarter(now), phone, keyed, pick: (sec) => {
      if (sec != null && sec <= Date.now() / 1000) toast('That time has passed, so it leaves now');
      this.set(sec);
    } });
    const arriveBy = this.timeItem({ label: 'Arrive by', ic: 'flagend', sec: by, def: quarter(this.there() ?? now), phone, keyed, pick: (sec) => {
      if (sec != null && sec <= Date.now() / 1000) toast('That time has passed');
      this.setBy(sec);
    } });
    const leaveNow = { icon: 'clock', label: 'Leave now', radio: true, checked: at == null && (by == null || this.nights), fn: () => this.set(null) };
    const groups = this.nights
      ? [{ group: 'First day', items: [leaveNow, leaveAt.item] }, { group: 'Last day', items: [{ icon: 'clock', label: 'Any time', radio: true, checked: by == null, fn: () => this.setBy(null) }, arriveBy.item] }]
      : [{ group: 'When', items: [leaveNow, leaveAt.item, arriveBy.item] }];
    anchor.setAttribute('aria-expanded', 'true');
    this.pop = popMenu(anchor, groups, { label: 'When', align: 'left', sheet: true, onClose: () => { this.pop = null; anchor.setAttribute('aria-expanded', 'false'); } });
    // a phone's, with a time set: the focus on its field from the keyboard, and on none from a tap: on Leave now it
    // reads as picked, and a field focused under a finger opens an iPhone's picker
    if (phone && (at != null || by != null)) { if (keyed) (by != null ? arriveBy : leaveAt).field.focus({ preventScroll: true }); else this.pop.el.querySelector(':focus')?.blur(); }
  }
  // Leave at… or Arrive by…, as the menu above says: { item, field }. `def`: the field's time when none is set
  timeItem({ label, ic, sec, def, phone, keyed, pick }) {
    const now = Date.now() / 1000, day = sec != null ? `${dayOf(sec, true)}, ${timeOf(sec)}` : '';
    // (min on the clock's quarter hour: the field's steps count from it)
    const field = h('input', { type: 'datetime-local', step: '900', class: phone ? 'menu-item' : 'name-field', value: local(sec ?? def), min: local(Math.floor(now / 900) * 900),
      'aria-label': phone ? `${label}…${sec != null ? ` ${day}.` : ''} Pick a day and a time` : `${label}: a day and a time` });
    const picked = () => pick(field.value ? new Date(field.value).getTime() / 1000 : null);
    if (phone) {
      let done = false;
      const open = () => { try { field.showPicker(); } catch { /* the phone opens its own */ } };
      field.addEventListener('click', open);
      field.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      field.addEventListener('change', () => { done = true; picked(); });
      field.addEventListener('blur', () => { if (done) this.pop?.close(keyed); }); // (left by a key: the focus back on the control)
      return { field, item: { node: h('div', { class: `menu-pick${sec != null ? ' on' : ''}` },
        h('span', { 'aria-hidden': 'true', html: `${icon(ic, 17)}<span>${label}…${sec != null ? `<small>${escapeHtml(day)}</small>` : ''}</span>${sec != null ? `<span class="menu-tick">${icon('check', 17)}</span>` : ''}` }), field) } };
    }
    const set = () => { if (!field.value) return; picked(); this.pop?.close(keyed); };
    field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); set(); } });
    const form = h('div', { class: 'menu-when' }, field, h('button', { type: 'button', class: 'btn primary', 'data-k': 'when-set', onclick: set }, 'Set'));
    return { field, item: { icon: ic, label: `${label}…`, desc: escapeHtml(day), radio: true, checked: sec != null, keep: true,
      fn: () => { this.pop.refill([{ group: label, items: [{ node: form }] }]); field.focus(); } } };
  }
}
