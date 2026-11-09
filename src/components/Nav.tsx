import { useEffect, useState } from 'react';
import { motion, useScroll } from 'framer-motion';
import { Icon } from './ui';
import { audio } from '../lib/audio';
import { cn } from '../utils/cn';

export const SECTIONS = [
  { id: 'universe', n: '00', label: 'Universe' },
  { id: 'discovery', n: '01', label: 'Discovery' },
  { id: 'museum', n: '02', label: 'Museum' },
  { id: 'globe', n: '03', label: 'Globe' },
  { id: 'lab', n: '04', label: 'Lab' },
  { id: 'knowledge', n: '05', label: 'Knowledge' },
  { id: 'domains', n: '06', label: 'Simulations', short: 'Sims' },
];

function SoundToggle() {
  const [muted, setMuted] = useState(audio.muted);
  const [ready, setReady] = useState(audio.ready);
  useEffect(() => audio.sub((m, r) => { setMuted(m); setReady(r); }), []);
  return (
    <button
      onClick={() => audio.toggle()}
      title={muted ? 'Sound off — click to enable' : 'Sound on — click to mute everything'}
      aria-label={muted ? 'Enable sound' : 'Mute all sound'}
      aria-pressed={!muted}
      className={cn('flex items-center gap-2 h-9 px-3 rounded-full border transition-colors duration-300',
        muted ? 'border-ivory/15 text-ivory/40 hover:text-ivory/70' : 'border-acid/60 text-acid')}
    >
      <span className="flex items-end gap-[2px] h-3.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-[2px] rounded-full bg-current transition-all duration-300"
            style={{
              height: muted ? 4 : ready ? [10, 14, 7][i] : 5,
              animation: !muted && ready ? `pulse-dot ${0.9 + i * 0.25}s ease-in-out infinite` : undefined,
            }} />
        ))}
      </span>
      <span className="hidden sm:block text-[9px] tracking-[0.22em] uppercase">{muted ? 'Muted' : 'Sound'}</span>
    </button>
  );
}

function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Nav() {
  const [active, setActive] = useState('universe');
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-42% 0px -42% 0px' }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => { obs.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <>
      {/* top progress */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-[70] bg-transparent pointer-events-none">
        <motion.div className="h-full origin-left bg-acid" style={{ scaleX: scrollYProgress }} />
      </div>

      {/* top bar */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-[60] transition-all duration-500',
          scrolled ? 'bg-obsidian/80 backdrop-blur-md border-b border-ivory/10' : 'border-b border-transparent'
        )}
      >
        <div className="max-w-[1500px] mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
          <button onClick={() => goTo('universe')} data-cursor="add" className="group flex items-center gap-3" aria-label="The Curious World — home">
            <span className="relative w-8 h-8 grid place-items-center">
              <span className="absolute inset-0 border border-acid/60 rotate-12 group-hover:rotate-45 transition-transform duration-700" />
              <span className="w-2 h-2 rounded-full bg-coral group-hover:bg-acid transition-colors duration-300" />
            </span>
            <span className="hidden sm:block text-left">
              <span className="block text-[13px] font-semibold tracking-[0.18em] text-ivory">THE CURIOUS WORLD</span>
              <span className="block text-[9px] tracking-[0.3em] text-ivory/40">EXPLORE EVERYTHING</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1" aria-label="Sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                data-cursor="add"
                className={cn(
                  'relative px-3.5 py-2 text-[11px] tracking-[0.22em] uppercase transition-colors duration-300',
                  active === s.id ? 'text-acid' : 'text-ivory/50 hover:text-ivory'
                )}
              >
                <span className="mr-1.5 text-[9px] opacity-60">{s.n}</span>
                {s.label}
                <span
                  className="absolute left-3.5 right-3.5 -bottom-0.5 h-px bg-acid transition-transform duration-400 origin-left"
                  style={{ transform: active === s.id ? 'scaleX(1)' : 'scaleX(0)' }}
                />
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden xl:flex items-center gap-2 text-[10px] tracking-[0.28em] text-ivory/40">
              <span className="w-1.5 h-1.5 rounded-full bg-acid pulse-dot" />
              UNIVERSE ONLINE
            </span>
            <SoundToggle />
            <span className="md:hidden w-8 h-8 grid place-items-center border border-ivory/15 rounded-full text-ivory/70">
              <Icon name="orbit" className="w-4 h-4" />
            </span>
          </div>
        </div>
      </header>

      {/* mobile bottom dock */}
      <nav
        aria-label="Sections (mobile)"
        className="md:hidden fixed bottom-3 left-3 right-3 z-[60] flex items-center justify-between gap-1 px-3 py-2 rounded-full bg-obsidian/85 backdrop-blur-md border border-ivory/12"
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => goTo(s.id)}
            aria-label={s.label}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-1 rounded-full transition-colors duration-300',
              active === s.id ? 'text-acid' : 'text-ivory/45'
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full transition-all', active === s.id ? 'bg-acid scale-125' : 'bg-ivory/25')} />
            <span className="text-[8px] tracking-[0.1em] uppercase">{(s as { short?: string }).short ?? s.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
