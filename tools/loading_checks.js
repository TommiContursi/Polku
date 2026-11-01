// Controlled service checks: no requests reach a public router or tile server.
const assert = (yes, words) => { if (!yes) throw new Error(words); };
const track = (p) => { const state = {}; p.then((value) => { state.value = value; state.done = true; state.at = Date.now(); }, (error) => { state.error = error; state.done = true; state.at = Date.now(); }); return state; };
const abort = () => new DOMException('Aborted', 'AbortError');
function clock() {
  const real = window.setTimeout.bind(window);
  let now = Date.now(), id = 0;
  const timers = new Map();
  Date.now = () => now;
  window.setTimeout = (fn, ms = 0) => { timers.set(++id, { at: now + ms, fn }); return id; };
  window.clearTimeout = (key) => timers.delete(key);
  AbortSignal.timeout = (ms) => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(new DOMException('The request timed out', 'TimeoutError')), ms);
    return ctrl.signal;
  };
  const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((ok) => real(ok, 0)); };
  return { settle, async advance(ms) {
    const end = now + ms;
    for (;;) {
      await settle();
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = end; await settle();
  } };
}
const routeJSON = (url) => ({ features: [{ geometry: { coordinates: new URL(url).searchParams.get('lonlats').split('|').map((s) => s.split(',').map(Number)) }, properties: {} }] });
const leg = (profile = 'mtb', opts = {}) => ({ from: [24, 61], to: [24.01, 61.01], mode: 'auto', profile, opts: { fallback: false, ...opts } });

export async function sharedCancellation() {
  const c = clock(), R = await import('../js/router.js');
  let sent = 0, cancelled = 0;
  window.fetch = (url, init) => new Promise((ok, no) => {
    sent++;
    init.signal.addEventListener('abort', () => { cancelled++; no(abort()); }, { once: true });
  });
  const a = new AbortController(), b = new AbortController();
  const first = track(R.routeLeg(leg(), a.signal));
  await c.settle();
  const joined = track(R.routeRun({ points: [[24, 61], [24.01, 61.01]], profile: 'mtb', opts: { fallback: false } }, b.signal));
  await c.settle(); b.abort(); await c.settle();
  assert(joined.error?.name === 'AbortError', 'a cancelled run subscriber still waits for the shared leg');
  assert(sent === 1 && cancelled === 0 && !first.done, 'cancelling one subscriber cancelled another subscriber');
  a.abort(); await c.settle();
  assert(cancelled === 1 && first.error?.name === 'AbortError', 'the last subscriber did not cancel the fetch');
  const dead = new AbortController(); dead.abort();
  await R.routeLeg(leg('mtb', { alt: 1 }), dead.signal).catch(() => {});
  await c.settle();
  assert(sent === 1, 'an already cancelled subscriber dispatched a new request');
  return { requests: sent, upstreamAborts: cancelled };
}

export async function networkDeadline() {
  const c = clock(), N = await import('../js/net.js');
  N.SOURCES.brouterOwn.pace = [[1000, 1]];
  let sent = 0, stopped = 0, reason;
  window.fetch = async (url, init) => {
    sent++;
    if (sent === 1) return new Response('first');
    const body = new ReadableStream({ start(stream) {
      init.signal?.addEventListener('abort', () => { stopped++; reason = init.signal.reason?.name; stream.error(init.signal.reason || abort()); }, { once: true });
    } });
    return new Response(body);
  };
  await N.request('brouterOwn', 'https://own.test/first');
  const result = track(N.request('brouterOwn', 'https://own.test/slow-body', { maxWait: 2000, timeoutMs: 200 }).then((r) => r.text()));
  await c.advance(900);
  assert(sent === 1 && !result.done, 'the network deadline ran while the request waited in the queue');
  await c.advance(400);
  assert(sent === 2 && result.error && reason === 'TimeoutError' && stopped === 1, `a stalled response body did not meet its dispatched-request deadline (${JSON.stringify({ sent, stopped, done: result.done, error: result.error?.name, reason })})`);
  assert(!N.sourceStatus('brouterOwn'), 'a request deadline imposed an outage cooldown');
  return { queueMs: 1050, requestBudgetMs: 200, sent, stopped };
}

