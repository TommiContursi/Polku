// One reusable modal dialog (native <dialog>: focus trap, Esc to close).

import { h, icon } from './ui.js';

let dlg = null;
let onClose = null;

function ensure() {
  if (dlg) return dlg;
  dlg = h('dialog', { class: 'modal', 'aria-labelledby': 'modal-title' });
  dlg.addEventListener('close', () => {
    if (dlg.open) return; // closed and immediately reopened with new content
    const f = onClose; onClose = null; if (f) f();
  });
  // click on the backdrop closes
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg);
  return dlg;
}

/**
 * Open the modal. `build(body, head)` fills it; returns a close() function.
 * `opts.wide` for image-heavy content, `opts.onClose` for cleanup.
 */
export function openModal({ title, subtitle = '', wide = false, card = false, onClose: cb = null }, build) {
  const d = ensure();
  if (d.open) { const f = onClose; onClose = null; if (f) f(); d.close(); }
  // card: a non-modal side panel, so the map stays usable behind it
  d.className = `modal${wide ? ' modal-wide' : ''}${card ? ' modal-card' : ''}`;
  d.innerHTML = '';
  const head = h('header', { class: 'modal-head' },
    h('div', { class: 'modal-titles' }, h('h2', { id: 'modal-title' }, title), subtitle ? h('p', {}, subtitle) : null),
    h('button', { type: 'button', class: 'tool', 'aria-label': 'Close', onclick: () => d.close(), html: icon('close', 18) }));
  const body = h('div', { class: 'modal-body' });
  d.append(head, body);
  onClose = cb;
  build(body, head);
  if (card) d.show(); else d.showModal();
  return () => d.close();
}

export const closeModal = () => { if (dlg && dlg.open) dlg.close(); };
export const modalBody = () => (dlg && dlg.open ? dlg.querySelector('.modal-body') : null);
