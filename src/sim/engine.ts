import { useCallback, useEffect, useRef, useState } from 'react';

/* ================================================================== */
/*  UNIVERSAL SIMULATION ENGINE                                        */
/*  One rAF loop per active domain. Mutable model + React params.      */
/* ================================================================== */

export const C = {
  obsidian: '#171713', coal: '#1e1e18', slab: '#26261f', ivory: '#F3EBDD',
  acid: '#D7FF45', coral: '#FF704F', lav: '#B59AFF', mint: '#7ED9A7',
  gold: '#E4C580', amber: '#FFD24A', orchid: '#E88BF0', sky: '#8FD8E8',
};

export type Params = Record<string, number>;
/** Shared orbit-camera state. `tx/ty/tz` move the pivot (region focus) in
 *  model units; every domain's 2D painter ignores them, the WebGL lab uses
 *  them for precision zoom. Yaw is unbounded (full 360°), pitch reaches the
 *  poles so the underside and top of a subject are both inspectable. */
export interface Cam { yaw: number; pitch: number; zoom: number; dist: number; panX: number; panY: number; tx?: number; ty?: number; tz?: number }
export interface Env {
  w: number; h: number; t: number; dt: number; cam: Cam;
  mx: number; my: number; hover: string | null; sel: string | null; q: number;
}
export interface Readout { label: string; value: string; tone?: string }
export interface Serie { label: string; color: string; v: number; max: number }
export interface CtrlSpec { k: string; label: string; min: number; max: number; step: number; def: number; unit?: string }
export interface ToggleSpec { k: string; label: string; def: boolean }
export interface ChoiceSpec { k: string; label: string; options: string[]; def: number }
export interface Scenario { name: string; note: string; set: Params }
export interface SelInfo { title: string; body: string; facts?: string[] }

export interface Spec {
  id: string; name: string; tag: string; accent: string; glyph: string;
  blurb: string; method: string; facts: string[];
  ctrls: CtrlSpec[]; toggles?: ToggleSpec[]; choices?: ChoiceSpec[]; scenarios?: Scenario[];
  make(): any;
  step(m: any, p: Params, dt: number, t: number): void;
  draw(ctx: CanvasRenderingContext2D, m: any, p: Params, e: Env): void;
  readouts(m: any, p: Params): Readout[];
  series?(m: any, p: Params): Serie[];
  explain(m: any, p: Params): string;
  hit?(m: any, p: Params, e: Env, x: number, y: number): string | null;
  info?(sel: string, m: any, p: Params): SelInfo | null;
  onAction?(action: string, m: any, p: Params): void | Record<string, number | undefined>;
  actions?: { id: string; label: string; tone?: string }[];
  orbit?: boolean;
}

/* ---------------- math + draw helpers ---------------- */

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const TAU = Math.PI * 2;
export const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
export const fmt = (n: number, d = 1) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : n.toFixed(d));

export function proj(cam: Cam, w: number, h: number, x: number, y: number, z: number) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const X = x * cy + z * sy;
  let Z = -x * sy + z * cy;
  const cx = Math.cos(cam.pitch), sx = Math.sin(cam.pitch);
  const Y = y * cx - Z * sx;
  Z = y * sx + Z * cx;
  const f = cam.dist / Math.max(0.6, cam.dist + Z);
  const s = Math.min(w, h) * 0.4 * cam.zoom;
  return { x: w / 2 + cam.panX + X * s * f, y: h / 2 + cam.panY - Y * s * f, z: Z, f };
}

