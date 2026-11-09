import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { WORLDS } from '../data/content';
import { parseHash, pushRouteHash, dismissRouteHash, useHashChange } from '../lib/route';
import { Icon, SectionHead } from './ui';

gsap.registerPlugin(ScrollTrigger);

/* faint star strip that parallaxes against the pinned section */
function useStarStrip(ref: React.RefObject<HTMLCanvasElement | null>, onProgress: (p: number) => void) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const w = (canvas.width = canvas.clientWidth * 1.4);
      const h = canvas.height = canvas.clientHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 1.3 + 0.3;
        ctx.globalAlpha = 0.08 + Math.random() * 0.3;
        ctx.fillStyle = Math.random() < 0.15 ? '#B59AFF' : '#F3EBDD';
        ctx.fillRect(x, y, r, r);
      }
      ctx.globalAlpha = 1;
    };
      draw();
      const onR = () => draw();
      window.addEventListener('resize', onR);
      return () => window.removeEventListener('resize', onR);
  }, [ref, onProgress]);
}

function GenRings({ accent }: { accent: string }) {
  return (
    <svg className="absolute -right-20 -top-24 w-[380px] h-[380px] opacity-25 pointer-events-none" viewBox="0 0 380 380" aria-hidden>
      <g className="gen-ring spin-slow">
        <circle cx="190" cy="190" r="150" fill="none" stroke={accent} strokeWidth="0.7" strokeDasharray="2 7" />
        <circle cx="190" cy="190" r="105" fill="none" stroke={accent} strokeWidth="0.7" strokeDasharray="30 12" />
      </g>
      <g className="gen-ring spin-slower">
        <circle cx="190" cy="190" r="178" fill="none" stroke={accent} strokeWidth="0.5" />
        <circle cx="190" cy="40" r="3.5" fill={accent} />
      </g>
      <circle cx="190" cy="190" r="2.5" fill={accent} />
    </svg>
  );
}

