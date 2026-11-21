// The route's moving chevrons (#198): white chevrons drifting slowly along the route, the way
// it goes, over the red line. They show the direction and catch the eye. MapLibre's styles
// can't move symbols along a line without laying them out again every frame, so this is a
// small custom WebGL layer: the legs as a strip, the chevrons from the fragment shader,
// spaced and sized in screen pixels.
//
// Motion has a cost: every frame redraws the whole map. So it moves at most ~24 frames a
// second, only while the route is in view, the page is visible, the map is flat (no 3D
// terrain to drape over) and the system doesn't ask for reduced motion; it rests a while after
// you last touched the map, and comes back with the next touch. While it isn't moving, the
// style's static arrows show the way (onMoving), and this layer draws nothing.

const VS = `
uniform mat4 u_matrix;
uniform vec2 u_viewport;
uniform float u_half;
uniform float u_scale;
attribute vec2 a_pos;
attribute vec2 a_other;
attribute float a_side;
attribute float a_along;
attribute float a_sign;
varying float v_along;
varying float v_side;
void main() {
  vec4 p = u_matrix * vec4(a_pos, 0.0, 1.0);
  vec4 q = u_matrix * vec4(a_other, 0.0, 1.0);
  vec2 ps = p.xy / p.w * u_viewport * 0.5;
  vec2 qs = q.xy / q.w * u_viewport * 0.5;
  vec2 d = (qs - ps) * a_sign;
  vec2 dir = length(d) > 0.0001 ? normalize(d) : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec2 s = ps + n * a_side * u_half;
  gl_Position = vec4(s / (u_viewport * 0.5) * p.w, p.z, p.w);
  v_along = a_along * u_scale;
  v_side = a_side;
}`;

const FS = `
precision highp float;
uniform float u_time;
uniform float u_spacing;
uniform float u_half;
uniform float u_thick;
uniform float u_opacity;
varying float v_along;
varying float v_side;
void main() {
  // the chevron's tip on the centre line, its arms reaching back: a V pointing the way
  float x = mod(v_along - u_time, u_spacing) - u_spacing * 0.5;
  float y = abs(v_side) * u_half;
  float d = abs(x + y * 0.8);
  float a = 1.0 - smoothstep(u_thick * 0.5 - 0.6, u_thick * 0.5 + 0.6, d);
  a *= 1.0 - smoothstep(u_half * 0.72, u_half * 0.9, y);
  gl_FragColor = vec4(1.0) * a * u_opacity;
}`;

const FPS = 24; // at most: enough to read as motion, half the redraws of 48
const SPEED = 14; // CSS px a second: a chevron spacing every ~2 s
const SPACING = 26; // CSS px between chevrons
const REST = 45e3; // ms after the last touch of the map before the chevrons rest

// a leg's line in mercator units, relative to an origin (float32 keeps metres near it)
function strip(features, origin) {
  const out = [];
  for (const f of features) {
    const c = f.geometry.coordinates.map((ll) => {
      const m = maplibregl.MercatorCoordinate.fromLngLat(ll);
      return [m.x - origin[0], m.y - origin[1]];
    });
    let along = 0;
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!len) continue;
      const la = along, lb = along + len;
      // two triangles: a- a+ b-, a+ b+ b-; each vertex knows the other end, which way is forward, its side
      const v = (p, o, side, l, sign) => out.push(p[0], p[1], o[0], o[1], side, l, sign);
      v(a, b, -1, la, 1); v(a, b, 1, la, 1); v(b, a, -1, lb, -1);
      v(a, b, 1, la, 1); v(b, a, 1, lb, -1); v(b, a, -1, lb, -1);
      along = lb;
    }
  }
  return new Float32Array(out);
}

export class RouteFlow {
  constructor(map, { onMoving = () => {}, enabled = () => true } = {}) {
    this.map = map;
    this.id = 'route-flow';
    this.type = 'custom';
    this.renderingMode = '2d';
    this.onMoving = onMoving;
    this.enabled = enabled;
    this.features = [];
    this.n = 0;
    this.moving = false;
    this.frames = 0; // drawn frames (tests)
    this.touched = Date.now();
    this.t0 = performance.now();
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const wake = () => { this.touched = Date.now(); this.check(); };
    this.reduce.addEventListener('change', wake);
    document.addEventListener('visibilitychange', wake);
    for (const ev of ['movestart', 'mousedown', 'touchstart', 'wheel']) map.on(ev, wake);
    // MapLibre leaves custom layers alone in setStyle(…, { diff: true }); put it back if a new style dropped it
    map.on('styledata', () => this.place());
    map.on('load', () => this.place());
    this.place();
  }

