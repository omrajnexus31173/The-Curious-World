import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROOMS, EXHIBITS, type Exhibit } from '../data/content';
import { makeShape, renderShape } from '../engine/shapes3d';
import { parseHash, pushRouteHash, dismissRouteHash, useHashChange } from '../lib/route';
import { Icon, Reveal, SectionHead, KeyDot } from './ui';
import { useProgress, progress } from '../lib/progress';
import HeartExhibit from './HeartExhibit';

/* ---------- static mini wireframe for cards ---------- */
function MiniShape({ kind, accent }: { kind: string; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (w < 4 || h < 4) return;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderShape(ctx, makeShape(kind), {
      cx: w / 2, cy: h / 2, scale: Math.min(w, h) * 0.31,
      rotX: 0.55, rotY: 0.7, color: accent, alpha: 0.9, lineWidth: 1,
    });
  }, [kind, accent]);
  return <canvas ref={ref} className="w-full h-full" aria-hidden />;
}

/* ---------- interactive rotating viewer ---------- */
function ShapeStage({ kind, accent, label }: { kind: string; accent: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const shape = useMemo(() => makeShape(kind), [kind]);
  const rot = useRef({ x: 0.5, y: 0.7, tx: 0.5, ty: 0.7 });
  const ctrl = useRef({ zoom: 1, explode: 0, auto: true, dragging: false });
  const [auto, setAuto] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [explode, setExplode] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => { ctrl.current.auto = auto; }, [auto]);
  useEffect(() => { ctrl.current.zoom = zoom; }, [zoom]);
  useEffect(() => { ctrl.current.explode = explode; }, [explode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) { setFailed(true); return; }
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) { setFailed(true); return; }
    const g = ctx;
    let raf = 0;
    let last = performance.now();
    let painted = false;
    let disposed = false;

    /* Returns false while the canvas still has no measurable size (layout
       not settled yet) so the caller retries instead of showing nothing. */
    const drawFrame = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w < 4 || h < 4) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      g.clearRect(0, 0, w, h);
      const m = Math.min(w, h);
      renderShape(g, shape, {
        cx: w / 2, cy: h / 2, scale: m * 0.3 * ctrl.current.zoom,
        rotX: rot.current.x, rotY: rot.current.y,
        explode: ctrl.current.explode, color: accent, alpha: 0.9, lineWidth: 1.1, fillGlow: true,
      });
      if (!painted) {
        painted = true;
        if (!disposed) setReady(true);
      }
      return true;
    };

    if (reduced) {
      if (!drawFrame()) {
        /* layout not settled — retry on resize and on frames until it is */
        const ro = new ResizeObserver(() => { if (drawFrame()) ro.disconnect(); });
        if (wrapRef.current) ro.observe(wrapRef.current);
        let tries = 0;
        const retry = () => {
          if (disposed || painted || tries++ > 90) return;
          if (!drawFrame()) raf = requestAnimationFrame(retry);
        };
        raf = requestAnimationFrame(retry);
        const safety = window.setTimeout(() => { if (!disposed) setReady(true); }, 2500);
        return () => { disposed = true; cancelAnimationFrame(raf); clearTimeout(safety); ro.disconnect(); };
      }
      const ro = new ResizeObserver(() => drawFrame());
      if (wrapRef.current) ro.observe(wrapRef.current);
      const safety = window.setTimeout(() => { if (!disposed) setReady(true); }, 2500);
      return () => { disposed = true; clearTimeout(safety); ro.disconnect(); };
    }

    const loop = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = ctrl.current;
      if (!c.dragging && c.auto) rot.current.ty += dt * 0.45;
      rot.current.x += (rot.current.tx - rot.current.x) * Math.min(1, dt * 10);
      rot.current.y += (rot.current.ty - rot.current.y) * Math.min(1, dt * 10);
      drawFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const safety = window.setTimeout(() => { if (!disposed) setReady(true); }, 2500);
    return () => { disposed = true; cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [shape, accent, reduced]);

  const onDown = (e: React.PointerEvent) => {
    ctrl.current.dragging = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!ctrl.current.dragging) return;
    rot.current.ty += e.movementX * 0.008;
    rot.current.tx = Math.max(-1.4, Math.min(1.4, rot.current.tx + e.movementY * 0.008));
  };
  const onUp = () => { ctrl.current.dragging = false; };

  if (failed) {
    return (
      <div className="w-full flex-1 min-h-[300px] sm:min-h-0 flex flex-col items-center justify-center text-center p-8 border border-ivory/12 rounded-xl" style={{ background: `radial-gradient(ellipse 80% 90% at 50% 60%, ${accent}14, transparent 70%)` }}>
        <span className="w-12 h-12 grid place-items-center rounded-full border" style={{ borderColor: `${accent}66`, color: accent }}>
          <Icon name="spark" />
        </span>
        <h4 className="font-display text-xl text-ivory mt-4">{label}</h4>
        <p className="mt-2 text-[12.5px] text-ivory/55 max-w-xs leading-relaxed">
          The live 3D renderer couldn’t start on this device, so here is the installation dossier instead — the full description and key facts are beside this panel.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 min-h-[300px] sm:min-h-0 flex flex-col">
      <div ref={wrapRef} className="flex-1 min-h-0 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none select-none"
          data-cursor="drag"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label={`Interactive 3D exhibit, ${label} — drag to rotate`}
        />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden>
            <div className="flex flex-col items-center gap-3">
              <span className="w-10 h-10 rounded-full border border-ivory/15 border-t-acid spin-slow" style={{ animationDuration: '1.1s' }} />
              <span className="tick-label text-ivory/40">Initialising installation</span>
            </div>
          </div>
        )}
        <span className="absolute bottom-2 left-3 tick-label text-ivory/30 pointer-events-none">Drag to rotate</span>
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-ivory/10">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] tracking-[0.2em] uppercase text-ivory/45">Zoom</span>
            <span className="text-[10px] text-acid tabular-nums">{zoom.toFixed(1)}×</span>
          </div>
          <input type="range" min="0.6" max="1.7" step="0.1" value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-full" aria-label="Zoom" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] tracking-[0.2em] uppercase text-ivory/45">Disassemble</span>
            <span className="text-[10px] text-coral tabular-nums">{Math.round(explode * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05" value={explode} onChange={(e) => setExplode(+e.target.value)} className="w-full range-coral" aria-label="Disassemble structure" />
        </div>
        <div>
          <span className="text-[10px] tracking-[0.2em] uppercase text-ivory/45 block mb-2">Auto-spin</span>
          <button
            data-cursor="play"
            onClick={() => setAuto((a) => !a)}
            className={`w-full py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase border transition-colors ${auto ? 'border-acid text-acid' : 'border-ivory/20 text-ivory/40'}`}
          >
            {auto ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- overlay ---------- */
function ExhibitOverlay({ exhibit, onClose, onNav }: { exhibit: Exhibit; onClose: () => void; onNav: (dir: 1 | -1) => void }) {
  const room = ROOMS.find((r) => r.id === exhibit.room)!;
  useEffect(() => {
    progress.markExhibit(exhibit.id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNav(1);
      if (e.key === 'ArrowLeft') onNav(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [exhibit.id, onClose, onNav]);

  return (
    <motion.div className="fixed inset-0 z-[75] flex items-stretch sm:items-center justify-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={exhibit.title}>
      <div className="absolute inset-0 bg-obsidian/85 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.985 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.985 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-5xl max-h-[92vh] sm:max-h-[86vh] overflow-y-auto sm:overflow-hidden bg-coal border border-ivory/14 sm:rounded-2xl flex flex-col sm:flex-row"
        style={{ boxShadow: `0 30px 140px ${exhibit.accent}1f` }}
      >
        <div className="sm:w-[56%] min-h-[320px] sm:min-h-[520px] p-5 sm:p-7 bg-obsidian/40 flex flex-col">
          {exhibit.kind === 'heart'
            ? <HeartExhibit key={exhibit.id} />
            : <ShapeStage key={exhibit.id} kind={exhibit.kind} accent={exhibit.accent} label={exhibit.title} />}
        </div>
        <div className="flex-1 p-6 sm:p-8 flex flex-col relative overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="tick-label" style={{ color: exhibit.accent }}>{room.name}</span>
              <h3 className="font-display text-3xl sm:text-4xl mt-2 text-ivory leading-tight">{exhibit.title}</h3>
            </div>
            <button data-cursor="add" onClick={onClose} className="w-10 h-10 shrink-0 grid place-items-center rounded-full border border-ivory/15 text-ivory/70 hover:text-acid hover:border-acid transition-colors" aria-label="Close exhibit">
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-ivory/60">{exhibit.desc}</p>
          <div className="mt-6 space-y-2.5">
            {exhibit.facts.map((f) => (
              <div key={f} className="flex items-center gap-3 text-[12.5px] text-ivory/70 border border-ivory/10 rounded-lg px-4 py-2.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: exhibit.accent }} />
                {f}
              </div>
            ))}
          </div>
          <div className="mt-auto pt-8 flex items-center justify-between">
            <button data-cursor="view" onClick={() => onNav(-1)} className="flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase text-ivory/50 hover:text-ivory transition-colors">
              <Icon name="arrow" className="w-4 h-4 rotate-180" /> Prev
            </button>
            <span className="tick-label text-ivory/25">Use ← → keys</span>
            <button data-cursor="view" onClick={() => onNav(1)} className="flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase text-ivory/50 hover:text-ivory transition-colors">
              Next <Icon name="arrow" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- section ---------- */
export default function Museum() {
  /* Selection is an ID; the exhibit object is derived fresh from EXHIBITS
     on every render so a selection can never render another installation. */
  const [openId, setOpenId] = useState<string | null>(() => {
    const r = parseHash(window.location.hash);
    return r.kind === 'exhibit' && EXHIBITS.some((e) => e.id === r.id) ? r.id : null;
  });
  const prog = useProgress();
  const open = EXHIBITS.find((e) => e.id === openId) ?? null;
  const openRef = useRef(openId);
  openRef.current = openId;

  const openExhibit = useCallback((id: string) => {
    if (!EXHIBITS.some((e) => e.id === id)) return;
    setOpenId(id);
    pushRouteHash(`#/exhibit/${id}`);
  }, []);

  const closeExhibit = useCallback(() => {
    setOpenId(null);
    dismissRouteHash();
  }, []);

  /* Back/forward + direct links: the hash is the source of truth. */
  useHashChange(() => {
    const r = parseHash(window.location.hash);
    if (r.kind === 'exhibit' && EXHIBITS.some((e) => e.id === r.id)) {
      const wasOpen = openRef.current !== null;
      setOpenId(r.id);
      if (!wasOpen) {
        document.getElementById('museum')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (r.kind === 'none') {
      setOpenId(null);
    } else {
      /* a world hash belongs to discovery — never show an exhibit for it */
      setOpenId(null);
    }
  });

  /* Direct landing on an exhibit link: bring the rooms into view. */
  useEffect(() => {
    if (openId) {
      const t = window.setTimeout(() => {
        document.getElementById('museum')?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 350);
      return () => window.clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = useCallback((dir: 1 | -1) => {
    const cur = EXHIBITS.find((e) => e.id === openRef.current);
    if (!cur) return;
    const inRoom = EXHIBITS.filter((e) => e.room === cur.room);
    const i = inRoom.findIndex((e) => e.id === cur.id);
    const next = inRoom[(i + dir + inRoom.length) % inRoom.length];
    setOpenId(next.id);
    pushRouteHash(`#/exhibit/${next.id}`);
  }, []);

  return (
    <section id="museum" className="relative py-24 sm:py-32" aria-label="The Interactive Museum">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 40% at 20% 0%, rgba(255,112,79,0.05), transparent 60%)' }} />
      <div className="relative max-w-[1500px] mx-auto px-6 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            index="EXP 02"
            label="The Interactive Museum"
            accent="#FF704F"
            title={<>Four rooms, sixteen <span className="italic text-coral">installations</span></>}
            sub="Not product cards — working objects. Drag to rotate them, disassemble them, switch systems on and off. Every exhibit you open is recorded in your progress."
          />
          <Reveal delay={0.2}>
            <div className="flex items-center gap-3 border border-ivory/12 rounded-full px-5 py-2.5">
              <KeyDot active color="#FF704F" />
              <span className="text-[11px] tracking-[0.2em] uppercase text-ivory/55">Visited {prog.exhibits.length} / {EXHIBITS.length}</span>
            </div>
          </Reveal>
        </div>

        <div className="mt-16 space-y-16">
          {ROOMS.map((room, ri) => (
            <div key={room.id}>
              <Reveal>
                <div className="flex items-center gap-4 mb-6">
                  <span className="font-display text-2xl italic" style={{ color: room.accent }}>Room {String(ri + 1).padStart(2, '0')}</span>
                  <h3 className="font-display text-2xl sm:text-3xl text-ivory">{room.name}</h3>
                  <span className="hidden sm:block h-px flex-1 max-w-[220px]" style={{ background: `linear-gradient(90deg, ${room.accent}66, transparent)` }} />
                  <p className="hidden lg:block text-[12px] text-ivory/40 italic">{room.desc}</p>
                </div>
              </Reveal>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {EXHIBITS.filter((e) => e.room === room.id).map((e, i) => (
                  <Reveal key={e.id} delay={i * 0.07}>
                    <button
                      data-cursor="view"
                      onClick={() => openExhibit(e.id)}
                      className="group w-full text-left border border-ivory/12 rounded-xl overflow-hidden bg-coal/50 hover:bg-coal transition-colors duration-400"
                      style={{ boxShadow: prog.exhibits.includes(e.id) ? `inset 0 0 0 1px ${e.accent}44` : undefined }}
                    >
                      <div className="h-32 sm:h-36 relative" style={{ background: `radial-gradient(ellipse 80% 90% at 50% 60%, ${e.accent}12, transparent 70%)` }}>
                        {e.kind === 'heart' ? (
                          <div className="w-full h-full grid place-items-center">
                            <Icon name="heart" className="w-12 h-12 transition-transform duration-500 group-hover:scale-110" style={{ color: e.accent }} />
                          </div>
                        ) : (
                          <div className="w-full h-full p-4"><MiniShape kind={e.kind} accent={e.accent} /></div>
                        )}
                        {prog.exhibits.includes(e.id) && (
                          <span className="absolute top-2.5 right-2.5 flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-ivory/50">
                            <Icon name="check" className="w-3 h-3" style={{ color: e.accent }} /> VISITED
                          </span>
                        )}
                      </div>
                      <div className="p-4 border-t border-ivory/10">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-[13px] font-semibold text-ivory/85 group-hover:text-ivory transition-colors truncate">{e.title}</h4>
                          <Icon name="arrow" className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" style={{ color: e.accent }} />
                        </div>
                        <p className="mt-1.5 text-[11px] text-ivory/40 line-clamp-2 leading-relaxed">{e.desc}</p>
                      </div>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {open && <ExhibitOverlay key={open.id} exhibit={open} onClose={closeExhibit} onNav={nav} />}
      </AnimatePresence>
    </section>
  );
}