export default function Discovery() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  /* Selection is an ID; the world object is derived fresh from WORLDS on
     every render so a selection can never render another world's data. */
  const [openId, setOpenId] = useState<string | null>(() => {
    const r = parseHash(window.location.hash);
    return r.kind === 'world' && WORLDS.some((w) => w.id === r.id) ? r.id : null;
  });
  const open = WORLDS.find((w) => w.id === openId) ?? null;

  const openWorld = useCallback((id: string) => {
    if (!WORLDS.some((w) => w.id === id)) return;
    setOpenId(id);
    pushRouteHash(`#/world/${id}`);
  }, []);

  const closeWorld = useCallback(() => {
    setOpenId(null);
    dismissRouteHash();
  }, []);

  /* Back/forward + direct links: the hash is the source of truth. */
  useHashChange(() => {
    const r = parseHash(window.location.hash);
    if (r.kind === 'world' && WORLDS.some((w) => w.id === r.id)) {
      setOpenId(r.id);
    } else if (r.kind === 'none') {
      setOpenId(null);
    } else {
      /* an exhibit hash belongs to the museum — never show a world for it */
      setOpenId(null);
    }
  });

  const onProgress = (p: number) => {
    if (stripRef.current) stripRef.current.style.transform = `translateX(${-p * 220}px)`;
  };
  useStarStrip(stripRef, onProgress);

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      const getShift = () => track.scrollWidth - window.innerWidth;
      gsap.to(track, {
        x: () => -getShift(),
        ease: 'none',
        scrollTrigger: {
          trigger: wrap,
          start: 'top top',
          end: () => '+=' + getShift(),
          scrub: reduced ? false : 1,
          pin: !reduced,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (stripRef.current) stripRef.current.style.transform = `translateX(${-self.progress * 220}px)`;
          },
        },
      });
      gsap.from('.disc-rise', {
        y: 46, opacity: 0, stagger: 0.07, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: wrap, start: 'top 75%', once: true },
      });
    }, wrap);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWorld(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, closeWorld]);

  const topicsCount = useMemo(() => WORLDS.reduce((a, w) => a + w.topics.length, 0), []);

  return (
    <section id="discovery" className="relative" aria-label="The Discovery Universe">
      {/* intro header (non-pinned) */}
      <div className="max-w-[1500px] mx-auto px-6 sm:px-10 pt-24 sm:pt-32 pb-10">
        <SectionHead
          index="EXP 01"
          label="The Discovery Universe"
          accent="#D7FF45"
          title={<>Eight worlds of <span className="italic text-acid">knowledge</span></>}
          sub={`${topicsCount} subjects, each with its own environment and motion language. Drag through the scroll — this corridor moves sideways while the stars keep drifting.`}
        />
        <div className="flex items-center gap-3 mt-8 text-ivory/30">
          <Icon name="arrow" className="w-4 h-4" />
          <span className="tick-label">Scroll to travel</span>
        </div>
      </div>

      {/* pinned horizontal corridor */}
      <div ref={wrapRef} className="relative h-svh min-h-[560px] overflow-hidden">
        <canvas ref={stripRef} className="absolute inset-0 h-full w-[140%] opacity-70 pointer-events-none" aria-hidden />
        <div className="absolute top-6 left-6 sm:left-10 z-20 flex items-center gap-3">
          <span className="tick-label text-acid">Travel corridor</span>
          <span className="tick-label text-ivory/30">{WORLDS.length} stations</span>
        </div>

        <div ref={trackRef} className="absolute inset-y-0 flex items-center gap-6 sm:gap-12 pl-6 sm:pl-16 pr-16 will-change-transform">
          {WORLDS.map((w) => (
            <article
              key={w.id}
              className="disc-panel relative shrink-0 h-[68vh] min-h-[430px] w-[82vw] sm:w-[46vw] lg:w-[38vw] max-w-[560px] border border-ivory/12 rounded-2xl bg-coal/60 backdrop-blur-[2px] overflow-hidden group"
              style={{ backgroundImage: `radial-gradient(ellipse 90% 60% at 78% 12%, ${w.accent}14, transparent 60%)` }}
            >
              <GenRings accent={w.accent} />
              <div className="relative z-10 h-full flex flex-col p-6 sm:p-8">
                <div className="disc-rise flex items-start justify-between">
                  <span
                    className="font-display text-6xl sm:text-7xl font-light text-outline leading-none select-none"
                    style={{ WebkitTextStroke: `1px ${w.accent}66` }}
                  >
                    {w.num}
                  </span>
                  <span className="w-10 h-10 grid place-items-center rounded-full border transition-colors duration-300" style={{ borderColor: `${w.accent}55`, color: w.accent }}>
                    <Icon name={w.icon} />
                  </span>
                </div>

                <div className="disc-rise mt-5">
                  <h3 className="font-display text-3xl sm:text-[2.6rem] leading-tight text-ivory">{w.name}</h3>
                  <p className="mt-2 text-[13px] text-ivory/50 italic">{w.tagline}</p>
                </div>

                <div className="disc-rise mt-6 flex-1 min-h-0 overflow-y-auto pr-1" role="list" aria-label={`${w.name} topics`}>
                  {w.topics.map((t, ti) => (
                    <button
                      key={`${w.id}:${t.name}`}
                      data-cursor="view"
                      onClick={() => openWorld(w.id)}
                      role="listitem"
                      className="group/t w-full text-left flex items-center gap-3 py-2.5 border-b border-ivory/8 transition-all duration-300 hover:pl-2"
                    >
                      <span className="text-[10px] tabular-nums" style={{ color: w.accent }}>{String(ti + 1).padStart(2, '0')}</span>
                      <span className="text-[13.5px] text-ivory/75 group-hover/t:text-ivory transition-colors duration-300">{t.name}</span>
                      <Icon name="plus" className="w-3.5 h-3.5 ml-auto opacity-0 group-hover/t:opacity-100 transition-opacity duration-300" style={{ color: w.accent }} />
                    </button>
                  ))}
                </div>

                <div className="disc-rise mt-5 pt-4 border-t border-ivory/10 flex items-center justify-between">
                  <button data-cursor="add" onClick={() => openWorld(w.id)} className="flex items-center gap-2.5 text-[11px] tracking-[0.26em] uppercase font-semibold transition-all duration-300" style={{ color: w.accent }}>
                    Open world
                    <Icon name="arrow" className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </button>
                  <span className="text-[10px] tracking-[0.24em] text-ivory/30">{w.num} / 08</span>
                </div>
              </div>
            </article>
          ))}

          {/* end card */}
          <article className="disc-panel shrink-0 w-[70vw] sm:w-[34vw] max-w-[440px] h-[56vh] min-h-[360px] border border-ivory/12 rounded-2xl bg-slab/60 p-8 flex flex-col justify-center">
            <span className="tick-label text-ivory/40">End of corridor</span>
            <h3 className="font-display text-3xl sm:text-4xl mt-4 leading-tight">
              Every world is <span className="italic text-coral">connected</span>.
            </h3>
            <p className="mt-4 text-sm text-ivory/50 leading-relaxed">
              The museum, the globe and the lab pick up where discovery leaves off. Keep descending — the universe is deeper than it looks.
            </p>
            <button
              data-cursor="add"
              onClick={() => document.getElementById('museum')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-7 self-start flex items-center gap-2.5 text-[11px] tracking-[0.26em] uppercase font-semibold text-acid"
            >
              Continue to the museum <Icon name="arrow" className="w-4 h-4 -rotate-90" />
            </button>
          </article>
        </div>
      </div>

      {/* world modal — keyed per world ID so each selection mounts its own
          content, entrance animation and topic list; no stale output can
          persist between worlds, in any order, via any navigation. */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key={`world-${open.id}`}
            className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm" onClick={closeWorld} />
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-3xl max-h-[86vh] overflow-y-auto bg-coal border border-ivory/14 rounded-t-2xl sm:rounded-2xl"
              style={{ boxShadow: `0 -20px 120px ${open.accent}22` }}
              role="dialog"
              aria-modal="true"
              aria-label={`${open.name} world`}
            >
              <div className="sticky top-0 bg-coal/95 backdrop-blur border-b border-ivory/10 px-6 sm:px-8 py-5 flex items-center gap-4">
                <span className="font-display text-3xl text-outline" style={{ WebkitTextStroke: `1px ${open.accent}` }}>{open.num}</span>
                <div>
                  <h3 className="font-display text-2xl text-ivory">{open.name}</h3>
                  <p className="text-[11px] tracking-[0.24em] uppercase mt-0.5" style={{ color: open.accent }}>{open.tagline}</p>
                </div>
                <button data-cursor="add" onClick={closeWorld} className="ml-auto w-10 h-10 grid place-items-center rounded-full border border-ivory/15 text-ivory/70 hover:text-acid hover:border-acid transition-colors" aria-label="Close">
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 sm:px-8 py-6">
                <p className="text-sm text-ivory/60 leading-relaxed max-w-2xl">{open.desc}</p>
                <div className="mt-6 grid sm:grid-cols-2 gap-3">
                  {open.topics.map((t, i) => (
                    <motion.div
                      key={`${open.id}:${t.name}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="group border border-ivory/10 rounded-xl p-4 hover:border-ivory/25 transition-colors duration-300"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: open.accent }} />
                        <h4 className="text-[13px] font-semibold text-ivory tracking-wide">{t.name}</h4>
                      </div>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-ivory/50">{t.blurb}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    data-cursor="add"
                    onClick={() => { closeWorld(); document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth' }); }}
                    className="px-5 py-2.5 rounded-full text-[11px] tracking-[0.22em] uppercase font-semibold text-obsidian"
                    style={{ background: open.accent }}
                  >
                    Try it in the lab
                  </button>
                  <button
                    data-cursor="view"
                    onClick={() => { closeWorld(); document.getElementById('globe')?.scrollIntoView({ behavior: 'smooth' }); }}
                    className="px-5 py-2.5 rounded-full border border-ivory/20 text-[11px] tracking-[0.22em] uppercase text-ivory/80 hover:border-ivory/50 transition-colors"
                  >
                    Locate it on the globe
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
