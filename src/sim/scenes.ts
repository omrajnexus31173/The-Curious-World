import { C, TAU, clamp, dot, lerp, rgba, seg, txt, type Env, type Params, type Spec } from './engine';
import { bake, blob, boxMesh, ellipsoid, lathe, merge, plate, projectPoint, renderMeshes, spline, surface, torusMesh, tube, type Mesh, type Placed, type V3 } from './mesh3d';
import * as AN from './anatomy';

/* ================================================================== */
/*  DOMAIN SCENES — a real lit 3D environment for every domain.        */
/*  The original 2D instrument view is preserved behind a toggle.      */
/* ================================================================== */

const cache = new Map<string, Mesh>();
const M = (k: string, f: () => Mesh) => { const h = cache.get(k); if (h) return h; const m = f(); cache.set(k, m); return m; };
const sg = (q: number, n: number) => Math.max(4, Math.round(n * q));
const P = (mesh: Mesh, pos: V3 = [0, 0, 0], scale: number | V3 = 1, extra: Partial<Placed> = {}): Placed => ({ mesh, pos, scale, ...extra });

export interface SceneObj { id: string; pos: V3; r: number; label: string; info: string; facts?: string[] }
interface Scene { items: Placed[]; objs: SceneObj[]; caption: string; ground?: boolean; ambient?: number }

const sphere = (r: number, q: number, col: string, opts = {}) => ellipsoid(r, r, r, sg(q, 16), sg(q, 11), col, { spec: 0.35, rim: 0.55, ...opts });
const dot3 = (r: number, q: number, col: string, opts = {}) => ellipsoid(r, r, r, Math.max(5, sg(q, 8)), Math.max(4, sg(q, 6)), col, { spec: 0.4, rim: 0.5, ...opts });

/* ---------------------------------------------------------------- */
/*  reusable model parts                                             */
/* ---------------------------------------------------------------- */

function gearMesh(teeth: number, r: number, thick: number, col: string, q: number): Mesh {
  return M(`gear${teeth}${r}${thick}${q}`, () => {
    const n = Math.max(6, Math.round(teeth));
    const prof = surface((u, v) => {
      const a = u * TAU;
      const tooth = Math.tanh(Math.sin(a * n) * 3.2);
      const rr = r * (1 + 0.13 * tooth);
      return [Math.cos(a) * rr, (v - 0.5) * thick, Math.sin(a) * rr];
    }, sg(q, n * 4), 2, col, { closeU: true, spec: 0.55, rim: 0.5 });
    const hub = lathe([[r * 0.22, -thick * 0.7], [r * 0.22, thick * 0.7]], sg(q, 14), col, { spec: 0.5 });
    const bore = lathe([[r * 0.09, -thick], [r * 0.09, thick]], sg(q, 10), '#2A2A24');
    return merge([prof, hub, bore], col);
  });
}

function wheelMesh(r: number, w: number, q: number): Mesh {
  return M(`wheel${r}${w}${q}`, () => {
    const tyre = torusMesh(r * 0.78, r * 0.24, sg(q, 20), sg(q, 10), '#26261F', { spec: 0.25 });
    const rim = lathe([[r * 0.62, -w / 2], [r * 0.62, w / 2]], sg(q, 16), '#C9C4B4', { spec: 0.7 });
    const spokes = Array.from({ length: 5 }, (_, i) => bake(boxMesh(r * 1.1, w * 0.5, r * 0.1, '#B8B2A0'), { rotY: (i / 5) * Math.PI, rotZ: Math.PI / 2 }));
    return merge([bake(tyre, { rotX: Math.PI / 2 }), bake(rim, { rotX: Math.PI / 2 }), ...spokes], '#26261F');
  });
}

function fishMesh(q: number, col: string): Mesh {
  return M(`fish${col}${q}`, () => {
    const body = surface((u, v) => {
      const th = u * TAU, t = v;
      const r = 0.16 * Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 - t * 0.25);
      return [Math.cos(th) * r * 0.55, Math.sin(th) * r, (t - 0.5) * 0.9];
    }, sg(q, 11), sg(q, 11), col, { closeU: true, spec: 0.6, rim: 0.6 });
    const tail = plate(spline([[0, 0, -0.44], [0, 0.02, -0.6], [0, 0, -0.66]], 5), (t) => 0.14 * t + 0.02, 0.12, 4, col, { spec: 0.5, doubleSided: true });
    const dorsal = plate(spline([[0, 0.1, 0.1], [0, 0.17, -0.05], [0, 0.08, -0.2]], 6), () => 0.05, 0.1, 4, col, { doubleSided: true });
    const eye = bake(dot3(0.022, q, '#171713', { spec: 0.9 }), { pos: [0.05, 0.035, 0.3] });
    const eye2 = bake(dot3(0.022, q, '#171713', { spec: 0.9 }), { pos: [-0.05, 0.035, 0.3] });
    return merge([body, tail, dorsal, eye, eye2], col);
  });
}

function quadruped(q: number, col: string, lean: number): Mesh {
  return M(`quad${col}${lean}${q}`, () => {
    const torso = surface((u, v) => {
      const th = u * TAU, t = v;
      const r = 0.20 * (0.72 + 0.42 * Math.sin(Math.PI * t)) * (1 - 0.18 * Math.pow(t, 3));
      return [Math.cos(th) * r * 0.62, Math.sin(th) * r * 0.82 + Math.sin(t * Math.PI) * lean, (t - 0.5) * 1.25];
    }, sg(q, 16), sg(q, 14), col, { closeU: true, spec: 0.35, rim: 0.6 });
    const neck = tube(spline([[0, 0.1, 0.55], [0, 0.26, 0.78], [0, 0.32, 0.92]], sg(q, 8)), (t) => 0.11 - t * 0.035, sg(q, 10), col, { spec: 0.35 });
    const head = bake(blob((th, phi) => {
      const r = 0.11;
      return [Math.sin(phi) * Math.cos(th) * r * 0.7, Math.cos(phi) * r * 0.8, Math.sin(phi) * Math.sin(th) * r * 1.25];
    }, sg(q, 14), sg(q, 10), col, { spec: 0.35 }), { pos: [0, 0.34, 1.0] });
    const muzzle = bake(ellipsoid(0.05, 0.045, 0.09, sg(q, 10), sg(q, 8), col), { pos: [0, 0.30, 1.13] });
    const ears = [-1, 1].map((s) => bake(ellipsoid(0.03, 0.045, 0.015, sg(q, 8), sg(q, 6), col), { pos: [s * 0.06, 0.44, 0.95] }));
    const tail = tube(spline([[0, 0.06, -0.6], [0, 0.14, -0.85], [0.05, 0.1, -1.05]], sg(q, 9)), (t) => 0.045 - t * 0.028, sg(q, 7), col, { spec: 0.35 });
    return merge([torso, neck, head, muzzle, ...ears, tail], col);
  });
}

function legMesh(q: number, col: string, thick: number): Mesh {
  return M(`leg${col}${thick}${q}`, () => {
    const upper = tube(spline([[0, 0, 0], [0, -0.22, 0.04], [0, -0.4, -0.02]], sg(q, 8)), (t) => thick * (1 - t * 0.35), sg(q, 8), col, { spec: 0.35 });
    const lower = tube(spline([[0, -0.4, -0.02], [0, -0.62, 0.03], [0, -0.78, 0.0]], sg(q, 8)), (t) => thick * 0.55 * (1 - t * 0.4), sg(q, 7), col, { spec: 0.35 });
    const paw = bake(ellipsoid(thick * 0.6, thick * 0.35, thick * 1.0, sg(q, 8), sg(q, 6), col), { pos: [0, -0.8, 0.03] });
    return merge([upper, lower, paw], col);
  });
}

function birdMesh(q: number, col: string): Mesh {
  return M(`bird${col}${q}`, () => {
    const body = surface((u, v) => {
      const th = u * TAU, t = v;
      const r = 0.15 * Math.sin(Math.PI * Math.pow(t, 0.6));
      return [Math.cos(th) * r * 0.8, Math.sin(th) * r * 0.85, (t - 0.5) * 0.95];
    }, sg(q, 14), sg(q, 12), col, { closeU: true, spec: 0.4, rim: 0.6 });
    const head = bake(dot3(0.075, q, col), { pos: [0, 0.07, 0.46] });
    const beak = bake(lathe([[0.03, 0], [0.0, 0.14]], sg(q, 8), '#E4C580', { spec: 0.6 }), { pos: [0, 0.06, 0.52], rotX: Math.PI / 2 });
    const tail = plate(spline([[0, 0, -0.42], [0, 0.02, -0.66]], 4), (t) => 0.11 * (1 - t * 0.3), 0.1, 4, col, { doubleSided: true });
    return merge([body, head, beak, tail], col);
  });
}

function wingMesh(q: number, col: string, span: number): Mesh {
  return M(`wing${col}${span.toFixed(2)}${q}`, () => plate(
    spline([[0, 0, 0], [span * 0.4, 0.04, -0.04], [span * 0.78, 0.02, -0.12], [span, -0.03, -0.22]], sg(q, 12)),
    (t) => 0.20 * (1 - t * 0.55), 0.10, sg(q, 5), col, { spec: 0.4, doubleSided: true },
  ));
}

function aircraft(q: number): Mesh {
  return M(`plane${q}`, () => {
    const fuse = surface((u, v) => {
      const th = u * TAU, t = v;
      const r = 0.16 * Math.sin(Math.PI * Math.pow(t, 0.42)) * (1 - 0.35 * Math.pow(t, 4));
      return [Math.cos(th) * r, Math.sin(th) * r * 1.05, (t - 0.5) * 3.0];
    }, sg(q, 18), sg(q, 18), '#E8E4D8', { closeU: true, spec: 0.65, rim: 0.5 });
    const wing = (s: number) => plate(spline([[0, -0.02, 0.15], [s * 0.7, -0.0, 0.0], [s * 1.5, 0.05, -0.25]], sg(q, 10)), (t) => 0.42 * (1 - t * 0.62), 0.09, sg(q, 5), '#DAD5C6', { spec: 0.6, doubleSided: true });
    const tailW = (s: number) => plate(spline([[0, 0.05, -1.25], [s * 0.5, 0.08, -1.4]], sg(q, 6)), (t) => 0.18 * (1 - t * 0.5), 0.08, 4, '#DAD5C6', { doubleSided: true });
    const fin = plate(spline([[0, 0.08, -1.2], [0, 0.5, -1.42]], sg(q, 6)), (t) => 0.24 * (1 - t * 0.45), 0.07, 4, '#FF704F', { doubleSided: true });
    const eng = [-1, 1].map((s) => bake(lathe([[0.11, -0.22], [0.13, -0.1], [0.12, 0.18], [0.09, 0.24]], sg(q, 14), '#B8B2A0', { spec: 0.7 }), { pos: [s * 0.72, -0.14, 0.12], rotX: Math.PI / 2 }));
    const windows = Array.from({ length: 12 }, (_, i) => bake(boxMesh(0.03, 0.035, 0.05, '#2A3038'), { pos: [0.155, 0.05, 0.9 - i * 0.16] }));
    return merge([fuse, wing(1), wing(-1), tailW(1), tailW(-1), fin, ...eng, ...windows], '#E8E4D8');
  });
}

function carBody(q: number, col: string): Mesh {
  return M(`car${col}${q}`, () => {
    const lower = surface((u, v) => {
      const th = u * TAU, t = v;
      const w = 0.46 * (0.82 + 0.18 * Math.sin(Math.PI * t));
      const h = 0.20;
      return [Math.cos(th) * w, Math.sin(th) * h + 0.02, (t - 0.5) * 2.3];
    }, sg(q, 16), sg(q, 16), col, { closeU: true, spec: 0.75, rim: 0.55 });
    const cabin = surface((u, v) => {
      const th = u * TAU, t = v;
      const w = 0.40 * (1 - 0.3 * Math.pow(Math.abs(t - 0.45) * 2, 2));
      return [Math.cos(th) * w, 0.18 + Math.sin(th) * 0.20 * (1 - 0.2 * t), (t - 0.5) * 1.25 - 0.05];
    }, sg(q, 14), sg(q, 10), '#2E3238', { closeU: true, spec: 0.85, rim: 0.6 });
    const lights = [-1, 1].map((s) => bake(ellipsoid(0.09, 0.05, 0.04, sg(q, 10), sg(q, 7), '#FFF0C0', { emissive: 0.5, spec: 0.8 }), { pos: [s * 0.3, 0.06, 1.13] }));
    const rear = [-1, 1].map((s) => bake(ellipsoid(0.09, 0.045, 0.03, sg(q, 10), sg(q, 7), '#FF4F3F', { emissive: 0.4 }), { pos: [s * 0.3, 0.08, -1.13] }));
    return merge([lower, cabin, ...lights, ...rear], col);
  });
}

function virusMesh(q: number, col: string): Mesh {
  return M(`virus${col}${q}`, () => {
    const cap = blob((th, phi) => {
      const f = 1 + 0.06 * Math.cos(th * 5) * Math.cos(phi * 5);
      return [Math.sin(phi) * Math.cos(th) * 0.3 * f, Math.cos(phi) * 0.3 * f, Math.sin(phi) * Math.sin(th) * 0.3 * f];
    }, sg(q, 16), sg(q, 11), col, { spec: 0.5, rim: 0.7 });
    const spikes: Mesh[] = [];
    const n = sg(q, 14);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.399;
      const d: V3 = [Math.cos(a) * r, y, Math.sin(a) * r];
      spikes.push(tube([[d[0] * 0.29, d[1] * 0.29, d[2] * 0.29], [d[0] * 0.42, d[1] * 0.42, d[2] * 0.42]], () => 0.018, 5, col, { spec: 0.5 }));
      spikes.push(bake(dot3(0.035, q, '#D7FF45', { emissive: 0.15 }), { pos: [d[0] * 0.44, d[1] * 0.44, d[2] * 0.44] }));
    }
    return merge([cap, ...spikes], col);
  });
}

function bacterium(q: number): Mesh {
  return M(`bact${q}`, () => {
    const body = surface((u, v) => {
      const th = u * TAU, t = v;
      const cap = Math.sin(Math.PI * clamp(t * 1.05, 0, 1));
      const r = 0.2 * Math.pow(cap, 0.35);
      return [Math.cos(th) * r, Math.sin(th) * r, (t - 0.5) * 0.95];
    }, sg(q, 16), sg(q, 14), '#9FD8A8', { closeU: true, spec: 0.55, rim: 0.6 });
    const flag = [0, 1, 2].map((k) => tube(spline(Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      return [Math.sin(t * 9 + k * 2) * 0.07, Math.cos(t * 9 + k * 2) * 0.07, -0.45 - t * 0.6] as V3;
    }), sg(q, 20)), () => 0.012, 4, '#7ED9A7', { spec: 0.4 }));
    return merge([body, ...flag], '#9FD8A8');
  });
}

