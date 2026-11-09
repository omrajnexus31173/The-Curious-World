import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';
import Nav, { SECTIONS } from './components/Nav';
import Hero from './components/Hero';
import Discovery from './components/Discovery';
import Museum from './components/Museum';
import Globe from './components/Globe';
import Lab from './components/Lab';
import Knowledge from './components/Knowledge';
import UniverseHub from './components/UniverseHub';
import { CursorSystem } from './engine/CursorSystem';
import { audio } from './lib/audio';
import { Icon } from './components/ui';

gsap.registerPlugin(ScrollTrigger);

/* ---------------- procedural intro ---------------- */

const WORDS = [
  { text: 'THE', cls: 'text-ivory/50 font-light', off: 0 },
  { text: 'CURIOUS', cls: 'text-acid italic font-medium', off: 1 },
  { text: 'WORLD', cls: 'text-ivory font-light', off: 2 },
];

function Intro({ done, setDone }: { done: boolean; setDone: (v: boolean) => void }) {
  const [pct, setPct] = useState(0);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (reduced.current) { setDone(true); return; }
    let raf = 0;
    let timeout = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const p = Math.min(1, (now - t0) / 1400);
      const eased = 1 - Math.pow(1 - p, 2);
      setPct(Math.round(eased * 100));
      if (p < 1) raf = requestAnimationFrame(loop);
      else timeout = window.setTimeout(() => setDone(true), 300);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearTimeout(timeout); };
  }, [setDone]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[95] bg-obsidian flex flex-col items-center justify-center"
          exit={{ y: '-100%' }}
          transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
          aria-label="Loading the universe"
        >
          <div className="flex flex-col items-center font-display leading-none">
            {WORDS.map((w) => (
              <span key={w.text} className="block overflow-hidden">
                <span className="block text-[9vw] sm:text-[6.5vw] tracking-tight">
                  {w.text.split('').map((ch, i) => (
                    <motion.span
                      key={i}
                      className={`inline-block ${w.cls}`}
                      initial={{ y: '115%', opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.75, delay: 0.12 + w.off * 0.13 + i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {ch === ' ' ? '\u00A0' : ch}
                    </motion.span>
                  ))}
                </span>
              </span>
            ))}
          </div>
          <div className="mt-10 w-48 sm:w-64">
            <div className="h-px bg-ivory/15 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-acid transition-none" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex justify-between">
              <span className="tick-label text-ivory/40">Assembling universe</span>
              <span className="tick-label text-acid tabular-nums">{pct.toString().padStart(3, '0')}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- footer ---------------- */

function Footer() {
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <footer className="relative border-t border-ivory/10 mt-8">
      <div className="max-w-[1500px] mx-auto px-6 sm:px-10 py-16 pb-28 md:pb-16">
        <div className="font-display text-3xl sm:text-5xl leading-tight text-ivory/85 max-w-3xl">
          The universe is <span className="text-outline-acid">deeper</span> than it looks.
          <span className="text-ivory/40"> Keep exploring.</span>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
          {SECTIONS.map((s) => (
            <button key={s.id} data-cursor="add" onClick={() => goTo(s.id)} className="text-[11px] tracking-[0.24em] uppercase text-ivory/45 hover:text-acid transition-colors">
              {s.n} · {s.label}
            </button>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-ivory/8 flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2.5 text-[11px] tracking-[0.2em] uppercase text-ivory/40">
            <Icon name="orbit" className="w-4 h-4 text-acid" /> The Curious World — a living atlas of knowledge
          </span>
          <span className="text-[11px] text-ivory/30">Built from light, math and an unreasonable amount of curiosity · {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- app shell ---------------- */

export default function App() {
  const [intro, setIntro] = useState(false);
  const cursorCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fine = matchMedia('(pointer: fine)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced || !cursorCanvas.current) return;
    const cs = new CursorSystem();
    cs.init(cursorCanvas.current);
    return () => cs.dispose();
  }, []);

  useEffect(() => {
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('load', onLoad);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain relative">
        <canvas ref={cursorCanvas} className="fixed inset-0 z-[100] pointer-events-none" aria-hidden />
        <Intro done={intro} setDone={setIntro} />
        <Nav />
        <main>
          <Hero />
          <Discovery />
          <Museum />
          <Globe />
          <Lab />
          <Knowledge />
          <UniverseHub />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
