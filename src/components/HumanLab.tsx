import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSimulation, type Spec, C } from '../sim/engine';
import { PBREngine, ASSET_MANIFEST } from '../sim/threeEngine';
import { projectPoint } from '../sim/mesh3d';
import { buildHumanBodyPBR, animateHumanPBR, BODY_REGIONS, regionById } from '../domains/humanScene';
import { SYSTEMS, ORGANS } from '../domains/Human';
import { Icon } from './ui';
import { audio } from '../lib/audio';
import { progress, useProgress } from '../lib/progress';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/*  controls                                                           */
/* ------------------------------------------------------------------ */

function Slider({ label, value, min, max, step, unit, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <label className="block group">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] tracking-[0.14em] uppercase text-ivory/45 group-hover:text-ivory/75 transition-colors">{label}</span>
        <span className="text-[11px] tabular-nums font-medium text-ivory/85">
          {step >= 1 ? value.toFixed(0) : value.toFixed(2)}<span className="text-ivory/35 ml-0.5">{unit}</span>
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => { onChange(+e.target.value); audio.tick(520 + ((+e.target.value - min) / (max - min)) * 420); }}
        className="mt-1.5 w-full" style={{ accentColor: C.acid }} />
      {hint && <span className="block text-[10px] leading-snug text-ivory/28 mt-0.5">{hint}</span>}
    </label>
  );
}

