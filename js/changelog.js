// The deployed release notes, fetched only when Settings → What's new opens.
// A small Markdown subset, built with DOM nodes: no HTML from the document runs.
import { h } from './ui.js';
import { request } from './net.js';
import { openModal } from './modal.js';

const SOURCE = 'https://github.com/TommiContursi/Polku/blob/main/CHANGELOG.md';
const REPO = 'https://github.com/TommiContursi/Polku/blob/main/';

function linkURL(value) {
  try {
    const url = new URL(value, REPO);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function inline(parent, text) {
  const tokens = /\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(tokens)) {
    parent.append(document.createTextNode(text.slice(last, m.index)));
    if (m[1]) {
      const href = linkURL(m[2]);
      const node = href ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }) : h('span');
      inline(node, m[1]);
      parent.append(node);
    } else parent.append(h(m[3] ? 'strong' : 'code', {}, m[3] || m[4]));
    last = m.index + m[0].length;
  }
  parent.append(document.createTextNode(text.slice(last)));
}

function renderNotes(text, body) {
  let paragraph = [], list = null;
  const flush = () => {
    if (paragraph.length) { const p = h('p'); inline(p, paragraph.join(' ')); body.append(p); paragraph = []; }
  };
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const item = /^\s*-\s+(.+)$/.exec(line);
    if (!line.trim() || heading || item) flush();
    if (heading) {
      list = null;
      // The dialog owns h2; dates are h3 and individual changes h4.
      if (heading[1].length === 1) continue;
      const el = h(heading[1].length === 2 ? 'h3' : 'h4');
      inline(el, heading[2]); body.append(el);
    } else if (item) {
      if (!list) { list = h('ul'); body.append(list); }
      const li = h('li'); inline(li, item[1]); list.append(li);
    } else if (line.trim()) { list = null; paragraph.push(line.trim()); }
    else list = null;
  }
  flush();
}

export function openChangelog(opener = document.activeElement) {
  const controller = new AbortController();
  let dialog, body, status, content, retry;
  const isolateKeys = (e) => e.stopPropagation(); // native Escape/Tab still work; map shortcuts stay out
  const connection = () => {
    const through = content.dataset.through;
    if (through) status.textContent = navigator.onLine ? `Release notes through ${through}.` : `Offline: showing saved release notes through ${through}.`;
  };
  openModal({ title: 'What’s new', subtitle: 'Changes in Polku', onClose: () => {
    controller.abort();
    dialog.removeEventListener('keydown', isolateKeys);
    window.removeEventListener('online', connection);
    window.removeEventListener('offline', connection);
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  } }, (b) => {
    body = b;
    dialog = body.parentElement;
    dialog.classList.add('modal-changelog');
    dialog.addEventListener('keydown', isolateKeys);
    status = h('p', { class: 'note', role: 'status', 'aria-live': 'polite' });
    content = h('article', { class: 'changelog-notes', 'aria-label': 'Release notes', tabindex: '0' });
    retry = h('button', { type: 'button', class: 'btn', hidden: true, onclick: load }, 'Retry');
    body.append(status, retry, h('p', { class: 'changelog-source' }, h('a', { href: SOURCE, target: '_blank', rel: 'noopener noreferrer' }, 'Full changelog on GitHub ↗')), content);
  });
  window.addEventListener('online', connection);
  window.addEventListener('offline', connection);
  load();

  async function load() {
    retry.disabled = true;
    status.textContent = 'Loading release notes…';
    content.setAttribute('aria-busy', 'true');
    try {
      const res = await request('polku', new URL('../CHANGELOG.md', import.meta.url), { signal: controller.signal, cache: 'no-cache', backoff: false });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const date = /^## (\d{4}-\d{2}-\d{2})\s*$/m.exec(text);
      if (!date) throw new Error('No dated release notes');
      if (controller.signal.aborted) return;
      content.replaceChildren();
      renderNotes(text, content);
      content.dataset.through = date[1];
      connection();
      if (document.activeElement === retry) content.focus({ preventScroll: true });
      retry.hidden = true;
    } catch (e) {
      if (controller.signal.aborted) return;
      status.textContent = navigator.onLine ? 'Release notes could not be loaded. Try again, or open the full changelog on GitHub.' : 'You’re offline and no saved release notes are available. Reconnect, then try again.';
      retry.hidden = false;
    } finally {
      if (!controller.signal.aborted) { retry.disabled = false; content.removeAttribute('aria-busy'); }
    }
  }
}
