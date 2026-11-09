import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HeroScene } from '../engine/HeroScene';
import { Icon, Magnetic } from './ui';
import { STATS } from '../data/content';

const EASE = [0.22, 1, 0.36, 1] as const;

function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HeroScene | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const quality: 0 | 1 = window.innerWidth > 900 && matchMedia('(pointer: fine)').matches ? 1 : 0;
    const scene = new HeroScene(canvas, quality);
    sceneRef.current = scene;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) scene.staticRender();
    else scene.start();

    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(canvas);

    const io = new IntersectionObserver(
      ([e]) => {
        if (reduced) return;
        if (e.isIntersecting) scene.start();
        else scene.stop();
      },
      { threshold: 0.02 }
    );
    if (sectionRef.current) io.observe(sectionRef.current);

    const t = setTimeout(() => setReady(true), reduced ? 50 : 300);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      io.disconnect();
      scene.stop();
    };
  }, []);

  const onMove = (e: React.MouseEvent) => {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect || !sceneRef.current) return;
    sceneRef.current.setMouse((e.clientX - rect.left) / rect.width - 0.5, (e.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <section
      id="universe"
      ref={sectionRef}
      onMouseMove={onMove}
      className="relative h-svh min-h-[620px] overflow-hidden flex flex-col"
      aria-label="The opening universe"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden />
      {/* vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 120% 90% at 50% 40%, transparent 55%, rgba(23,23,19,0.85) 100%)' }} />

      {/* eyebrow */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={ready ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 1, delay: 0.9, ease: EASE }}
        className="relative z-10 pt-24 sm:pt-28 px-6 sm:px-10 flex items-center gap-4"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-coral pulse-dot" />
        <span className="tick-label text-ivory/60">A living atlas of knowledge</span>
        <span className="hidden sm:block tick-label text-ivory/25 ml-4">LAT 27.98 · LON 86.93 · T+00:00</span>
      </motion.div>

      {/* title block */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16">
        <div className="max-w-5xl">
          <h1 className="font-display select-none leading-[0.92] tracking-tight">
            <span className="block overflow-hidden">
              <motion.span
                className="block text-[13vw] sm:text-[9vw] lg:text-[7.2vw] font-light text-ivory/90"
                initial={{ y: '110%' }}
                animate={ready ? { y: 0 } : {}}
                transition={{ duration: 1.15, delay: 1.0, ease: EASE }}
              >
                THE <span className="text-ivory/40">CURIOUS</span>
              </motion.span>
            </span>
            <span className="block overflow-hidden">
              <motion.span
                className="block text-[15vw] sm:text-[10.5vw] lg:text-[8.6vw] font-medium italic"
                initial={{ y: '115%' }}
                animate={ready ? { y: 0 } : {}}
                transition={{ duration: 1.25, delay: 1.15, ease: EASE }}
              >
                <span className="text-acid" style={{ textShadow: '0 0 60px rgba(215,255,69,0.25)' }}>WORLD</span>
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 1.5, ease: EASE }}
            className="mt-6 text-sm sm:text-base text-ivory/60 max-w-md leading-relaxed"
          >
            Explore everything. Experience knowledge.
            <span className="text-ivory/30"> — 26 running simulations, a human body you can take apart, and a time machine through 4.5 billion years.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 1.65, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Magnetic
              data-cursor="add"
              onClick={() => goTo('discovery')}
              className="bg-acid text-obsidian px-7 py-3.5 text-[12px] font-semibold tracking-[0.22em] uppercase hover:shadow-[0_0_50px_rgba(215,255,69,0.35)]"
            >
              Enter the universe
              <Icon name="arrow" className="w-4 h-4 -rotate-90" />
            </Magnetic>
            <Magnetic
              data-cursor="view"
              onClick={() => goTo('domains')}
              className="border border-ivory/25 text-ivory px-7 py-3.5 text-[12px] tracking-[0.22em] uppercase hover:border-coral hover:text-coral transition-colors duration-300"
            >
              Open the simulators
            </Magnetic>
          </motion.div>
        </div>
      </div>

      {/* bottom strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : {}}
        transition={{ duration: 1.2, delay: 1.9 }}
        className="relative z-10 pb-24 md:pb-8 px-6 sm:px-10 flex items-end justify-between gap-6"
      >
        <div className="flex items-center gap-3">
          <span className="relative w-px h-12 bg-ivory/20 overflow-hidden">
            <span className="absolute left-0 top-0 w-full h-full bg-acid scroll-line" />
          </span>
          <span className="tick-label text-ivory/45 hidden sm:block">Scroll to descend</span>
        </div>
        <div className="flex items-center gap-6 sm:gap-10">
          {[
            { n: '26', l: 'Simulations' },
            { n: String(STATS.worlds).padStart(2, '0'), l: 'Worlds' },
            { n: String(STATS.exhibits).padStart(2, '0'), l: 'Exhibits' },
            { n: String(STATS.places).padStart(2, '0'), l: 'Sites' },
          ].map((s) => (
            <div key={s.l} className="text-right">
              <div className="font-display text-xl sm:text-2xl text-ivory/85">{s.n}</div>
              <div className="tick-label text-ivory/35">{s.l}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