export async function plannerCancellation() {
  const c = clock(), { Planner } = await import('../js/planner.js');
  localStorage.setItem('polku:brouterUrl', JSON.stringify('https://own.test/brouter'));
  const p = Object.create(Planner.prototype);
  Object.assign(p, { gen: 0, points: [], legs: [], altFor: null,
    drawRoute() {}, setBusy() {}, snapPoints: () => false, save() {}, runAnalysis: async () => {}, styleOpts: () => ({}),
    legKey(i) { return { key: this.points[i].join(','), from: this.points[i], to: this.points[i + 1], nogos: [{ ll: [24, 61], r: 10 }], profile: 'mtb', rp: { key: 'mtb' } }; },
  });
  let sent = [], active = 0, peak = 0, cancelled = 0;
  window.fetch = (url, init) => new Promise((ok, no) => {
    active++; peak = Math.max(peak, active);
    const entry = { url, done: false, finish() { if (this.done) return; this.done = true; active--; ok(Response.json(routeJSON(url))); } }; sent.push(entry);
    init.signal?.addEventListener('abort', () => { if (entry.done) return; entry.done = true; active--; cancelled++; no(abort()); }, { once: true });
  });
  const set = (lon) => { p.points = Array.from({ length: 7 }, (_, i) => [lon + i * 0.01, 61]); p.legs = Array.from({ length: 6 }, () => ({ mode: 'auto' })); };
  set(24); const old = track(p.routeAll()); await c.settle();
  set(25); const current = track(p.routeAll()); await c.settle();
  const overlap = active;
  // Finish all calls, including any obsolete queue that starts as old calls settle.
  let oldSent = 0, totalSent = 0;
  for (let i = 0; i < 6; i++) { const batch = sent.splice(0); totalSent += batch.length; oldSent += batch.filter((e) => new URL(e.url).searchParams.get('lonlats').startsWith('24.')).length; batch.forEach((e) => e.finish()); await c.settle(); }
  assert(cancelled === 3 && overlap === 3 && peak <= 3, `rapid route edits left ${overlap} requests running (peak ${peak}, cancelled ${cancelled})`);
  assert(old.done && current.done && p.legs.every((l) => l.result?.coords[0][0] >= 25), 'old routing work replaced the current route');
  assert(oldSent === 3 && totalSent === 9, 'obsolete queued legs still dispatched');
  return { overlap, peak, cancelled, obsoleteDispatched: oldSent, totalRequests: totalSent };
}

export async function plannerSharedGeneration() {
  const c = clock(), { Planner } = await import('../js/planner.js');
  localStorage.setItem('polku:brouterUrl', JSON.stringify('https://own.test/brouter'));
  const p = Object.create(Planner.prototype);
  Object.assign(p, { gen: 0, points: [[24, 61], [24.01, 61.01]], legs: [{ mode: 'auto' }], altFor: null,
    drawRoute() {}, setBusy() {}, snapPoints: () => false, save() {}, runAnalysis: async () => {}, styleOpts: () => ({}),
    legKey() { return { key: 'same', from: this.points[0], to: this.points[1], nogos: [], profile: 'mtb', rp: { key: 'mtb' } }; },
  });
  let sent = 0, cancelled = 0, release;
  window.fetch = (url, init) => new Promise((ok, no) => {
    sent++; release = () => ok(Response.json(routeJSON(url)));
    init.signal?.addEventListener('abort', () => { cancelled++; no(abort()); }, { once: true });
  });
  const first = track(p.routeAll()); await c.settle();
  const second = track(p.routeAll()); await c.settle();
  assert(sent === 1 && cancelled === 0, 'an unchanged current generation lost its shared request');
  release(); await c.settle();
  assert(first.done && second.done && p.legs[0].result?.coords.length === 2, 'a shared generation failed to finish');
  return { requests: sent, upstreamAborts: cancelled };
}

