/* ================================================================== */
/*  THREE PBR ENGINE                                                   */
/*  A single WebGL PBR stage per domain. Owns the camera rig, the       */
/*  lighting, contact shadow, turntable, GPU pick rays, exploded       */
/*  transforms, leader guides and screen-projected labels.             */
/*  No two renderers ever draw the same body.                           */
/* ================================================================== */
import * as THREE from 'three';
import type { Mesh as PDBMesh } from './mesh3d';
import type { Cam } from './engine';
import { C } from './engine';

export interface PBRFrame { drawCalls: number; tris: number; fps: number; gpu: boolean }

export interface Organel {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  dir: THREE.Vector3;
  tag: string;
  id: string | null;
  baseOpacity: number;
  baseScale: number;
  label: string | null;
}

const geomCache = new WeakMap<PDBMesh, THREE.BufferGeometry>();
const texCache = new Map<string, THREE.Texture>();

/* ---------------- procedural texture library ---------------- */
const canvasTex = (key: string, draw: (x: CanvasRenderingContext2D, s: number) => void): THREE.Texture => {
  const hit = texCache.get(key);
  if (hit) return hit;
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  if (!ctx) return new THREE.Texture();
  draw(ctx, s);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
};
const shade = (c: string, k: number) => {
  const h = c.replace('#', ''), f = h.length === 3 ? h.split('').map((v) => v + v).join('') : h;
  return `#${[0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(f.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('')}`;
};
const speckle = (x: CanvasRenderingContext2D, s: number, n: number, a: number, col: string) => {
  x.globalAlpha = a; x.fillStyle = col;
  for (let i = 0; i < n; i++) x.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
};
const painters: Record<string, (x: CanvasRenderingContext2D, s: number, base: string) => void> = {
  skin(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.05;
    for (let i = 0; i < 420; i++) { x.fillStyle = Math.random() < 0.88 ? shade(base, 0.86) : shade(base, 1.12); x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 0.5 + Math.random() * 2.2, 0, 7); x.fill(); }
    x.globalAlpha = 0.035; x.strokeStyle = shade(base, 0.72);
    for (let i = 0; i < 110; i++) { const y = Math.random() * s; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * 0.3, y + 6, s * 0.7, y - 6, s, y); x.stroke(); }
  },
  muscle(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.16; x.strokeStyle = shade(base, 1.18); x.lineWidth = 1.5;
    for (let i = -2; i < s + 2; i += 6) { x.beginPath(); x.moveTo(0, i); x.bezierCurveTo(s * 0.3, i + 3.2, s * 0.7, i - 3.2, s, i + (Math.random() * 2 - 1)); x.stroke(); }
    x.globalAlpha = 0.09; x.strokeStyle = shade(base, 0.66); x.lineWidth = 2.4;
    for (let i = 0; i < 5; i++) { const y = Math.random() * s; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * 0.4, y + 10, s * 0.6, y - 10, s, y); x.stroke(); }
  },
  organ(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.14; x.strokeStyle = shade(base, 0.74); x.lineWidth = 1.4;
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * 7, r0 = Math.random() * s * 0.3;
      x.beginPath(); x.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0);
      x.bezierCurveTo(Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s, s / 2 + Math.cos(a) * (r0 + 90), s / 2 + Math.sin(a) * (r0 + 90));
      x.stroke();
    }
    speckle(x, s, 5200, 0.05, shade(base, 0.84));
    speckle(x, s, 1600, 0.05, shade(base, 1.16));
  },
  bone(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.1; x.strokeStyle = shade(base, 0.82);
    for (let i = 0; i < 80; i++) { x.beginPath(); x.moveTo(Math.random() * s, Math.random() * s); x.lineTo(Math.random() * s, Math.random() * s); x.stroke(); }
    speckle(x, s, 2600, 0.07, shade(base, 0.78));
  },
  metal(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 130; i++) { x.globalAlpha = 0.05 + Math.random() * 0.05; x.strokeStyle = Math.random() < 0.5 ? '#ffffff' : '#000000'; x.beginPath(); const y = Math.random() * s; x.moveTo(0, y); x.lineTo(s, y + Math.random() * 8 - 4); x.stroke(); }
  },
  stone(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) { x.globalAlpha = 0.05 + Math.random() * 0.08; x.fillStyle = Math.random() < 0.5 ? shade(base, 1.16) : '#101010'; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 9 + Math.random() * 40, 4 + Math.random() * 16, Math.random() * 3, 0, 7); x.fill(); }
  },
  wood(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.strokeStyle = shade(base, 0.62);
    for (let i = 0; i < 36; i++) { x.globalAlpha = 0.08 + Math.random() * 0.1; x.beginPath(); x.ellipse(s / 2, s / 2, 3 + i * 5, 1.6 + i * 2.6, 0, 0, 7); x.stroke(); }
  },
  cloth(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.07; x.fillStyle = shade(base, 1.08);
    for (let i = 0; i < s; i += 13) { x.fillRect(i, 0, 1, s); x.fillRect(0, i, s, 1); }
  },
  cartilage(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.1; x.strokeStyle = '#ffffff';
    for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 4 + Math.random() * 14, 0, 7); x.stroke(); }
  },
  myocardium(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.2; x.strokeStyle = shade(base, 0.7); x.lineWidth = 1.1;
    for (let i = 0; i < 90; i++) { const y = Math.random() * s; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * 0.3, y + 7, s * 0.7, y - 7, s, y + (Math.random() * 4 - 2)); x.stroke(); }
    x.globalAlpha = 0.1; x.strokeStyle = shade(base, 1.3);
    for (let i = 0; i < 26; i++) { const y = Math.random() * s; x.beginPath(); x.moveTo(0, y); x.lineTo(s, y); x.stroke(); }
  },
  alveolar(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) {
      const r = 3 + Math.random() * 7, cx = Math.random() * s, cy = Math.random() * s;
      x.globalAlpha = 0.16; x.fillStyle = shade(base, 1.14); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.globalAlpha = 0.2; x.strokeStyle = shade(base, 0.74); x.lineWidth = 0.9; x.stroke();
    }
  },
  cortex(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.22; x.strokeStyle = shade(base, 0.66); x.lineWidth = 2.6; x.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      const y0 = Math.random() * s, x0 = Math.random() * s;
      x.beginPath(); x.moveTo(x0, y0);
      x.bezierCurveTo(x0 + 26, y0 + 16, x0 + 44, y0 - 18, x0 + 74, y0 + 6);
      x.stroke();
    }
    x.globalAlpha = 0.1; x.strokeStyle = '#F2E8DC';
    for (let i = 0; i < 18; i++) { const y0 = Math.random() * s; x.beginPath(); x.moveTo(0, y0); x.bezierCurveTo(s * 0.3, y0 + 20, s * 0.7, y0 - 20, s, y0); x.stroke(); }
  },
  cortical(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.05;
    for (let i = 0; i < 2000; i++) { x.fillStyle = Math.random() < 0.5 ? '#FFFFFF' : shade(base, 0.7); x.fillRect(Math.random() * s, Math.random() * s, 1.2, 1.2); }
    x.globalAlpha = 0.08; x.strokeStyle = shade(base, 0.72);
    for (let i = 0; i < 22; i++) { const y = Math.random() * s; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * 0.4, y + 8, s * 0.6, y - 8, s, y); x.stroke(); }
  },
  tendon(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.2; x.strokeStyle = shade(base, 0.82); x.lineWidth = 1.4;
    for (let i = 0; i < s; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 6, s); x.stroke(); }
  },
  nerve(x, s, base) {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.18; x.strokeStyle = shade(base, 0.7); x.lineWidth = 1.2;
    for (let i = 0; i < 60; i++) { const y = Math.random() * s; x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + Math.random() * 10 - 5); x.stroke(); }
  },
};
const bumpTex = () => canvasTex('bump-fine', (x, s) => {
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, s, s);
  x.globalAlpha = 0.3;
  for (let i = 0; i < 6000; i++) { const v = 100 + Math.random() * 110; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * s, Math.random() * s, 1.4, 1.4); }
});