function immuneCell(q: number): Mesh {
  return M(`imm${q}`, () => blob((th, phi) => {
    const r = 0.34 * (1 + 0.13 * Math.sin(th * 6) * Math.sin(phi * 5) + 0.06 * Math.sin(phi * 11));
    return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(th) * r];
  }, sg(q, 15), sg(q, 10), '#F3EBDD', { spec: 0.35, rim: 0.7 }));
}

function helixMesh(q: number, turns: number, open: number): Mesh {
  return M(`helix${turns.toFixed(1)}${open.toFixed(2)}${q}`, () => {
    const parts: Mesh[] = [];
    const N = sg(q, 70);
    for (let s = 0; s < 2; s++) {
      const pts: V3[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, a = t * turns * TAU + s * Math.PI;
        const sep = 1 + open * Math.max(0, (t - 0.5) * 2.4);
        pts.push([Math.cos(a) * 0.34 * sep, (t - 0.5) * 2.2, Math.sin(a) * 0.34 * sep]);
      }
      parts.push(tube(spline(pts, N), () => 0.055, sg(q, 8), s ? '#B59AFF' : '#FF704F', { spec: 0.55, rim: 0.5 }));
    }
    const rungs = sg(q, 26);
    for (let i = 0; i <= rungs; i++) {
      const t = i / rungs, a = t * turns * TAU;
      const sep = 1 + open * Math.max(0, (t - 0.5) * 2.4);
      const p1: V3 = [Math.cos(a) * 0.34 * sep, (t - 0.5) * 2.2, Math.sin(a) * 0.34 * sep];
      const p2: V3 = [-Math.cos(a) * 0.34 * sep, (t - 0.5) * 2.2, -Math.sin(a) * 0.34 * sep];
      const mid: V3 = [(p1[0] + p2[0]) / 2, p1[1], (p1[2] + p2[2]) / 2];
      const col = i % 2 ? '#D7FF45' : '#FFD24A';
      parts.push(tube([p1, mid], () => 0.035, 5, col, { spec: 0.5 }));
      parts.push(tube([mid, p2], () => 0.035, 5, i % 2 ? '#8FD8E8' : '#E88BF0', { spec: 0.5 }));
    }
    return merge(parts, '#FF704F');
  });
}

function chipMesh(q: number, label: string): Mesh {
  return M(`chip${label}${q}`, () => {
    const sub = boxMesh(1.5, 0.1, 1.5, '#20241C');
    const die = bake(boxMesh(0.8, 0.06, 0.8, '#3A4030', { spec: 0.8 }), { pos: [0, 0.08, 0] });
    const cores: Mesh[] = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      cores.push(bake(boxMesh(0.15, 0.03, 0.15, (i + j) % 2 ? '#D7FF45' : '#8FD8E8', { emissive: 0.18, spec: 0.7 }), { pos: [(i - 1.5) * 0.19, 0.12, (j - 1.5) * 0.19] }));
    }
    const pins: Mesh[] = [];
    for (let i = 0; i < 16; i++) {
      const t = (i / 15 - 0.5) * 1.35;
      pins.push(bake(boxMesh(0.05, 0.03, 0.12, '#C9B87A', { spec: 0.8 }), { pos: [t, -0.05, 0.78] }));
      pins.push(bake(boxMesh(0.05, 0.03, 0.12, '#C9B87A', { spec: 0.8 }), { pos: [t, -0.05, -0.78] }));
      pins.push(bake(boxMesh(0.12, 0.03, 0.05, '#C9B87A', { spec: 0.8 }), { pos: [0.78, -0.05, t] }));
      pins.push(bake(boxMesh(0.12, 0.03, 0.05, '#C9B87A', { spec: 0.8 }), { pos: [-0.78, -0.05, t] }));
    }
    return merge([sub, die, ...cores, ...pins], '#20241C');
  });
}

function turbineMesh(q: number): Mesh {
  return M(`turb${q}`, () => {
    const tower = lathe([[0.11, -1.6], [0.07, 0.4], [0.06, 0.55]], sg(q, 12), '#E8E4D8', { spec: 0.5 });
    const nac = bake(lathe([[0.1, -0.22], [0.12, 0], [0.07, 0.3]], sg(q, 12), '#DAD5C6', { spec: 0.6 }), { pos: [0, 0.6, 0], rotX: Math.PI / 2 });
    return merge([tower, nac], '#E8E4D8');
  });
}

function bladeMesh(q: number): Mesh {
  return M(`blade${q}`, () => plate(spline([[0, 0, 0], [0.06, 0.55, 0.02], [0.03, 1.1, 0.0], [0, 1.5, -0.02]], sg(q, 12)), (t) => 0.13 * (1 - t * 0.75), 0.16, sg(q, 5), '#F3EBDD', { spec: 0.55, doubleSided: true }));
}

function towerMesh(q: number, floors: number, mat: string): Mesh {
  return M(`tower${floors}${mat}${q}`, () => {
    const parts: Mesh[] = [];
    const fh = 2.8 / floors;
    for (let i = 0; i < floors; i++) {
      const w = 0.62 * (1 - (i / floors) * 0.28);
      parts.push(bake(boxMesh(w * 2, fh * 0.82, w * 2, mat, { spec: 0.5 }), { pos: [0, -1.4 + i * fh + fh / 2, 0] }));
      parts.push(bake(boxMesh(w * 2.06, fh * 0.1, w * 2.06, '#8FD8E8', { emissive: 0.12, spec: 0.8 }), { pos: [0, -1.4 + i * fh + fh * 0.92, 0] }));
    }
    parts.push(bake(boxMesh(1.7, 0.14, 1.7, '#4A4438'), { pos: [0, -1.47, 0] }));
    return merge(parts, mat);
  });
}

function habitatMesh(q: number): Mesh {
  return M(`hab${q}`, () => {
    const ring = torusMesh(1.15, 0.17, sg(q, 40), sg(q, 12), '#B8B2C8', { spec: 0.7, rim: 0.6 });
    const spokes = Array.from({ length: 6 }, (_, i) => bake(boxMesh(2.2, 0.05, 0.05, '#8E88A0', { spec: 0.6 }), { rotY: (i / 6) * Math.PI }));
    const hub = lathe([[0.2, -0.3], [0.24, 0], [0.2, 0.3]], sg(q, 14), '#DAD5C6', { spec: 0.7 });
    const windows = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * TAU;
      return bake(boxMesh(0.1, 0.06, 0.05, '#D7FF45', { emissive: 0.4 }), { pos: [Math.cos(a) * 1.15, 0.16, Math.sin(a) * 1.15], rotY: -a });
    });
    return merge([ring, ...spokes, hub, ...windows], '#B8B2C8');
  });
}

function earthGlobe(q: number, cut: number): Mesh {
  return M(`earth${cut.toFixed(2)}${q}`, () => {
    const uMax = 1 - cut * 0.28;
    const shell = (r: number, col: string, em = 0) => surface((u, v) => {
      const th = u * TAU * uMax, phi = v * Math.PI;
      return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(th) * r];
    }, sg(q, 34), sg(q, 20), col, { doubleSided: true, spec: 0.4, emissive: em });
    const parts = [shell(1.0, '#2E5A4A'), shell(0.96, '#8E5A3A'), shell(0.72, '#C4622E'), shell(0.46, '#FFB347', 0.12), shell(0.24, '#FFE9A8', 0.3)];
    // continents as raised patches
    const cont: [number, number, number][] = [[0.35, 0.6, 0.34], [-0.2, 0.3, 0.26], [0.9, -0.3, 0.3], [-1.1, -0.5, 0.22], [2.2, 0.5, 0.36], [2.6, -0.4, 0.24], [-2.4, 0.75, 0.3]];
    cont.forEach(([lon, lat, s]) => {
      const d: V3 = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
      parts.push(bake(blob((th, phi) => {
        const r = s * (0.7 + 0.4 * Math.sin(th * 3 + lon) * Math.cos(phi * 2));
        return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 0.22, Math.sin(phi) * Math.sin(th) * r];
      }, sg(q, 12), sg(q, 7), '#7ED9A7', { spec: 0.3 }), { pos: [d[0] * 0.99, d[1] * 0.99, d[2] * 0.99], rotY: -lon, rotX: lat }));
    });
    parts.push(bake(sphere(0.26, q, '#F3EBDD', { spec: 0.6 }), { pos: [0, 0.94, 0], scale: [1, 0.35, 1] }));
    parts.push(bake(sphere(0.26, q, '#F3EBDD', { spec: 0.6 }), { pos: [0, -0.94, 0], scale: [1, 0.35, 1] }));
    return merge(parts, '#2E5A4A');
  });
}

function submarine(q: number): Mesh {
  return M(`sub${q}`, () => {
    const hull = surface((u, v) => {
      const th = u * TAU, t = v;
      const r = 0.3 * Math.pow(Math.sin(Math.PI * clamp(t, 0.001, 0.999)), 0.38);
      return [Math.cos(th) * r, Math.sin(th) * r, (t - 0.5) * 2.4];
    }, sg(q, 18), sg(q, 18), '#E4C580', { closeU: true, spec: 0.7, rim: 0.6 });
    const tower = bake(boxMesh(0.22, 0.3, 0.6, '#D4B570', { spec: 0.6 }), { pos: [0, 0.3, 0.25] });
    const fins = [0, 1].map((i) => bake(boxMesh(0.9, 0.05, 0.28, '#C9A45C'), { pos: [0, 0, -0.95], rotZ: i * Math.PI / 2 }));
    const prop = bake(merge(Array.from({ length: 5 }, (_, k) => bake(boxMesh(0.06, 0.34, 0.03, '#B8B2A0', { spec: 0.8 }), { rotZ: (k / 5) * TAU })), '#B8B2A0'), { pos: [0, 0, -1.25] });
    const ports = [0, 1, 2].map((i) => bake(dot3(0.055, q, '#8FD8E8', { emissive: 0.4, spec: 0.9 }), { pos: [0.28, 0.05, 0.6 - i * 0.4] }));
    const lamp = bake(dot3(0.07, q, '#FFF3D0', { emissive: 0.8 }), { pos: [0, -0.1, 1.15] });
    return merge([hull, tower, ...fins, prop, ...ports, lamp], '#E4C580');
  });
}

function plantMesh(q: number, growth: number): Mesh {
  return M(`plant${growth.toFixed(2)}${q}`, () => {
    const h = 0.4 + growth * 2.0;
    const stem = tube(spline([[0, -0.9, 0], [0.05, -0.9 + h * 0.4, 0.03], [-0.03, -0.9 + h * 0.75, -0.02], [0, -0.9 + h, 0]], sg(q, 14)), (t) => 0.05 * (1 - t * 0.5) * (0.4 + growth), sg(q, 8), '#5A8C3A', { spec: 0.4 });
    const parts: Mesh[] = [stem];
    const nl = Math.round(2 + growth * 7);
    for (let i = 0; i < nl; i++) {
      const t = 0.18 + (i / nl) * 0.72, y = -0.9 + h * t, a = i * 2.399;
      const len = (0.28 + growth * 0.42) * (1 - t * 0.35);
      parts.push(plate(spline([[0, y, 0], [Math.cos(a) * len * 0.5, y + 0.08, Math.sin(a) * len * 0.5], [Math.cos(a) * len, y + 0.02, Math.sin(a) * len]], sg(q, 8)),
        (u) => 0.14 * Math.sin(Math.PI * u) * (0.5 + growth), 0.08, sg(q, 5), i % 2 ? '#7ED9A7' : '#5FBF87', { spec: 0.45, doubleSided: true }));
    }
    if (growth > 0.62) {
      const y = -0.9 + h;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        parts.push(bake(ellipsoid(0.13, 0.035, 0.06, sg(q, 8), sg(q, 6), '#FFD24A', { spec: 0.5 }), { pos: [Math.cos(a) * 0.17, y + 0.04, Math.sin(a) * 0.17], rotY: -a }));
      }
      parts.push(bake(sphere(0.13, q, '#6B4A22', { spec: 0.4 }), { pos: [0, y + 0.05, 0], scale: [1, 0.55, 1] }));
    }
    const roots = [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * TAU;
      return tube(spline([[0, -0.9, 0], [Math.cos(a) * 0.2, -1.15, Math.sin(a) * 0.2], [Math.cos(a) * 0.38, -1.45, Math.sin(a) * 0.38]], sg(q, 8)), (t) => 0.03 * (1 - t * 0.7), 5, '#C9A45C', { spec: 0.3 });
    });
    return merge([...parts, ...roots], '#5A8C3A');
  });
}

function soilBlock(q: number): Mesh {
  return M(`soil${q}`, () => merge([
    bake(boxMesh(2.4, 0.3, 1.8, '#3D3324'), { pos: [0, -1.05, 0] }),
    bake(boxMesh(2.4, 0.35, 1.8, '#4A3D2C'), { pos: [0, -1.37, 0] }),
    bake(boxMesh(2.4, 0.4, 1.8, '#5A4D3A'), { pos: [0, -1.74, 0] }),
  ], '#3D3324'));
}

function eyeModel(q: number): Mesh {
  return M(`eye${q}`, () => {
    const ball = sphere(0.6, q, '#F3EBDD', { spec: 0.8 });
    const iris = bake(lathe([[0.0, 0], [0.26, 0.04], [0.28, 0.02]], sg(q, 24), '#7ED9A7', { spec: 0.8 }), { pos: [0, 0, 0.55], rotX: Math.PI / 2 });
    const pupil = bake(sphere(0.12, q, '#171713', { spec: 0.9 }), { pos: [0, 0, 0.6] });
    const cornea = bake(sphere(0.3, q, '#8FD8E8', { spec: 0.95 }), { pos: [0, 0, 0.44], scale: [1, 1, 0.5] });
    const nerve = tube(spline([[0, 0, -0.55], [0.1, -0.05, -0.95], [0.15, -0.1, -1.3]], sg(q, 10)), (t) => 0.13 - t * 0.04, sg(q, 9), '#E4E86A', { spec: 0.4 });
    return merge([ball, iris, pupil, cornea, nerve], '#F3EBDD');
  });
}

function ridgeMesh(q: number, pattern: number, freq: number): Mesh {
  return M(`ridge${pattern}${freq}${q}`, () => surface((u, v) => {
    const x = (u - 0.5) * 1.8, z = (v - 0.5) * 2.2;
    const r = Math.hypot(x * 1.1, z * 0.8);
    let phase: number;
    if (pattern === 0) phase = r * freq + x * 2.2;
    else if (pattern === 1) phase = Math.atan2(z, x) * 3 + r * freq;
    else phase = z * freq * 0.8 + Math.cos(x * 1.6) * 2;
    const y = Math.sin(phase) * 0.055 * Math.exp(-r * r * 0.5);
    return [x, y, z];
  }, sg(q, 30), sg(q, 30), '#E4C580', { spec: 0.55, rim: 0.6, doubleSided: true }));
}

/* ---------------------------------------------------------------- */
/*  scene assembly per domain                                        */
/* ---------------------------------------------------------------- */