export async function customRefusal(status = 403) {
  const c = clock(), R = await import('../js/router.js'), N = await import('../js/net.js');
  let uploads = 0, routes = 0;
  window.fetch = async (url) => {
    if (String(url).startsWith('profiles/')) return new Response('profile');
    if (String(url).includes('/profile/')) { uploads++; return Response.json({ profileid: 'custom_polku-road-1' }); }
    routes++; return new Response(status === 403 ? 'Please, retry later!' : 'server unavailable', { status });
  };
  const result = track(R.routeLeg(leg('custom_polku-road-1')));
  await c.settle(); await c.advance(2100);
  assert(result.error?.name === 'Limited', `custom profile ${status} did not become Limited`);
  assert(N.sourceStatus('brouter'), `custom profile ${status} did not pause BRouter`);
  assert(uploads === 1 && routes === 1, `custom profile ${status}: ${uploads} uploads and ${routes} route requests`);
  return { status, uploads, routes };
}

export async function missingProfile() {
  const c = clock(), R = await import('../js/router.js'), N = await import('../js/net.js');
  let uploads = 0, routes = 0;
  window.fetch = async (url) => {
    if (String(url).includes('.brf')) return new Response('profile');
    if (String(url).includes('/profile/')) { uploads++; return Response.json({ profileid: 'custom_polku-road-1' }); }
    routes++;
    return routes === 1 ? new Response('profile polku-road-1.brf does not exist', { status: 500 }) : Response.json(routeJSON(url));
  };
  const result = track(R.routeLeg(leg('custom_polku-road-1'))); await c.settle();
  assert(result.value?.coords.length === 2 && uploads === 2 && routes === 2, 'a positively identified missing profile did not recover once');
  assert(!N.sourceStatus('brouter'), 'a missing profile imposed a general outage cooldown');
  return { uploads, routes, recovered: true };
}

export async function routingDeadline() {
  const c = clock(), R = await import('../js/router.js');
  localStorage.setItem('polku:brouterUrl', JSON.stringify('https://own.test/brouter'));
  let sent = 0, stopped = 0, release;
  window.fetch = (url, init) => new Promise((ok, no) => {
    let done = false;
    sent++; release = () => { done = true; ok(Response.json(routeJSON(url))); };
    init.signal?.addEventListener('abort', () => { if (done) return; done = true; stopped++; no(init.signal.reason || abort()); }, { once: true });
  });
  const first = track(R.routeLeg(leg()));
  await c.advance(90000);
  assert(!first.done && sent === 1, 'a legitimate long own-server route was cut short');
  release(); await c.settle(); assert(first.value?.coords.length === 2, 'the long route did not finish');
  const stalled = track(R.routeLeg({ ...leg(), to: [24.02, 61.02] }));
  await c.advance(120100);
  assert(stalled.error?.name === 'TimeoutError' && sent === 2 && stopped === 1, 'a stalled BRouter request did not stop at its independent deadline');
  return { legitimateRouteMs: 90000, stalledBudgetMs: 120000, requests: sent, stopped };
}

export async function routingBodyFallback() {
  const c = clock(), R = await import('../js/router.js');
  let brouter = 0, valhalla = 0;
  window.fetch = async (url, init) => {
    if (String(url).includes('brouter')) {
      brouter++;
      const response = new Response('');
      response.text = () => new Promise((ok, no) => init.signal.addEventListener('abort', () => no(abort()), { once: true }));
      return response;
    }
    valhalla++;
    return Response.json(String(url).includes('/route?') ? { trip: { legs: [{ shape: '_gjaR_ouce@o}@o}@' }] } } : { edges: [] });
  };
  const result = track(R.routeLeg(leg('mtb', { fallback: true })));
  await c.advance(122000);
  assert(result.value?.provider === 'valhalla' && brouter === 1 && valhalla === 2, 'a timed-out BRouter response body was mistaken for user cancellation');
  return { brouter, valhalla, fallback: result.value.provider };
}