export interface MatOpts { tex?: string; metal?: number; rough?: number; emissive?: number; opacity?: number }

const WET = new Set(['organ', 'myocardium', 'alveolar', 'cortex', 'cartilage', 'nerve']);
function materialFor(m: PDBMesh, o: MatOpts): THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial {
  const kind = o.tex ?? 'cloth';
  const paint = painters[kind] ?? painters.cloth;
  const map = canvasTex(`${kind}-${m.color}`, (x, s) => paint(x, s, m.color));
  const common = {
    color: new THREE.Color(m.color),
    map, bumpMap: bumpTex(), bumpScale: kind === 'metal' ? 0.18 : 0.42,
    roughness: o.rough ?? (kind === 'metal' ? 0.28 : kind === 'organ' ? 0.46 : kind === 'bone' ? 0.62 : 0.55),
    metalness: o.metal ?? (kind === 'metal' ? 0.85 : 0.04),
    envMapIntensity: kind === 'metal' ? 1.15 : 0.7,
    side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1,
    emissive: new THREE.Color(m.color), emissiveIntensity: o.emissive ?? 0,
    depthWrite: (o.opacity ?? 1) >= 0.98,
  };
  if (kind === 'metal' || kind === 'stone' || kind === 'wood' || kind === 'cloth') {
    return new THREE.MeshStandardMaterial({ ...common, roughness: o.rough ?? 0.4, metalness: o.metal ?? 0.6 });
  }
  /* living tissue reads as damp: a thin clearcoat over the albedo, plus
     sheen at grazing angles for skin and muscle */
  return new THREE.MeshPhysicalMaterial({
    ...common,
    roughness: o.rough ?? (kind === 'skin' ? 0.62 : kind === 'cortical' ? 0.5 : 0.3),
    metalness: 0,
    clearcoat: kind === 'skin' ? 0.28 : WET.has(kind) ? 0.72 : 0.4,
    clearcoatRoughness: kind === 'skin' ? 0.5 : 0.24,
    sheen: kind === 'skin' || kind === 'muscle' || kind === 'cortex' ? 0.5 : 0.18,
    sheenColor: new THREE.Color(kind === 'skin' ? '#ffd9c0' : '#ffffff'),
    specularIntensity: 0.7,
    envMapIntensity: kind === 'cortical' ? 0.6 : 1.0,
  });
}

