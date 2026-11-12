// When you leave (#364, #869): the departure and its one control. The planner holds one (`planner.when`); every time on
// the route counts from start(), and js/trip.js says them. A row (the first screen's and the start's card's) or a pill
// (Go's) opens the same menu, and When says the departure again in each of them after a change (put()).
import { h, icon, popMenu, toast, escapeHtml } from './ui.js';
import { LONG_HOURS } from './weather.js';
import { timeOf, dayOf } from './trip.js';

// a departure as a datetime-local field writes it ("2026-11-07T09:00")
const local = (sec) => { const d = new Date(sec * 1000), z = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const caret = `<span class="caret" aria-hidden="true">${icon('caret', 12)}</span>`;

export class When {
  // changed({ opened }): after the departure changes; `opened` when it came with a route (open()), which the
  // planner draws next. coarse(): a phone, whose own picker the menu opens.
  constructor({ changed, coarse }) {
    this.at = null; // epoch seconds, or null to leave now
    this.passed = null; // a planned departure that had passed when its route was opened (said until a new one)
    this.changed = changed;
    this.coarse = coarse;
    this.controls = new Set(); // (WeakRefs to the controls, so a card's row goes with its card)
    this.puts = new WeakMap(); // (each control's put())
    this.pop = null;
    // (registered before the planner's moveOn(): a departure that passed leaves now first)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.expire(); });
  }

  // the departure: the time set, or the current minute
  start() { return this.at ?? Math.round(Date.now() / 60000) * 60; }
  // in words: "now", "07:30" today, "Sun 1 Nov, 07:30" on another day
  words() {
    const at = this.at;
    return at == null ? 'now' : new Date(at * 1000).toDateString() === new Date().toDateString() ? timeOf(at) : `${dayOf(at)}, ${timeOf(at)}`;
  }
  // A time of your own: a time that has passed is now
  set(sec) {
    sec = sec != null && sec > Date.now() / 1000 ? Math.round(sec / 60) * 60 : null;
    const was = this.at, passed = this.passed;
    this.passed = null; // (the note on one that had passed goes)
    if (sec === was) { if (passed) this.put(); return; }
    this.at = sec;
    this.put();
    this.expire();
    this.changed({});
  }
  // A route opened (saved, saved offline, a link, Undo) leaves when it was planned to; one whose time has passed leaves
  // now, saying when it was planned for
  open(sec) {
    const ahead = sec > Date.now() / 1000;
    this.at = ahead ? sec : null;
    this.passed = sec && !ahead ? sec : null;
    this.put();
    this.expire();
    this.changed({ opened: true });
  }
  // A planned departure that passes while Polku stays open leaves now, saying when it was planned for, as a reload says:
  // on a timer, when the page is shown again, and before a link or a file is made (the review of #475)
  expire() {
    clearTimeout(this.timer);
    if (this.at == null) return;
    const left = this.at - Date.now() / 1000;
    if (left > 0) { this.timer = setTimeout(() => this.expire(), Math.min(left * 1000 + 500, 864e5)); return; }
    const was = this.at;
    this.set(null);
    this.passed = was;
    this.put();
  }

  // Every control says it again: after a change, and when the planner draws (overnight "Tomorrow" becomes "Today")
  put() {
    for (const ref of this.controls) { const el = ref.deref(); if (el) this.puts.get(el)(); else this.controls.delete(ref); }
  }

  // The control, kept up to date: 'row', a row with the day as its line (the first screen's, the start's card's); 'pill',
  // the value with ▾ and a note under it past the forecast's reach or when a planned time had passed (Go's)
  control(kind) {
    const b = h('button', { type: 'button', class: kind === 'row' ? 'row when-row' : 'rt-pill when-pill', 'data-k': 'when', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.menu(b) });
    const note = kind === 'pill' && h('p', { class: 'pick-note', hidden: true });
    const el = note ? h('div', { class: 'when-box' }, b, note) : b;
    const put = () => {
      const at = this.at, passed = at == null && this.passed, far = at != null && at - Date.now() / 1000 >= LONG_HOURS * 3600;
      if (kind === 'row') {
        const name = at == null ? 'Leave now' : `Leave at ${timeOf(at)}`;
        const line = at != null ? `${dayOf(at, true)}${far ? ' · no forecast yet' : ''}` : passed ? `${dayOf(passed)}, ${timeOf(passed)} has passed` : 'Times and weather along the route';
        b.setAttribute('aria-label', `When: ${name}. ${line}`);
        b.innerHTML = `<span>${icon(at == null ? 'clock' : 'calendar', 20)}</span><span><b>${escapeHtml(name)}</b><small>${escapeHtml(line)}</small></span>${caret}`;
        return;
      }
      const name = `Leave ${this.words()}`;
      b.setAttribute('aria-label', `When: ${name}`);
      b.innerHTML = `<span>${icon(at == null ? 'clock' : 'calendar', 16)}</span><span>${escapeHtml(name)}</span>${caret}`;
      note.hidden = !far && !passed;
      note.classList.toggle('info', !!passed);
      note.replaceChildren(h('span', { 'aria-hidden': 'true', html: icon(far ? 'cloudSun' : 'info', 16) }),
        h('span', {}, far ? `No forecast yet for ${dayOf(at)}. Sunset and the dark still count.` : passed ? `Planned for ${dayOf(passed)}, ${timeOf(passed)}. That’s passed, so it leaves now: pick a new time above.` : ''));
    };
    put();
    this.puts.set(el, put);
    this.controls.add(new WeakRef(el));
    return el;
  }

  // The menu: Leave now, and Leave at…. On a phone, Leave at…'s date field lies unseen over it, so a tap opens the
  // phone's own picker (an iPhone has no showPicker()), and the field is what the keyboard and a screen reader reach;
  // the menu stays while the picker is open, and goes once a time is picked and the picker is put away. A desktop
  // browser's picker has no OK, so there Leave at… shows the field itself in the menu, with Set (and Enter).
  menu(anchor) {
    if (this.pop) { this.pop.close(); return; }
    const at = this.at, now = Date.now() / 1000, day = at != null ? `${dayOf(at, true)}, ${timeOf(at)}` : '', phone = this.coarse(), keyed = anchor.matches(':focus-visible');
    // (min on the clock's quarter hour: the field's steps count from it)
    const field = h('input', { type: 'datetime-local', step: '900', class: phone ? 'menu-item' : 'name-field', value: local(at ?? Math.ceil(now / 900) * 900), min: local(Math.floor(now / 900) * 900),
      'aria-label': phone ? `Leave at…${at != null ? ` ${day}.` : ''} Pick a day and a time` : 'Leave at: a day and a time' });
    const pick = () => {
      const sec = field.value ? new Date(field.value).getTime() / 1000 : null;
      if (sec != null && sec <= Date.now() / 1000) toast('That time has passed, so it leaves now');
      this.set(sec);
    };
    let leaveAt;
    if (phone) {
      let picked = false;
      const open = () => { try { field.showPicker(); } catch { /* the phone opens its own */ } };
      field.addEventListener('click', open);
      field.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      field.addEventListener('change', () => { picked = true; pick(); });
      field.addEventListener('blur', () => { if (picked) this.pop?.close(keyed); }); // (left by a key: the focus back on the control)
      leaveAt = { node: h('div', { class: `menu-pick${at != null ? ' on' : ''}` },
        h('span', { 'aria-hidden': 'true', html: `${icon('calendar', 17)}<span>Leave at…${at != null ? `<small>${escapeHtml(day)}</small>` : ''}</span>${at != null ? `<span class="menu-tick">${icon('check', 17)}</span>` : ''}` }), field) };
    } else {
      const set = () => { if (!field.value) return; pick(); this.pop?.close(keyed); };
      field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); set(); } });
      const form = h('div', { class: 'menu-when' }, field, h('button', { type: 'button', class: 'btn primary', 'data-k': 'when-set', onclick: set }, 'Set'));
      leaveAt = { icon: 'calendar', label: 'Leave at…', desc: escapeHtml(day), radio: true, checked: at != null, keep: true,
        fn: () => { this.pop.refill([{ group: 'Leave at', items: [{ node: form }] }]); field.focus(); } };
    }
    anchor.setAttribute('aria-expanded', 'true');
    this.pop = popMenu(anchor, [{ group: 'When', items: [{ icon: 'clock', label: 'Leave now', radio: true, checked: at == null, fn: () => this.set(null) }, leaveAt] }],
      { label: 'When', align: 'left', sheet: true, onClose: () => { this.pop = null; anchor.setAttribute('aria-expanded', 'false'); } });
    // a phone's, with a time set: the focus on Leave at… from the keyboard, and on neither from a tap: on Leave now it
    // reads as picked, and a field focused under a finger opens an iPhone's picker
    if (phone && at != null) { if (keyed) field.focus({ preventScroll: true }); else this.pop.el.querySelector(':focus')?.blur(); }
  }
}