export async function customRecovery() {
  const c = clock(), R = await import('../js/router.js');
  let uploads = 0, routes = 0;
  window.fetch = async (url) => {
    if (String(url).includes('.brf')) return new Response('profile');
    if (String(url).includes('/profile/')) { uploads++; return Response.json({ profileid: 'custom_polku-road-1' }); }
    return ++routes === 1 ? new Response('Please, retry later!', { status: 403 }) : Response.json(routeJSON(url));
  };
  const first = track(R.routeLeg(leg('custom_polku-road-1'))); await c.settle();
  assert(first.error?.name === 'Limited', 'custom-profile refusal did not pause');
  await c.advance(61000);
  const recovered = await R.routeLeg(leg('custom_polku-road-1'));
  assert(recovered.coords.length === 2 && uploads === 1 && routes === 2, 'recovery re-uploaded a valid profile or failed to route');
  return { uploads, routes, recovered: true };
}

export async function alreadyCancelledRequest() {
  const N = await import('../js/net.js'), ctrl = new AbortController();
  let sent = 0;
  window.fetch = async () => { sent++; return new Response(''); };
  ctrl.abort();
  const result = await N.request('brouterOwn', 'https://own.test/cancelled', { signal: ctrl.signal }).then(() => null, (e) => e.name);
  assert(result === 'AbortError' && sent === 0 && N.usage().find((u) => u.id === 'brouterOwn').session === 0, 'an already cancelled unpaced request was sent or counted');
  return { sent, counted: 0 };
}

export async function profileQueueBudget() {
  const c = clock(), R = await import('../js/router.js'), N = await import('../js/net.js');
  let uploads = 0, routes = 0;
  window.fetch = async (url) => {
    if (String(url).includes('.brf')) return new Response('profile');
    if (String(url).includes('/profile/')) { uploads++; return Response.json({ profileid: 'custom_polku-road-1' }); }
    if (String(url).includes('occupy')) return new Response('');
    routes++; return Response.json(routeJSON(url));
  };
  for (let i = 0; i < 5; i++) await N.request('brouter', `https://mock.invalid/occupy/${i}`);
  const result = track(R.routeLeg(leg('custom_polku-road-1', { maxWait: 6000 })));
  await c.advance(6100);
  assert(result.error?.name === 'Limited' && result.error.reason === 'pacing' && uploads === 0 && routes === 0, 'a custom-profile upload ignored the route queue budget');
  return { uploads, routes, queueBudgetMs: 6000 };
}

export async function overpassValidity(kind = 'remark') {
  const c = clock(), O = await import('../js/osm.js'), { OVERPASS } = await import('../js/config.js');
  let sent = 0;
  window.fetch = (url, init) => {
    sent++;
    const i = OVERPASS.indexOf(String(url));
    if (i === 0) return Promise.resolve(Response.json(kind === 'remark' ? { remark: 'runtime error: timeout', elements: [] } : { status: 'error' }));
    return new Promise((ok, no) => {
      if (i === 1) setTimeout(() => ok(Response.json({ elements: [{ type: 'node', id: 2 }] })), 10);
      init.signal.addEventListener('abort', () => no(abort()), { once: true });
    });
  };
  const result = track(O.overpass('mock', { race: true }));
  await c.advance(20);
  assert(result.value?.elements?.[0]?.id === 2 && !result.value.remark, `invalid Overpass ${kind} won or cancelled the valid mirror`);
  assert(sent === 3, 'validation changed the initial mirror fanout');
  return { winner: 2, initialRequests: sent };
}