function build(id: string, p: Params, m: any, e: Env): Scene {
  const q = clamp(e.q, 0.5, 1.1);
  const t = e.t;
  const mode = Math.round(p.mode ?? p.view ?? 0);
  const items: Placed[] = [];
  const objs: SceneObj[] = [];
  let caption = '';
  let ground = true;

  switch (id) {
    case 'space': {
      ground = false;
      const stage = Math.round(p.stage ?? 1);
      const R = 0.42 * (stage === 2 ? 2.1 : stage === 4 ? 0.3 : 1) * Math.pow(clamp(p.mass, 0.5, 30), 0.28);
      const col = stage === 0 ? '#B59AFF' : stage === 2 ? '#FF704F' : stage === 4 ? '#101014' : p.mass > 8 ? '#CFE0FF' : '#FFD24A';
      items.push(P(sphere(R, q, col, { emissive: 0.75, rim: 0.9 }), [0, 0, 0]));
      objs.push({ id: 'star', pos: [0, 0, 0], r: R, label: `${p.mass} M☉ star`, info: `A ${p.mass} solar-mass star. Luminosity scales as M³·⁵ and main-sequence lifetime as M⁻²·⁵, so this star burns ${Math.pow(p.mass, 3.5).toFixed(1)}× the Sun’s output.` });
      if (stage === 4 && p.mass >= 20) items.push(P(torusMesh(R * 2.4, R * 0.5, sg(q, 30), sg(q, 8), '#FFB347', { emissive: 0.5 }), [0, 0, 0], 1, { rotX: 0.4, alpha: 0.75 }));
      const names = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
      const au = [0.39, 0.72, 1, 1.52, 5.2, 9.58, 19.2, 30.05];
      const cols = ['#C9B8A0', '#E8C57A', '#7ED9A7', '#FF704F', '#E4C580', '#D7C9A0', '#A8D8C9', '#B59AFF'];
      const n = Math.round(p.count ?? 8);
      for (let i = 0; i < n; i++) {
        const rad = 0.9 + Math.log(1 + au[i]) * 0.85;
        const T = 365.25 * Math.pow(au[i], 1.5);
        const a = ((m.days ?? 0) / T) * TAU + i;
        const pos: V3 = [Math.cos(a) * rad * (1 + (p.ecc ?? 0)), 0, Math.sin(a) * rad * (1 - (p.ecc ?? 0))];
        const pr = 0.055 + (i >= 4 ? 0.075 : 0.02);
        items.push(P(sphere(pr, q, cols[i]), pos));
        if (i === 5) items.push(P(torusMesh(pr * 2.1, pr * 0.28, sg(q, 26), sg(q, 6), '#E4C580', { spec: 0.6 }), pos, 1, { rotX: 0.45 }));
        items.push(P(torusMesh(rad, 0.006, sg(q, 48), 3, '#F3EBDD', { emissive: 0.2 }), [0, 0, 0], 1, { alpha: 0.22 }));
        objs.push({ id: `planet${i}`, pos, r: pr * 1.6, label: names[i], info: `${names[i]} — semi-major axis ${au[i]} AU, orbital period ${Math.pow(au[i], 1.5).toFixed(2)} years by Kepler’s third law (T² = a³).`, facts: [`${au[i]} AU`, `${(Math.pow(au[i], 1.5) * 365.25).toFixed(0)} days`] });
      }
      caption = `Orrery · ${n} planets · ${p.mass} M☉ ${['nebula', 'main sequence', 'red giant', 'supernova', 'remnant'][stage]}`;
      break;
    }
    case 'earth': {
      const cut = clamp(p.depth ?? 1, 0.2, 1);
      items.push(P(earthGlobe(q, cut), [0, 0, 0], 1.35, { rotY: t * 0.06 }));
      objs.push({ id: 'crust', pos: [0, 1.3, 0], r: 0.5, label: 'Crust', info: 'The crust is 5–70 km thick — under 1% of Earth’s radius. Oceanic crust is basaltic and young; continental crust is granitic and up to 4 billion years old.' });
      objs.push({ id: 'mantle', pos: [0.9, 0.2, 0.6], r: 0.45, label: 'Mantle', info: 'Solid silicate rock that creeps over geological time. Convection here drives every plate at 2–15 cm per year.' });
      objs.push({ id: 'outercore', pos: [0.5, -0.4, 0.9], r: 0.4, label: 'Outer core', info: 'Liquid iron–nickel. Its convection generates the geomagnetic field. S-waves cannot cross it — that shadow is how we know it is liquid.' });
      objs.push({ id: 'innercore', pos: [0, 0, 1.1], r: 0.32, label: 'Inner core', info: 'Solid iron at about 5,200 °C, kept solid by 360 GPa of pressure despite being hotter than the Sun’s surface.' });
      const shift = Math.sin((m.off ?? 0) * 0.2) * 0.3;
      const vx = 0.4 + shift;
      items.push(P(lathe([[0.34, 0], [0.05, 0.42]], sg(q, 16), '#6B4A32', { spec: 0.4 }), [vx, 1.15, 0.5], 1));
      if ((m.erupt ?? 0) > 0) items.push(P(sphere(0.14, q, '#FF704F', { emissive: 0.8 }), [vx, 1.62, 0.5], 1 + Math.sin(t * 9) * 0.2));
      objs.push({ id: 'volcano', pos: [vx, 1.5, 0.5], r: 0.35, label: 'Volcano', info: 'Magma rises where pressure drops or water lowers the melting point. Trigger an eruption from the instrument rail.' });
      if ((m.quake ?? 0) > 0) {
        items.push(P(torusMesh((m.wr ?? 0) * 0.006, 0.02, sg(q, 40), 4, '#D7FF45', { emissive: 0.5 }), [vx, 1.2, 0.5], 1, { rotX: Math.PI / 2, alpha: 0.7 }));
        items.push(P(torusMesh((m.sr ?? 0) * 0.006, 0.02, sg(q, 40), 4, '#B59AFF', { emissive: 0.5 }), [vx, 1.2, 0.5], 1, { rotX: Math.PI / 2, alpha: 0.7 }));
      }
      caption = `Cutaway Earth · ${['convergent', 'divergent', 'transform'][Math.round(p.bound ?? 0)]} boundary · P 6.0 / S 3.5 km/s`;
      break;
    }
    case 'ocean': {
      ground = false;
      const depth = clamp((m.depth ?? 0) / 11000, 0, 1);
      items.push(P(submarine(q), [0, 0.1, 0], 0.85, { rotY: Math.PI * 0.15, rotZ: Math.sin(t * 0.6) * 0.03 }));
      objs.push({ id: 'sub', pos: [0, 0.1, 0], r: 0.9, label: 'Submersible', info: `Hull pressure at this depth is ${(1 + (m.depth ?? 0) / 10.06).toFixed(1)} bar. Crewed spheres use titanium or syntactic foam because every gas-filled cavity would implode.` });
      const scene = Math.round(p.scene ?? 0);
      if (scene === 1) {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU;
          const bleach = clamp(((p.sst ?? 22) - 28) / 4, 0, 1);
          items.push(P(blob((th, phi) => { const r = 0.22 * (1 + 0.35 * Math.sin(th * 5)); return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 1.4, Math.sin(phi) * Math.sin(th) * r]; }, sg(q, 12), sg(q, 8), bleach > 0.5 ? '#EDE6D6' : ['#FF704F', '#E88BF0', '#FFD24A'][i % 3], { spec: 0.4 }), [Math.cos(a) * 1.5, -1.2, Math.sin(a) * 1.5]));
        }
        objs.push({ id: 'coral', pos: [1.5, -1.0, 0], r: 0.5, label: 'Coral colony', info: 'Corals are animals hosting photosynthetic algae. Above roughly 29 °C they expel the algae and bleach — the tissue is still alive but starving.' });
      } else if (scene === 2) {
        items.push(P(lathe([[0.45, -1.4], [0.3, -0.4], [0.16, 0.3], [0.2, 0.45]], sg(q, 16), '#3A342C', { spec: 0.35 }), [-1.3, 0, -0.6]));
        objs.push({ id: 'vent', pos: [-1.3, 0.4, -0.6], r: 0.5, label: 'Black smoker', info: 'Hydrothermal fluid exits at up to 400 °C, kept liquid by pressure. Chemosynthetic bacteria form the base of a food web that needs no sunlight.' });
      }
      const nf = scene === 0 ? 8 : 5;
      for (let i = 0; i < nf; i++) {
        const a = t * 0.25 + i * 1.7;
        const bio = depth > 0.1;
        const pos: V3 = [Math.cos(a) * (1.6 + (i % 3) * 0.4), Math.sin(a * 1.3) * 0.8, Math.sin(a) * (1.6 + (i % 2) * 0.5)];
        items.push(P(fishMesh(q, bio ? '#B59AFF' : '#8FD8E8'), pos, 0.55, { rotY: -a + Math.PI / 2 }));
        if (i === 0) objs.push({ id: 'fish', pos, r: 0.45, label: bio ? 'Bioluminescent fish' : 'Reef fish', info: bio ? 'Below 1,000 m all light is biological. Photophores produce cold light through luciferin oxidation for lures, camouflage and signalling.' : 'Sunlit reef fish live in the epipelagic zone where photosynthesis is possible — about 90% of marine life crowds into this thin layer.' });
      }
      caption = `${(m.depth ?? 0).toFixed(0)} m · ${(1 + (m.depth ?? 0) / 10.06).toFixed(1)} bar · light ${(Math.exp(-(p.turb ?? 0.08) * (m.depth ?? 0) * 0.06) * 100).toFixed(2)}%`;
      break;
    }
    case 'physics': {
      if (mode === 1) {
        const cart = (x: number, mass: number, col: string) => {
          items.push(P(boxMesh(0.5 + mass * 0.05, 0.34, 0.5, col, { spec: 0.6 }), [x, -0.6, 0]));
          [-1, 1].forEach((s) => [-1, 1].forEach((u) => items.push(P(wheelMesh(0.12, 0.06, q), [x + s * 0.2, -0.8, u * 0.22], 1, { rotZ: Math.PI / 2 }))));
        };
        cart((m.ax ?? 0.2) * 4 - 2, p.m1, '#D7FF45');
        cart((m.bx ?? 0.75) * 4 - 2, p.m2, '#FF704F');
        items.push(P(boxMesh(5, 0.08, 0.9, '#2A2A24'), [0, -0.92, 0]));
        objs.push({ id: 'cartA', pos: [(m.ax ?? 0.2) * 4 - 2, -0.6, 0], r: 0.45, label: `Cart A ${p.m1} kg`, info: `Momentum ${(p.m1 * (m.av ?? 0)).toFixed(2)} kg·m/s. In every collision total momentum is conserved; kinetic energy only when restitution is 1.` });
        objs.push({ id: 'cartB', pos: [(m.bx ?? 0.75) * 4 - 2, -0.6, 0], r: 0.45, label: `Cart B ${p.m2} kg`, info: `With e = ${p.rest}, ${((1 - p.rest * p.rest) * 100).toFixed(0)}% of relative kinetic energy becomes deformation and heat.` });
      } else if (mode === 2) {
        const th = m.th ?? 0.6, L = 1.6;
        const bob: V3 = [Math.sin(th) * L, 0.9 - Math.cos(th) * L, 0];
        items.push(P(boxMesh(1.2, 0.1, 0.4, '#4A4438'), [0, 0.95, 0]));
        items.push(P(tube([[0, 0.9, 0], bob], () => 0.015, 6, '#F3EBDD'), [0, 0, 0]));
        items.push(P(sphere(0.18 + p.m1 * 0.012, q, '#D7FF45', { spec: 0.7 }), bob));
        objs.push({ id: 'bob', pos: bob, r: 0.35, label: 'Pendulum bob', info: `Full nonlinear pendulum: θ̈ = −(g/L)·sinθ. At ${(Math.abs(th) * 180 / Math.PI).toFixed(0)}° the small-angle period formula is already measurably wrong.` });
      } else if (mode === 4) {
        const t1 = (90 - (p.ang ?? 45)) * Math.PI / 180;
        const s2 = Math.sin(t1) / (p.n2 ?? 1.5);
        const tir = Math.abs(s2) > 1;
        const t2 = tir ? t1 : Math.asin(s2);
        // optical rail + glass block
        items.push(P(boxMesh(4.4, 0.1, 1.0, '#2A2A24', { spec: 0.5 }), [0, -1.0, 0]));
        items.push(P(boxMesh(1.9, 1.5, 1.1, '#8FD8E8', { spec: 0.95, rim: 0.8 }), [0, -0.2, 0], 1, { alpha: 0.3 }));
        items.push(P(boxMesh(1.94, 0.05, 1.14, '#C9F0FF', { spec: 0.9, emissive: 0.15 }), [0, 0.55, 0]));
        // laser housing
        const sx0 = -Math.sin(t1) * 1.7, sy0 = Math.cos(t1) * 1.7;
        items.push(P(lathe([[0.13, -0.3], [0.15, 0.1], [0.09, 0.22]], sg(q, 14), '#4A4438', { spec: 0.7 }), [sx0, sy0, 0], 1, { rotZ: -t1 }));
        items.push(P(dot3(0.07, q, '#D7FF45', { emissive: 0.9 }), [sx0 * 0.86, sy0 * 0.86, 0]));
        // incident beam
        items.push(P(tube([[sx0, sy0, 0], [0, 0.55, 0]], () => 0.028, sg(q, 8), '#D7FF45', { emissive: 0.6 }), [0, 0, 0]));
        // normal
        items.push(P(tube([[0, 1.35, 0], [0, -0.9, 0]], () => 0.008, 4, '#F3EBDD', { emissive: 0.2 }), [0, 0, 0], 1, { alpha: 0.4 }));
        if (tir) {
          items.push(P(tube([[0, 0.55, 0], [Math.sin(t1) * 1.7, 0.55 + Math.cos(t1) * 1.7, 0]], () => 0.028, sg(q, 8), '#FF704F', { emissive: 0.6 }), [0, 0, 0]));
        } else {
          // dispersion: three wavelengths refract by slightly different indices
          [[-0.012, '#FF704F'], [0, '#D7FF45'], [0.014, '#B59AFF']].forEach(([dn, col]) => {
            const rr = Math.asin(clamp(Math.sin(t1) / ((p.n2 ?? 1.5) + (dn as number)), -1, 1));
            items.push(P(tube([[0, 0.55, 0], [Math.sin(rr) * 1.5, 0.55 - Math.cos(rr) * 1.5, 0]], () => 0.022, sg(q, 7), col as string, { emissive: 0.55 }), [0, 0, 0]));
          });
          items.push(P(tube([[0, 0.55, 0], [Math.sin(t2) * 1.6, 0.55 - Math.cos(t2) * 1.6, 0]], () => 0.012, sg(q, 6), '#F3EBDD', { emissive: 0.3 }), [0, 0, 0], 1, { alpha: 0.5 }));
        }
        // partial reflection + screen
        items.push(P(tube([[0, 0.55, 0], [Math.sin(t1) * 1.1, 0.55 + Math.cos(t1) * 1.1, 0]], () => 0.014, sg(q, 6), '#D7FF45', { emissive: 0.4 }), [0, 0, 0], 1, { alpha: 0.45 }));
        items.push(P(boxMesh(0.08, 1.4, 1.0, '#EDE6D6', { spec: 0.3 }), [1.95, -0.25, 0]));
        for (let i = 0; i < 9; i++) {
          const u = ((t * 0.5 + i / 9) % 1);
          items.push(P(dot3(0.035, q, '#D7FF45', { emissive: 0.7 }), [sx0 * (1 - u), sy0 * (1 - u) + 0.55 * u, 0]));
        }
        objs.push({ id: 'source', pos: [sx0, sy0, 0], r: 0.35, label: 'Monochromatic source', info: `Incidence ${(t1 * 180 / Math.PI).toFixed(1)}° from the normal. Part of the beam always reflects; the rest refracts unless the critical angle is exceeded.` });
        objs.push({ id: 'medium', pos: [0, -0.2, 0], r: 0.9, label: `Medium n = ${(p.n2 ?? 1.5).toFixed(2)}`, info: `Snell’s law n₁sinθ₁ = n₂sinθ₂ gives ${tir ? 'no real solution — total internal reflection' : `θ₂ = ${(t2 * 180 / Math.PI).toFixed(1)}°`}. Light travels at ${(299792 / (p.n2 ?? 1.5)).toFixed(0)} km/s inside. The three coloured rays show dispersion: n varies slightly with wavelength.` });
        objs.push({ id: 'screen', pos: [1.95, -0.25, 0], r: 0.5, label: 'Screen', info: 'Where the emergent beam lands. Moving the angle sweeps the spot across the screen — the basis of every refractometer.' });
      } else if (mode === 3) {
        for (let i = 0; i < 26; i++) {
          const x = (i / 25 - 0.5) * 4;
          const y = Math.sin(x * p.freq * 2 - t * 3) * 0.5 + Math.sin(x * p.freq * 2 - t * 3 + Math.PI * p.mu * 2) * 0.35;
          items.push(P(dot3(0.06, q, i % 2 ? '#FF704F' : '#D7FF45', { emissive: 0.3 }), [x, y, 0]));
        }
        objs.push({ id: 'wave', pos: [0, 0, 0], r: 1.4, label: 'Superposition', info: 'Two travelling waves add point by point. Phase offset decides constructive or destructive interference.' });
      } else {
        const bx = clamp((m.x ?? 0) * 0.05, -2, 2.2), by = clamp((m.y ?? 0) * 0.05, 0, 2.2);
        items.push(P(lathe([[0.16, 0], [0.13, 0.7]], sg(q, 12), '#4A4438', { spec: 0.6 }), [-2, -0.9, 0], 1, { rotZ: -(p.ang ?? 45) * Math.PI / 180 + Math.PI / 2 }));
        items.push(P(sphere(0.14, q, '#FF704F', { spec: 0.7 }), [bx - 1.6, by - 0.85, 0]));
        objs.push({ id: 'projectile', pos: [bx - 1.6, by - 0.85, 0], r: 0.3, label: 'Projectile', info: `Speed ${Math.hypot(m.vx ?? 0, m.vy ?? 0).toFixed(1)} m/s. Gravity removes ${p.g} m/s of vertical velocity every second.` });
      }
      caption = ['Projectile bench', 'Collision bench', 'Pendulum', 'Wave tank', 'Optics bench'][mode];
      break;
    }
    case 'chemistry': {
      if (mode === 1) {
        const mols: Record<string, [V3, string, number][]> = {
          '0': [[[0, 0, 0], '#FF704F', 0.3], [[-0.62, 0.48, 0], '#F3EBDD', 0.19], [[0.62, 0.48, 0], '#F3EBDD', 0.19]],
          '1': [[[0, 0, 0], '#8F8A7A', 0.28], [[-0.8, 0, 0], '#FF704F', 0.28], [[0.8, 0, 0], '#FF704F', 0.28]],
          '2': [[[0, 0, 0], '#8F8A7A', 0.28], [[0.5, 0.5, 0.5], '#F3EBDD', 0.17], [[-0.5, -0.5, 0.5], '#F3EBDD', 0.17], [[-0.5, 0.5, -0.5], '#F3EBDD', 0.17], [[0.5, -0.5, -0.5], '#F3EBDD', 0.17]],
          '3': [[[-0.45, 0, 0], '#FFD24A', 0.3], [[0.45, 0, 0], '#D7FF45', 0.36]],
          '4': [[[0, 0.2, 0], '#B59AFF', 0.29], [[0.6, -0.25, 0], '#F3EBDD', 0.17], [[-0.3, -0.25, 0.52], '#F3EBDD', 0.17], [[-0.3, -0.25, -0.52], '#F3EBDD', 0.17]],
        };
        const set = mols[String(Math.round(p.mol ?? 0))] ?? mols['0'];
        set.forEach(([pos, col, r], i) => {
          items.push(P(sphere(r, q, col, { spec: 0.75 }), pos));
          if (i > 0) items.push(P(tube([set[0][0], pos], () => 0.06, sg(q, 8), '#C9C4B4', { spec: 0.6 }), [0, 0, 0]));
        });
        objs.push({ id: 'molecule', pos: [0, 0, 0], r: 1, label: ['H₂O', 'CO₂', 'CH₄', 'NaCl', 'NH₃'][Math.round(p.mol ?? 0)], info: 'Geometry follows electron-pair repulsion. Lone pairs push harder than bonding pairs, which is why water is bent at 104.5° rather than linear.' });
      } else if (mode === 0) {
        const shells = [2, 8, 18, 32];
        items.push(P(sphere(0.3, q, '#FF704F', { emissive: 0.25, spec: 0.6 }), [0, 0, 0]));
        objs.push({ id: 'nucleus', pos: [0, 0, 0], r: 0.35, label: 'Nucleus', info: 'Protons and neutrons hold >99.9% of the mass in about 1/100,000 of the atom’s diameter.' });
        objs.push({ id: 'shell', pos: [1.05, 0, 0], r: 0.4, label: 'Electron shells', info: 'Shells fill 2, 8, 18, 32. Only the outermost electrons take part in bonding, which is why the periodic table repeats its chemistry in periods.' });
        shells.forEach((count, si) => {
          const r = 0.65 + si * 0.42;
          items.push(P(torusMesh(r, 0.008, sg(q, 40), 4, '#F3EBDD', { emissive: 0.2 }), [0, 0, 0], 1, { rotX: si * 0.5, alpha: 0.35 }));
          const n = Math.min(count, 8);
          for (let i = 0; i < n; i++) {
            const a = t * (1.1 - si * 0.2) + (i / n) * TAU;
            const pos: V3 = [Math.cos(a) * r, Math.sin(a) * r * Math.sin(si * 0.5), Math.sin(a) * r * Math.cos(si * 0.5)];
            items.push(P(dot3(0.075, q, '#D7FF45', { emissive: 0.45 }), pos));
          }
        });
      } else {
        items.push(P(lathe([[0.55, -1], [0.5, -0.2], [0.22, 0.35], [0.2, 0.9]], sg(q, 22), '#8FD8E8', { spec: 0.9 }), [0, 0, 0], 1, { alpha: 0.3 }));
        const fill = mode === 3 ? clamp((p.vol ?? 0) / 50, 0.05, 0.95) : clamp(m.reacted ?? 0.3, 0.05, 0.95);
        items.push(P(lathe([[0.5, -0.98], [0.46 * (1 - fill * 0.3), -0.98 + fill * 1.1]], sg(q, 20), mode === 3 ? '#B59AFF' : '#D7FF45', { spec: 0.7, emissive: 0.15 }), [0, 0, 0], 1, { alpha: 0.8 }));
        for (let i = 0; i < 16; i++) {
          const a = t * 1.4 + i, r = 0.3 * Math.sqrt((i + 1) / 16);
          items.push(P(dot3(0.05, q, i % 2 ? '#FF704F' : '#FFD24A', { emissive: 0.3 }), [Math.cos(a) * r, -0.9 + ((t * 0.4 + i / 16) % 1) * fill * 1.1, Math.sin(a) * r]));
        }
        objs.push({ id: 'flask', pos: [0, -0.3, 0], r: 0.8, label: mode === 3 ? 'Titration flask' : 'Reaction vessel', info: mode === 3 ? 'Strong acid meets strong base. The equivalence point at 25 mL swings pH by several units in a single drop.' : `Arrhenius: k = A·e^(−Ea/RT). At ${p.temp} K the barrier is ${(p.ea - p.cat).toFixed(0)} kJ/mol.` });
      }
      caption = ['Atom', 'Molecular geometry', 'Kinetics', 'Titration', 'States of matter'][mode];
      break;
    }
    case 'math': {
      if (mode === 0) {
        const it = Math.round(p.iter ?? 90);
        items.push(P(surface((u, v) => {
          const cr = (p.cx ?? -0.6) + (u - 0.5) * 3 / (p.zoom ?? 1);
          const ci = (p.cy ?? 0) + (v - 0.5) * 3 / (p.zoom ?? 1);
          let zr = 0, zi = 0, i = 0;
          while (zr * zr + zi * zi < 4 && i < it) { const tt = zr * zr - zi * zi + cr; zi = 2 * zr * zi + ci; zr = tt; i++; }
          return [(u - 0.5) * 3.2, (i / it) * 1.4 - 0.6, (v - 0.5) * 3.2];
        }, sg(q, 44), sg(q, 44), '#E88BF0', { spec: 0.5, rim: 0.6, doubleSided: true }), [0, 0, 0]));
        objs.push({ id: 'fractal', pos: [0, 0, 0], r: 1.6, label: 'Mandelbrot heightfield', info: `Escape time after ${it} iterations, plotted as height. The boundary has Hausdorff dimension 2 — infinitely intricate at every zoom.` });
      } else if (mode === 2) {
        items.push(P(boxMesh(3, 0.1, 1.2, '#3A342C'), [0, -1.2, 0]));
        for (let r = 0; r < 8; r++) for (let k = 0; k <= r; k++) {
          items.push(P(dot3(0.05, q, '#F3EBDD'), [(k - r / 2) * 0.3, 0.9 - r * 0.26, 0]));
        }
        const bins = (m.bins ?? []) as number[];
        const mx = Math.max(4, ...bins);
        bins.forEach((v, i) => { if (i % 2 === 0) items.push(P(boxMesh(0.18, (v / mx) * 0.9 + 0.02, 0.4, '#E88BF0', { spec: 0.5 }), [(i - 12) * 0.12, -1.15 + (v / mx) * 0.45, 0])); });
        objs.push({ id: 'galton', pos: [0, 0, 0], r: 1.4, label: 'Galton board', info: 'Each peg is a fair coin flip. Ten rows of Bernoulli trials produce a binomial distribution that converges on the normal curve.' });
      } else if (mode === 4) {
        const n = 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const pos: V3 = [Math.cos(a) * 1.3, Math.sin(a * 2) * 0.4, Math.sin(a) * 1.3];
          items.push(P(sphere(0.15, q, i % 3 ? '#E88BF0' : '#FF704F', { spec: 0.6 }), pos));
          const b = ((i + 1) / n) * TAU;
          items.push(P(tube([pos, [Math.cos(b) * 1.3, Math.sin(b * 2) * 0.4, Math.sin(b) * 1.3]], () => 0.025, 5, '#D7FF45', { emissive: 0.2 }), [0, 0, 0]));
        }
        objs.push({ id: 'graph', pos: [0, 0, 0], r: 1.5, label: 'Graph', info: 'Euler’s theorem: a walk crossing every edge exactly once exists only when zero or two vertices have odd degree.' });
      } else {
        const S = Math.round(p.surf ?? 0);
        items.push(P(surface((u, v) => {
          const x = (u - 0.5) * 3.4, z = (v - 0.5) * 3.4, r = Math.hypot(x, z);
          const y = S === 0 ? (x * x - z * z) * 0.2 * (p.amp ?? 0.7) : S === 1 ? Math.sin(r * 2.4 - t) * (p.amp ?? 0.7) * 0.5 : Math.sin(Math.atan2(z, x) * 3 + t) * 0.3 * (p.amp ?? 0.7);
          return [x, y, z];
        }, sg(q, 34), sg(q, 34), '#E88BF0', { spec: 0.55, rim: 0.6, doubleSided: true }), [0, 0, 0]));
        objs.push({ id: 'surface', pos: [0, 0, 0], r: 1.6, label: ['Hyperbolic paraboloid', 'Radial wave', 'Toroidal harmonic'][S], info: 'The saddle has negative Gaussian curvature: it curves up in one direction and down in the other, so it cannot be flattened without distortion.' });
      }
      caption = ['Fractal', 'Surface', 'Probability', 'Calculus', 'Graph theory'][mode];
      break;
    }
    case 'genetics': {
      items.push(P(helixMesh(q, p.twist ?? 3, p.unzip ?? 0.4), [0, 0, 0], 1, { rotY: t * 0.35 }));
      objs.push({ id: 'helix', pos: [0, 0.6, 0], r: 0.6, label: 'Double helix', info: 'Two antiparallel sugar-phosphate backbones with complementary base pairs inside: A–T and G–C. Real B-DNA makes one turn every 10.5 base pairs.' });
      objs.push({ id: 'fork', pos: [0, -0.7, 0], r: 0.5, label: 'Replication fork', info: 'Helicase unwinds the duplex; polymerase copies each strand 5′→3′. One strand is built continuously, the other in Okazaki fragments.' });
      if (mode === 2) {
        items.push(P(blob((th, phi) => { const r = 0.42 * (1 + 0.1 * Math.sin(th * 4)); return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 0.8, Math.sin(phi) * Math.sin(th) * r]; }, sg(q, 18), sg(q, 12), '#E4C580', { spec: 0.4 }), [0.9, -0.2, 0]));
        objs.push({ id: 'ribosome', pos: [0.9, -0.2, 0], r: 0.5, label: 'Ribosome', info: 'Reads mRNA three bases at a time and catalyses peptide bond formation. The standard code maps 64 codons to 20 amino acids plus stop.' });
      }
      caption = ['Replication', 'Transcription', 'Translation', 'Inheritance'][mode];
      break;
    }
    case 'evolution': {
      if (mode === 1) {
        items.push(P(blob((th, phi) => { const r = 1.15 * (1 + 0.04 * Math.sin(th * 3)); return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 0.8, Math.sin(phi) * Math.sin(th) * r]; }, sg(q, 26), sg(q, 18), '#7ED9A7', { spec: 0.4 }), [0, 0, 0], 1, { alpha: 0.28 }));
        items.push(P(sphere(0.36, q, '#B59AFF', { spec: 0.6 }), [-0.2, 0, 0]));
        objs.push({ id: 'nucleus', pos: [-0.2, 0, 0], r: 0.4, label: 'Nucleus', info: 'Houses the genome. Transcription happens here; translation happens outside in the cytoplasm.' });
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          const pos: V3 = [Math.cos(a) * 0.78, Math.sin(a * 2) * 0.25, Math.sin(a) * 0.78];
          items.push(P(ellipsoid(0.19, 0.1, 0.1, sg(q, 12), sg(q, 8), '#D7FF45', { emissive: 0.1 + (p.light ?? 0.6) * 0.3, spec: 0.5 }), pos, 1, { rotY: -a }));
          if (i === 0) objs.push({ id: 'chloroplast', pos, r: 0.3, label: 'Chloroplast', info: 'Photosynthesis saturates with light: beyond a point the enzymes, not the photons, are the limit.' });
        }
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + 1;
          items.push(P(ellipsoid(0.15, 0.08, 0.08, sg(q, 10), sg(q, 7), '#FF704F', { spec: 0.5 }), [Math.cos(a) * 0.55, Math.sin(a * 3) * 0.3, Math.sin(a) * 0.55], 1, { rotY: -a }));
        }
      } else {
        items.push(P(boxMesh(5, 0.12, 5, '#3A4030'), [0, -0.9, 0]));
        const agents = (m.agents ?? []) as { t: number; x: number; y: number }[];
        agents.slice(0, 46).forEach((a, i) => {
          const v = lerp(0.25, 0.95, a.t);
          const col = `rgb(${Math.round(v * 210)},${Math.round(v * 180)},${Math.round(v * 110)})`;
          const pos: V3 = [(a.x - 0.5) * 4.4, -0.7, (a.y - 0.5) * 4.4];
          items.push(P(blob((th, phi) => { const r = 0.13; return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 0.8, Math.sin(phi) * Math.sin(th) * r * 1.3]; }, sg(q, 8), sg(q, 6), col, { spec: 0.4 }), pos, 1, { rotY: a.x * 6 }));
          if (i === 0) objs.push({ id: 'organism', pos, r: 0.25, label: `Trait ${a.t.toFixed(2)}`, info: 'Fitness here is closeness to the environment tone. Predators remove the most conspicuous individuals; survivors breed with mutation.' });
        });
        const px = ((m.predX ?? 0) - 0.5) * 4.4;
        items.push(P(birdMesh(q, '#FF704F'), [px, 0.7, 0], 0.7, { rotY: Math.PI / 2 }));
        objs.push({ id: 'predator', pos: [px, 0.7, 0], r: 0.5, label: 'Predator', info: 'Selection pressure. Raise it and the population converges on the environment tone faster — but loses the variation it needs for future change.' });
      }
      caption = mode === 1 ? 'Plant cell' : `Generation ${m.gen ?? 0} · mean trait ${(m.mean ?? 0.5).toFixed(3)}`;
      break;
    }
    case 'animals': {
      const sp = Math.round(p.sp ?? 0);
      const fr = (p.speed * p.speed) / (9.81 * p.leg);
      if (sp <= 1) {
        const col = sp === 0 ? '#E4C580' : '#A8785A';
        const flex = sp === 0 && fr > 2.5 ? Math.sin((m.phase ?? 0) * TAU) * 0.12 : 0;
        items.push(P(quadruped(q, col, flex), [0, 0.2, 0], 1));
        objs.push({ id: 'body', pos: [0, 0.3, 0], r: 0.8, label: sp === 0 ? 'Cheetah' : 'Horse', info: `Froude number ${fr.toFixed(2)} — ${fr < 0.5 ? 'walking' : fr < 2.5 ? 'trotting' : 'galloping'}. The threshold is dimensionless, so it holds for mice and horses alike.` });
        const legPhase = (m.phase ?? 0) * TAU;
        [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], i) => {
          const ph = legPhase + (sz > 0 ? 0 : Math.PI) + (sx > 0 ? 0.4 : 0);
          items.push(P(legMesh(q, col, 0.075), [sx * 0.16, 0.05, sz * 0.42], 1, { rotX: Math.sin(ph) * (fr > 2.5 ? 0.7 : 0.4) }));
          if (i === 0) objs.push({ id: 'limb', pos: [sx * 0.16, -0.4, sz * 0.42], r: 0.35, label: 'Limb', info: 'Limb length sets the Froude scaling. Longer legs shift every gait transition to a higher absolute speed.' });
        });
      } else if (sp === 2) {
        const flap = Math.sin((m.phase ?? 0) * TAU) * clamp(p.flap / 3, 0.1, 1) * 0.6;
        items.push(P(birdMesh(q, '#F3EBDD'), [0, 0, 0], 1.2));
        [-1, 1].forEach((s) => items.push(P(wingMesh(q, '#E8E4D8', s * (0.9 + p.span)), [s * 0.1, 0.05, 0.05], 1, { rotZ: s * flap })));
        objs.push({ id: 'wing', pos: [1.2, 0.1, 0], r: 0.7, label: 'Wing', info: `Wing loading ${(p.mass / p.span).toFixed(1)} kg/m². Lift scales with v², so airspeed matters more than flapping effort for a soaring bird.` });
      } else {
        items.push(P(fishMesh(q, '#8FD8E8'), [0, 0, 0], 1.8, { rotY: Math.sin((m.phase ?? 0) * TAU) * 0.12 }));
        objs.push({ id: 'fish', pos: [0, 0, 0], r: 0.9, label: 'Tuna', info: 'A stiff, high-aspect-ratio tail generates thrust while the front two-thirds stays rigid — the signature of an efficient cruising swimmer.' });
      }
      caption = `${['Cheetah', 'Horse', 'Albatross', 'Tuna'][sp]} · Fr ${fr.toFixed(2)}`;
      break;
    }
    case 'plants': {
      items.push(P(soilBlock(q), [0, 0, 0]));
      const g = clamp(m.mass ?? 0.3, 0.02, 1);
      items.push(P(plantMesh(q, g), [0, 0, 0], 1));
      objs.push({ id: 'plant', pos: [0, 0.2, 0], r: 0.9, label: g < 0.05 ? 'Seedling' : g < 0.7 ? 'Vegetative growth' : 'Flowering', info: `Biomass ${(g * 100).toFixed(0)}%. Growth is capped by the scarcest resource — Liebig’s law of the minimum.` });
      objs.push({ id: 'soil', pos: [0, -1.4, 0.9], r: 0.6, label: 'Soil profile', info: 'Topsoil forms at roughly 0.1 mm per year. Water fills the pore space between mineral grains; roots need both water and air.' });
      for (let i = 0; i < 6; i++) {
        const a = t * 1.5 + i;
        items.push(P(dot3(0.035, q, '#8FD8E8', { emissive: 0.4 }), [Math.cos(a) * 0.25, -1.3 + ((t * 0.3 + i / 6) % 1) * (0.4 + g * 1.8), Math.sin(a) * 0.25]));
      }
      caption = `Day ${(m.day ?? 0).toFixed(0)} · biomass ${(g * 100).toFixed(0)}%`;
      break;
    }
    case 'weather': {
      ground = false;
      if (mode === 3) {
        items.push(P(earthGlobe(q, 0), [0, -0.2, 0], 1.1, { rotY: t * 0.1 }));
        items.push(P(sphere(1.35 + (p.co2 - 280) / 2400, q, '#FF704F', { emissive: 0.15 }), [0, -0.2, 0], 1, { alpha: 0.16 }));
        objs.push({ id: 'atmos', pos: [0, 1.2, 0], r: 0.7, label: 'Greenhouse shell', info: `CO₂ at ${p.co2} ppm gives ${(5.35 * Math.log(p.co2 / 280)).toFixed(2)} W/m² of radiative forcing. The shell thickens with concentration.` });
      } else if (mode === 1) {
        items.push(P(boxMesh(4, 0.9, 2.4, '#8FD8E8', { spec: 0.3 }), [0, 0.6, 0], 1, { alpha: 0.3, rotZ: 0.12 }));
        items.push(P(boxMesh(4, 0.9, 2.4, '#FF704F', { spec: 0.3 }), [0, -0.5, 0], 1, { alpha: 0.3, rotZ: -0.05 }));
        for (let i = 0; i < 16; i++) {
          const u = i / 15;
          const cx2 = -2 + u * 4, cy2 = 0.15 + u * 0.85;
          items.push(P(blob((th, phi) => { const r = 0.34 * (1 + 0.22 * Math.sin(th * 3 + i)); return [Math.sin(phi) * Math.cos(th) * r * 1.5, Math.cos(phi) * r * 0.6, Math.sin(phi) * Math.sin(th) * r]; }, sg(q, 12), sg(q, 8), '#F3EBDD', { spec: 0.2 }), [cx2, cy2, Math.sin(i * 2.3) * 0.5], 1, { alpha: 0.55 }));
        }
        for (let i = 0; i < 14; i++) {
          const u = ((t * 0.18 + i / 14) % 1);
          items.push(P(dot3(0.06, q, '#FF704F', { emissive: 0.35 }), [-2 + u * 4, -0.35 + u * 1.1, Math.cos(i * 1.7) * 0.6]));
          items.push(P(dot3(0.06, q, '#8FD8E8', { emissive: 0.3 }), [2 - u * 4, -0.75 + u * 0.15, Math.sin(i * 1.9) * 0.6]));
        }
        for (let i = 0; i < 22; i++) {
          const u = ((t * 0.5 + i / 22) % 1);
          items.push(P(dot3(0.03, q, '#8FD8E8', { emissive: 0.2 }), [-1.8 + (i % 11) * 0.36, 0.6 - u * 1.6, Math.sin(i) * 0.7]));
        }
        objs.push({ id: 'front', pos: [0, 0.1, 0], r: 1.4, label: 'Warm front', info: 'Less dense warm air rides up over the cold wedge, cooling adiabatically until vapour condenses into layered cloud and steady rain.' });
        objs.push({ id: 'warm', pos: [1.2, 0.7, 0], r: 0.6, label: 'Warm sector', info: 'Coral parcels are advancing warm air. It cannot displace the dense cold air beneath it, so it overruns it along a shallow slope.' });
        objs.push({ id: 'cold', pos: [-1.2, -0.7, 0], r: 0.6, label: 'Cold wedge', info: 'Blue parcels are the dense cold air mass. Its leading edge is the frontal surface.' });
      } else {
        const rings = mode === 2 ? 16 : 12;
        const intensity = clamp(((p.sst ?? 28) - 26) / 6, 0, 1) * (1 - (p.shear ?? 0.2));
        const dir = Math.sign(Math.sin((p.lat ?? 25) * Math.PI / 180)) || 1;
        for (let i = 0; i < rings; i++) {
          const v = i / (rings - 1);
          const r = mode === 2 ? 0.12 + v * v * 1.3 : 1.5 - v * 1.2;
          const y = mode === 2 ? -1.2 + v * 2.6 : -0.9 + v * 1.9;
          const skew = (p.shear ?? 0) * v * 0.9;
          items.push(P(torusMesh(r, 0.055 + intensity * 0.05, sg(q, 30), sg(q, 6), i % 3 === 0 ? '#F3EBDD' : '#8FD8E8', { emissive: 0.08 }), [skew, y, 0], 1, { rotY: t * (0.6 + intensity * 2) * dir / Math.max(0.2, r), alpha: 0.55 }));
        }
        objs.push({ id: 'vortex', pos: [0, 0, 0], r: 1.3, label: mode === 2 ? 'Tornado vortex' : 'Cyclone', info: `Coriolis f = ${(2 * 7.292e-5 * Math.sin((p.lat ?? 25) * Math.PI / 180)).toExponential(2)} s⁻¹. Rotation is ${dir > 0 ? 'counter-clockwise (northern hemisphere)' : 'clockwise (southern hemisphere)'}.` });
      }
      caption = ['Cyclone', 'Frontal system', 'Tornado', 'Greenhouse'][mode];
      break;
    }
    case 'micro': {
      ground = false;
      const agent = Math.round(p.agent ?? 0);
      const path = (m.cells ?? []) as { x: number; y: number; k: number }[];
      path.slice(0, 16).forEach((c, i) => {
        const pos: V3 = [(c.x - 0.5) * 3.4, (c.y - 0.5) * 2.2, Math.sin(i * 2.1) * 0.9];
        if (c.k === 0) {
          items.push(P(agent === 1 ? virusMesh(q, '#FF704F') : agent === 0 ? bacterium(q) : blob((th, phi) => { const r = 0.3; return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 1.3, Math.sin(phi) * Math.sin(th) * r]; }, sg(q, 14), sg(q, 10), '#E4C580', { spec: 0.4 }), pos, agent === 1 ? 0.7 : 0.8, { rotY: t * 0.4 + i }));
          if (i === 0) objs.push({ id: 'pathogen', pos, r: 0.45, label: ['Bacterium', 'Virus', 'Fungus'][agent], info: agent === 1 ? 'A capsid of protein around nucleic acid, with surface spikes that bind host receptors. Viruses have no metabolism of their own.' : agent === 0 ? 'A prokaryotic cell with flagella for motility. Antibiotics target bacterial structures — they do nothing to viruses.' : 'Eukaryotic cells with a chitin wall. Fungi are closer to animals than to plants.' });
        } else {
          items.push(P(immuneCell(q), pos, c.k === 1 ? 0.85 : 0.6));
          if (i === 1) objs.push({ id: 'immune', pos, r: 0.45, label: c.k === 1 ? 'Macrophage' : 'Lymphocyte', info: c.k === 1 ? 'Engulfs and digests pathogens, then presents fragments to the adaptive immune system.' : 'Produces antibodies tuned to one epitope. Memory cells make the second response faster and stronger.' });
        }
      });
      caption = `R₀ ${(p.beta / p.gamma).toFixed(2)} · infected ${((m.I ?? 0) * 100).toFixed(1)}%`;
      break;
    }
    case 'engineering': {
      if (mode === 0) {
        const n1 = Math.round(p.n1), n2 = Math.round(p.n2);
        const r1 = 0.35 + n1 * 0.022, r2 = 0.35 + n2 * 0.022;
        items.push(P(gearMesh(n1, r1, 0.22, '#D7FF45', q), [-r1 - 0.05, 0, 0], 1, { rotY: m.a ?? 0 }));
        items.push(P(gearMesh(n2, r2, 0.22, '#FF704F', q), [r2 + 0.05, 0, 0], 1, { rotY: -(m.a ?? 0) * n1 / n2 }));
        objs.push({ id: 'driver', pos: [-r1 - 0.05, 0, 0], r: r1, label: `Driver ${n1}T`, info: `${p.rpm} rpm input. Gear ratio ${ (n2 / n1).toFixed(2)}:1 multiplies torque by the same factor and divides speed.` });
        objs.push({ id: 'driven', pos: [r2 + 0.05, 0, 0], r: r2, label: `Driven ${n2}T`, info: `Output ${(p.rpm * n1 / n2).toFixed(0)} rpm at ${(p.torque * n2 / n1).toFixed(1)} N·m. Power is conserved apart from friction.` });
      } else if (mode === 2) {
        const s1 = 0.22, s2 = 0.22 * Math.sqrt(p.area);
        items.push(P(lathe([[s1, -0.9], [s1, 0.3]], sg(q, 16), '#8FD8E8', { spec: 0.7 }), [-1.1, 0, 0], 1, { alpha: 0.5 }));
        items.push(P(lathe([[s2, -0.9], [s2, 0.1]], sg(q, 20), '#8FD8E8', { spec: 0.7 }), [1.1, 0, 0], 1, { alpha: 0.5 }));
        items.push(P(lathe([[s1 * 0.9, 0], [s1 * 0.9, 0.12]], sg(q, 14), '#C9C4B4', { spec: 0.8 }), [-1.1, 0.3 - (m.press ?? 0) * 0.4, 0]));
        items.push(P(lathe([[s2 * 0.9, 0], [s2 * 0.9, 0.12]], sg(q, 18), '#C9C4B4', { spec: 0.8 }), [1.1, 0.1 + (m.press ?? 0) * 0.4 / p.area, 0]));
        items.push(P(tube([[-1.1, -0.9, 0], [1.1, -0.9, 0]], () => 0.09, sg(q, 8), '#4A4438'), [0, 0, 0]));
        objs.push({ id: 'press', pos: [1.1, 0.2, 0], r: 0.7, label: 'Output piston', info: `Pascal’s law: pressure is transmitted undiminished, so ${p.load} kN becomes ${(p.load * p.area).toFixed(0)} kN — but the piston moves ${p.area}× less far. Work is conserved.` });
      } else if (mode === 3) {
        const n = 6, span = 3.6;
        for (let i = 0; i <= n; i++) {
          const x = (i / n - 0.5) * span;
          items.push(P(boxMesh(0.09, 0.09, 0.5, '#D7FF45', { spec: 0.6 }), [x, -0.5, 0]));
          if (i < n) {
            const x2 = ((i + 1) / n - 0.5) * span;
            items.push(P(tube([[x, -0.5, 0], [x2, -0.5, 0]], () => 0.05, 5, '#D7FF45'), [0, 0, 0]));
            items.push(P(tube([[x, -0.5, 0], [(x + x2) / 2, 0.3, 0]], () => 0.05, 5, '#FF704F'), [0, 0, 0]));
            items.push(P(tube([[(x + x2) / 2, 0.3, 0], [x2, -0.5, 0]], () => 0.05, 5, '#D7FF45'), [0, 0, 0]));
            items.push(P(tube([[(x + x2) / 2, 0.3, 0], [(x + x2) / 2 + span / n, 0.3, 0]], () => 0.05, 5, '#FF704F'), [0, 0, 0]));
          }
        }
        objs.push({ id: 'truss', pos: [0, 0, 0], r: 1.6, label: 'Truss bridge', info: 'Coral members are in compression, lime in tension. Triangles are the only inherently rigid polygon — that is why every truss is built from them.' });
      } else if (mode === 4) {
        items.push(P(turbineMesh(q), [0, 0, 0], 1));
        for (let b = 0; b < 3; b++) items.push(P(bladeMesh(q), [0, 0.6, 0.16], 1, { rotZ: (m.a ?? 0) + b * TAU / 3 }));
        objs.push({ id: 'turbine', pos: [0, 0.6, 0], r: 1.2, label: 'Rotor', info: 'Betz’s limit caps extraction at 59.3% of the kinetic energy in the wind — taking more would stop the air behind the disc.' });
      } else {
        const a = m.a ?? 0;
        const O: V3 = [-1.2, -0.3, 0], A2: V3 = [O[0] + Math.cos(a) * p.crank, O[1] + Math.sin(a) * p.crank, 0];
        items.push(P(tube([O, A2], () => 0.07, sg(q, 8), '#D7FF45', { spec: 0.6 }), [0, 0, 0]));
        items.push(P(tube([A2, [0.6, 0.5, 0]], () => 0.06, sg(q, 8), '#FF704F', { spec: 0.6 }), [0, 0, 0]));
        items.push(P(tube([[0.6, 0.5, 0], [1.3, -0.3, 0]], () => 0.06, sg(q, 8), '#B59AFF', { spec: 0.6 }), [0, 0, 0]));
        [O, A2, [0.6, 0.5, 0] as V3, [1.3, -0.3, 0] as V3].forEach((j) => items.push(P(sphere(0.1, q, '#F3EBDD', { spec: 0.8 }), j)));
        objs.push({ id: 'linkage', pos: A2, r: 0.4, label: 'Four-bar linkage', info: 'Grashof’s condition decides whether the crank can rotate fully. The coupler traces a curve no simple cam can reproduce.' });
      }
      caption = ['Gear train', 'Four-bar linkage', 'Hydraulic press', 'Truss bridge', 'Turbine'][mode];
      break;
    }
    case 'electronics': {
      items.push(P(boxMesh(3.2, 0.12, 2.2, '#1E3A24', { spec: 0.4 }), [0, -0.5, 0]));
      const trace = (a: V3, b: V3, col = '#C9B87A') => items.push(P(tube([a, b], () => 0.022, 4, col, { spec: 0.8, emissive: 0.1 }), [0, 0, 0]));
      trace([-1.4, -0.42, -0.8], [1.4, -0.42, -0.8]);
      trace([-1.4, -0.42, 0.8], [1.4, -0.42, 0.8]);
      trace([-1.4, -0.42, -0.8], [-1.4, -0.42, 0.8]);
      const I = mode === 1 ? p.v / p.r1 + p.v / p.r2 : p.v / (p.r1 + (mode === 0 ? p.r2 : 0));
      const resistor = (x: number, z: number, col: string) => {
        items.push(P(lathe([[0.11, -0.24], [0.13, -0.14], [0.13, 0.14], [0.11, 0.24]], sg(q, 12), col, { spec: 0.5 }), [x, -0.3, z], 1, { rotZ: Math.PI / 2 }));
        [0, 1, 2].forEach((k) => items.push(P(torusMesh(0.135, 0.02, sg(q, 12), 4, ['#2A2A24', '#FF704F', '#FFD24A'][k]), [x - 0.1 + k * 0.1, -0.3, z], 1, { rotZ: Math.PI / 2 })));
      };
      resistor(-0.5, -0.8, '#D8C8A8');
      if (mode === 0) resistor(0.5, 0.8, '#D8C8A8');
      if (mode === 1) resistor(1.2, 0, '#D8C8A8');
      if (mode === 2) {
        items.push(P(lathe([[0.22, -0.3], [0.22, 0.35]], sg(q, 16), '#2A3A5A', { spec: 0.6 }), [0.6, -0.15, 0.4]));
        items.push(P(torusMesh(0.22, 0.03, sg(q, 16), 5, '#C9C4B4'), [0.6, 0.1, 0.4]));
        objs.push({ id: 'cap', pos: [0.6, 0, 0.4], r: 0.45, label: `${p.cap} µF`, info: `τ = RC = ${((p.r1 * p.cap) / 1000).toFixed(1)} ms. The capacitor reaches 63.2% of supply after one time constant.` });
      }
      if (mode === 4) {
        items.push(P(chipMesh(q, 'gate'), [0.3, -0.35, 0], 0.65));
        objs.push({ id: 'ic', pos: [0.3, -0.1, 0], r: 0.6, label: 'Logic IC', info: 'NAND is functionally complete: every boolean function can be built from NAND gates alone.' });
      }
      items.push(P(lathe([[0.16, -0.2], [0.16, 0.2]], sg(q, 12), '#3A3A34', { spec: 0.6 }), [-1.35, -0.3, 0]));
      const bright = clamp(I * 40, 0.05, 1);
      items.push(P(sphere(0.13, q, '#D7FF45', { emissive: bright }), [1.35, -0.2, 0]));
      objs.push({ id: 'led', pos: [1.35, -0.2, 0], r: 0.3, label: 'Indicator', info: `Current ${(I * 1000).toFixed(2)} mA. LED brightness follows current, not voltage.` });
      for (let i = 0; i < 14; i++) {
        const u = ((t * clamp(I * 6, 0.1, 3) + i / 14) % 1);
        const per = u * 4;
        const pos: V3 = per < 1 ? [-1.4 + per * 2.8, -0.38, -0.8] : per < 2 ? [1.4, -0.38, -0.8 + (per - 1) * 1.6] : per < 3 ? [1.4 - (per - 2) * 2.8, -0.38, 0.8] : [-1.4, -0.38, 0.8 - (per - 3) * 1.6];
        items.push(P(dot3(0.04, q, '#D7FF45', { emissive: 0.7 }), pos));
      }
      caption = `${['Series R', 'Parallel R', 'RC charge', 'Rectifier', 'Logic'][mode]} · ${(I * 1000).toFixed(2)} mA`;
      break;
    }
    case 'computers': {
      if (mode === 1) {
        const n = Math.round(p.size), arr = (m.arr ?? []) as number[];
        for (let i = 0; i < n; i++) {
          const h = (arr[i] / 100) * 1.8 + 0.05;
          const active = i === m.j || i === m.j + 1;
          items.push(P(boxMesh(2.8 / n * 0.8, h, 0.4, m.done ? '#D7FF45' : active ? '#FF704F' : '#8FD8E8', { spec: 0.5, emissive: active ? 0.25 : 0 }), [(i / (n - 1) - 0.5) * 3, -0.9 + h / 2, 0]));
        }
        objs.push({ id: 'array', pos: [0, 0, 0], r: 1.6, label: 'Array', info: `${m.cmp ?? 0} comparisons, ${m.swp ?? 0} swaps. Comparison count is the honest measure of an algorithm’s cost.` });
      } else if (mode === 3) {
        const n = Math.round(p.layers ?? 5);
        for (let i = 0; i < n; i++) {
          const w = 2.4 - i * 0.22;
          items.push(P(boxMesh(w, 0.16, w * 0.65, i === Math.floor((t * 0.6) % n) ? '#D7FF45' : '#8FD8E8', { spec: 0.6, emissive: 0.08 }), [0, 1.1 - i * 0.36, 0], 1, { alpha: 0.85 }));
        }
        items.push(P(boxMesh(1.0, 0.22, 0.7, '#2A3038', { spec: 0.7 }), [-1.9, -0.9, 0]));
        items.push(P(boxMesh(1.0, 0.22, 0.7, '#2A3038', { spec: 0.7 }), [1.9, -0.9, 0]));
        for (let i = 0; i < 8; i++) {
          items.push(P(boxMesh(0.07, 0.05, 0.05, i % 3 ? '#D7FF45' : '#FF704F', { emissive: 0.5 }), [-2.25 + i * 0.1, -0.78, 0.34]));
          items.push(P(boxMesh(0.07, 0.05, 0.05, i % 2 ? '#8FD8E8' : '#D7FF45', { emissive: 0.5 }), [1.55 + i * 0.1, -0.78, 0.34]));
        }
        items.push(P(tube(spline([[-1.9, -0.78, 0], [-0.9, -1.25, 0.4], [0.9, -1.25, 0.4], [1.9, -0.78, 0]], sg(q, 18)), () => 0.035, sg(q, 7), '#E4C580', { spec: 0.5 }), [0, 0, 0]));
        for (let i = 0; i < 5; i++) {
          const u = ((t * 0.35 + i / 5) % 1);
          const px = -1.9 + u * 3.8;
          items.push(P(boxMesh(0.16, 0.16, 0.16, '#D7FF45', { emissive: 0.4, spec: 0.6 }), [px, -1.15 + Math.sin(u * Math.PI) * -0.1, 0.35]));
        }
        objs.push({ id: 'stack', pos: [0, 0.3, 0], r: 1.2, label: 'OSI stack', info: 'The payload gains a header at each layer going down and loses one coming up. Routers read only the network layer.' });
        objs.push({ id: 'router', pos: [-1.9, -0.9, 0], r: 0.6, label: 'Router', info: 'Reads the network-layer header, consults a forwarding table and re-encapsulates the packet in a new link-layer frame.' });
        objs.push({ id: 'host', pos: [1.9, -0.9, 0], r: 0.6, label: 'Destination host', info: 'Strips headers layer by layer until only the original payload reaches the application.' });
      } else {
        items.push(P(chipMesh(q, 'cpu'), [0, -0.3, 0], 1.2));
        objs.push({ id: 'cpu', pos: [0, 0, 0], r: 1, label: 'Processor', info: `PC=${m.pc ?? 0}, ACC=${m.acc ?? 0}, ${m.cycles ?? 0} cycles. Every program is fetch → decode → execute, billions of times a second.` });
        for (let i = 0; i < 8; i++) {
          const on = ((m.acc ?? 0) >> i) & 1;
          items.push(P(boxMesh(0.14, 0.1, 0.14, on ? '#D7FF45' : '#2A2A24', { emissive: on ? 0.5 : 0, spec: 0.6 }), [(i - 3.5) * 0.2, 0.1, 1.0]));
        }
        objs.push({ id: 'alu', pos: [0, 0.1, 1.0], r: 0.7, label: 'Accumulator (binary)', info: `Register holds ${m.acc ?? 0} = ${(m.acc ?? 0).toString(2)}. Each lit block is one power of two.` });
      }
      caption = ['CPU cycle', 'Sorting', 'Binary', 'Network stack'][mode];
      break;
    }
    case 'ai': {
      if (mode === 2) {
        const L1 = 1.0, L2 = 0.85;
        const a1 = Math.sin(t * 0.6) * 0.7 - 0.9, a2 = Math.cos(t * 0.4) * 0.9 + 1.2;
        const j: V3 = [Math.cos(a1) * L1, Math.sin(a1) * L1 - 0.6, 0];
        const h: V3 = [j[0] + Math.cos(a1 + a2) * L2, j[1] + Math.sin(a1 + a2) * L2, 0];
        items.push(P(lathe([[0.35, -0.15], [0.3, 0.1]], sg(q, 16), '#4A4438', { spec: 0.6 }), [0, -1.0, 0]));
        items.push(P(tube([[0, -0.9, 0], j], () => 0.11, sg(q, 10), '#E88BF0', { spec: 0.6 }), [0, 0, 0]));
        items.push(P(tube([j, h], () => 0.085, sg(q, 10), '#B59AFF', { spec: 0.6 }), [0, 0, 0]));
        items.push(P(sphere(0.15, q, '#F3EBDD', { spec: 0.8 }), j));
        items.push(P(boxMesh(0.16, 0.2, 0.1, '#D7FF45', { emissive: 0.3 }), h));
        objs.push({ id: 'arm', pos: h, r: 0.4, label: 'End effector', info: 'Two-link inverse kinematics: the law of cosines gives the elbow angle, then the shoulder follows. Beyond the reach circle no solution exists.' });
      } else if (mode === 3) {
        for (let i = 0; i < 36; i++) {
          const r = Math.floor(i / 6), c = i % 6;
          const wall = (m.grid ?? [])[i] === 1;
          const v = Math.max(...((m.q ?? [])[i] ?? [0]));
          items.push(P(boxMesh(0.42, wall ? 0.5 : 0.08 + clamp(v, 0, 1) * 0.4, 0.42, wall ? '#4A4438' : '#D7FF45', { spec: 0.5, emissive: wall ? 0 : clamp(v, 0, 1) * 0.3 }), [(c - 2.5) * 0.46, -0.6, (r - 2.5) * 0.46]));
        }
        const s = m.s ?? 0;
        items.push(P(sphere(0.16, q, '#FF704F', { emissive: 0.4 }), [((s % 6) - 2.5) * 0.46, -0.2, (Math.floor(s / 6) - 2.5) * 0.46]));
        objs.push({ id: 'agent', pos: [0, 0, 0], r: 1.4, label: 'Q-learning agent', info: `${m.wins ?? 0} successful runs. Each cell stores four action values; the agent exploits the best arrow and explores ε of the time.` });
      } else {
        const H = Math.round(p.hidden ?? 4);
        const layers = [2, H, 1];
        const posOf = (li: number, i: number, n: number): V3 => [(li - 1) * 1.3, ((i + 1) / (n + 1) - 0.5) * 2.0, 0];
        layers.forEach((n, li) => {
          for (let i = 0; i < n; i++) {
            const pos = posOf(li, i, n);
            items.push(P(sphere(0.16, q, li === 2 ? '#D7FF45' : '#E88BF0', { emissive: li === 2 ? 0.3 : 0.12, spec: 0.6 }), pos));
            if (li < 2) for (let k = 0; k < layers[li + 1]; k++) {
              const w = li === 0 ? (m.w?.[0]?.[k]?.[i] ?? 0) : (m.w?.[1]?.[i] ?? 0);
              items.push(P(tube([pos, posOf(li + 1, k, layers[li + 1])], () => 0.012 + Math.min(0.03, Math.abs(w) * 0.012), 4, w > 0 ? '#FF704F' : '#B59AFF', { emissive: 0.1 }), [0, 0, 0], 1, { alpha: 0.75 }));
            }
          }
        });
        objs.push({ id: 'net', pos: [0, 0, 0], r: 1.6, label: 'Multilayer perceptron', info: `Loss ${(m.loss ?? 1).toFixed(5)} after ${m.epoch ?? 0} epochs. Coral weights are positive, lavender negative. XOR needs a hidden layer because it is not linearly separable.` });
      }
      caption = ['Training', 'Decision surface', 'Robot arm', 'Reinforcement learning'][mode];
      break;
    }
    case 'architecture': {
      const F = Math.round(p.floors ?? 14);
      const mat = ['#8FD8E8', '#D8D2C4', '#C9A45C'][Math.round(p.mat ?? 0)];
      items.push(P(towerMesh(q, F, mat), [0, 0, 0], 1, { rotZ: (m.sway ?? 0) * 0.09 }));
      objs.push({ id: 'tower', pos: [0, 0.6, 0], r: 1.1, label: `${F}-storey ${['steel', 'concrete', 'timber'][Math.round(p.mat ?? 0)]} frame`, info: `Wind pressure ${(0.5 * 1.225 * p.wind * p.wind / 1000).toFixed(2)} kPa. Tall buildings are usually governed by stiffness and occupant comfort, not strength.` });
      objs.push({ id: 'base', pos: [0, -1.4, 0], r: 0.7, label: 'Foundation', info: 'Loads collect at the base. Utilisation there sets the member sizes for the whole structure.' });
      for (let i = 0; i < 5; i++) items.push(P(tube([[-2.2, -1 + i * 0.55, 0], [-0.8, -1 + i * 0.55, 0]], () => 0.02, 4, '#D7FF45', { emissive: 0.2 }), [0, 0, 0], 1, { alpha: clamp(p.wind / 40, 0.1, 0.8) }));
      caption = `${F} floors · ${p.wind} m/s wind · ${(Math.abs(m.sway ?? 0) * 1000).toFixed(0)} mm tip deflection`;
      break;
    }
    case 'aviation': {
      const aoa = (p.aoa ?? 5) * Math.PI / 180;
      items.push(P(aircraft(q), [0, 0, 0], 0.85, { rotX: -aoa, rotY: Math.PI * 0.12 }));
      objs.push({ id: 'aircraft', pos: [0, 0, 0], r: 1.4, label: 'Aircraft', info: `Angle of attack ${p.aoa}°. ${(p.aoa ?? 0) > 15 ? 'Past the critical angle the boundary layer separates and lift collapses — reduce AoA to recover.' : 'Lift grows with the square of airspeed and linearly with angle of attack until stall.'}` });
      objs.push({ id: 'wing', pos: [1.2, 0, 0], r: 0.6, label: 'Wing', info: `C_D = C_D0 + kC_L². Induced drag dominates slowly, parasite drag fast — their sum sets the best-glide speed.` });
      for (let i = 0; i < 7; i++) {
        const y = (i - 3) * 0.22;
        const sep = (p.aoa ?? 0) > 15 && i < 3 ? Math.sin(t * 8 + i) * 0.15 : 0;
        items.push(P(tube(spline([[-1.8, y + 0.3, 0], [-0.4, y + 0.12, 0], [0.6, y + sep, 0], [1.9, y + sep * 2, 0]], sg(q, 12)), () => 0.012, 4, (p.aoa ?? 0) > 15 && i < 3 ? '#FF704F' : '#8FD8E8', { emissive: 0.2 }), [0, 0, 0], 1, { alpha: 0.55 }));
      }
      caption = `${(m.v ?? 0).toFixed(0)} m/s · ${(m.alt ?? 0).toFixed(0)} m · ${m.stalled ? 'STALLED' : 'flying'}`;
      break;
    }
    case 'autos': {
      if (mode === 0) {
        const phase = ((m.crank ?? 0) % (TAU * 2)) / (TAU * 2);
        const stroke = Math.floor(phase * 4);
        const py = -Math.cos(m.crank ?? 0) * 0.35;
        items.push(P(lathe([[0.42, -0.9], [0.42, 0.9]], sg(q, 20), '#8FD8E8', { spec: 0.8 }), [0, 0, 0], 1, { alpha: 0.22 }));
        items.push(P(lathe([[0.38, -0.12], [0.38, 0.12]], sg(q, 18), '#C9C4B4', { spec: 0.8 }), [0, py + 0.2, 0]));
        items.push(P(tube([[0, py + 0.08, 0], [Math.sin(m.crank ?? 0) * 0.35, -1.1 + Math.cos(m.crank ?? 0) * 0.35, 0]], () => 0.07, sg(q, 8), '#8E8878', { spec: 0.7 }), [0, 0, 0]));
        items.push(P(lathe([[0.35, -0.08], [0.35, 0.08]], sg(q, 16), '#6B6458', { spec: 0.7 }), [0, -1.1, 0]));
        [-1, 1].forEach((s) => items.push(P(lathe([[0.13, 0], [0.05, 0.22]], sg(q, 10), s < 0 ? '#8FD8E8' : '#FF704F', { spec: 0.7 }), [s * 0.2, 0.9 + ((s < 0 ? stroke === 0 : stroke === 3) ? 0.12 : 0), 0])));
        if (stroke === 2) items.push(P(sphere(0.3, q, '#FFD24A', { emissive: 0.9 }), [0, 0.65, 0], 1 + Math.sin(t * 30) * 0.15));
        objs.push({ id: 'engine', pos: [0, 0.2, 0], r: 1, label: ['Intake', 'Compression', 'Power', 'Exhaust'][stroke], info: `Two crankshaft revolutions complete one cycle. At ${p.rpm} rpm that is ${(p.rpm / 120).toFixed(1)} power strokes per second in this cylinder.` });
      } else {
        const ex = mode === 3 ? (p.explode ?? 0) : 0;
        items.push(P(carBody(q, '#FF704F'), [0, 0.1 + ex * 0.5, 0], 1));
        [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => items.push(P(wheelMesh(0.34, 0.22, q), [sx * (0.48 + ex * 0.5), -0.28 - ex * 0.3, sz * 0.78], 1, { rotZ: Math.PI / 2, rotY: (m.crank ?? 0) * 0.3 })));
        if (ex > 0.1) {
          items.push(P(boxMesh(0.7, 0.4, 0.9, '#8E8878', { spec: 0.7 }), [0, 0.1 + ex * 1.5, 0.7]));
          items.push(P(boxMesh(0.9, 0.2, 1.1, '#D7FF45', { spec: 0.6 }), [0, -0.3 - ex * 1.1, -0.2]));
        }
        objs.push({ id: 'car', pos: [0, 0.2, 0], r: 1.3, label: 'Vehicle', info: `At ${p.speed} km/h the car carries ${(0.5 * p.mass * Math.pow(p.speed / 3.6, 2) / 1000).toFixed(0)} kJ. Braking distance grows with the square of speed.` });
        objs.push({ id: 'wheel', pos: [0.48, -0.28, 0.78], r: 0.4, label: 'Tyre contact', info: `Friction limit µg = ${((p.abs ? p.mu : p.mu * 0.75) * 9.81).toFixed(1)} m/s². ABS keeps the tyre near peak slip instead of locked sliding.` });
      }
      caption = ['4-stroke engine', 'EV drivetrain', 'Braking', 'Exploded assembly'][mode];
      break;
    }
    case 'energy': {
      const sun = Math.max(0, Math.sin((((m.t ?? 12) - 6) / 12) * Math.PI));
      for (let i = 0; i < 3; i++) {
        const x = -2 + i * 0.9;
        items.push(P(turbineMesh(q), [x, 0.2, -1.2], 0.55));
        for (let b = 0; b < 3; b++) items.push(P(bladeMesh(q), [x, 0.53, -1.1], 0.55, { rotZ: t * clamp(p.wind / 6, 0, 4) + b * TAU / 3 }));
      }
      objs.push({ id: 'wind', pos: [-1.1, 0.5, -1.2], r: 0.9, label: 'Wind farm', info: `P = ½ρAv³Cp. At ${p.wind} m/s the cube law gives ${Math.pow(p.wind / 9, 3).toFixed(1)}× the output at 9 m/s.` });
      for (let i = 0; i < 6; i++) items.push(P(boxMesh(0.55, 0.04, 0.4, '#2A3A5A', { spec: 0.85, emissive: sun * 0.25 }), [0.6 + (i % 3) * 0.62, -0.55, 0.5 + Math.floor(i / 3) * 0.5], 1, { rotX: -0.5 }));
      objs.push({ id: 'solar', pos: [1.2, -0.5, 0.7], r: 0.8, label: 'Solar array', info: `Irradiance follows the sun’s elevation. Current output ${(sun * p.solar).toFixed(1)} GW from ${p.solar} GW of capacity.` });
      items.push(P(lathe([[0.5, -0.9], [0.34, 0.1], [0.42, 0.5]], sg(q, 20), '#C9C4B4', { spec: 0.5 }), [2.1, 0, -0.8]));
      objs.push({ id: 'nuclear', pos: [2.1, 0, -0.8], r: 0.6, label: 'Baseload plant', info: `${p.nuclear} GW of steady output. Nuclear does not ramp quickly, which is why storage and flexible demand matter.` });
      for (let i = 0; i < 8; i++) {
        const h = 0.3 + ((i * 37) % 11) / 11 * 0.9;
        items.push(P(boxMesh(0.3, h, 0.3, '#3A3A34', { spec: 0.4, emissive: (m.served ?? 1) > 0.98 ? 0.12 : 0 }), [-1.6 + i * 0.42, -0.9 + h / 2, 1.5]));
      }
      objs.push({ id: 'city', pos: [0, -0.4, 1.5], r: 1.2, label: 'Demand centre', info: (m.served ?? 1) > 0.98 ? 'Supply meets demand. Frequency is stable.' : 'Load shedding: generation plus storage cannot cover demand, so the operator disconnects customers.' });
      caption = `${(m.served ?? 1) > 0.98 ? 'Grid balanced' : 'LOAD SHEDDING'} · storage ${((m.soc ?? 0) * 100).toFixed(0)}%`;
      break;
    }
    case 'agriculture': {
      items.push(P(soilBlock(q), [0, 0, 0], 1.1));
      const plots = (m.plots ?? []) as { g: number; health: number }[];
      plots.slice(0, 6).forEach((pl, i) => {
        const x = (i % 3 - 1) * 0.75, z = (Math.floor(i / 3) - 0.5) * 0.8;
        items.push(P(plantMesh(q, clamp(pl.g, 0.05, 1)), [x, 0.35, z], 0.42));
        if (i === 0) objs.push({ id: 'crop', pos: [x, 0.5, z], r: 0.5, label: `${['Wheat', 'Maize', 'Soybean', 'Tomato'][Math.round(p.crop ?? 0)]} plot`, info: `Growth ${(pl.g * 100).toFixed(0)}%, health ${(pl.health * 100).toFixed(0)}%. Yield is capped by the scarcest input.` });
      });
      for (let i = 0; i < Math.round((p.bees ?? 0.6) * 8); i++) {
        const a = t * 2 + i;
        items.push(P(dot3(0.04, q, '#FFD24A', { emissive: 0.3 }), [Math.cos(a) * 1.1, 0.5 + Math.sin(a * 2) * 0.25, Math.sin(a * 1.3) * 0.9]));
      }
      objs.push({ id: 'soil', pos: [0, -1.4, 0.9], r: 0.7, label: 'Soil profile', info: `Moisture ${((m.soilW ?? 0.5) * 100).toFixed(0)}%. Over-irrigation leaches nitrate past the root zone instead of feeding it.` });
      caption = `Day ${(m.day ?? 0).toFixed(0)} · stored ${m.store ?? 0} kg`;
      break;
    }
    case 'psychology': {
      ground = false;
      if (mode === 3) {
        const B = AN.brain(q);
        B.hemis.forEach((h) => items.push(P(h, [0, 0, 0], 3.4)));
        items.push(P(B.cerebellum, [0, -0.21, -0.26], 3.4));
        items.push(P(B.stem, [0, -0.21, -0.07], 3.4));
        objs.push({ id: 'brain', pos: [0, 0, 0], r: 1.3, label: 'Sleeping brain', info: 'Sleep runs in ~90-minute cycles. Deep slow-wave sleep is front-loaded; REM lengthens toward morning, so a short night removes REM disproportionately.' });
      } else {
        items.push(P(eyeModel(q), [-0.9, 0, 0], 1));
        objs.push({ id: 'eye', pos: [-0.9, 0, 0], r: 0.8, label: 'Eye', info: 'Light is refracted by the cornea and lens onto the retina. The optic nerve carries ~1 million ganglion axons to the lateral geniculate nucleus.' });
        const B = AN.brain(q);
        B.hemis.forEach((h) => items.push(P(h, [1.1, 0, 0], 2.2)));
        items.push(P(B.cerebellum, [1.1, -0.14, -0.17], 2.2));
        objs.push({ id: 'cortex', pos: [1.1, 0, 0], r: 0.9, label: 'Cortex', info: 'Simple visual reaction time is typically 200–300 ms: retinal transduction, cortical processing, motor planning and muscle activation all take time.' });
        items.push(P(tube(spline([[-0.35, 0, -0.4], [0.3, -0.1, -0.5], [0.75, 0, -0.2]], sg(q, 12)), () => 0.05, sg(q, 7), '#E4E86A', { emissive: 0.3 }), [0, 0, 0]));
        for (let i = 0; i < 5; i++) {
          const u = ((t * 0.7 + i / 5) % 1);
          items.push(P(dot3(0.05, q, '#D7FF45', { emissive: 0.6 }), [-0.35 + u * 1.1, -0.1 * Math.sin(u * Math.PI), -0.4 - 0.1 * Math.sin(u * Math.PI)]));
        }
      }
      caption = ['Reaction time', 'Stroop', 'Memory span', 'Sleep architecture'][mode] + ' — switch off 3D scene to run the test full-size';
      break;
    }
    case 'forensics': {
      if (mode === 0) {
        items.push(P(ridgeMesh(q, Math.round(p.pattern ?? 0), p.ridge ?? 14), [-1, 0, 0], 1));
        items.push(P(ridgeMesh(q, Math.round(p.pattern ?? 0), p.ridge ?? 14), [1, 0, 0], 1, { alpha: 0.85 }));
        objs.push({ id: 'latent', pos: [-1, 0.2, 0], r: 0.9, label: 'Latent print', info: 'Examiners compare ridge flow and minutiae — bifurcations and endings. Pattern class narrows the field; minutiae carry the identification.' });
        objs.push({ id: 'reference', pos: [1, 0.2, 0], r: 0.9, label: 'Reference print', info: `Quality ${(p.noise * 100).toFixed(0)}%. A degraded lift with few minutiae should be reported inconclusive, not forced to a match.` });
      } else if (mode === 1) {
        const n = Math.round(p.loci ?? 13);
        for (let i = 0; i < n; i++) {
          const h1 = 0.3 + ((i * 17) % 11) / 11 * 1.2, h2 = 0.3 + ((i * 29) % 13) / 13 * 1.2;
          items.push(P(boxMesh(0.12, h1, 0.12, '#D7FF45', { emissive: 0.2 }), [(i / (n - 1) - 0.5) * 3.2, -0.9 + h1 / 2, -0.2]));
          items.push(P(boxMesh(0.12, h2, 0.12, '#B59AFF', { emissive: 0.2 }), [(i / (n - 1) - 0.5) * 3.2, -0.9 + h2 / 2, 0.2]));
        }
        objs.push({ id: 'gel', pos: [0, 0, 0], r: 1.6, label: 'STR profile', info: `Random match probability ≈ 1 in ${Math.pow(1 / (2 * p.freq * (1 - p.freq)), n).toExponential(1)}. That is the chance a random person matches — not the chance the suspect is innocent.` });
      } else if (mode === 2) {
        items.push(P(boxMesh(4, 0.1, 2.4, '#3A342C'), [0, -0.9, 0]));
        for (let i = 0; i < 5; i++) {
          items.push(P(ellipsoid(0.16, 0.04, 0.42, sg(q, 12), sg(q, 8), '#E4C580', { spec: 0.4 }), [-1.5 + i * (p.stride / 100), -0.82, i % 2 ? 0.35 : -0.35], 1, { rotY: i % 2 ? 0.1 : -0.1 }));
        }
        objs.push({ id: 'print', pos: [0, -0.8, 0], r: 1.2, label: 'Footwear impressions', info: `Stature ≈ ${(p.foot * 6.6).toFixed(0)} cm from foot length; stride implies ${((p.stride / 100) / 0.75).toFixed(1)} m/s. Population regressions — supportive, never an identification.` });
      } else {
        items.push(P(boxMesh(4, 0.1, 3, '#2A2A24'), [0, -0.9, 0]));
        (m.evidence ?? []).forEach((ev: { t: string; txt: string }, i: number) => {
          const a = (i / 5) * TAU;
          const pos: V3 = [Math.cos(a) * 1.3, -0.7, Math.sin(a) * 1.0];
          items.push(P(lathe([[0.14, 0], [0.02, 0.34]], sg(q, 10), '#FFD24A', { spec: 0.6 }), pos));
          objs.push({ id: `ev${i}`, pos: [pos[0], -0.4, pos[2]], r: 0.35, label: `${ev.t} — ${ev.txt}`, info: 'Every item needs an unbroken chain of custody, or its interpretation collapses in court.' });
        });
      }
      caption = ['Fingerprints', 'DNA profile', 'Footwear & gait', 'Case timeline'][mode];
      break;
    }
    case 'future': {
      if (Math.round(p.view ?? 0) === 1) {
        ground = false;
        items.push(P(habitatMesh(q), [0, 0, 0], 1, { rotY: m.rot ?? 0, rotX: 0.25 }));
        const g = (Math.pow((p.rpm ?? 1) * TAU / 60, 2) * (p.radius ?? 900)) / 9.81;
        objs.push({ id: 'ring', pos: [1.15, 0, 0], r: 0.6, label: `Rim · ${g.toFixed(2)} g`, info: `a = ω²r. At ${p.radius} m and ${p.rpm} rpm the rim feels ${g.toFixed(2)} g. ${(p.rpm ?? 1) > 2 ? 'Above ~2 rpm cross-coupled Coriolis effects cause motion sickness in most people.' : 'Inside the comfort envelope established by centrifuge studies.'}` });
        objs.push({ id: 'hub', pos: [0, 0, 0], r: 0.4, label: 'Zero-g hub', info: 'Docking and manufacturing happen at the axis where apparent gravity falls to zero.' });
      } else {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU, r = 0.7 + (i % 3) * 0.55;
          const h = 0.6 + ((i * 13) % 7) / 7 * 1.8 * (0.5 + (p.pop ?? 4) / 20);
          const green = (i % 4 === 0) && (p.green ?? 0.4) > 0.3;
          items.push(P(boxMesh(0.34, h, 0.34, green ? '#4A7A5A' : '#3A3450', { spec: 0.6, emissive: 0.06 }), [Math.cos(a) * r, -1 + h / 2, Math.sin(a) * r]));
          if (green) for (let k = 0; k < 4; k++) items.push(P(boxMesh(0.4, 0.04, 0.4, '#7ED9A7', { emissive: 0.15 }), [Math.cos(a) * r, -1 + h * (k + 1) / 5, Math.sin(a) * r]));
        }
        items.push(P(lathe([[1.9, -0.06], [1.9, 0]], sg(q, 32), '#2A2A3A'), [0, -1, 0]));
        objs.push({ id: 'city', pos: [0, 0.4, 0], r: 1.5, label: 'Speculative city', info: `A scenario, not a forecast: ${(p.pop ?? 4).toFixed(1)} M people, ${((p.renew ?? 0.7) * 100).toFixed(0)}% renewable. The energy physics is real; the social choices are open.` });
        for (let i = 0; i < 3; i++) {
          const x = -2 + i * 2;
          items.push(P(turbineMesh(q), [x, -0.2, -2], 0.4));
          for (let b = 0; b < 3; b++) items.push(P(bladeMesh(q), [x, 0.04, -1.92], 0.4, { rotZ: t * 1.4 + b * TAU / 3 }));
        }
      }
      caption = Math.round(p.view ?? 0) === 1 ? 'Orbital habitat · physics exact' : 'City scenario · speculative';
      break;
    }
    default: {
      items.push(P(sphere(0.8, q, '#D7FF45'), [0, 0, 0]));
      caption = id;
    }
  }
  return { items, objs, caption, ground };
}

