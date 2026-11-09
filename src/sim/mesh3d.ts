import type { Cam } from './engine';

/* ================================================================== */
/*  MESH3D — procedural triangle meshes + a lit software renderer.     */
/*  Geometry is built once and cached; only transforms run per frame.  */
/* ================================================================== */

export type V3 = [number, number, number];

export interface Mesh {
  v: Float32Array;          // local-space vertices
  f: Uint16Array;           // triangle indices
  color: string;
  spec?: number;            // specular strength 0..1
  rim?: number;             // rim-light strength 0..1
  emissive?: number;
  doubleSided?: boolean;
  _rgb?: [number, number, number];
  _ramp?: string[];
  _rimRamp?: string[];
}

export interface Placed {
  mesh: Mesh;
  pos?: V3;
  scale?: V3 | number;
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  alpha?: number;
  id?: string;
  tint?: string;
  flat?: boolean;
}

export const renderStats = { tris: 0, meshes: 0, draws: 0, fills: 0 };

/* ---------------- vector helpers ---------------- */
export const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Catmull-Rom spline through control points — used for every vessel and gut. */
export function spline(pts: V3[], samples: number): V3[] {
  if (pts.length < 2) return pts.slice();
  const out: V3[] = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * (pts.length - 1);
    const k = Math.min(pts.length - 2, Math.floor(t));
    const u = t - k;
    const p0 = P[k], p1 = P[k + 1], p2 = P[k + 2], p3 = P[k + 3];
    const u2 = u * u, u3 = u2 * u;
    const c = (a: number, b: number, cc: number, d: number) =>
      0.5 * ((2 * b) + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u2 + (-a + 3 * b - 3 * cc + d) * u3);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])]);
  }
  return out;
}

/* ---------------- builders ---------------- */

class Builder {
  verts: number[] = [];
  faces: number[] = [];
  vert(x: number, y: number, z: number) { this.verts.push(x, y, z); return this.verts.length / 3 - 1; }
  tri(a: number, b: number, c: number) { this.faces.push(a, b, c); }
  quad(a: number, b: number, c: number, d: number) { this.faces.push(a, b, c, a, c, d); }
  done(color: string, opts: Partial<Mesh> = {}): Mesh {
    return { v: new Float32Array(this.verts), f: new Uint16Array(this.faces), color, ...opts };
  }
}

/** General parametric surface. fn(u,v) with u,v in [0,1]. */
export function surface(
  fn: (u: number, v: number) => V3, nu: number, nv: number, color: string,
  opts: Partial<Mesh> & { closeU?: boolean; capV?: boolean } = {},
): Mesh {
  const b = new Builder();
  const cols = opts.closeU ? nu : nu + 1;
  for (let j = 0; j <= nv; j++) for (let i = 0; i < cols; i++) {
    const p = fn(i / nu, j / nv);
    b.vert(p[0], p[1], p[2]);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < (opts.closeU ? nu : nu); i++) {
    const i2 = (i + 1) % cols;
    const a = j * cols + i, bb = j * cols + i2, c = (j + 1) * cols + i2, d = (j + 1) * cols + i;
    if (!opts.closeU && i === nu - 1) continue;
    b.quad(a, bb, c, d);
  }
  return b.done(color, opts);
}

/** Surface of revolution around Y from a [radius, height] profile. */
export function lathe(profile: [number, number][], seg: number, color: string, opts: Partial<Mesh> = {}): Mesh {
  const path: V3[] = profile.map(([r, y]) => [r, y, 0]);
  return surface((u, v) => {
    const t = v * (path.length - 1);
    const k = Math.min(path.length - 2, Math.floor(t));
    const f = t - k;
    const r = path[k][0] + (path[k + 1][0] - path[k][0]) * f;
    const y = path[k][1] + (path[k + 1][1] - path[k][1]) * f;
    const a = u * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  }, seg, Math.max(3, profile.length * 2), color, { ...opts, closeU: true });
}

