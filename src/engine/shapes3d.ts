/* ------------------------------------------------------------------ */
/*  Tiny 3D wireframe math — shared by hero, museum, lab               */
/* ------------------------------------------------------------------ */

export type Vec3 = [number, number, number];
export interface Shape { pts: Vec3[]; edges: [number, number][]; }

export function icosahedron(s = 1): Shape {
  const t = (1 + Math.sqrt(5)) / 2;
  const k = s / Math.sqrt(1 + t * t);
  const pts: Vec3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => [x * k, y * k, z * k] as Vec3);
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const seen = new Set<number>();
  const edges: [number, number][] = [];
  for (const f of faces) for (let i = 0; i < 3; i++) {
    const a = f[i], b = f[(i + 1) % 3];
    const key = a < b ? a * 100 + b : b * 100 + a;
    if (!seen.has(key)) { seen.add(key); edges.push([a, b]); }
  }
  return { pts, edges };
}

export function octahedron(s = 1): Shape {
  const pts: Vec3[] = [[s, 0, 0], [-s, 0, 0], [0, s, 0], [0, -s, 0], [0, 0, s], [0, 0, -s]];
  const edges: [number, number][] = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
    if (d < s * 1.415) edges.push([i, j]);
  }
  return { pts, edges };
}

export function box(s = 1): Shape {
  const h = s / 2;
  const pts: Vec3[] = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]];
  const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  return { pts, edges };
}

export function torus(R = 1.4, r = 0.45, seg = 30, ring = 9): Shape {
  const pts: Vec3[] = [];
  const edges: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    for (let j = 0; j < ring; j++) {
      const b = (j / ring) * Math.PI * 2;
      pts.push([(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)]);
    }
  }
  const idx = (i: number, j: number) => (i % seg) * ring + (j % ring);
  for (let i = 0; i < seg; i++) for (let j = 0; j < ring; j++) {
    edges.push([idx(i, j), idx(i + 1, j)], [idx(i, j), idx(i, j + 1)]);
  }
  return { pts, edges };
}

export function wireSphere(r = 1, lat = 11, lon = 16): Shape {
  const pts: Vec3[] = [];
  const edges: [number, number][] = [];
  const grid: number[][] = [];
  for (let i = 0; i <= lat; i++) {
    const th = (i / lat) * Math.PI;
    grid[i] = [];
    for (let j = 0; j < lon; j++) {
      const ph = (j / lon) * Math.PI * 2;
      grid[i].push(pts.length);
      pts.push([r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)]);
    }
  }
  for (let i = 0; i <= lat; i++) for (let j = 0; j < lon; j++) {
    edges.push([grid[i][j], grid[i][(j + 1) % lon]]);
    if (i < lat) edges.push([grid[i][j], grid[i + 1][j]]);
  }
  return { pts, edges };
}

export function helix(turns = 3, radius = 0.55, height = 2.8, per = 26): Shape {
  const pts: Vec3[] = [];
  const edges: [number, number][] = [];
  const total = turns * per;
  for (let s = 0; s < 2; s++) {
    const base = s * total;
    for (let i = 0; i <= total; i++) {
      const t = i / total;
      const a = t * turns * Math.PI * 2 + s * Math.PI;
      pts.push([radius * Math.cos(a), (t - 0.5) * height, radius * Math.sin(a)]);
      if (i < total) edges.push([base + i, base + i + 1]);
    }
    if (s === 0) for (let i = 0; i <= total; i += 3) edges.push([i, total + i]);
  }
  return { pts, edges };
}

export function knot(R = 1.05, r = 0.42, seg = 110): Shape {
  const pts: Vec3[] = [];
  const edges: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    const w = R + r * Math.cos(3 * t);
    pts.push([w * Math.cos(2 * t), r * Math.sin(3 * t), w * Math.sin(2 * t)]);
  }
  for (let i = 0; i < seg; i++) edges.push([i, i + 1]);
  return { pts, edges };
}

export function cone(h = 1.9, r = 0.85, seg = 16): Shape {
  const pts: Vec3[] = [];
  const edges: [number, number][] = [];
  pts.push([0, h / 2, 0]);
  const ring0 = pts.length;
  const ring1 = pts.length + seg;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([r * Math.cos(a), -h / 2, r * Math.sin(a)]);
  }
  const mr = r * 0.55;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([mr * Math.cos(a), 0, mr * Math.sin(a)]);
  }
  for (let i = 0; i < seg; i++) {
    const c = (i + 1) % seg;
    edges.push([ring0 + i, ring0 + c], [ring1 + i, ring1 + c]);
    if (i % 2 === 0) edges.push([0, ring0 + i], [0, ring1 + i], [ring0 + i, ring1 + i]);
  }
  return { pts, edges };
}