const tmpBox = new THREE.Box3();
const tmpSize = new THREE.Vector3();

export class PBREngine {
  ren: THREE.WebGLRenderer | null = null;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(32, 1.6, 0.05, 120);
  root = new THREE.Group();
  organs: Organel[] = [];
  fail = '';
  hoverId: string | null = null;
  selId: string | null = null;
  explode = 0;
  private ray = new THREE.Raycaster();
  private picks: THREE.Mesh[] = [];
  private labelDefs: { p: THREE.Vector3; text: string; id: string | null; tag: string }[] = [];
  private guides: THREE.LineSegments | null = null;
  private guideData: { o: Organel }[] = [];
  private clockStart = performance.now();
  private fps = 60;
  private frames = 0;
  private acc = 0;
  private fitDist = 7;
  private raf = 0;
  private disposed = false;
  private onFrame: (i: PBRFrame) => void;
  preRender: ((eng: PBREngine, dt: number, t: number) => void) | null = null;

  constructor(onFrame: (i: PBRFrame) => void) { this.onFrame = onFrame; }

  mount(canvas: HTMLCanvasElement, hi: boolean): boolean {
    try {
      const probe = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (!probe) { this.fail = 'This device has no WebGL context available.'; return false; }
      THREE.Cache.enabled = true;
      this.ren = new THREE.WebGLRenderer({ canvas, antialias: hi, alpha: true, powerPreference: 'high-performance', stencil: false, logarithmicDepthBuffer: true });
      this.ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1.35));
      this.ren.shadowMap.enabled = true;
      this.ren.shadowMap.type = THREE.PCFSoftShadowMap;
      this.ren.toneMapping = THREE.ACESFilmicToneMapping;
      this.ren.toneMappingExposure = 1.02;
      this.ren.outputColorSpace = THREE.SRGBColorSpace;