export async function overpassFourth() {
  const O = await import('../js/osm.js'), { OVERPASS } = await import('../js/config.js');
  const sent = [];
  window.fetch = async (url) => {
    const i = OVERPASS.indexOf(String(url)); sent.push(i);
    return i === 3 ? Response.json({ elements: [{ type: 'node', id: 4 }] }) : new Response('bad', { status: 400 });
  };
  const result = await O.overpass('mock', { race: true }).catch(() => null);
  assert(result?.elements?.[0]?.id === 4 && sent.join() === '0,1,2,3', `healthy fourth Overpass mirror not used (sent ${sent})`);
  return { sent, winner: 4 };
}

export async function overpassBudget() {
  const c = clock(), O = await import('../js/osm.js');
  const start = Date.now(), sent = [];
  let stopped = 0;
  window.fetch = (url, init) => new Promise((ok, no) => {
    sent.push(Date.now() - start);
    init.signal.addEventListener('abort', () => { stopped++; no(abort()); }, { once: true });
  });
  const result = track(O.overpass('mock', { race: true, timeoutMs: 75 }));
  await c.advance(74); assert(!result.done && stopped === 0, 'Overpass stopped before its supplied budget');
  await c.advance(77);
  assert(result.error && sent.join() === '0,0,0,75' && stopped === 4, 'the mirror race ignored its supplied per-request deadline');
  return { sentAtMs: sent, stopped, mirrorBudgetMs: 75 };
}

export async function profileSubscribers() {
  const c = clock(), R = await import('../js/router.js');
  let uploads = 0, stopped = 0, release;
  window.fetch = async (url, init) => {
    if (String(url).includes('.brf')) return new Response('profile');
    if (String(url).includes('/profile/')) {
      uploads++;
      return new Promise((ok, no) => {
        release = () => ok(Response.json({ profileid: 'custom_polku-road-1' }));
        init.signal?.addEventListener('abort', () => { stopped++; no(abort()); }, { once: true });
      });
    }
    return Response.json(routeJSON(url));
  };
  const a = new AbortController(), b = new AbortController();
  const first = track(R.routeLeg(leg('custom_polku-road-1'), a.signal));
  const second = track(R.routeLeg({ ...leg('custom_polku-road-1'), to: [24.02, 61.02] }, b.signal));
  await c.settle(); a.abort(); await c.settle();
  release(); await c.settle();
  assert(first.error?.name === 'AbortError' && second.value?.coords.length === 2, 'cancelling one route killed the profile upload needed by another route');
  assert(uploads === 1 && stopped === 0, 'the shared profile was uploaded twice or aborted early');
  return { uploads, upstreamAborts: stopped };
}

export async function routeCacheBound() {
  const R = await import('../js/router.js');
  localStorage.setItem('polku:brouterUrl', JSON.stringify('https://own.test/brouter'));
  let sent = 0;
  window.fetch = async (url) => { sent++; return Response.json(routeJSON(url)); };
  const route = (i) => R.routeLoop({ points: [[24 + i * 0.001, 61], [24.01 + i * 0.001, 61.01]], profile: 'mtb', opts: { fallback: false } });
  for (let i = 0; i < 401; i++) await route(i);
  await route(0);
  assert(sent === 402, `round trips bypassed the 400-entry route cache bound (${sent} requests)`);
  assert(R.routerHeadroom() === Infinity, 'a configured BRouter inherited public-server quotas');
  return { requests: sent, ownServerHeadroom: 'unpaced' };
}