function Chip({ on, label, onClick, color = C.acid }: { on: boolean; label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={() => { onClick(); audio.tick(on ? 400 : 700); }} aria-pressed={on}
      className={cn('px-2.5 py-1.5 rounded-lg border text-[10px] tracking-[0.1em] uppercase transition-all duration-200 text-left',
        on ? 'font-semibold text-obsidian border-transparent' : 'border-ivory/12 text-ivory/45 hover:text-ivory hover:border-ivory/30')}
      style={on ? { background: color } : undefined}>
      {label}
    </button>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: { k: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-obsidian/70 border border-ivory/10">
      {options.map((o) => (
        <button key={o.k} onClick={() => { onChange(o.k); audio.tick(660); }} aria-pressed={value === o.k}
          className={cn('flex-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-[0.14em] uppercase transition-all duration-200 whitespace-nowrap',
            value === o.k ? 'text-obsidian font-semibold bg-ivory' : 'text-ivory/45 hover:text-ivory')}
          style={value === o.k ? { background: C.acid } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ id, title, icon, open, onToggle, badge, children }: {
  id: string; title: string; icon: string; open: boolean; onToggle: () => void; badge?: string; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-ivory/8" data-section={id}>
      <button onClick={onToggle} aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-ivory/[0.03] transition-colors">
        <Icon name={icon} className={cn('w-4 h-4 shrink-0 transition-colors', open ? 'text-acid' : 'text-ivory/35')} />
        <span className={cn('text-[11px] tracking-[0.18em] uppercase font-medium transition-colors', open ? 'text-ivory' : 'text-ivory/60')}>{title}</span>
        {badge && <span className="ml-auto text-[9.5px] tabular-nums px-1.5 py-0.5 rounded bg-ivory/8 text-ivory/45">{badge}</span>}
        <Icon name="arrow" className={cn('w-3.5 h-3.5 ml-auto text-ivory/35 transition-transform duration-300', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  main lab                                                           */
/* ------------------------------------------------------------------ */

type ViewKey = 'front' | 'side' | 'back' | 'top' | 'bottom';

export default function HumanLab({ spec, onClose }: { spec: Spec; onClose: () => void }) {
  const sim = useSimulation(spec);
  const p = sim.params;
  const prog = useProgress();
  const [tab, setTab] = useState<'lab' | 'schematic'>('lab');
  const [open, setOpen] = useState<Record<string, boolean>>({ systems: true, physiology: true, regions: true, view: false, conditions: false, vessels: false, organ: true, notes: false });
  const [stats, setStats] = useState({ drawCalls: 0, tris: 0, fps: 60, gpu: true });
  const [labels, setLabels] = useState<{ x: number; y: number; text: string; id: string | null }[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [webgl, setWebgl] = useState<'pending' | 'ok' | 'failed'>('pending');
  const [showGraph, setShowGraph] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [spin, setSpin] = useState(false);
  const [region, setRegion] = useState<string>('full');
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef({ dist: 0, zoom: 1, cx: 0, cy: 0, panX: 0, panY: 0 });
  const repeat = useRef(0);
  const engRef = useRef<PBREngine | null>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ on: false, x: 0, y: 0, moved: 0, yaw: 0, pit: 0, panX: 0, panY: 0 });
  const hoverRef = useRef<string | null>(null);
  const sex = Math.round(p.sex) === 1 ? 'F' : 'M';
  const detail = p.detail ?? 0.8;
  const bookmarked = prog.bookmarks.some((b) => b.id === 'domain:human');

  const set = sim.set;
  const toggle = (k: string) => set(k, p[k] ? 0 : 1);
  const visible = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of SYSTEMS) m[s.k] = p[s.k] ? 1 : 0;
    return m;
  }, [p]);

  /* ---- engine lifecycle: rebuild when model sex or LOD changes ---- */
  useEffect(() => {
    if (tab !== 'lab') return;
    const cv = cvRef.current;
    if (!cv) return;
    const hi = window.innerWidth > 900;
    const eng = new PBREngine((f) => setStats(f));
    engRef.current = eng;
    if (!eng.mount(cv, hi)) { setWebgl('failed'); return; }
    setWebgl('ok');
    try {
      buildHumanBodyPBR(eng, ORGANS as never, sex, detail);
      eng.preRender = (e, dt) => {
        const mo = sim.model() ?? {};
        animateHumanPBR(e, { beat: mo.beat ?? 0, breath: mo.breath ?? 0 });
        e.applyState({
          visible: visibleRef.current, alpha: alphaRef.current, explode: explodeRef.current,
          sel: selRef2.current, hover: hoverRef.current, iso: isoRef.current, dt,
        });
      };
      const getSize = () => ({ w: cv.clientWidth, h: cv.clientHeight });
      eng.start(() => camRefRead(), getSize);
      const ro = new ResizeObserver(() => eng.resize(cv.clientWidth, cv.clientHeight));
      ro.observe(cv);
      eng.resize(cv.clientWidth, cv.clientHeight);
      const io = new IntersectionObserver(([en]) => setInView(en.isIntersecting), { threshold: 0.01 });
      if (wrapRef.current) io.observe(wrapRef.current);
      return () => { ro.disconnect(); io.disconnect(); eng.dispose(); engRef.current = null; };
    } catch (e) {
      setWebgl('failed');
      eng.dispose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sex, detail]);

  const [inView, setInView] = useState(true);
  const camRefRead = () => sim.camRef.current;
  const visibleRef = useRef(visible); visibleRef.current = visible;
  const alphaRef = useRef(1); alphaRef.current = p.alpha ?? 1;
  const explodeRef = useRef(0); explodeRef.current = p.explode ?? 0;
  const isoRef = useRef(0); isoRef.current = p.isolate ?? 0;
  const selRef2 = useRef<string | null>(null); selRef2.current = sim.sel;

  /* label projection loop (throttled, only while the lab tab is live) */
  useEffect(() => {
    if (tab !== 'lab' || webgl !== 'ok') return;
    let raf = 0; let acc = 0; let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const cv = cvRef.current; const eng = engRef.current;
      if (!cv || !eng || !inView) return;
      const now = performance.now(); acc += (now - last); last = now;
      if (acc < 0.07) return;
      acc = 0;
      const w = cv.clientWidth, h = cv.clientHeight;
      const raw = eng.projectLabels(w, h, {
        show: (o) => {
          if (!(p.labels ?? 1)) return false;
          const zoomed = (sim.camRef.current.zoom ?? 1) > 1.5;
          const exploded = (p.explode ?? 0) > 0.12;
          return exploded || zoomed || o.id === sim.selRef.current || o.id === hoverRef.current || PRIMARY_LABELS.includes(o.text);
        },
      });
      /* de-collide: keep the nearest label per vertical band, drop overlaps */
      const seen = new Set<string>();
      const placed: { y: number }[] = [];
      const out: typeof raw = [];
      raw.sort((a, b) => (prio(b.text) - prio(a.text)) || (a.depth - b.depth)).forEach((L) => {
        const key = L.text;
        if (seen.has(key)) return;
        if (L.x < 8 || L.x > w - 8 || L.y < 8 || L.y > h - 8) return;
        if (placed.some((q) => Math.abs(q.y - L.y) < 15)) return;
        seen.add(key); placed.push({ y: L.y }); out.push(L);
      });
      setLabels(out.slice(0, 14));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tab, webgl, inView, p.labels, p.explode, sim.sel, sim.camRef, sim.selRef]);

  /* ---- pointer: shared camera with the schematic ---- */
  const onDown = (e: React.PointerEvent) => {
    const c = sim.camRef.current;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, bb] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - bb.x, a.y - bb.y), zoom: c.zoom, cx: (a.x + bb.x) / 2, cy: (a.y + bb.y) / 2, panX: c.panX, panY: c.panY };
    }
    drag.current = { on: true, x: e.clientX, y: e.clientY, moved: 0, yaw: c.yaw, pit: c.pitch, panX: c.panX, panY: c.panY };
  };
  const onMove = (e: React.PointerEvent) => {
    const c = sim.camRef.current;
    const pt = pointers.current.get(e.pointerId);
    if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
    const d = drag.current;
    if (!d.on) return;
    /* two fingers: pinch to zoom, drag both to pan */
    if (pointers.current.size >= 2) {
      const [a, bb] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - bb.x, a.y - bb.y);
      if (pinch.current.dist > 4) c.zoom = clamp(pinch.current.zoom * (dist / pinch.current.dist), 0.35, 22);
      const mx = (a.x + bb.x) / 2 - pinch.current.cx, my = (a.y + bb.y) / 2 - pinch.current.cy;
      c.panX = clamp(pinch.current.panX + mx, -300, 300);
      c.panY = clamp(pinch.current.panY + my, -240, 240);
      d.moved += 12;
      return;
    }
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.x = e.clientX; d.y = e.clientY;
    const panning = e.shiftKey || e.button === 2 || e.buttons === 2;
    if (panning) {
      c.panX = clamp(d.panX + dx, -300, 300);
      c.panY = clamp(d.panY + dy, -240, 240);
    } else {
      /* one finger / left drag orbits: yaw unbounded, pitch reaches the poles */
      c.yaw = d.yaw - dx * 0.0072;
      c.pitch = clamp(d.pit + dy * 0.0062, -1.55, 1.55);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current.dist = 0;
    const d = drag.current;
    drag.current = { ...d, on: false };
    const eng = engRef.current, cv = cvRef.current;
    if (d.moved > 8 || !eng || !cv) { drag.current.moved = 0; return; }
    const r = cv.getBoundingClientRect();
    const id = eng.pick(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    sim.setSel(id);
    drag.current.moved = 0;
    if (id) {
      audio.tick(760);
      progress.visit(`organ:${id}`, `${nameOf(id)}`, 'organ');
      const reg = BODY_REGIONS.find((q) => q.k === id);
      setRegion(reg ? reg.k : 'custom');
    } else {
      setRegion('full');
      engRef.current?.clearFocus();
    }
  };
  const onDouble = (e: React.MouseEvent) => {
    const eng = engRef.current, cv = cvRef.current;
    if (!eng || !cv) return;
    const r = cv.getBoundingClientRect();
    const id = eng.pick(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (!id) { fullBody(); return; }
    const bounds = eng.boundsOf(id);
    if (bounds) {
      /* frame the object's own bounding box — works assembled or exploded */
      eng.focusRegion(bounds.c, bounds.r);
      sim.setSel(id);
      setRegion('custom');
      sim.camRef.current.zoom = 1;
      audio.tick(880);
      progress.experiment();
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    const c = sim.camRef.current;
    const k = e.ctrlKey ? 0.012 : 0.0016;   // trackpad pinch arrives as ctrl+wheel
    c.zoom = clamp(c.zoom * (1 - e.deltaY * k), 0.35, 22);
  };
  const onHoverMove = (e: React.MouseEvent) => {
    const eng = engRef.current, cv = cvRef.current;
    if (!eng || !cv || drag.current.on) return;
    const r = cv.getBoundingClientRect();
    const id = eng.pick(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (id !== hoverRef.current) { hoverRef.current = id; setHover(id); }
    cv.style.cursor = id ? 'pointer' : 'grab';
  };

  /* ---- region focus — works in both the WebGL lab and the 2D schematic ---- */
  const schematicFocus = (p3: [number, number, number], r: number) => {
    const cv = cvRef.current; if (!cv) return;
    const c = sim.camRef.current;
    const w = cv.clientWidth || 900, h = cv.clientHeight || 600;
    c.zoom = clamp((1.86 / Math.max(0.08, r)) * 0.5, 0.5, 9);
    const q2 = projectPoint({ ...c, panX: 0, panY: 0 }, w, h, p3);
    c.panX = clamp(w / 2 - q2.x, -1400, 1400);
    c.panY = clamp(h / 2 - q2.y, -1200, 1200);
  };

  const focusRegion = (k: string) => {
    const eng = engRef.current;
    const reg = regionById(k);
    setRegion(k);
    if (k === 'full') { sim.camRef.current.zoom = 1; sim.camRef.current.panX = 0; sim.camRef.current.panY = 0; sim.setSel(null); }
    if (!eng) { if (k !== 'full') schematicFocus(reg.p, reg.r); return; }
    if (k === 'full') { eng.clearFocus(); sim.camRef.current.zoom = 1; sim.setSel(null); }
    else {
      eng.focusRegion(reg.p, reg.r);
      sim.camRef.current.zoom = 1;
      if (reg.k === 'heart' || reg.k === 'brain' || reg.k === 'liver' || reg.k === 'stomach') sim.setSel(reg.k);
      if (reg.k === 'lungs') sim.setSel('lungR');
      if (reg.k === 'kidneys') sim.setSel('kidneyR');
      if (!eng) schematicFocus(reg.p, reg.r);
    }
    audio.tick(680);
    progress.experiment();
  };
  const fullBody = () => focusRegion('full');
  const nudge = (axis: 'yaw' | 'pitch' | 'zoom', dir: 1 | -1) => {
    const c = sim.camRef.current;
    if (axis === 'yaw') c.yaw += dir * 0.3;
    else if (axis === 'pitch') c.pitch = clamp(c.pitch + dir * 0.2, -1.55, 1.55);
    else c.zoom = clamp(c.zoom * (dir > 0 ? 1.25 : 0.8), 0.35, 22);
  };
  const holdRepeat = (fn: () => void) => () => {
    fn();
    window.clearInterval(repeat.current);
    repeat.current = window.setInterval(fn, 60);
  };
  const stopRepeat = () => window.clearInterval(repeat.current);
  useEffect(() => () => window.clearInterval(repeat.current), []);

  const nameOf = (id: string) =>
    (ORGANS as { id: string; name: string }[]).find((o) => o.id === id)?.name
    ?? SYSTEMS.find((x) => (x.k as string) === id)?.label
    ?? ({ skin: 'Skin & body surface', muscle: 'Musculature', arteries: 'Arterial tree', veins: 'Venous network', nerves: 'Peripheral nerves', lymph: 'Lymphatic chain', trachea: 'Trachea & bronchi', diaphragm: 'Diaphragm', pituitary: 'Pituitary gland', skeleton: 'Skeleton' } as Record<string, string>)[id]
    ?? id;

  const view = (v: ViewKey) => {
    const c = sim.camRef.current;
    c.pitch = v === 'top' ? 1.5 : v === 'bottom' ? -1.5 : 0.1;
    c.yaw = v === 'front' ? 0 : v === 'back' ? Math.PI : v === 'side' ? Math.PI / 2 : 0.42;
    c.zoom = 1; c.panX = 0; c.panY = 0;
    engRef.current?.clearFocus();
    if (v !== 'top' && v !== 'bottom') setRegion('full');
    audio.tick(600);
  };
  const resetView = () => { view('front'); sim.set('explode', 0); sim.set('isolate', 0); sim.setSel(null); };

  const act = (a: string) => {
    sim.act(a);
    if (a === 'explode') { view('front'); sim.camRef.current.zoom = 1.15; }
    if (a === 'restore') { sim.set('isolate', 0); sim.setSel(null); }
    progress.experiment();
  };

  /* 360° turntable — advances the shared camera so both views stay in sync */
  useEffect(() => {
    if (!spin) return;
    let raf = 0; let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      sim.camRef.current.yaw += ((now - last) / 1000) * 0.45;
      last = now;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spin, sim.camRef]);

  const internals = () => {
    const anySkin = !!p.skin;
    if (anySkin) { set('skin', 0); set('muscle', 0); set('alpha', 0.55); }
    else { set('skin', 1); set('muscle', p.muscle ? 1 : 0); set('alpha', 1); }
    audio.tick(640);
  };

  const sel = sim.sel;
  const selOrgan: { id: string; name: string; sys: string } | undefined = (ORGANS as { id: string; name: string; sys: string }[]).find((o) => o.id === sel);
  const keyMetrics = sim.readouts.slice(0, 8);
  const blocked = /OCCLUDED|VESSEL/i.test(sim.readouts.map((r) => r.value).join(' '));

  const rail = (
    <RailContent
      p={p} set={set} toggle={toggle} spec={spec} sim={sim}
      open={open} setOpen={setOpen} sex={sex} tab={tab} setTab={setTab}
      onAct={act} onReset={resetView} onView={view}
      showGraph={showGraph} setShowGraph={setShowGraph}
      stats={stats} webgl={webgl} blocked={blocked}
      spin={spin} setSpin={setSpin} onInternals={internals}
      region={region} onFocusRegion={focusRegion}
    />
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-obsidian text-ivory">
      {/* ---------------- header ---------------- */}
      <header className="shrink-0 flex items-center gap-3 px-4 sm:px-5 h-14 border-b border-ivory/10 bg-obsidian/95">
        <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg border" style={{ borderColor: rgba(C.coral, 0.4), color: C.coral, background: rgba(C.coral, 0.08) }}>
          <Icon name="heart" className="w-4.5 h-4.5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base sm:text-xl leading-none truncate">Human Body Simulator</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: sim.running ? C.acid : C.ivory }} />
            <span className="text-[9.5px] tracking-[0.2em] uppercase text-ivory/45">{sim.running ? 'Live' : 'Paused'}</span>
            {tab === 'lab' && webgl === 'ok' && (
              <span className="hidden sm:inline text-[9.5px] tracking-[0.16em] uppercase text-ivory/30 tabular-nums">
                · {stats.tris.toLocaleString()} tris · {stats.fps} fps
              </span>
            )}
            {blocked && <span className="text-[9.5px] tracking-[0.16em] uppercase text-coral">· vessel occluded</span>}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block w-[168px]">
            <Segmented options={[{ k: 'lab' as const, label: '3D Lab' }, { k: 'schematic' as const, label: 'Schematic' }]} value={tab} onChange={setTab} />
          </div>
          <button onClick={() => { sim.setRunning(!sim.running); audio.tick(500); }}
            className="w-9 h-9 grid place-items-center rounded-full border border-ivory/12 text-ivory/70 hover:text-ivory hover:border-ivory/30 transition-colors"
            aria-label={sim.running ? 'Pause' : 'Run'} title={sim.running ? 'Pause' : 'Run'}>
            <Icon name={sim.running ? 'pause' : 'play'} className="w-4 h-4" />
          </button>
          <button onClick={() => { sim.stepOnce(); audio.tick(800); }} title="Single step" aria-label="Step"
            className="hidden sm:grid w-9 h-9 place-items-center rounded-full border border-ivory/12 text-ivory/60 hover:text-ivory transition-colors">
            <Icon name="arrow" className="w-4 h-4" />
          </button>
          <button onClick={() => { sim.reset(); audio.tick(420); }} title="Reset simulation" aria-label="Reset"
            className="hidden sm:grid w-9 h-9 place-items-center rounded-full border border-ivory/12 text-ivory/60 hover:text-coral hover:border-coral/50 transition-colors">
            <Icon name="target" className="w-4 h-4" />
          </button>
          <button onClick={() => { progress.toggleBookmark('domain:human', 'Human Body Simulator', 'domain'); audio.chime(); }}
            aria-label="Bookmark" className={cn('hidden lg:grid w-9 h-9 place-items-center rounded-full border transition-colors', bookmarked ? 'border-acid text-acid' : 'border-ivory/12 text-ivory/50 hover:text-ivory')}>
            <Icon name={bookmarked ? 'check' : 'plus'} className="w-4 h-4" />
          </button>
          <button onClick={onClose} aria-label="Close" title="Back to all worlds"
            className="w-9 h-9 grid place-items-center rounded-full border border-ivory/12 text-ivory/70 hover:text-coral hover:border-coral/50 transition-colors">
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* mobile tab switch */}
      <div className="md:hidden shrink-0 px-3 py-2 border-b border-ivory/10">
        <Segmented options={[{ k: 'lab' as const, label: '3D Lab' }, { k: 'schematic' as const, label: 'Schematic' }]} value={tab} onChange={setTab} />
      </div>

      {/* ---------------- body ---------------- */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* viewport + telemetry */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={wrapRef} className="relative flex-1 min-h-[46vh] bg-[#101009]"
            style={{ backgroundImage: 'radial-gradient(ellipse 62% 52% at 50% 42%, rgba(255,112,79,0.07), transparent 70%)' }}>
            {/* the WebGL lab canvas */}
            <canvas
              ref={cvRef}
              className="absolute inset-0 w-full h-full block touch-none select-none"
              style={{ display: tab === 'lab' ? 'block' : 'none', cursor: 'grab' }}
              onPointerDown={onDown} onPointerMove={(e) => { onMove(e); onHoverMove(e); }} onPointerUp={onUp} onPointerCancel={onUp}
              onWheel={onWheel} onDoubleClick={onDouble} onContextMenu={(e) => e.preventDefault()}
              tabIndex={0}
              onKeyDown={(e) => {
                const c = sim.camRef.current;
                const step = e.shiftKey ? 0.24 : 0.08;
                if (e.key === 'ArrowLeft') { c.yaw -= step; e.preventDefault(); }
                else if (e.key === 'ArrowRight') { c.yaw += step; e.preventDefault(); }
                else if (e.key === 'ArrowUp') { c.pitch = clamp(c.pitch + step * 0.7, -1.3, 1.3); e.preventDefault(); }
                else if (e.key === 'ArrowDown') { c.pitch = clamp(c.pitch - step * 0.7, -1.3, 1.3); e.preventDefault(); }
                else if (e.key === '+' || e.key === '=') { c.zoom = clamp(c.zoom * 1.12, 0.45, 3.6); e.preventDefault(); }
                else if (e.key === '-') { c.zoom = clamp(c.zoom / 1.12, 0.45, 3.6); e.preventDefault(); }
                else if (e.key === '0' || e.key.toLowerCase() === 'f') { fullBody(); }
                else if (e.key === 'Escape') { if (sim.sel) sim.setSel(null); else fullBody(); }
                else if (e.key.toLowerCase() === 'e') { act((p.explode ?? 0) > 0.05 ? 'restore' : 'explode'); }
              }}
              aria-label="Interactive anatomical model — drag to orbit, arrow keys to rotate, plus and minus to zoom, click an organ to inspect"
            />
            {/* the legacy 2D schematic canvas, driven by the same simulation */}
            <canvas
              ref={sim.canvasRef}
              style={{ display: tab === 'schematic' ? 'block' : 'none' }}
              className="absolute inset-0 w-full h-full block touch-none"
              aria-hidden={tab !== 'schematic'}
              {...sim.bind}
              aria-label="Anatomical schematic with live physiology overlay"
            />

            {/* labels bound to 3D parts */}
            {tab === 'lab' && webgl === 'ok' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {labels.map((L) => {
                  const on = L.id === sel || L.id === hover;
                  return (
                    <span key={L.text} className="absolute" style={{ left: L.x, top: L.y }}>
                      <span className="flex items-center gap-1 -translate-y-1/2">
                        <span className="w-[3px] h-[3px] rounded-full shrink-0" style={{ background: on ? C.acid : rgba(C.ivory, 0.5) }} />
                        <span className="block h-px w-4 shrink-0" style={{ background: on ? rgba(C.acid, 0.7) : rgba(C.ivory, 0.18) }} />
                        <span className="px-1.5 py-[3px] rounded text-[9.5px] tracking-[0.1em] uppercase whitespace-nowrap border"
                          style={{ background: 'rgba(17,17,13,0.82)', borderColor: on ? rgba(C.acid, 0.55) : 'rgba(243,235,221,0.12)', color: on ? C.acid : 'rgba(243,235,221,0.72)' }}>
                          {L.text}
                        </span>
                      </span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* view chips */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              {(['front', 'side', 'back', 'top', 'bottom'] as ViewKey[]).map((v) => (
                <button key={v} onClick={() => view(v)}
                  className="px-2 py-1 rounded-md bg-obsidian/70 border border-ivory/10 text-[9px] tracking-[0.14em] uppercase text-ivory/55 hover:text-ivory hover:border-ivory/25 transition-colors backdrop-blur-sm">
                  {v}
                </button>
              ))}
              <button onClick={resetView} title="Reset view and restore arrangement"
                className="px-2 py-1 rounded-md bg-obsidian/70 border border-ivory/10 text-[9px] tracking-[0.14em] uppercase text-ivory/55 hover:text-acid hover:border-acid/40 transition-colors backdrop-blur-sm">
                reset
              </button>
            </div>

            {/* mode + quick explode */}
            <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
              <button onClick={() => act((p.explode ?? 0) > 0.05 ? 'restore' : 'explode')}
                className="px-3 py-1.5 rounded-full text-[9.5px] font-semibold tracking-[0.16em] uppercase backdrop-blur-sm transition-all"
                style={{ background: (p.explode ?? 0) > 0.05 ? C.acid : 'rgba(17,17,13,0.75)', color: (p.explode ?? 0) > 0.05 ? C.obsidian : 'rgba(243,235,221,0.75)', border: `1px solid ${(p.explode ?? 0) > 0.05 ? 'transparent' : 'rgba(243,235,221,0.14)'}` }}>
                {(p.explode ?? 0) > 0.05 ? 'Restore anatomy' : 'Exploded view'}
              </button>
              <span className="px-2 py-1 rounded-md bg-obsidian/70 border border-ivory/10 text-[9px] tracking-[0.14em] uppercase text-ivory/40 backdrop-blur-sm">
                {sex === 'F' ? 'Female model' : 'Male model'} · LOD {detail.toFixed(2)}
              </span>
            </div>

            {/* region readout + return control */}
            <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
              <span className="px-2.5 py-1 rounded-full bg-obsidian/78 border border-ivory/12 text-[9px] tracking-[0.16em] uppercase text-ivory/55 backdrop-blur-sm">
                Inspecting · <span className="text-acid">{region === 'full' ? 'Full Body' : region === 'custom' ? (sel ? nameOf(sel) : 'Selected structure') : regionById(region).label}</span>
                <span className="ml-2 text-ivory/30 tabular-nums">×{(sim.camRef.current.zoom ?? 1).toFixed(2)}</span>
              </span>
              {region !== 'full' && (
                <button onClick={fullBody}
                  className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9.5px] font-semibold tracking-[0.16em] uppercase backdrop-blur-sm transition-all hover:brightness-110"
                  style={{ background: C.acid, color: C.obsidian }}>
                  <Icon name="arrow" className="w-3 h-3 rotate-180" /> Return to Full Body
                </button>
              )}
            </div>

            {/* floating camera cluster */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-1.5 rounded-2xl border border-ivory/12 bg-obsidian/78 backdrop-blur-sm">
              {([
                ['↶', 'Rotate left', () => nudge('yaw', -1)],
                ['↷', 'Rotate right', () => nudge('yaw', 1)],
              ] as [string, string, () => void][]).map(([g, t, fn]) => (
                <div key={t} className="grid grid-cols-2 gap-1">
                  <button title={t} aria-label={t} onPointerDown={holdRepeat(fn)} onPointerUp={stopRepeat} onPointerLeave={stopRepeat}
                    className="w-8 h-8 grid place-items-center rounded-lg border border-ivory/12 text-ivory/60 hover:text-acid hover:border-acid/40 transition-colors text-[13px] leading-none">{g}</button>
                </div>
              ))}
              <div className="h-px bg-ivory/10 my-0.5" />
              <button title="Tilt up" aria-label="Tilt up" onPointerDown={holdRepeat(() => nudge('pitch', 1))} onPointerUp={stopRepeat} onPointerLeave={stopRepeat}
                className="w-8 h-8 grid place-items-center rounded-lg border border-ivory/12 text-ivory/60 hover:text-acid hover:border-acid/40 transition-colors text-[13px] leading-none">▲</button>
              <button title="Tilt down" aria-label="Tilt down" onPointerDown={holdRepeat(() => nudge('pitch', -1))} onPointerUp={stopRepeat} onPointerLeave={stopRepeat}
                className="w-8 h-8 grid place-items-center rounded-lg border border-ivory/12 text-ivory/60 hover:text-acid hover:border-acid/40 transition-colors text-[13px] leading-none">▼</button>
              <div className="h-px bg-ivory/10 my-0.5" />
              <button title="Zoom in" aria-label="Zoom in" onClick={() => nudge('zoom', 1)}
                className="w-8 h-8 grid place-items-center rounded-lg border border-ivory/12 text-ivory/60 hover:text-acid hover:border-acid/40 transition-colors text-[13px] leading-none">+</button>
              <button title="Zoom out" aria-label="Zoom out" onClick={() => nudge('zoom', -1)}
                className="w-8 h-8 grid place-items-center rounded-lg border border-ivory/12 text-ivory/60 hover:text-acid hover:border-acid/40 transition-colors text-[13px] leading-none">−</button>
              <div className="h-px bg-ivory/10 my-0.5" />
              <button title="Focus selected region" aria-label="Focus selected region" disabled={!sel}
                onClick={() => { const eng = engRef.current; if (!eng || !sel) return; const bd = eng.boundsOf(sel); if (bd) { eng.focusRegion(bd.c, bd.r); setRegion('custom'); sim.camRef.current.zoom = 1; } }}
                className="w-8 h-8 grid place-items-center rounded-lg border text-[10px] transition-colors disabled:opacity-30"
                style={{ borderColor: rgba(C.acid, 0.35), color: C.acid }}>◎</button>
              <button title="Reset camera" aria-label="Reset camera" onClick={resetView}
                className="w-8 h-8 grid place-items-center rounded-lg border border-ivory/12 text-ivory/60 hover:text-ivory transition-colors">
                <Icon name="target" className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* exploded-view layer legend */}
            {(p.explode ?? 0) > 0.05 && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 hidden sm:flex flex-col gap-[3px] pointer-events-none">
                {SYSTEMS.filter((s2) => p[s2.k as string]).map((s2, i) => (
                  <span key={s2.k} className="flex items-center gap-1.5">
                    <span className="w-[14px] h-[2px] rounded-full" style={{ background: s2.color, opacity: 0.85 }} />
                    <span className="text-[8.5px] tracking-[0.14em] uppercase text-ivory/45">{String(i + 1).padStart(2, '0')} {s2.label}</span>
                  </span>
                ))}
                <span className="mt-1 text-[8px] tracking-[0.12em] uppercase text-ivory/25">dashed guides mark home</span>
              </div>
            )}

            {/* selection chip */}
            <AnimatePresence>
              {sel && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 pointer-events-none">
                  <span className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
                    style={{ borderColor: rgba(C.acid, 0.4), background: 'rgba(17,17,13,0.8)', color: C.acid }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.acid }} />
                    <span className="text-[10px] tracking-[0.16em] uppercase font-semibold">{selOrgan?.name ?? sel}</span>
                    <button onClick={() => { sim.setSel(null); hoverRef.current = null; }} className="ml-1 opacity-60 hover:opacity-100 pointer-events-auto" aria-label="Clear selection">
                      <Icon name="close" className="w-3 h-3" />
                    </button>
                  </span>
                  <span className="hidden sm:block text-[9px] tracking-[0.14em] uppercase text-ivory/25 pointer-events-none">
                    drag orbit · shift-drag pan · scroll zoom · click organ
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {tab === 'lab' && webgl === 'failed' && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center bg-obsidian/80">
                <div className="max-w-sm">
                  <Icon name="spark" className="w-7 h-7 mx-auto text-coral" />
                  <h4 className="font-display text-lg mt-3">WebGL is unavailable on this device</h4>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ivory/55">
                    The simulator switched to the schematic renderer — every system, organ, control and measurement still works.
                  </p>
                  <button onClick={() => setTab('schematic')} className="mt-4 px-4 py-2 rounded-full text-[10px] tracking-[0.2em] uppercase font-semibold" style={{ background: C.acid, color: C.obsidian }}>
                    Open schematic view
                  </button>
                </div>
              </div>
            )}
            {tab === 'lab' && webgl === 'pending' && (
              <div className="absolute inset-0 grid place-items-center bg-obsidian/70">
                <div className="flex flex-col items-center gap-2.5">
                  <span className="w-9 h-9 rounded-full border border-ivory/12 border-t-acid animate-spin" />
                  <span className="text-[9.5px] tracking-[0.24em] uppercase text-ivory/40">Preparing anatomy</span>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- compact telemetry ---------------- */}
          <div className="shrink-0 border-t border-ivory/10 bg-coal/60">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2">
              <span className="text-[9px] tracking-[0.2em] uppercase text-ivory/35 shrink-0 hidden sm:block">Vitals</span>
              <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                {keyMetrics.map((r) => (
                  <div key={r.label} className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[8.5px] tracking-[0.12em] uppercase text-ivory/32 truncate">{r.label}</span>
                    <span className="ml-auto text-[11px] font-semibold tabular-nums truncate" style={{ color: r.tone ?? C.ivory }}>{r.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowGraph((v) => !v)} aria-expanded={showGraph}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-ivory/12 text-[9px] tracking-[0.16em] uppercase text-ivory/50 hover:text-ivory transition-colors">
                <Icon name="spark" className="w-3 h-3" /> Trends
              </button>
            </div>
            <AnimatePresence initial={false}>
              {showGraph && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-ivory/8">
                  <div className="px-3 sm:px-4 py-2.5">
                    <canvas ref={sim.graphRef} className="w-full h-[74px] block" aria-label="Live physiology graph" />
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-ivory/40 line-clamp-2">{sim.explain}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ---------------- right rail (desktop) ---------------- */}
        <aside className="hidden lg:flex w-[350px] shrink-0 flex-col border-l border-ivory/10 bg-coal/45 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto sim-scroll">{rail}</div>
        </aside>
      </div>

      {/* ---------------- bottom sheet (mobile / tablet) ---------------- */}
      <div className="lg:hidden shrink-0 border-t border-ivory/10 bg-coal/70 backdrop-blur">
        <button onClick={() => setMobileSheet((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2.5">
          <Icon name="chip" className="w-4 h-4 text-acid" />
          <span className="text-[10px] tracking-[0.2em] uppercase text-ivory/70">Instruments</span>
          <span className="ml-auto text-[9px] tracking-[0.16em] uppercase text-ivory/35">{mobileSheet ? 'hide' : 'show'}</span>
          <Icon name="arrow" className={cn('w-3.5 h-3.5 text-ivory/40 transition-transform duration-300', mobileSheet && '-rotate-90')} />
        </button>
        <AnimatePresence initial={false}>
          {mobileSheet && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
              <div className="max-h-[52vh] overflow-y-auto sim-scroll border-t border-ivory/8">{rail}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const prio = (t: string) => { const i = PRIMARY_LABELS.indexOf(t); return i < 0 ? 0 : PRIMARY_LABELS.length - i; };
const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`;
};

/* ------------------------------------------------------------------ */
/*  rail contents — grouped from the spec so every control stays live  */
/* ------------------------------------------------------------------ */

const SYS_KEYS: string[] = SYSTEMS.map((s) => s.k as string);
/** Labels shown at default zoom — the rest appear on hover, zoom or explode. */
const SYSTEM_INFO: Record<string, { title: string; body: string; facts: string[] }> = {
  skin: { title: 'Skin & body surface', body: 'The largest organ: 1.5–2 m², roughly 16% of body mass. It is a living barrier, a radiator and a sensory surface — sweat evaporating from it is the body\'s primary way of shedding heat.', facts: ['~2 mm epidermis over dermis over subcutaneous fat', 'Sheds ~500 million cells a day', 'Toggle it off to see every layer beneath'] },
  muscle: { title: 'Musculature', body: 'Around 640 named skeletal muscles convert chemical energy into movement and heat, generating roughly 85% of body heat at rest and far more during exercise.', facts: ['30–40% of body mass', 'Raises core temperature under exercise load', 'Striated fibres run along the force line'] },
  skeleton: { title: 'Skeleton', body: '206 bones forming a loaded framework: the skull on a curved vertebral column, a rib cage hinged to the sternum, and a pelvic ring that transfers the whole body onto the femurs.', facts: ['Remodels ~10% per year', 'Stronger per weight than mild steel', 'Protects brain, heart and lungs'] },
  arteries: { title: 'Arterial tree', body: 'High-pressure conduits carrying oxygenated blood from the left ventricle. Their elastic walls smooth the pulsatile output into steady flow downstream.', facts: ['Wall about 1 mm thick', 'Pulse pressure falls with distance from the heart'] },
  veins: { title: 'Venous return', body: 'Low-capacitance return vessels with one-way valves; the skeletal muscle pump does most of the work pushing blood back to the right atrium.', facts: ['Hold ~64% of blood volume', 'Muscle pump is why standing still feels tiring'] },
  nerves: { title: 'Peripheral nerves', body: 'The spinal cord branches into segmental nerves that carry motor commands out and sensation back, at up to 120 m/s.', facts: ['Myelin raises conduction speed', 'Dermatomes map the body onto the cord'] },
  lymph: { title: 'Lymphatic chain', body: 'A one-way drainage network returning interstitial fluid to the bloodstream and sampling it for antigens at every node it passes.', facts: ['Returns ~3 L of protein-rich fluid daily', 'Node swelling is immune activity, not blockage'] },
  trachea: { title: 'Trachea & bronchi', body: 'A cartilage-braced airway that divides at the carina into main bronchi, then branches roughly 23 times to reach the alveoli.', facts: ['C-shaped rings keep it open under pressure change', 'Total airway cross-section explodes at the alveoli'] },
  diaphragm: { title: 'Diaphragm', body: 'The dome-shaped muscle that drives breathing. Its contraction flattens the dome, expanding the thorax and pulling air in — the primary muscle of inspiration.', facts: ['Innervated by the phrenic nerve (C3–C5)', 'Flattens on inhalation — watch it move with the breathing rate'] },
  pituitary: { title: 'Pituitary gland', body: 'A pea-sized master gland hanging from the hypothalamus; its hormones set thyroid output, adrenal steroid production, growth and fluid balance.', facts: ['~0.5 g of tissue', 'Controls more glands than any other organ'] },
};
const PRIMARY_LABELS = ['Heart', 'Brain · cerebrum', 'Right lung · 3 lobes', 'Left lung · 2 lobes', 'Liver', 'Stomach', 'Small intestine', 'Skeleton', 'Musculature', 'Diaphragm'];

function RailContent(props: {
  p: Record<string, number>; set: (k: string, v: number) => void; toggle: (k: string) => void;
  spec: Spec; sim: ReturnType<typeof useSimulation>;
  open: Record<string, boolean>; setOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  sex: 'M' | 'F'; tab: 'lab' | 'schematic'; setTab: (v: 'lab' | 'schematic') => void;
  onAct: (a: string) => void; onReset: () => void; onView: (v: ViewKey) => void;
  showGraph: boolean; setShowGraph: (v: boolean) => void;
  stats: { fps: number; tris: number; drawCalls: number }; webgl: string; blocked: boolean;
  spin: boolean; setSpin: (v: boolean) => void; onInternals: () => void;
  region: string; onFocusRegion: (k: string) => void;
}) {
  const { p, set, toggle, spec, sim, open, setOpen, sex, onAct, onReset, onView, onInternals, region, onFocusRegion: focusRegion } = props;
  const spinProp = props.spin; const setSpinProp = props.setSpin;
  const tog = (k: string) => spec.toggles?.find((t) => t.k === k);
  const choice = (k: string) => spec.choices?.find((c) => c.k === k);
  const ctrl = (k: string) => spec.ctrls.find((c) => c.k === k);
  const sysToggles = (spec.toggles ?? []).filter((t) => SYS_KEYS.includes(t.k));
  const extraToggles = (spec.toggles ?? []).filter((t) => !SYS_KEYS.includes(t.k) && t.k !== 'compare');
  const physKeys = ['hr', 'rr', 'ex', 'o2', 'bp', 'temp', 'hyd'];
  const viewKeys = ['explode', 'alpha', 'detail'];
  const selOrgan: { id: string; name: string; sys: string } | undefined = (ORGANS as { id: string; name: string; sys: string }[]).find((o) => o.id === sim.sel);
  const conditions = choice('cond');
  const vessels = choice('vessel');
  const condName = conditions ? conditions.options[Math.round(p.cond ?? 0)] : '';
  const blockedName = vessels ? vessels.options[Math.round(p.vessel ?? 0)] : '';

  const S = (id: string, title: string, icon: string, badge?: string, children?: React.ReactNode) => (
    <Section id={id} title={title} icon={icon} badge={badge} open={!!open[id]} onToggle={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
      {children}
    </Section>
  );

  return (
    <div className="divide-y-0">
      {/* 1 systems */}
      {S('systems', 'Anatomical systems', 'leaf', `${sysToggles.filter((t) => p[t.k]).length}/${sysToggles.length}`,
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {sysToggles.map((t) => (
              <Chip key={t.k} label={t.label} on={!!p[t.k]} color={SYSTEMS.find((s) => s.k === t.k)?.color ?? C.acid} onClick={() => toggle(t.k)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {extraToggles.map((t) => <Chip key={t.k} label={t.label} on={!!p[t.k]} onClick={() => toggle(t.k)} />)}
          </div>
          <button onClick={() => { sysToggles.forEach((t) => set(t.k, 1)); audio.chime(); }} className="text-[10px] tracking-[0.14em] uppercase text-ivory/40 hover:text-ivory transition-colors">Show all systems</button>
        </>)}

      {/* 2 model */}
      {S('view', 'Model & camera', 'compass', sex === 'F' ? 'Female' : 'Male',
        <>
          <div>
            <span className="block text-[10px] tracking-[0.14em] uppercase text-ivory/40 mb-1.5">Anatomical model</span>
            <Segmented options={[{ k: 'm' as const, label: 'Male' }, { k: 'f' as const, label: 'Female' }]}
              value={sex === 'F' ? 'f' : 'm'} onChange={(v) => { set('sex', v === 'f' ? 1 : 0); audio.whoosh(); }} />
          </div>
          <div>
            <span className="block text-[10px] tracking-[0.14em] uppercase text-ivory/40 mb-1.5">Camera</span>
            <div className="grid grid-cols-5 gap-1.5">
              {(['front', 'side', 'back', 'top', 'bottom'] as ViewKey[]).map((v) => (
                <button key={v} onClick={() => onView(v)} className="py-1.5 rounded-lg border border-ivory/12 text-[9px] tracking-[0.1em] uppercase text-ivory/50 hover:text-ivory hover:border-ivory/30 transition-colors">{v}</button>
              ))}
              <button onClick={onReset} className="py-1.5 rounded-lg border text-[9px] tracking-[0.1em] uppercase transition-colors" style={{ borderColor: rgba(C.acid, 0.35), color: C.acid }}>reset</button>
            </div>
          </div>
          {viewKeys.map((k) => { const c = ctrl(k); return c ? <Slider key={k} label={c.label} value={p[k]} min={c.min} max={c.max} step={c.step} unit={c.unit} onChange={(v) => set(k, v)} hint={k === 'explode' ? 'Systems separate into ordered layers with guide lines back to their anatomical position.' : undefined} /> : null; })}
          <button onClick={() => onAct((p.explode ?? 0) > 0.05 ? 'restore' : 'explode')}
            className="w-full py-2 rounded-lg text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors"
            style={{ background: (p.explode ?? 0) > 0.05 ? C.acid : 'transparent', color: (p.explode ?? 0) > 0.05 ? C.obsidian : C.acid, border: `1px solid ${rgba(C.acid, 0.35)}` }}>
            {(p.explode ?? 0) > 0.05 ? 'Restore exact arrangement' : 'Separate all systems'}
          </button>
          <div className="text-[10px] text-ivory/30 leading-relaxed">Renderer · {props.tab === 'lab' ? (props.webgl === 'ok' ? `WebGL PBR · ${props.stats.tris.toLocaleString()} tris · ${props.stats.fps} fps` : 'software fallback') : '2D schematic'}</div>
        </>)}

      {/* regions */}
      {S('regions', 'Body regions', 'search', region === 'full' ? undefined : regionById(region).label,
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {BODY_REGIONS.map((r) => (
              <button key={r.k} onClick={() => focusRegion(r.k)}
                className={cn('px-2.5 py-2 rounded-lg border text-left text-[10.5px] tracking-wide transition-all duration-200',
                  region === r.k ? 'border-transparent text-obsidian font-semibold' : 'border-ivory/12 text-ivory/55 hover:text-ivory hover:border-ivory/30 hover:translate-x-0.5')}
                style={region === r.k ? { background: r.k === 'full' ? C.ivory : C.acid } : undefined}>
                {r.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-ivory/32">
            Each target moves the orbit pivot to that region and frames it; you can then rotate a full 360°, pan and keep zooming. Head and feet are reachable independently at any depth.
          </p>
        </>)}

      {/* 3 physiology */}
      {S('physiology', 'Physiology', 'atom', `${Math.round(p.hr ?? 72)} bpm`,
        <>
          {physKeys.map((k) => { const c = ctrl(k); return c ? <Slider key={k} label={c.label} value={p[k]} min={c.min} max={c.max} step={c.step} unit={c.unit} onChange={(v) => set(k, v)} /> : null; })}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[9px] tracking-[0.16em] uppercase text-ivory/35">Time</span>
            <input type="range" min={0.1} max={8} step={0.1} value={sim.speed} onChange={(e) => sim.setSpeed(+e.target.value)} className="flex-1" aria-label="Simulation speed" style={{ accentColor: C.acid }} />
            <span className="text-[10px] tabular-nums text-ivory/60">×{sim.speed.toFixed(1)}</span>
          </div>
        </>)}

      {/* 4 vessels */}
      {S('vessels', 'Vessel experiment', 'target', props.blocked ? 'occluded' : undefined,
        <>
          <div>
            <span className="block text-[10px] tracking-[0.14em] uppercase text-ivory/40 mb-1.5">Target vessel</span>
            <div className="grid grid-cols-2 gap-1.5">
              {vessels?.options.map((o, i) => (
                <Chip key={o} label={o} on={Math.round(p.vessel ?? 0) === i} color={C.coral} onClick={() => { set('vessel', i); audio.tick(600); }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => onAct('stop')} className="py-2 rounded-lg text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ background: rgba('#FF4F4F', 0.14), color: '#FF6B5E', border: `1px solid ${rgba('#FF4F4F', 0.4)}` }}>Stop flow</button>
            <button onClick={() => onAct('resume')} className="py-2 rounded-lg text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ background: rgba(C.acid, 0.12), color: C.acid, border: `1px solid ${rgba(C.acid, 0.4)}` }}>Restore</button>
          </div>
          <p className="text-[10.5px] leading-relaxed text-ivory/40">
            Occluding <span className="text-ivory/70">{blockedName}</span> starves everything downstream — watch oxygen delivery and the tissue tint in the model respond, then restore circulation.
          </p>
        </>)}

      {/* 5 conditions */}
      {S('conditions', 'Conditions', 'flask', condName && condName !== 'Healthy baseline' ? condName : 'baseline',
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {conditions?.options.map((o, i) => (
              <Chip key={o} label={o} on={Math.round(p.cond ?? 0) === i} color={C.lav} onClick={() => { set('cond', i); set('mode', i === 0 ? 0 : 2); audio.tick(560); }} />
            ))}
          </div>
          {tog('compare') && <Chip label="Compare with normal" on={!!p.compare} onClick={() => toggle('compare')} />}
          <button onClick={() => { set('cond', 0); set('mode', 0); }} className="text-[10px] tracking-[0.14em] uppercase text-ivory/40 hover:text-ivory transition-colors">Clear condition</button>
          <p className="text-[10.5px] leading-relaxed text-ivory/35">Educational mechanism visualisation — never a diagnosis, and not a prediction for any individual.</p>
        </>)}

      {/* 6 organ inspection */}
      {S('organ', 'Organ inspection', 'search', selOrgan ? '1 active' : undefined,
        selOrgan ? (
          <>
            <div className="rounded-lg border p-3" style={{ borderColor: rgba(C.acid, 0.3), background: rgba(C.acid, 0.05) }}>
              <div className="font-display text-base text-ivory leading-tight">{selOrgan.name}</div>
              <div className="text-[9.5px] tracking-[0.16em] uppercase mt-0.5" style={{ color: SYSTEMS.find((s) => (s.k as string) === selOrgan.sys)?.color ?? C.acid }}>
                {SYSTEMS.find((s) => (s.k as string) === selOrgan.sys)?.label}
              </div>
            </div>
            {ctrl('isolate') && <Slider label={ctrl('isolate')!.label} value={p.isolate ?? 0} min={0} max={1} step={0.02} onChange={(v) => set('isolate', v)} hint="Pull the selected organ out for close, unobstructed inspection." />}
            <div className="grid grid-cols-2 gap-1.5">
              <Chip label="Isolate organ" on={(p.isolate ?? 0) > 0.5} onClick={() => set('isolate', (p.isolate ?? 0) > 0.5 ? 0 : 0.85)} />
              <Chip label="Turntable 360°" on={spinProp} onClick={() => setSpinProp(!spinProp)} />
              <Chip label="Internal view" on={!p.skin} onClick={onInternals} />
              <Chip label="Show all layers" on={false} onClick={() => { SYSTEMS.forEach((s2) => set(s2.k as string, 1)); }} />
              <Chip label="Return to body" on={false} onClick={() => { set('isolate', 0); set('explode', 0); sim.setSel(null); setSpinProp(false); }} />
            </div>
            <div className="text-[11px] leading-relaxed text-ivory/60 space-y-2 pt-1">
              {!sim.info && SYSTEM_INFO[sim.sel ?? ''] && (
                <>
                  <p className="whitespace-pre-line">{SYSTEM_INFO[sim.sel!].body}</p>
                  <ul className="space-y-1">{SYSTEM_INFO[sim.sel!].facts.map((f) => <li key={f} className="flex gap-2 text-[10.5px] text-ivory/45"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: C.acid }} />{f}</li>)}</ul>
                </>
              )}
              {sim.info ? (
                <>
                  <p className="whitespace-pre-line">{sim.info.body}</p>
                  {sim.info.facts && <ul className="space-y-1">{sim.info.facts.map((f) => <li key={f} className="flex gap-2 text-[10.5px] text-ivory/45"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: C.acid }} />{f}</li>)}</ul>}
                </>
              ) : <p className="text-ivory/35 italic">Reading anatomical dossier…</p>}
            </div>
          </>
        ) : <p className="text-[11px] leading-relaxed text-ivory/35">Click any organ in the model — brain, heart, lungs, liver, stomach, gut, kidneys, bladder, spleen, pancreas, thyroid or reproductive organs — to isolate and inspect it.</p>)}

      {/* 7 notes */}
      {S('notes', 'Field notes', 'book', undefined,
        <>
          <p className="text-[12px] leading-relaxed text-ivory/60">{spec.blurb}</p>
          <div className="p-3 rounded-lg border border-ivory/10 bg-obsidian/50">
            <div className="text-[9px] tracking-[0.18em] uppercase mb-1.5" style={{ color: spec.accent }}>Model fidelity</div>
            <p className="text-[11px] leading-relaxed text-ivory/50">{spec.method}</p>
          </div>
          <ul className="space-y-1.5">
            {spec.facts.map((f) => <li key={f} className="flex gap-2 text-[11.5px] leading-relaxed text-ivory/55"><span className="w-1 h-1 rounded-full mt-[7px] shrink-0" style={{ background: spec.accent }} />{f}</li>)}
          </ul>
          <div className="p-3 rounded-lg border border-ivory/10">
            <div className="text-[9px] tracking-[0.18em] uppercase text-ivory/35 mb-1.5">Asset provenance</div>
            {ASSET_MANIFEST.slice(0, 4).map((a) => (
              <p key={a.name} className="text-[10px] leading-relaxed text-ivory/40 mt-1">
                <span className="text-ivory/65">{a.name}</span> — {a.source} · {a.licence === 'original' ? 'original, no attribution required' : a.licence}
              </p>
            ))}
          </div>
        </>)}
      <div className="h-2" />
    </div>
  );
}
