import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, Reveal, SectionHead } from './ui';
import OrbitSim from './lab/OrbitSim';
import MagnetSim from './lab/MagnetSim';
import NeuralSim from './lab/NeuralSim';
import PacketSim from './lab/PacketSim';
import DnaSim from './lab/DnaSim';
import { cn } from '../utils/cn';

const TABS = [
  { id: 'solar', label: 'Solar System', icon: 'orbit', blurb: 'Eight orbits, one star. Crank time to watch the outer planets finally move.' },
  { id: 'magnet', label: 'Magnetism', icon: 'target', blurb: 'Field lines drawn live from four poles. Flip a magnet and watch the field reshape itself.' },
  { id: 'neural', label: 'Neural Network', icon: 'chip', blurb: 'Signals crossing a 3-4-4-2 network. Fire the inputs and watch activation cascade to the output.' },
  { id: 'packet', label: 'Network Packets', icon: 'globe', blurb: 'A tiny internet of two routers. Send packets, drop links, measure the delivery rate.' },
  { id: 'dna', label: 'DNA Structure', icon: 'leaf', blurb: 'The double helix, turning in 3D. Unzip it and watch the base-pair code get exposed.' },
];

export default function Lab() {
  const [tab, setTab] = useState('solar');
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <section id="lab" className="relative py-24 sm:py-32" aria-label="The Interactive Lab">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 45% at 15% 10%, rgba(215,255,69,0.045), transparent 60%)' }} />
      <div className="relative max-w-[1500px] mx-auto px-6 sm:px-10">
        <SectionHead
          index="EXP 04"
          label="The Interactive Lab"
          accent="#D7FF45"
          title={<>Hands-on <span className="italic text-acid">physics</span></>}
          sub="Five live simulations, each one a small experiment you can disturb. Change a parameter and the world answers in real time."
        />

        {/* tab rail */}
        <Reveal delay={0.15}>
          <div className="mt-12 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="Simulations">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                data-cursor="add"
                onClick={() => setTab(t.id)}
                className={cn(
                  'shrink-0 flex items-center gap-2.5 px-4.5 sm:px-5 py-2.5 rounded-full border text-[11px] tracking-[0.18em] uppercase font-medium transition-all duration-300',
                  tab === t.id
                    ? 'bg-acid text-obsidian border-transparent'
                    : 'border-ivory/15 text-ivory/55 hover:border-ivory/40 hover:text-ivory'
                )}
              >
                <Icon name={t.icon} className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </Reveal>

        <p className="mt-5 text-sm text-ivory/50 max-w-2xl">{active.blurb}</p>

        <Reveal delay={0.2} className="mt-6">
          <div className="relative min-h-[420px] lg:min-h-[480px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -18, filter: 'blur(4px)' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="h-[440px] sm:h-[480px]"
              >
                {tab === 'solar' && <OrbitSim />}
                {tab === 'magnet' && <MagnetSim />}
                {tab === 'neural' && <NeuralSim />}
                {tab === 'packet' && <PacketSim />}
                {tab === 'dna' && <DnaSim />}
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