/** Tube swept along a polyline with a radius function and parallel-transport frames. */
export function tube(
  path: V3[], radius: (t: number) => number, seg: number, color: string,
  opts: Partial<Mesh> & { caps?: boolean; flatten?: number } = {},
): Mesh {
  const b = new Builder();
  const n = path.length;
  if (n < 2) return b.done(color, opts);
  let up: V3 = Math.abs(path[0][1] - path[1][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const rings: number[] = [];
  const flat = opts.flatten ?? 1;
  for (let i = 0; i < n; i++) {
    const tan = norm(sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)]));
    let side = norm(cross(tan, up));
    if (!isFinite(side[0]) || len(side) < 1e-6) side = [1, 0, 0];
    up = norm(cross(side, tan));
    const r = radius(i / (n - 1));
    const base = b.verts.length / 3;
    rings.push(base);
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const cx = Math.cos(a) * r, sy = Math.sin(a) * r * flat;
      b.vert(path[i][0] + side[0] * cx + up[0] * sy, path[i][1] + side[1] * cx + up[1] * sy, path[i][2] + side[2] * cx + up[2] * sy);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) {
    const k2 = (k + 1) % seg;
    b.quad(rings[i] + k, rings[i] + k2, rings[i + 1] + k2, rings[i + 1] + k);
  }
  if (opts.caps !== false) {
    for (const [ring, idx, flip] of [[rings[0], 0, true], [rings[n - 1], n - 1, false]] as [number, number, boolean][]) {
      const c = b.vert(path[idx][0], path[idx][1], path[idx][2]);
      for (let k = 0; k < seg; k++) {
        const k2 = (k + 1) % seg;
        flip ? b.tri(c, ring + k2, ring + k) : b.tri(c, ring + k, ring + k2);
      }
    }
  }
  return b.done(color, opts);
}

/** Deformed sphere — the workhorse for organic masses. r(θ,φ) in local units. */
export function blob(
  rf: (theta: number, phi: number, u: number, v: number) => V3,
  seg: number, rings: number, color: string, opts: Partial<Mesh> = {},
): Mesh {
  return surface((u, v) => rf(u * Math.PI * 2, v * Math.PI, u, v), seg, rings, color, { ...opts, closeU: true });
}

export function ellipsoid(rx: number, ry: number, rz: number, seg: number, rings: number, color: string, opts: Partial<Mesh> = {}): Mesh {
  return blob((_t, phi, u) => {
    const th = u * Math.PI * 2;
    return [Math.sin(phi) * Math.cos(th) * rx, Math.cos(phi) * ry, Math.sin(phi) * Math.sin(th) * rz];
  }, seg, rings, color, opts);
}

export function boxMesh(w: number, h: number, d: number, color: string, opts: Partial<Mesh> = {}): Mesh {
  const b = new Builder();
  const x = w / 2, y = h / 2, z = d / 2;
  const p: V3[] = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  p.forEach((q) => b.vert(q[0], q[1], q[2]));
  b.quad(0, 1, 2, 3); b.quad(5, 4, 7, 6); b.quad(4, 0, 3, 7); b.quad(1, 5, 6, 2); b.quad(3, 2, 6, 7); b.quad(4, 5, 1, 0);
  return b.done(color, opts);
}

/** Curved plate (rib, ilium, scapula) swept from a spline with a flat cross-section. */
export function plate(path: V3[], width: (t: number) => number, thick: number, seg: number, color: string, opts: Partial<Mesh> = {}): Mesh {
  return tube(path, width, seg, color, { ...opts, flatten: thick, caps: true });
}

export function torusMesh(R: number, r: number, seg: number, ring: number, color: string, opts: Partial<Mesh> = {}): Mesh {
  return surface((u, v) => {
    const a = u * Math.PI * 2, bb = v * Math.PI * 2;
    return [(R + r * Math.cos(bb)) * Math.cos(a), r * Math.sin(bb), (R + r * Math.cos(bb)) * Math.sin(a)];
  }, seg, ring, color, { ...opts, closeU: true });
}