      /* environment probe — authored in-engine, PMREM baked (no external HDR) */
      const pmrem = new THREE.PMREMGenerator(this.ren);
      const env = new THREE.Scene();
      const mk = (w: number, h: number, col: number, pos: [number, number, number]) => {
        const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col }));
        o.position.set(...pos); o.lookAt(0, 0, 0); return o;
      };
      env.add(
        new THREE.Mesh(new THREE.SphereGeometry(24, 24, 14), new THREE.MeshBasicMaterial({ color: 0x131310, side: THREE.BackSide })),
        mk(11, 6, 0xfff4e2, [-6, 7, -4]),
        mk(5, 8, 0x54503c, [7, 1, 3]),
        mk(9, 4, 0x2b2a22, [0, -7, 5]),
      );
      const baked = pmrem.fromScene(env, 0.22);
      this.scene.environment = baked.texture;
      this.scene.environmentIntensity = 0.5;
      pmrem.dispose();

      const key = new THREE.DirectionalLight(0xfff2dd, 2.35);
      key.position.set(-4.2, 6.4, 5.2);
      key.castShadow = true;
      key.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
      Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 6, bottom: -4, near: 0.5, far: 26 });
      key.shadow.bias = -0.0005; key.shadow.normalBias = 0.022;
      const fill = new THREE.DirectionalLight(0xc9cdff, 0.5); fill.position.set(5.5, 1.4, -3.2);
      const rim = new THREE.DirectionalLight(0xd7ff45, 0.85); rim.position.set(0.6, 3.4, -6.4);
      this.scene.add(key, fill, rim, new THREE.HemisphereLight(0x3c3a30, 0x0e0e0b, 0.55));

      this.scene.add(this.root);
      return true;
    } catch (e) { this.fail = String((e as Error).message ?? e); return false; }
  }

  /** Lab floor: turntable + contact shadow. Grounds the figure in space. */
  addStage(groundY: number, radius: number) {
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.02, 0.06, 64),
      new THREE.MeshStandardMaterial({ color: 0x1d1d18, roughness: 0.42, metalness: 0.5, envMapIntensity: 0.8 }),
    );
    disc.position.y = groundY - 0.03; disc.receiveShadow = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.94, 0.008, 6, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(C.coral), transparent: true, opacity: 0.42 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = groundY + 0.004;
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.72, 0.004, 6, 80),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(C.acid), transparent: true, opacity: 0.2 }),
    );
    ring2.rotation.x = Math.PI / 2; ring2.position.y = groundY + 0.004;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.9, 44), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.46 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = groundY + 0.008; shadow.receiveShadow = true;
    this.scene.add(disc, ring, ring2, shadow);
  }

  resize(w: number, h: number) {
    if (!this.ren || w < 4 || h < 4) return;
    this.ren.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  /** Add a converted mesh. `home` is the assembled anatomical position. */
  add(m: PDBMesh, o: { pos?: [number, number, number]; scale?: number | [number, number, number]; rot?: [number, number, number]; tex?: string; metal?: number; rough?: number; emissive?: number; opacity?: number; id?: string | null; tag?: string; label?: string | null; dir?: [number, number, number]; pickable?: boolean } = {}): THREE.Mesh {
    let g = geomCache.get(m);
    if (!g) {
      g = new THREE.BufferGeometry();
      const pos = new Float32Array(m.v.length);
      pos.set(m.v);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(m.f), 1));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      g.computeBoundingBox();
      geomCache.set(m, g);
    }
    const mat = materialFor(m, o);
    const mesh = new THREE.Mesh(g, mat);
    const s = typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : (o.scale ?? [1, 1, 1]);
    mesh.scale.set(s[0], s[1], s[2]);
    const home = new THREE.Vector3(...(o.pos ?? [0, 0, 0]));
    mesh.position.copy(home);
    if (o.rot) mesh.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const id = o.id ?? null;
    mesh.userData.organel = this.organs.length;
    const item: Organel = {
      mesh, home, tag: o.tag ?? 'body', id,
      baseOpacity: o.opacity ?? 1, baseScale: s[0] || 1,
      label: o.label ?? null,
      dir: new THREE.Vector3(...(o.dir ?? [0, 0, 0])),
    };
    this.organs.push(item);
    if (o.pickable !== false && id) { this.picks.push(mesh); }
    this.root.add(mesh);
    if (item.label) this.labelDefs.push({ p: home.clone(), text: item.label, id, tag: item.tag });
    return mesh;
  }

  /** Active focus: a pivot point in model units plus a framing radius.
      null = whole-body framing. Set by the lab for region / object focus. */
  focus: { p: THREE.Vector3; radius: number } | null = null;
  private curTarget = new THREE.Vector3();
  private curDist = 8;
  private curYaw = 0.6;
  private curPitch = 0.3;

  /** Framing radius of a named structure's live bounding box (works exploded). */
  boundsOf(id: string): { c: [number, number, number]; r: number } | null {
    const list = this.organs.filter((o) => o.id === id);
    if (!list.length) return null;
    const b = new THREE.Box3();
    list.forEach((o) => { o.mesh.updateMatrixWorld(true); b.union(new THREE.Box3().setFromObject(o.mesh)); });
    if (!isFinite(b.min.x)) return null;
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    return { c: [c.x, c.y, c.z], r: Math.max(0.06, Math.max(s.x, s.y, s.z) * 0.62) };
  }

  focusRegion(p: [number, number, number], radius: number) {
    this.focus = { p: new THREE.Vector3(p[0], p[1], p[2]), radius };
  }
  clearFocus() { this.focus = null; }

  /** Snap the smoothing state (used on first mount so nothing slides in). */
  snapCamera() { this.curDist = -1; }

  /** Recentre geometry on the origin and compute a framing distance. */
  fit(w: number, h: number, frac = 0.74) {
    this.root.updateMatrixWorld(true);
    tmpBox.setFromObject(this.root);
    if (!isFinite(tmpBox.min.x)) return;
    tmpBox.getSize(tmpSize);
    const c = tmpBox.getCenter(new THREE.Vector3());
    this.root.position.sub(c);
    this.root.userData.offset = -c.y;
    this.recomputeFit(w, h, frac);
  }
  recomputeFit(w: number, h: number, frac = 0.74) {
    this.root.updateMatrixWorld(true);
    tmpBox.setFromObject(this.root);
    if (!isFinite(tmpBox.min.x)) return;
    tmpBox.getSize(tmpSize);
    const tan = Math.tan((this.cam.fov * Math.PI) / 360);
    /* portrait viewports get a slightly tighter crop so the figure stays big */
    const aspect = w / Math.max(1, h);
    const f2 = aspect < 1 ? Math.min(0.88, frac * (1 + (1 - aspect) * 0.22)) : frac;
    const needH = (tmpSize.y * 0.5) / Math.max(0.0001, tan * f2);
    const needW = (tmpSize.x * 0.5) / Math.max(0.0001, tan * f2 * aspect);
    this.fitDist = Math.max(2.4, Math.max(needH, needW));
  }

  guidesFor(list: Organel[]) {
    this.guideData = list.map((o) => ({ o }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(6, list.length * 6)), 3));
    this.guides = new THREE.LineSegments(g, new THREE.LineDashedMaterial({ color: new THREE.Color(C.ivory), transparent: true, opacity: 0.3, dashSize: 0.04, gapSize: 0.03 }));
    this.guides.frustumCulled = false;
    this.scene.add(this.guides);
  }
  private updateGuides() {
    if (!this.guides) return;
    const arr = (this.guides.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const off = this.root.position;
    let i = 0;
    for (const { o } of this.guideData) {
      const cur = o.mesh.position;
      arr[i++] = o.home.x + off.x; arr[i++] = o.home.y + off.y; arr[i++] = o.home.z + off.z;
      arr[i++] = cur.x + off.x; arr[i++] = cur.y + off.y; arr[i++] = cur.z + off.z;
    }
    for (; i < arr.length; i++) arr[i] = 0;
    this.guides.geometry.getAttribute('position').needsUpdate = true;
    this.guides.geometry.computeBoundingSphere();
    this.guides.visible = this.explode > 0.02;
    (this.guides.material as THREE.LineDashedMaterial).opacity = Math.min(0.34, this.explode * 0.5);
  }

  /** Orbit camera driven by the shared domain camera state. */
  /** Orbit camera driven by the shared domain camera state.
      Orbits the model (never spins the anatomy itself); pivots to the active
      focus with a damped tween so region jumps animate instead of snapping. */
  applyCamera(cam: Cam, w: number, h: number, dt = 1 / 60) {
    this.recomputeFit(w, h);
    const off = this.root.position;
    const f = this.focus;
    const wantTarget = f
      ? new THREE.Vector3(f.p.x + off.x, f.p.y + off.y, f.p.z + off.z)
      : new THREE.Vector3(0, 0, 0);
    const wantDist = f
      ? Math.max(0.14, (f.radius * 2) / (Math.tan((this.cam.fov * Math.PI) / 360) * 1.3)) / Math.max(0.1, cam.zoom)
      : this.fitDist / Math.max(0.1, cam.zoom);
    const k = this.curDist < 0 ? 1 : 1 - Math.exp(-dt * 9);
    if (this.curDist < 0) {
      this.curTarget.copy(wantTarget); this.curDist = wantDist;
      this.curYaw = cam.yaw; this.curPitch = cam.pitch;
    } else {
      this.curTarget.lerp(wantTarget, k);
      this.curDist += (wantDist - this.curDist) * k;
      /* shortest arc, so a 360° spin never doubles back */
      let dy = cam.yaw - this.curYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.curYaw += dy * k;
      this.curPitch += (THREE.MathUtils.clamp(cam.pitch, -1.5533, 1.5533) - this.curPitch) * k;
    }
    const d = this.curDist;
    const pit = this.curPitch;
    const cp = Math.cos(pit);
    /* near the poles, tilt the up-vector so the frame rolls predictably
       instead of flipping — this is what makes a full vertical sweep usable */
    const polar = Math.abs(pit) > 1.47;
    this.cam.up.set(0, polar ? Math.cos(pit) || 0.001 : 1, polar ? 0.0012 : 0).normalize();
    const px = cam.panX * 0.004, py = -cam.panY * 0.004;
    this.cam.position.set(
      this.curTarget.x + Math.sin(this.curYaw) * cp * d + px,
      this.curTarget.y + Math.sin(pit) * d * 0.98 + py,
      this.curTarget.z + Math.cos(this.curYaw) * cp * d,
    );
    /* lookAt() reads matrixWorld, so refresh it first — otherwise the camera
       aims from last frame's eye position and the subject drifts off centre. */
    this.cam.updateMatrixWorld(true);
    this.cam.lookAt(this.curTarget.x + px, this.curTarget.y + py, this.curTarget.z);
    this.cam.updateMatrixWorld(true);
    /* the near plane follows the pivot so deep zoom never clips the subject */
    this.cam.near = Math.max(0.0030, d * 0.010);
    this.cam.far = Math.max(this.fitDist * 4, d * 8) + 40;
    this.cam.updateProjectionMatrix();
  }

  pick(x: number, y: number, w: number, h: number): string | null {
    if (!this.ren || this.picks.length === 0) return null;
    this.ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), this.cam);
    const vis = this.picks.filter((p) => (p.material as THREE.Material).opacity > 0.12 && p.visible);
    const hits = this.ray.intersectObjects(vis, false);
    for (const hit of hits) {
      const idx = hit.object.userData.organel as number | undefined;
      if (idx === undefined) continue;
      const o = this.organs[idx];
      if (o?.id) return o.id;
    }
    return null;
  }

  /** Push visibility / transparency / explode into every registered part. */
  applyState(opts: { visible: Record<string, number>; alpha: number; explode: number; sel: string | null; hover: string | null; iso: number; dt: number }) {
    const { visible, alpha, sel, hover, iso, dt } = opts;
    const k = Math.min(1, dt * 7);
    for (const o of this.organs) {
      const mat = o.mesh.material as THREE.MeshStandardMaterial;
      const sysOn = visible[o.tag] ?? 1;
      const isSel = !!sel && o.id === sel;
      const dimmed = sel ? (isSel ? 1 : 0.14) : 1;
      const target = sysOn * o.baseOpacity * alpha * dimmed * (iso > 0.4 && !isSel && sel ? lerp(1, 0.3, iso) : 1);
      mat.opacity += (target - mat.opacity) * k;
      const wantT = mat.opacity < 0.985;
      if (mat.transparent !== wantT) { mat.transparent = wantT; mat.needsUpdate = true; }
      const hot = hover && o.id === hover;
      const e0 = hot ? 0.34 : isSel ? 0.2 : 0;
      mat.emissiveIntensity += (e0 - mat.emissiveIntensity) * Math.min(1, dt * 9);
      if (hot || isSel) mat.emissive.setHex(new THREE.Color(hot ? C.acid : o.mesh.name && o.id ? new THREE.Color(0x000000).getHex() : 0).getHex());
      else mat.emissive.set(mat.color);
      if (hot || isSel) mat.emissiveIntensity = e0;
      /* exploded layout: organised layered separation with per-organ fan */
      const ex = opts.explode;
      const home = o.home;
      const pull = isSel ? iso : 0;
      const tx = home.x + o.dir.x * ex * 1.0 + pull * 0.95;
      const ty = home.y + o.dir.y * ex * 0.9 + pull * 0.05;
      const tz = home.z + o.dir.z * ex * 1.5 + pull * 0.75;
      o.mesh.position.x += (tx - o.mesh.position.x) * Math.min(1, dt * 6);
      o.mesh.position.y += (ty - o.mesh.position.y) * Math.min(1, dt * 6);
      o.mesh.position.z += (tz - o.mesh.position.z) * Math.min(1, dt * 6);
      o.mesh.visible = mat.opacity > 0.02 && sysOn > 0.02;
    }
    this.explode = opts.explode;
    this.updateGuides();
  }

  frame(cam: Cam, w: number, h: number) {
    if (!this.ren || this.disposed || w < 4 || h < 4) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.last ?? now)) / 1000);
    this.last = now;
    const t = (now - this.clockStart) / 1000;
    this.applyCamera(cam, w, h, dt);
    this.preRender?.(this, dt, t);
    this.ren.render(this.scene, this.cam);
    this.frames++; this.acc += dt;
    if (this.acc > 0.5) { this.fps = Math.round(this.frames / Math.max(0.001, this.acc)); this.frames = 0; this.acc = 0; }
    const info = this.ren.info;
    this.onFrame({ drawCalls: info.render.calls, tris: info.render.triangles, fps: this.fps, gpu: true });
  }
  private last = 0;

  start(getCam: () => Cam, getSize: () => { w: number; h: number }) {
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const s = getSize();
      this.frame(getCam(), s.w, s.h);
    };
    this.raf = requestAnimationFrame(loop);
  }

  projectLabels(w: number, h: number, opts: { show: (o: { text: string; id: string | null; tag: string }) => boolean }): { x: number; y: number; text: string; id: string | null; depth: number }[] {
    const out: { x: number; y: number; text: string; id: string | null; depth: number }[] = [];
    if (!this.ren) return out;
    const v = new THREE.Vector3();
    this.root.updateMatrixWorld(true);
    for (const L of this.labelDefs) {
      if (!opts.show(L)) continue;
      const idx = this.organs.findIndex((o) => o.id === L.id && o.label === L.text);
      const live = idx >= 0 ? this.organs[idx].mesh.position : L.p;
      v.copy(live).add(this.root.position);
      v.project(this.cam);
      if (v.z > 1 || v.z < -1) continue;
      const mat = idx >= 0 ? (this.organs[idx].mesh.material as THREE.MeshStandardMaterial) : null;
      if (mat && mat.opacity < 0.2) continue;
      out.push({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, text: L.text, id: L.id, depth: v.z });
    }
    return out;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.picks = [];
    this.organs = [];
    this.labelDefs = [];
    this.guideData = [];
    [...this.root.children].forEach((c) => this.root.remove(c));
    if (this.guides) { this.guides.geometry.dispose(); (this.guides.material as THREE.Material).dispose(); }
    this.scene.environment?.dispose();
    this.scene.environment = null;
    this.ren?.dispose();
    this.ren = null;
  }
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------------- GLB asset loading (compressed-ready) ---------------- */
const loadedGLB = new Map<string, Promise<THREE.Object3D>>();