export async function valhallaDeadline() {
  const c = clock(), V = await import('../js/valhalla.js');
  let stopped = false;
  window.fetch = async (url, init) => {
    if (String(url).includes('/route?')) return Response.json({ trip: { legs: [{ shape: '_gjaR_ouce@o}@o}@' }] } });
    return new Promise((ok, no) => { init.signal?.addEventListener('abort', () => { stopped = true; no(init.signal.reason || abort()); }, { once: true }); });
  };
  const start = Date.now(), result = track(V.valhallaRoute([[24, 61], [24.01, 61.01]], 'mtb'));
  await c.advance(7100);
  assert(result.done && !result.error, 'optional Valhalla attributes still hold the completed route after seven seconds');
  assert(stopped, 'optional attributes were left running after their deadline');
  assert(result.value[0].tags.every((t) => Object.keys(t).length === 0), 'missing attributes became known');
  return { usableAfterMs: result.at - start, unknownTags: true };
}

export async function terrainPool() {
  const c = clock(), D = await import('../js/dem.js'), G = await import('../js/geo.js');
  let sent = 0, active = 0, peak = 0, release;
  const fast = [];
  const canvas = new OffscreenCanvas(2, 2), ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(128,100,0)'; ctx.fillRect(0, 0, 2, 2);
  const png = await canvas.convertToBlob();
  window.fetch = async () => {
    sent++; active++; peak = Math.max(peak, active);
    if (sent === 1) await new Promise((ok) => { release = ok; });
    else if (sent <= 8) await new Promise((ok) => fast.push(ok));
    active--; return new Response(png);
  };
  const points = Array.from({ length: 12 }, (_, i) => { const [w, s, e, n] = G.tileBounds(9000 + i, 4600, 14); return [(w + e) / 2, (s + n) / 2]; });
  const result = track(D.elevations(points));
  await c.settle();
  fast.forEach((go) => go()); await c.settle();
  const beforeRelease = sent;
  release(); await c.settle();
  assert(beforeRelease === 12, `one slow terrain tile held the next batch (${beforeRelease}/12 started)`);
  assert(result.done && result.value.every(Number.isFinite) && peak <= 8, 'terrain values or bounded concurrency changed');
  return { startedBeforeSlowTile: beforeRelease, peak };
}

export async function terrainDeadline() {
  const c = clock(), D = await import('../js/dem.js');
  let attempts = 0, cancelled = 0;
  window.fetch = (url, init) => new Promise((ok, no) => {
    attempts++;
    init?.signal?.addEventListener('abort', () => { cancelled++; no(abort()); }, { once: true });
  });
  const result = track(D.elevations([[24, 61]]));
  await c.advance(45100);
  assert(result.done && Number.isNaN(result.value[0]) && result.value.failed === 1, 'stalled terrain did not finish as missing after coarser fallbacks');
  assert(attempts === 3 && cancelled === 3, 'terrain did not cancel each stalled resolution');
  return { attempts, upstreamAborts: cancelled, missing: result.value.failed };
}

export async function valhallaCancellation() {
  const c = clock(), V = await import('../js/valhalla.js');
  let release, signal;
  window.fetch = async (url, init) => {
    if (String(url).includes('/route?')) return Response.json({ trip: { legs: [{ shape: '_gjaR_ouce@o}@o}@' }] } });
    signal = init.signal;
    return new Promise((ok, no) => { release = () => ok(Response.json({ edges: [] })); signal?.addEventListener('abort', () => no(abort()), { once: true }); });
  };
  const ctrl = new AbortController();
  const result = track(V.valhallaRoute([[24, 61], [24.01, 61.01]], 'mtb', ctrl.signal));
  await c.advance(1200); ctrl.abort(); await c.settle();
  assert(result.error?.name === 'AbortError' && signal?.aborted, 'cancelling Valhalla returned a partial route or left attributes running');
  release();
  return { parentAbortPropagated: true };
}