/* ---------------- transform ---------------- */

export function bake(m: Mesh, o: { pos?: V3; scale?: V3 | number; rotY?: number; rotX?: number; rotZ?: number }): Mesh {
  const s = typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : (o.scale ?? [1, 1, 1]);
  const p = o.pos ?? [0, 0, 0];
  const cy = Math.cos(o.rotY ?? 0), sy = Math.sin(o.rotY ?? 0);
  const cx = Math.cos(o.rotX ?? 0), sx = Math.sin(o.rotX ?? 0);
  const cz = Math.cos(o.rotZ ?? 0), sz = Math.sin(o.rotZ ?? 0);
  const v = new Float32Array(m.v.length);
  for (let i = 0; i < m.v.length; i += 3) {
    let x = m.v[i] * s[0], y = m.v[i + 1] * s[1], z = m.v[i + 2] * s[2];
    let x2 = x * cz - y * sz, y2 = x * sz + y * cz; x = x2; y = y2;
    let y3 = y * cx - z * sx, z3 = y * sx + z * cx; y = y3; z = z3;
    let x4 = x * cy + z * sy, z4 = -x * sy + z * cy; x = x4; z = z4;
    v[i] = x + p[0]; v[i + 1] = y + p[1]; v[i + 2] = z + p[2];
  }
  return { ...m, v, _ramp: undefined, _rimRamp: undefined, _rgb: undefined };
}

export function merge(list: Mesh[], color?: string): Mesh {
  let nv = 0, nf = 0;
  list.forEach((m) => { nv += m.v.length; nf += m.f.length; });
  const v = new Float32Array(nv), f = new Uint16Array(nf);
  let vo = 0, fo = 0, base = 0;
  list.forEach((m) => {
    v.set(m.v, vo);
    for (let i = 0; i < m.f.length; i++) f[fo + i] = m.f[i] + base;
    base += m.v.length / 3; vo += m.v.length; fo += m.f.length;
  });
  return { v, f, color: color ?? list[0]?.color ?? '#ffffff', spec: list[0]?.spec, rim: list[0]?.rim };
}

export function triCount(list: Placed[]) { let n = 0; list.forEach((p) => { n += p.mesh.f.length / 3; }); return n; }

/* ---------------- shading ---------------- */

const LEVELS = 22;
function hexRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function ramps(m: Mesh, tint?: string) {
  const key = (tint ?? '') + m.color;
  if (m._ramp && (m as any)._rampKey === key) return;
  const base = hexRGB(tint ?? m.color);
  const rimC = hexRGB('#D7FF45');
  const ramp: string[] = [], rimRamp: string[] = [];
  for (let i = 0; i < LEVELS; i++) {
    const k = 0.16 + (i / (LEVELS - 1)) * 1.14;
    ramp.push(`rgb(${Math.min(255, Math.round(base[0] * k))},${Math.min(255, Math.round(base[1] * k))},${Math.min(255, Math.round(base[2] * k))})`);
    const t = 0.42;
    rimRamp.push(`rgb(${Math.min(255, Math.round((base[0] * (1 - t) + rimC[0] * t) * k))},${Math.min(255, Math.round((base[1] * (1 - t) + rimC[1] * t) * k))},${Math.min(255, Math.round((base[2] * (1 - t) + rimC[2] * t) * k))})`);
  }
  m._ramp = ramp; m._rimRamp = rimRamp; m._rgb = base;
  (m as any)._rampKey = key;
}

/* ---------------- renderer ---------------- */

interface FaceRec { z: number; a: number; b: number; c: number; col: string; alpha: number; }
const pool: FaceRec[] = [];
let poolN = 0;
const sx: number[] = [], sy2: number[] = [];

export interface LightRig { key: V3; fill: V3; keyCol: string; ambient: number; }
export const DEFAULT_RIG: LightRig = { key: norm([-0.45, 0.78, -0.6]), fill: norm([0.7, 0.15, 0.4]), keyCol: '#FFF3E0', ambient: 0.2 };