/* ---------------------------------------------------------------- */
/*  public render + spec decorator                                   */
/* ---------------------------------------------------------------- */

const SPLIT = ['psychology'];

const FIT: Record<string, number> = {
  space: 0.6, earth: 0.78, ocean: 0.8, physics: 0.82, chemistry: 0.92, math: 0.74,
  genetics: 0.84, evolution: 0.7, animals: 0.92, plants: 0.78, weather: 0.8, micro: 0.85,
  engineering: 0.8, electronics: 0.8, computers: 0.92, ai: 0.84, architecture: 0.84,
  aviation: 0.68, autos: 0.78, energy: 0.68, agriculture: 0.78, psychology: 0.84,
  forensics: 0.78, future: 0.72,
};

export function renderDomainScene(ctx: CanvasRenderingContext2D, id: string, p: Params, m: any, e0: Env) {
  const fit = FIT[id] ?? 0.8;
  const e: Env = { ...e0, cam: { ...e0.cam, zoom: e0.cam.zoom * fit }, q: clamp(e0.q * (p.quality ?? 0.85), 0.4, 1.2) };
  let sc: Scene;
  try { sc = build(id, p, m, e); } catch { return { hits: [], objs: [] as SceneObj[] }; }
  if (sc.ground) {
    const g = 14;
    for (let i = -g; i <= g; i++) {
      const a = projectPoint(e.cam, e.w, e.h, [(i / g) * 3.4, -1.5, -3.4]);
      const b = projectPoint(e.cam, e.w, e.h, [(i / g) * 3.4, -1.5, 3.4]);
      const c = projectPoint(e.cam, e.w, e.h, [-3.4, -1.5, (i / g) * 3.4]);
      const d = projectPoint(e.cam, e.w, e.h, [3.4, -1.5, (i / g) * 3.4]);
      seg(ctx, a.x, a.y, b.x, b.y, rgba(C.ivory, 0.05), 1);
      seg(ctx, c.x, c.y, d.x, d.y, rgba(C.ivory, 0.05), 1);
    }
  }
  renderMeshes(ctx, sc.items, { cam: e.cam, w: e.w, h: e.h, maxTris: 90000 });
  const hits: { x: number; y: number; id: string; r: number }[] = [];
  const S = Math.min(e.w, e.h) * 0.4 * e.cam.zoom;
  sc.objs.forEach((o) => {
    const pt = projectPoint(e.cam, e.w, e.h, o.pos);
    const r = Math.max(26, o.r * S * pt.f * 0.8);
    hits.push({ x: pt.x, y: pt.y, id: o.id, r });
    const on = e.sel === o.id || e.hover === o.id;
    if (on) {
      ctx.strokeStyle = rgba(C.acid, 0.6); ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (on || (p.labels ?? 1)) {
      dot(ctx, pt.x, pt.y, on ? 3.5 : 2, rgba(on ? C.acid : C.ivory, on ? 1 : 0.45), on ? 8 : 0);
      if (on) {
        ctx.font = '600 10px "Space Grotesk", system-ui, sans-serif';
        const tw = ctx.measureText(o.label).width;
        ctx.fillStyle = rgba('#171713', 0.85);
        ctx.fillRect(pt.x + r * 0.6, pt.y - r * 0.6 - 9, tw + 10, 16);
        ctx.strokeStyle = rgba(C.acid, 0.5); ctx.lineWidth = 1;
        ctx.strokeRect(pt.x + r * 0.6, pt.y - r * 0.6 - 9, tw + 10, 16);
        txt(ctx, o.label, pt.x + r * 0.6 + 5, pt.y - r * 0.6 + 2.5, 10, C.acid, 'left', 1);
      }
    }
  });
  txt(ctx, sc.caption, 14, e.h - 14, 10.5, C.ivory, 'left', 0.6);
  txt(ctx, 'drag orbit · shift-drag pan · wheel zoom · click objects', 14, 22, 9.5, C.ivory, 'left', 0.32);
  return { hits, objs: sc.objs };
}

/** Adds a real 3D environment in front of a domain's existing instrument view. */
export function withScene(spec: Spec): Spec {
  if (spec.id === 'human' || spec.id === 'timemachine') return spec;
  const origDraw = spec.draw.bind(spec);
  const origHit = spec.hit?.bind(spec);
  const origInfo = spec.info?.bind(spec);
  const origExplain = spec.explain.bind(spec);
  return {
    ...spec,
    orbit: true,
    toggles: [{ k: 'v3d', label: '3D scene', def: true }, { k: 'labels', label: 'Labels', def: true }, ...(spec.toggles ?? []).filter((t) => t.k !== 'labels')],
    ctrls: [...spec.ctrls, { k: 'quality', label: 'Render quality (LOD)', min: 0.5, max: 1.2, step: 0.05, def: 0.85 }],
    draw(ctx, m, p, e) {
      if (!p.v3d) { origDraw(ctx, m, p, e); return; }
      /* Domains whose primary experience IS the 2D instrument (reaction-time
         tests etc.) keep it live in a split view instead of behind a toggle. */
      if (SPLIT.includes(spec.id)) {
        const h1 = Math.round(e.h * 0.44);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, e.w, h1); ctx.clip();
        ctx.fillStyle = '#0D0F12'; ctx.fillRect(0, 0, e.w, h1);
        const r0 = renderDomainScene(ctx, spec.id, p, m, { ...e, h: h1 });
        m.sceneHits = r0.hits; m.sceneObjs = r0.objs; m.splitY = h1;
        ctx.restore();
        ctx.save(); ctx.translate(0, h1); ctx.beginPath(); ctx.rect(0, 0, e.w, e.h - h1); ctx.clip();
        origDraw(ctx, m, p, { ...e, h: e.h - h1, my: e.my - h1 });
        ctx.restore();
        seg(ctx, 0, h1, e.w, h1, rgba(spec.accent, 0.35), 1);
        return;
      }
      const night = ['space', 'ocean', 'micro', 'future', 'weather', 'psychology'].includes(spec.id);
      ctx.fillStyle = night ? '#0D0F12' : '#141410';
      ctx.fillRect(0, 0, e.w, e.h);
      const g = ctx.createRadialGradient(e.w * 0.5, e.h * 0.42, 0, e.w * 0.5, e.h * 0.42, Math.max(e.w, e.h) * 0.72);
      g.addColorStop(0, rgba(spec.accent, 0.11)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, e.w, e.h);
      const r = renderDomainScene(ctx, spec.id, p, m, e);
      m.sceneHits = r.hits; m.sceneObjs = r.objs;
    },
    hit(m, p, e, x, y) {
      if (!p.v3d) return origHit ? origHit(m, p, e, x, y) : null;
      if (SPLIT.includes(spec.id) && y > (m.splitY ?? e.h)) {
        return origHit ? origHit(m, p, { ...e, h: e.h - (m.splitY ?? 0) }, x, y - (m.splitY ?? 0)) : null;
      }
      const hs = (m.sceneHits ?? []) as { x: number; y: number; id: string; r: number }[];
      let best: string | null = null, bd = 1e9;
      hs.forEach((h) => { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r && d < bd) { bd = d; best = h.id; } });
      return best;
    },
    info(selId, m, p) {
      if (p.v3d) {
        const o = ((m.sceneObjs ?? []) as SceneObj[]).find((q) => q.id === selId);
        if (o) return { title: o.label, body: o.info, facts: [...(o.facts ?? []), `Domain: ${spec.name}`, 'Procedural 3D model — simplified for teaching'] };
      }
      return origInfo ? origInfo(selId, m, p) : null;
    },
    explain(m, p) {
      const base = origExplain(m, p);
      if (!p.v3d) return base;
      return `${base} You are looking at the live 3D model — drag to orbit it, click a structure to inspect it, or switch off “3D scene” for the instrument diagram.`;
    },
  };
}