export async function lipasShared() {
  const c = clock(), { LipasLayer } = await import('../js/lipas.js');
  let sent = 0, release;
  const map = { on() {}, getZoom: () => 12, getCenter: () => ({ lng: 24, lat: 61 }), getBounds: () => ({ getWest: () => 24, getEast: () => 24.01, getSouth: () => 61, getNorth: () => 61.01 }) };
  const L = new LipasLayer(map, () => {});
  L.showRoutes = true; L.routeTypes = [4401];
  L.fetchTile = async () => { sent++; await new Promise((ok) => { release = ok; }); return [{ id: 'route', properties: { type: 4401, lipasId: 1 }, geometry: { type: 'LineString', coordinates: [[24, 61], [24.01, 61.01]] } }]; };
  L.update();
  const result = track(L.routesIn([24, 61, 24.01, 61.01], [4401], [24, 61]));
  await c.settle(); assert(sent === 1, 'Marked routes duplicated a pending map tile');
  release(); await c.settle();
  assert(result.value.routes.length === 1 && result.value.failed === 0, 'Marked routes lost the shared result');
  // An independently requested tile may be evicted while routesIn waits for another.
  L.tiles.clear();
  const failed = track(L.routesIn([24, 61, 24.01, 61.01], [4401], [24, 61]));
  await c.settle(); L.tiles.clear(); release(); await c.settle();
  assert(failed.value.routes.length === 1, 'cache eviction lost a result needed by Marked routes');
  return { sharedRequests: sent - 1, markedRoutes: result.value.routes.length };
}

export async function lipasLate() {
  const c = clock(), { LipasLayer } = await import('../js/lipas.js');
  let lon = 24, redraws = 0, data = [];
  const waits = [];
  const map = { on() {}, getZoom: () => 12, getCenter: () => ({ lng: lon, lat: 61 }), getBounds: () => ({ getWest: () => lon, getEast: () => lon + 0.01, getSouth: () => 61, getNorth: () => 61.01 }) };
  const L = new LipasLayer(map, (routes) => { redraws++; data = routes.features; });
  L.showRoutes = true; L.routeTypes = [4401, 4402];
  L.fetchTile = (type, x) => new Promise((ok) => waits.push(() => ok([{ id: `${type}/${x}`, properties: { type }, geometry: { type: 'LineString', coordinates: [] } }])));
  L.update(); const old = waits.splice(0); lon = 26; L.update();
  waits.splice(0).forEach((go) => go()); await c.advance(0);
  assert(data.length === 2, 'current LIPAS tiles did not appear');
  const before = redraws;
  old.forEach((go) => go()); await c.advance(0);
  assert(redraws === before && data.length === 2, 'late offscreen LIPAS tiles redrew or replaced the current view');
  assert(before === 1, `two tile arrivals caused ${before} redraws instead of one`);
  return { redrawsForTwoTiles: before, lateRedraws: redraws - before };
}

export async function lipasViewport() {
  const c = clock(), { LipasLayer } = await import('../js/lipas.js');
  let lon = 24, lat = 61, calls = 0, last = [];
  const map = { on() {}, getZoom: () => 12, getCenter: () => ({ lng: lon, lat }), getBounds: () => ({ getWest: () => lon, getEast: () => lon + 0.01, getSouth: () => lat, getNorth: () => lat + 0.01 }) };
  const L = new LipasLayer(map, (routes) => { calls++; last = routes.features; });
  L.showRoutes = true; L.routeTypes = [4401];
  L.fetchTile = async (type, x, y) => [{ type: 'Feature', id: `${type}/${x}/${y}`, properties: { type }, geometry: { type: 'LineString', coordinates: [] } }];
  for (let i = 0; i < 100; i++) { lon = 20 + i % 10; lat = 60 + Math.floor(i / 10); L.update(); await c.settle(); }
  await c.advance(100);
  assert(L.tiles.size <= 64, `LIPAS retained ${L.tiles.size} tiles after panning`);
  assert(last.length <= 9, `LIPAS redraw included ${last.length} accumulated tiles`);
  const before = calls; L.update(); L.publish(); L.publish(); await c.advance(100);
  assert(calls === before, `an unchanged LIPAS view redrew ${calls - before} times`);
  return { retained: L.tiles.size, published: last.length, redundantRedraws: calls - before };
}