export function atom(radius = 1.35): Shape {
  const core = wireSphere(0.34, 6, 10);
  const shape: Shape = { pts: [...core.pts], edges: [...core.edges] };
  const rings = [
    { tiltX: 0, tiltZ: 0, n: 26 },
    { tiltX: Math.PI / 3, tiltZ: 0.5, n: 26 },
    { tiltX: -Math.PI / 3.4, tiltZ: -0.6, n: 26 },
  ];
  for (const rg of rings) {
    const base = shape.pts.length;
    for (let i = 0; i < rg.n; i++) {
      const a = (i / rg.n) * Math.PI * 2;
      let x = radius * Math.cos(a), y = 0, z = radius * Math.sin(a);
      const cx = Math.cos(rg.tiltX), sx = Math.sin(rg.tiltX);
      let y2 = y * cx - z * sx; let z2 = y * sx + z * cx;
      const cz = Math.cos(rg.tiltZ), sz = Math.sin(rg.tiltZ);
      let x2 = x * cz - y2 * sz; y2 = x * sz + y2 * cz;
      shape.pts.push([x2, y2, z2]);
    }
    for (let i = 0; i < rg.n; i++) shape.edges.push([base + i, base + ((i + 1) % rg.n)]);
  }
  return shape;
}

export function makeShape(kind: string): Shape {
  switch (kind) {
    case 'icosahedron': return icosahedron(1);
    case 'octahedron': return octahedron(1);
    case 'box': return box(1.15);
    case 'torus': return torus(1.25, 0.42, 34, 10);
    case 'sphere': return wireSphere(1.05, 11, 17);
    case 'helix': return helix(3.2, 0.5, 2.7, 24);
    case 'knot': return knot();
    case 'cone': return cone();
    case 'atom': return atom();
    default: return icosahedron(1);
  }
}

const _hash = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export interface RenderOpts {
  cx: number; cy: number; scale: number;
  rotX: number; rotY: number;
  explode?: number; color?: string; alpha?: number; lineWidth?: number;
  fillGlow?: boolean;
}

/** Rotate + orthographically project a shape and draw its wireframe. */
export function renderShape(ctx: CanvasRenderingContext2D, shape: Shape, o: RenderOpts) {
  const ex = o.explode ?? 0;
  const col = o.color ?? '#F3EBDD';
  const alphaBase = o.alpha ?? 0.8;
  const lw = o.lineWidth ?? 1;
  const cosY = Math.cos(o.rotY), sinY = Math.sin(o.rotY);
  const cosX = Math.cos(o.rotX), sinX = Math.sin(o.rotX);
  const n = shape.pts.length;
  const px = new Float64Array(n), py = new Float64Array(n), pz = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let [x, y, z] = shape.pts[i];
    if (ex > 0.001) {
      const f = 1 + ex * (0.9 + _hash(i, 1) * 1.1);
      x *= f; y *= f; z *= f;
      x += (_hash(i, 2) - 0.5) * ex * 1.4;
      y += (_hash(i, 3) - 0.5) * ex * 1.4;
      z += (_hash(i, 4) - 0.5) * ex * 1.4;
    }
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    px[i] = o.cx + x1 * o.scale;
    py[i] = o.cy - y1 * o.scale;
    pz[i] = z2;
  }

  if (o.fillGlow) {
    let zx = 0; for (let i = 0; i < n; i += 7) zx += pz[i];
    const glow = Math.max(0, zx / Math.max(1, Math.ceil(n / 7))) / 2 + 0.5;
    const g = ctx.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, o.scale * 1.6);
    g.addColorStop(0, `rgba(${hexRgb(col)},${0.05 * glow})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(o.cx - o.scale * 1.6, o.cy - o.scale * 1.6, o.scale * 3.2, o.scale * 3.2);
  }

  ctx.lineCap = 'round';
  for (const [a, b] of shape.edges) {
    const depth = (pz[a] + pz[b]) / 2;
    const k = Math.min(1, Math.max(0, (depth + 1.8) / 3.6));
    ctx.globalAlpha = alphaBase * (0.18 + 0.82 * k);
    ctx.lineWidth = lw * (0.5 + 0.9 * k);
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(px[a], py[a]);
    ctx.lineTo(px[b], py[b]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const rgbCache: Record<string, string> = {};
export function hexRgb(hex: string): string {
  if (rgbCache[hex]) return rgbCache[hex];
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = `${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)}`;
  rgbCache[hex] = v;
  return v;
}

/** Rotate a unit sphere point by yaw/pitch — shared with the globe. */
export function rotateYP(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  const y2 = p[1] * cx - z1 * sx;
  const z2 = p[1] * sx + z1 * cx;
  return [x1, y2, z2];
}