export async function loadGLB(url: string, onProgress?: (f: number) => void): Promise<THREE.Object3D> {
  const cached = loadedGLB.get(url);
  if (cached) return (await cached).clone(true);
  const p = (async () => {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    try {
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch { /* meshopt decoder optional */ }
    return new Promise<THREE.Object3D>((res, rej) => {
      loader.load(url, (g) => res(g.scene), (ev) => { if (ev.total > 0) onProgress?.(ev.loaded / ev.total); }, rej);
    });
  })();
  loadedGLB.set(url, p);
  return (await p).clone(true);
}

export interface AssetRecord { name: string; source: string; author: string; licence: string; attribution: string; path: string; status: 'procedural-runtime' | 'loaded' | 'pending' }

export const ASSET_MANIFEST: AssetRecord[] = [
  { name: 'Human anatomical mesh set — 15 organs, skeleton, muscles, vessels, nerves, skin', source: 'generated in-engine — src/sim/anatomy.ts', author: 'The Curious World', licence: 'original', attribution: 'none required', path: 'runtime', status: 'procedural-runtime' },
  { name: 'Domain environment mesh sets — 25 domains', source: 'generated in-engine — src/sim/scenes.ts', author: 'The Curious World', licence: 'original', attribution: 'none required', path: 'runtime', status: 'procedural-runtime' },
  { name: 'Environment light probe (IBL)', source: 'authored scene baked with PMREM at runtime', author: 'The Curious World', licence: 'original', attribution: 'none required', path: 'runtime', status: 'procedural-runtime' },
  { name: 'Surface textures (albedo + bump)', source: 'procedural canvas textures at runtime — no image files shipped', author: 'The Curious World', licence: 'original', attribution: 'none required', path: 'runtime', status: 'procedural-runtime' },
  { name: 'Scanned / sculpted anatomical GLB', source: 'unverified — no license-checked download URL could be confirmed from this build environment', author: '—', licence: '—', attribution: 'no third-party asset used', path: 'not shipped', status: 'pending' },
];

export const anatomyAssetStatus = () => ASSET_MANIFEST.map((a) => `${a.status}:${a.name}`).join('\n');
export function disposeAllTextures() { texCache.forEach((t) => t.dispose()); texCache.clear(); }