  // the route's lines (the planner's `route` source): routed and straight legs, not gaps, carries or legs still loading
  setData(fc) {
    this.features = (fc && fc.features || []).filter((f) => f.geometry && f.geometry.type === 'LineString' && f.properties.kind === 'leg' && !f.properties.loading && f.geometry.coordinates.length > 1);
    this.dirty = true;
    this.touched = Date.now();
    this.check();
  }

  place() {
    if (this.map.getLayer(this.id) || !this.map.getLayer('route-line')) return; // not until the style has the route's layers
    this.map.addLayer(this, this.map.getLayer('route-arrows') ? 'route-arrows' : undefined);
  }

  // should the chevrons move now? (and tell the style, so the static arrows give way)
  check() {
    const m = this.map;
    let on = this.enabled() && this.features.length > 0 && !this.reduce.matches && !document.hidden
      && Date.now() - this.touched < REST && !(m.getTerrain && m.getTerrain()) && m.getZoom() >= 10;
    if (on) {
      const b = m.getBounds();
      on = this.features.some((f) => f.geometry.coordinates.some(([lon, lat]) => b.contains([lon, lat])));
    }
    if (on === this.moving) return;
    this.moving = on;
    this.onMoving(on);
    m.triggerRepaint();
  }

  onAdd(map, gl) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.gl = gl;
    this.prog = p;
    this.buf = gl.createBuffer();
    this.loc = Object.fromEntries(['a_pos', 'a_other', 'a_side', 'a_along', 'a_sign'].map((k) => [k, gl.getAttribLocation(p, k)]));
    this.uni = Object.fromEntries(['u_matrix', 'u_viewport', 'u_half', 'u_scale', 'u_time', 'u_spacing', 'u_thick', 'u_opacity'].map((k) => [k, gl.getUniformLocation(p, k)]));
    this.dirty = true;
  }

  onRemove(map, gl) {
    if (this.buf) gl.deleteBuffer(this.buf);
    if (this.prog) gl.deleteProgram(this.prog);
    this.buf = this.prog = null;
  }

  render(gl, opts) {
    this.check();
    if (!this.moving || !this.prog) return;
    if (this.dirty) {
      // an origin at the route's first point: mercator units are tiny, and float32 needs them small
      const first = this.features[0].geometry.coordinates[0], o = maplibregl.MercatorCoordinate.fromLngLat(first);
      this.origin = [o.x, o.y];
      const data = strip(this.features, this.origin);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      this.n = data.length / 7;
      this.dirty = false;
    }
    if (!this.n) return;
    // the map's matrix moved to the origin (in float64 here, then float32 for the GPU)
    // MapLibre 5: defaultProjectionData.mainMatrix takes mercator units (0–1) to clip space; its
    // modelViewProjectionMatrix takes world pixels
    const m = (opts.defaultProjectionData && opts.defaultProjectionData.mainMatrix) || opts, [ox, oy] = this.origin, mat = new Float32Array(16);
    for (let i = 0; i < 16; i++) mat[i] = m[i];
    for (let r = 0; r < 4; r++) mat[12 + r] = m[r] * ox + m[4 + r] * oy + m[12 + r];
    const dpr = gl.drawingBufferWidth / Math.max(1, this.map.getCanvas().clientWidth);
    const z = this.map.getZoom();
    // as wide as the route's white casing (5 px at zoom 8, 11 at 16), so the chevrons read on the red line
    const half = (Math.max(5, Math.min(11, 5 + ((z - 8) * 6) / 8)) / 2) * dpr;
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const stride = 7 * 4;
    const attr = (k, size, off) => { const l = this.loc[k]; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride, off * 4); };
    attr('a_pos', 2, 0); attr('a_other', 2, 2); attr('a_side', 1, 4); attr('a_along', 1, 5); attr('a_sign', 1, 6);
    gl.uniformMatrix4fv(this.uni.u_matrix, false, mat);
    gl.uniform2f(this.uni.u_viewport, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(this.uni.u_half, half);
    gl.uniform1f(this.uni.u_scale, 512 * 2 ** z * dpr);
    gl.uniform1f(this.uni.u_time, ((performance.now() - this.t0) / 1000) * SPEED * dpr);
    gl.uniform1f(this.uni.u_spacing, SPACING * dpr);
    gl.uniform1f(this.uni.u_thick, 2.2 * dpr);
    gl.uniform1f(this.uni.u_opacity, 0.9);
    // MapLibre may leave its tile stencil and face culling on: neither applies to this strip
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, this.n);
    for (const k of Object.keys(this.loc)) gl.disableVertexAttribArray(this.loc[k]);
    this.frames++;
    // the next frame, no sooner than the frame rate allows
    clearTimeout(this.next);
    this.next = setTimeout(() => this.map.triggerRepaint(), 1000 / FPS);
  }
}