export function renderMeshes(
  ctx: CanvasRenderingContext2D, items: Placed[],
  o: { cam: Cam; w: number; h: number; alpha?: number; rig?: LightRig; outline?: boolean; maxTris?: number },
) {
  const { cam, w, h } = o;
  const rig = o.rig ?? DEFAULT_RIG;
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cx = Math.cos(cam.pitch), sxr = Math.sin(cam.pitch);
  const S = Math.min(w, h) * 0.4 * cam.zoom;
  const ox = w / 2 + cam.panX, oy = h / 2 + cam.panY;
  const gA = o.alpha ?? 1;
  const kl = rig.key, fl = rig.fill;
  // rotate light into camera space once
  const rotL = (L: V3): V3 => {
    const X = L[0] * cy + L[2] * sy; let Z = -L[0] * sy + L[2] * cy;
    const Y = L[1] * cx - Z * sxr; Z = L[1] * sxr + Z * cx;
    return [X, Y, Z];
  };
  const K = rotL(kl), F = rotL(fl);
  poolN = 0;
  let meshes = 0;
  const budget = o.maxTris ?? 22000;
  let used = 0;

  for (const it of items) {
    const m = it.mesh;
    if (!m.f.length) continue;
    const tri = m.f.length / 3;
    if (used + tri > budget) continue;
    used += tri;
    meshes++;
    ramps(m, it.tint);
    const alpha = (it.alpha ?? 1) * gA;
    if (alpha <= 0.012) continue;
    const sc = typeof it.scale === 'number' ? [it.scale, it.scale, it.scale] : (it.scale ?? [1, 1, 1]);
    const pp = it.pos ?? [0, 0, 0];
    const ry = it.rotY ?? 0, rx = it.rotX ?? 0, rz = it.rotZ ?? 0;
    const cyy = Math.cos(ry), syy = Math.sin(ry), cxx = Math.cos(rx), sxx = Math.sin(rx), czz = Math.cos(rz), szz = Math.sin(rz);
    const nv = m.v.length / 3;
    const WX = new Float64Array(nv), WY = new Float64Array(nv), WZ = new Float64Array(nv);
    for (let i = 0; i < nv; i++) {
      let x = m.v[i * 3] * sc[0], y = m.v[i * 3 + 1] * sc[1], z = m.v[i * 3 + 2] * sc[2];
      if (rz) { const a = x * czz - y * szz, b = x * szz + y * czz; x = a; y = b; }
      if (rx) { const a = y * cxx - z * sxx, b = y * sxx + z * cxx; y = a; z = b; }
      if (ry) { const a = x * cyy + z * syy, b = -x * syy + z * cyy; x = a; z = b; }
      x += pp[0]; y += pp[1]; z += pp[2];
      const X = x * cy + z * sy; let Z = -x * sy + z * cy;
      const Y = y * cx - Z * sxr; Z = y * sxr + Z * cx;
      WX[i] = X; WY[i] = Y; WZ[i] = Z;
      const f = cam.dist / Math.max(0.6, cam.dist + Z);
      sx[i] = ox + X * S * f; sy2[i] = oy - Y * S * f;
    }
    const ramp = m._ramp!, rimRamp = m._rimRamp!;
    const spec = m.spec ?? 0.25, rimS = m.rim ?? 0.5, emis = m.emissive ?? 0;
    for (let t = 0; t < m.f.length; t += 3) {
      const i0 = m.f[t], i1 = m.f[t + 1], i2 = m.f[t + 2];
      const ax = WX[i1] - WX[i0], ay = WY[i1] - WY[i0], az = WZ[i1] - WZ[i0];
      const bx = WX[i2] - WX[i0], by = WY[i2] - WY[i0], bz = WZ[i2] - WZ[i0];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const zc = (WZ[i0] + WZ[i1] + WZ[i2]) / 3;
      const xc = (WX[i0] + WX[i1] + WX[i2]) / 3, yc = (WY[i0] + WY[i1] + WY[i2]) / 3;
      // view direction from camera at (0,0,-dist)
      const vx = xc, vy = yc, vz = zc + cam.dist;
      const vl = Math.hypot(vx, vy, vz) || 1;
      const facing = (nx * vx + ny * vy + nz * vz) / vl;
      if (!m.doubleSided && facing > 0.02) continue;
      const sgn = facing > 0 ? -1 : 1;
      const dK = Math.max(0, (nx * K[0] + ny * K[1] + nz * K[2]) * sgn);
      const dF = Math.max(0, (nx * F[0] + ny * F[1] + nz * F[2]) * sgn);
      const rimF = Math.pow(1 - Math.min(1, Math.abs(facing)), 3) * rimS;
      let lum = rig.ambient + dK * 0.85 + dF * 0.26 + emis;
      if (spec > 0) {
        const hx = K[0] - vx / vl, hy = K[1] - vy / vl, hz = K[2] - vz / vl;
        const hl = Math.hypot(hx, hy, hz) || 1;
        const sp = Math.max(0, (nx * hx + ny * hy + nz * hz) * sgn / hl);
        lum += Math.pow(sp, 22) * spec;
      }
      const li = Math.max(0, Math.min(LEVELS - 1, Math.round(lum * (LEVELS - 1) / 1.3)));
      const col = rimF > 0.34 ? rimRamp[li] : ramp[li];
      const px0 = sx[i0], py0 = sy2[i0], px1 = sx[i1], py1 = sy2[i1], px2 = sx[i2], py2 = sy2[i2];
      const area2 = (px1 - px0) * (py2 - py0) - (px2 - px0) * (py1 - py0);
      if (area2 > -0.45 && area2 < 0.45) continue;   // sub-pixel: invisible, skip
      const r = pool[poolN] ?? (pool[poolN] = { z: 0, a: 0, b: 0, c: 0, col: '', alpha: 1 });
      r.z = zc; r.a = i0; r.b = i1; r.c = i2; r.col = col; r.alpha = alpha;
      // stash projected coords per-face (verts are shared, so copy)
      (r as any).x0 = px0; (r as any).y0 = py0;
      (r as any).x1 = px1; (r as any).y1 = py1;
      (r as any).x2 = px2; (r as any).y2 = py2;
      poolN++;
    }
  }

  const view = pool.slice(0, poolN);
  view.sort((a, b) => b.z - a.z);
  ctx.lineJoin = 'round';
  let fills = 0;
  let i = 0;
  while (i < view.length) {
    const r = view[i] as any;
    ctx.globalAlpha = r.alpha;
    ctx.fillStyle = r.col;
    ctx.beginPath();
    let j = i;
    /* Adjacent faces in the depth sort that share a colour can share one
       raster call — identical pixels, far fewer fills. */
    while (j < view.length) {
      const f = view[j] as any;
      if (f.col !== r.col || f.alpha !== r.alpha) break;
      ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.closePath();
      j++;
    }
    ctx.fill(); fills++;
    if (o.outline) { ctx.strokeStyle = r.col; ctx.lineWidth = 0.6; ctx.stroke(); }
    i = j;
  }
  ctx.globalAlpha = 1;
  renderStats.fills = fills;
  renderStats.tris = view.length;
  renderStats.meshes = meshes;
  renderStats.draws++;
}

/** Project a local point through the same camera the mesh renderer uses. */
export function projectPoint(cam: Cam, w: number, h: number, p: V3) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cx = Math.cos(cam.pitch), sxr = Math.sin(cam.pitch);
  const X = p[0] * cy + p[2] * sy; let Z = -p[0] * sy + p[2] * cy;
  const Y = p[1] * cx - Z * sxr; Z = p[1] * sxr + Z * cx;
  const f = cam.dist / Math.max(0.6, cam.dist + Z);
  const S = Math.min(w, h) * 0.4 * cam.zoom;
  return { x: w / 2 + cam.panX + X * S * f, y: h / 2 + cam.panY - Y * S * f, z: Z, f };
}