export function rgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`;
}

export function bg(ctx: CanvasRenderingContext2D, e: Env, accent: string, deep = C.obsidian) {
  ctx.fillStyle = deep;
  ctx.fillRect(0, 0, e.w, e.h);
  const g = ctx.createRadialGradient(e.w * 0.5, e.h * 0.45, 0, e.w * 0.5, e.h * 0.45, Math.max(e.w, e.h) * 0.7);
  g.addColorStop(0, rgba(accent, 0.09));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, e.w, e.h);
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glow = 0) {
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.2, r), 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
}

export function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size = 10, color = C.ivory, align: CanvasTextAlign = 'left', alpha = 0.75) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${size}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

export function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w = 1, a = 1) {
  ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalAlpha = 1;
}

export function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w = 1.5) {
  seg(ctx, x1, y1, x2, y2, color, w, 0.9);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.4) * 7, y2 - Math.sin(a - 0.4) * 7);
  ctx.lineTo(x2 - Math.cos(a + 0.4) * 7, y2 - Math.sin(a + 0.4) * 7);
  ctx.closePath(); ctx.fill();
}

export function grid2d(ctx: CanvasRenderingContext2D, e: Env, step = 40, color = C.ivory, a = 0.05) {
  ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < e.w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, e.h); }
  for (let y = 0; y < e.h; y += step) { ctx.moveTo(0, y); ctx.lineTo(e.w, y); }
  ctx.stroke(); ctx.globalAlpha = 1;
}

export function grid3d(ctx: CanvasRenderingContext2D, e: Env, n = 8, size = 2.4, color = C.ivory, a = 0.1) {
  for (let i = -n; i <= n; i++) {
    const t = (i / n) * size;
    const p1 = proj(e.cam, e.w, e.h, t, -1, -size), p2 = proj(e.cam, e.w, e.h, t, -1, size);
    const p3 = proj(e.cam, e.w, e.h, -size, -1, t), p4 = proj(e.cam, e.w, e.h, size, -1, t);
    seg(ctx, p1.x, p1.y, p2.x, p2.y, color, 1, a);
    seg(ctx, p3.x, p3.y, p4.x, p4.y, color, 1, a);
  }
}

export function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], fill: string, stroke?: string, a = 1) {
  if (pts.length < 2) return;
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.globalAlpha = 1;
}

/* Lambert-ish shading for procedural solids */
export function shade(hex: string, k: number) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const m = clamp(k, 0.12, 1.6);
  const r = Math.round(clamp(parseInt(f.slice(0, 2), 16) * m, 0, 255));
  const g = Math.round(clamp(parseInt(f.slice(2, 4), 16) * m, 0, 255));
  const b = Math.round(clamp(parseInt(f.slice(4, 6), 16) * m, 0, 255));
  return `rgb(${r},${g},${b})`;
}

/* ---------------- hook ---------------- */

const HISTORY = 200;

export function defaultsOf(spec: Spec): Params {
  const p: Params = {};
  spec.ctrls.forEach((c) => { p[c.k] = c.def; });
  spec.toggles?.forEach((t) => { p[t.k] = t.def ? 1 : 0; });
  spec.choices?.forEach((c) => { p[c.k] = c.def; });
  return p;
}

export interface SimApi {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  graphRef: React.RefObject<HTMLCanvasElement | null>;
  params: Params;
  set: (k: string, v: number) => void;
  running: boolean; setRunning: (v: boolean) => void;
  speed: number; setSpeed: (v: number) => void;
  readouts: Readout[];
  explain: string;
  sel: string | null; setSel: (s: string | null) => void;
  selRef: React.MutableRefObject<string | null>;
  /** Live shared camera — the WebGL lab and the 2D schematic orbit together. */
  camRef: React.MutableRefObject<Cam>;
  /** The live simulation model, so an external stage can read animation
      phase instead of re-deriving it from wall-clock time. */
  model: () => any;
  info: SelInfo | null;
  reset: () => void; randomize: () => void; stepOnce: () => void; exportPNG: () => void;
  applyScenario: (s: Scenario) => void;
  scenario: string;
  act: (id: string) => void;
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  };
  resetView: () => void;
  view: (v: 'front' | 'back' | 'side' | 'top') => void;
  elapsed: number;
}

export function useSimulation(spec: Spec): SimApi {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState<Params>(() => defaultsOf(spec));
  const pRef = useRef(params); pRef.current = params;
  const modelRef = useRef<any>(null);
  if (modelRef.current === null) modelRef.current = spec.make();
  const camRef = useRef<Cam>({ yaw: 0.6, pitch: 0.32, zoom: 1, dist: 6, panX: 0, panY: 0 });
  const [running, setRunning] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const runRef = useRef(running); runRef.current = running;
  const [speed, setSpeed] = useState(1);
  const spRef = useRef(speed); spRef.current = speed;
  const [readouts, setReadouts] = useState<Readout[]>([]);
  const [explain, setExplain] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const selRef = useRef<string | null>(null); selRef.current = sel;
  const hoverRef = useRef<string | null>(null);
  const mouseRef = useRef({ x: -1, y: -1 });
  const histRef = useRef<{ label: string; color: string; max: number; v: number[] }[]>([]);
  const tRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [scenario, setScenario] = useState('Custom');
  const stepReq = useRef(0);
  const [info, setInfo] = useState<SelInfo | null>(null);
  const q = useRef(typeof window !== 'undefined' && window.innerWidth > 900 ? 1 : 0.6);

  const set = useCallback((k: string, v: number) => {
    setParams((old) => ({ ...old, [k]: v }));
    setScenario('Custom');
  }, []);

  const reset = useCallback(() => {
    modelRef.current = spec.make();
    histRef.current = [];
    tRef.current = 0;
    setSel(null); setInfo(null); setElapsed(0);
  }, [spec]);

  const randomize = useCallback(() => {
    setParams((old) => {
      const n = { ...old };
      spec.ctrls.forEach((c) => {
        const steps = Math.round((c.max - c.min) / c.step);
        n[c.k] = +(c.min + Math.round(Math.random() * steps) * c.step).toFixed(4);
      });
      return n;
    });
    setScenario('Randomised');
  }, [spec]);

  const applyScenario = useCallback((s: Scenario) => {
    modelRef.current = spec.make();
    histRef.current = [];
    setParams((old) => ({ ...old, ...s.set }));
    setScenario(s.name);
  }, [spec]);

  const act = useCallback((id: string) => {
    /* An action may return a parameter patch; applying it through React
       state keeps every slider, readout and the model in sync. */
    const patch = spec.onAction?.(id, modelRef.current, pRef.current);
    if (patch && typeof patch === 'object') {
      const clean: Params = {};
      Object.entries(patch).forEach(([k, v]) => { if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v; });
      if (Object.keys(clean).length) {
        setParams((old) => ({ ...old, ...clean }));
        setScenario('Custom');
      }
    }
  }, [spec]);
  const stepOnce = useCallback(() => { stepReq.current += 1; }, []);
  const resetView = useCallback(() => { camRef.current = { yaw: 0.6, pitch: 0.32, zoom: 1, dist: 6, panX: 0, panY: 0 }; }, []);
  const view = useCallback((v: 'front' | 'back' | 'side' | 'top') => {
    const c = camRef.current;
    c.pitch = v === 'top' ? 1.2 : 0.18;
    c.yaw = v === 'front' ? 0 : v === 'back' ? Math.PI : v === 'side' ? Math.PI / 2 : 0.6;
  }, []);

  const exportPNG = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    try {
      const a = document.createElement('a');
      a.download = `curious-world-${spec.id}-${Date.now()}.png`;
      a.href = c.toDataURL('image/png');
      a.click();
    } catch { /* tainted canvas guard */ }
  }, [spec.id]);

  /* main loop */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
    if (!ctx) return;
    const g = ctx;
    let raf = 0, last = performance.now(), visible = true, disposed = false;
    let acc = 0, hAcc = 0, eAcc = 0;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w < 4 || h < 4) return false;
      const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      return true;
    };

    const drawGraph = () => {
      const gc = graphRef.current; if (!gc) return;
      const gx = gc.getContext('2d'); if (!gx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = gc.clientWidth, h = gc.clientHeight;
      if (w < 4 || h < 4) return;
      if (gc.width !== Math.round(w * dpr)) { gc.width = Math.round(w * dpr); gc.height = Math.round(h * dpr); gx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      gx.clearRect(0, 0, w, h);
      gx.strokeStyle = rgba(C.ivory, 0.07); gx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { gx.beginPath(); gx.moveTo(0, (h / 4) * i); gx.lineTo(w, (h / 4) * i); gx.stroke(); }
      const hist = histRef.current;
      hist.forEach((s, si) => {
        if (s.v.length < 2) return;
        gx.strokeStyle = s.color; gx.lineWidth = 1.6; gx.globalAlpha = 0.95;
        gx.beginPath();
        s.v.forEach((v, i) => {
          const x = (i / (HISTORY - 1)) * w;
          const y = h - clamp(v / (s.max || 1), 0, 1) * (h - 6) - 3;
          i === 0 ? gx.moveTo(x, y) : gx.lineTo(x, y);
        });
        gx.stroke(); gx.globalAlpha = 1;
        const lastV = s.v[s.v.length - 1];
        const ly = h - clamp(lastV / (s.max || 1), 0, 1) * (h - 6) - 3;
        dot(gx, (s.v.length - 1) / (HISTORY - 1) * w, ly, 2.4, s.color, 6);
        txt(gx, s.label, 6 + si * 92, 12, 9, s.color, 'left', 0.85);
      });
    };

    let lastW = 0, lastH = 0;
    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      /* Simulation time and telemetry keep running even when the 2D stage is
         hidden (the WebGL lab drives the same model) — only painting is gated. */
      if (fit()) { lastW = canvas.clientWidth; lastH = canvas.clientHeight; }
      let dt = 0;
      if (runRef.current) dt = real * spRef.current;
      else if (stepReq.current > 0) { stepReq.current -= 1; dt = (1 / 60) * spRef.current; }
      if (dt > 0) {
        tRef.current += dt;
        try { spec.step(modelRef.current, pRef.current, dt, tRef.current); } catch { /* keep loop alive */ }
      }
      if (visible && lastW >= 4 && lastH >= 4) {
        const w2 = lastW, h2 = lastH;
        const env: Env = {
          w: w2, h: h2, t: tRef.current, dt, cam: camRef.current,
          mx: mouseRef.current.x, my: mouseRef.current.y,
          hover: hoverRef.current, sel: selRef.current, q: q.current,
        };
        try { spec.draw(g, modelRef.current, pRef.current, env); } catch { bg(g, env, spec.accent); }
      }

      acc += real; hAcc += real; eAcc += real;
      if (hAcc > 0.1) {
        hAcc = 0;
        const ss = spec.series?.(modelRef.current, pRef.current) ?? [];
        if (histRef.current.length !== ss.length) histRef.current = ss.map((s) => ({ label: s.label, color: s.color, max: s.max, v: [] }));
        ss.forEach((s, i) => {
          const t = histRef.current[i];
          t.max = s.max; t.v.push(s.v);
          if (t.v.length > HISTORY) t.v.shift();
        });
        drawGraph();
      }
      if (acc > 0.16) {
        acc = 0;
        try { setReadouts(spec.readouts(modelRef.current, pRef.current)); } catch { /* noop */ }
        setElapsed(tRef.current);
      }
      if (eAcc > 0.45) {
        eAcc = 0;
        try { setExplain(spec.explain(modelRef.current, pRef.current)); } catch { /* noop */ }
        if (selRef.current && spec.info) setInfo(spec.info(selRef.current, modelRef.current, pRef.current));
      }
    };
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) last = performance.now(); }, { threshold: 0.01 });
    io.observe(canvas);
    const ro = new ResizeObserver(() => fit());
    ro.observe(canvas);
    return () => { disposed = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); };
  }, [spec]);

  /* pointer: orbit / pan / pick */
  const drag = useRef({ on: false, pan: false, x: 0, y: 0, moved: 0 });
  const bind = {
    onPointerDown: (e: React.PointerEvent) => {
      drag.current = { on: true, pan: e.shiftKey || e.button === 2, x: e.clientX, y: e.clientY, moved: 0 };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (drag.current.on) {
        const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
        drag.current.x = e.clientX; drag.current.y = e.clientY;
        drag.current.moved += Math.abs(dx) + Math.abs(dy);
        const c = camRef.current;
        if (drag.current.pan) { c.panX += dx; c.panY += dy; }
        else if (spec.orbit !== false) { c.yaw += dx * 0.007; c.pitch = clamp(c.pitch + dy * 0.006, -1.4, 1.4); }
      } else if (spec.hit) {
        const canvas = canvasRef.current;
        if (canvas) {
          const env: Env = { w: canvas.clientWidth, h: canvas.clientHeight, t: tRef.current, dt: 0, cam: camRef.current, mx: mouseRef.current.x, my: mouseRef.current.y, hover: hoverRef.current, sel: selRef.current, q: q.current };
          hoverRef.current = spec.hit(modelRef.current, pRef.current, env, mouseRef.current.x, mouseRef.current.y);
        }
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const wasDrag = drag.current.moved > 6;
      drag.current.on = false;
      if (!wasDrag && spec.hit) {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const canvas = canvasRef.current;
        if (canvas) {
          const env: Env = { w: canvas.clientWidth, h: canvas.clientHeight, t: tRef.current, dt: 0, cam: camRef.current, mx: 0, my: 0, hover: null, sel: selRef.current, q: q.current };
          const id = spec.hit(modelRef.current, pRef.current, env, e.clientX - r.left, e.clientY - r.top);
          setSel(id);
          setInfo(id && spec.info ? spec.info(id, modelRef.current, pRef.current) : null);
        }
      }
    },
    onWheel: (e: React.WheelEvent) => {
      const c = camRef.current;
      c.zoom = clamp(c.zoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.35, 4.5);
    },
  };

  return {
    canvasRef, graphRef, params, set, running, setRunning, speed, setSpeed,
    readouts, explain, sel, setSel, selRef, camRef, model: () => modelRef.current, info, reset, randomize, stepOnce, exportPNG,
    applyScenario, scenario, act, bind, resetView, view, elapsed,
  };
}
