import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GlobeEngine } from '../engine/GlobeEngine';
import { LOCATIONS, CAT_ACCENT, type Loc, type LocCat } from '../data/content';
import { Icon, Reveal, SectionHead, KeyDot } from './ui';
import { useProgress, progress } from '../lib/progress';
import { cn } from '../utils/cn';

const CATS: (LocCat | 'All')[] = ['All', 'Science', 'Nature', 'Civilization', 'Technology', 'Earth'];

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const [selected, setSelected] = useState<Loc | null>(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<LocCat | 'All'>('All');
  const [auto, setAuto] = useState(true);
  const prog = useProgress();

  const pickLoc = (loc: Loc | null) => {
    setSelected(loc);
    engineRef.current?.setSelected(loc?.id ?? null);
    if (loc) {
      engineRef.current?.focus(loc);
      progress.markPlace(loc.id);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const quality: 0 | 1 = window.innerWidth > 900 ? 1 : 0;
    const engine = new GlobeEngine();
    engine.init(canvas, LOCATIONS, quality);
    engine.setOnPick((id) => {
      const loc = LOCATIONS.find((l) => l.id === id) ?? null;
      pickLoc(loc);
    });
    engineRef.current = engine;

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) engine.start();
      else engine.stop();
    });
    if (stageRef.current) io.observe(stageRef.current);
    return () => { ro.disconnect(); io.disconnect(); engine.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engineRef.current?.setAuto(auto); }, [auto]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LOCATIONS.filter((l) => (cat === 'All' || l.cat === cat) && (!q || l.name.toLowerCase().includes(q) || l.cat.toLowerCase().includes(q)));
  }, [query, cat]);

  const surprise = () => {
    const unvisited = LOCATIONS.filter((l) => !prog.places.includes(l.id));
    const pool = unvisited.length ? unvisited : LOCATIONS;
    pickLoc(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <section id="globe" className="relative py-24 sm:py-32" aria-label="The 3D World Explorer">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(181,154,255,0.06), transparent 60%)' }} />
      <div className="relative max-w-[1500px] mx-auto px-6 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            index="EXP 03"
            label="The 3D World Explorer"
            accent="#B59AFF"
            title={<>One planet, <span className="italic text-lav">every story</span></>}
            sub={`${LOCATIONS.length} sites where science, civilization and nature intersect. Drag the globe to spin it, click a marker to focus, or search your way there. Selected sites trace discovery arcs to their siblings.`}
          />
          <Reveal delay={0.2}>
            <div className="flex items-center gap-3 border border-ivory/12 rounded-full px-5 py-2.5">
              <KeyDot active color="#B59AFF" />
              <span className="text-[11px] tracking-[0.2em] uppercase text-ivory/55">Charted {prog.places.length} / {LOCATIONS.length}</span>
            </div>
          </Reveal>
        </div>

        <div className="mt-14 grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
          {/* globe stage */}
          <Reveal className="relative">
            <div
              ref={stageRef}
              className="relative w-full h-[52vh] min-h-[380px] lg:h-[62vh] border border-ivory/12 rounded-2xl overflow-hidden bg-coal/40"
              style={{ backgroundImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(181,154,255,0.05), transparent 70%)' }}
            >
              <canvas ref={canvasRef} className="w-full h-full touch-none" data-cursor="drag" aria-label="Interactive globe — drag to rotate, click a marker to explore" />
              <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-lav pulse-dot" />
                <span className="tick-label text-ivory/40">Orbit · live</span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <span className="tick-label text-ivory/30">Drag to rotate · click markers</span>
                <button
                  data-cursor="play"
                  onClick={() => setAuto((a) => !a)}
                  className={cn('pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] tracking-[0.2em] uppercase transition-colors', auto ? 'border-lav text-lav' : 'border-ivory/20 text-ivory/40')}
                >
                  <Icon name="orbit" className="w-3.5 h-3.5" /> {auto ? 'Auto-orbit on' : 'Auto-orbit off'}
                </button>
              </div>
            </div>
          </Reveal>

          {/* control column */}
          <div className="flex flex-col gap-5">
            <Reveal delay={0.1}>
              <div className="relative">
                <Icon name="search" className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ivory/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search sites — volcano, pyramid, reactor…"
                  className="w-full bg-coal/60 border border-ivory/15 rounded-full pl-11 pr-4 py-3.5 text-sm text-ivory placeholder:text-ivory/30 focus:border-lav focus:outline-none transition-colors"
                  data-cursor="add"
                  aria-label="Search locations"
                />
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="flex flex-wrap gap-2">
                {CATS.map((c) => (
                  <button
                    key={c}
                    data-cursor="view"
                    onClick={() => setCat(c)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full border text-[10.5px] tracking-[0.18em] uppercase transition-all duration-300',
                      cat === c ? 'border-transparent text-obsidian font-semibold' : 'border-ivory/15 text-ivory/50 hover:text-ivory'
                    )}
                    style={cat === c ? { background: c === 'All' ? '#F3EBDD' : CAT_ACCENT[c] } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.2} className="flex-1 min-h-0">
              <div className="border border-ivory/12 rounded-2xl bg-coal/40 divide-y divide-ivory/8 max-h-[300px] lg:max-h-[340px] overflow-y-auto" role="list" aria-label="Locations">
                {filtered.length === 0 && (
                  <div className="p-6 text-sm text-ivory/40">No sites match “{query}”. Try “trench” or “dish”.</div>
                )}
                {filtered.map((l) => (
                  <button
                    key={l.id}
                    data-cursor="pick"
                    onClick={() => pickLoc(l)}
                    role="listitem"
                    className={cn(
                      'w-full text-left px-5 py-3 flex items-center gap-3 transition-colors duration-200 hover:bg-ivory/4',
                      selected?.id === l.id && 'bg-ivory/6'
                    )}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_ACCENT[l.cat] }} />
                    <span className={cn('text-[13px] truncate', selected?.id === l.id ? 'text-ivory' : 'text-ivory/70')}>{l.name}</span>
                    {prog.places.includes(l.id) && <Icon name="check" className="w-3.5 h-3.5 shrink-0 text-ivory/30" />}
                    <span className="ml-auto text-[9.5px] tracking-[0.18em] uppercase text-ivory/30 shrink-0">{l.cat}</span>
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.25}>
              <button
                data-cursor="add"
                onClick={surprise}
                className="w-full flex items-center justify-center gap-2.5 bg-lav text-obsidian py-3.5 rounded-full text-[11px] font-semibold tracking-[0.24em] uppercase hover:shadow-[0_0_40px_rgba(181,154,255,0.35)] transition-shadow"
              >
                <Icon name="compass" className="w-4 h-4" />
                Surprise me — random site
              </button>
            </Reveal>
          </div>
        </div>

        {/* selected site card */}
        <div className="mt-6 min-h-[92px]">
          <AnimateSlide loc={selected} />
        </div>
      </div>
    </section>
  );
}

function AnimateSlide({ loc }: { loc: Loc | null }) {
  return (
    <motion.div
      key={loc?.id ?? 'none'}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn('border rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4', loc ? 'bg-coal/60' : 'bg-transparent border-dashed border-ivory/10')}
    >
      {loc ? (
        <>
          <div className="flex items-center gap-3 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_ACCENT[loc.cat], boxShadow: `0 0 14px ${CAT_ACCENT[loc.cat]}` }} />
            <div>
              <h3 className="font-display text-xl sm:text-2xl text-ivory">{loc.name}</h3>
              <span className="text-[10px] tracking-[0.24em] uppercase" style={{ color: CAT_ACCENT[loc.cat] }}>{loc.cat} · {loc.lat.toFixed(1)}°, {loc.lon.toFixed(1)}°</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-ivory/60 sm:ml-4">{loc.fact}</p>
        </>
      ) : (
        <p className="text-sm text-ivory/40 italic">Select a marker, search a name, or let the universe pick one for you.</p>
      )}
    </motion.div>
  );
}
