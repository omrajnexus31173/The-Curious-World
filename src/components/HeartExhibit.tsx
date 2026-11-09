import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './ui';

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  { title: 'A fist-sized engine', text: 'About 250 grams of muscle, beating ~100,000 times a day, pushing roughly 7,500 litres of blood through 100,000 km of vessels. It never rests — not even in sleep.' },
  { title: 'Four chambers, two circuits', text: 'The two upper atria receive blood; the two lower ventricles pump it out. The right side feeds the lungs, the left side feeds the body.' },
  { title: 'The great tubes', text: 'The aorta is the highway out to the body. The pulmonary artery runs back to the lungs. The vena cavae are the long-distance collectors bringing blood home.' },
  { title: 'The journey of blood', text: 'Deoxygenated blood (lavender) returns to the right side and travels to the lungs. Oxygenated blood (coral) enters the left side and goes out to the body. The two never mix.' },
  { title: 'One-way valves', text: 'Four gates open and close with every beat, keeping flow in a single direction. The “dub” and “bup” you hear are them snapping shut.' },
  { title: 'Assembled', text: 'Atria, ventricles, vessels and valves — one pump that has run your entire life without a single day off.' },
];

const CORAL = '#FF704F';
const LAV = '#B59AFF';

function Valve({ x, y, rot, active }: { x: number; y: number; rot: number; active: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={active ? { scale: [1, 1.45, 1] } : { scale: 1 }}
        transition={active ? { repeat: Infinity, duration: 0.9, ease: 'easeInOut' } : { duration: 0.4 }}
      >
        <path d="M -13 0 Q 0 -8 13 0 M -13 0 Q 0 8 13 0" fill="none" stroke="#D7FF45" strokeWidth="1.6" opacity={active ? 1 : 0.6} />
      </motion.g>
    </g>
  );
}

function ChamberLabel({ x, y, tx, ty, anchor, on, children }: { x: number; y: number; tx: number; ty: number; anchor: 'start' | 'end'; on: boolean; children: string }) {
  return (
    <motion.g animate={{ opacity: on ? 1 : 0 }} transition={{ duration: 0.5 }}>
      <line x1={x} y1={y} x2={tx} y2={ty} stroke="#F3EBDD" strokeOpacity="0.35" strokeWidth="0.7" />
      <circle cx={x} cy={y} r="1.8" fill="#D7FF45" />
      <text x={tx + (anchor === 'start' ? 6 : -6)} y={ty + 3} textAnchor={anchor} fontSize="9.5" letterSpacing="1.5" fill="#F3EBDD" opacity="0.85">{children}</text>
    </motion.g>
  );
}

export default function HeartExhibit() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 3400);
    return () => clearInterval(timer.current);
  }, [playing]);

  const s = step;
  const myoOp = [0.9, 0.14, 0.3, 0.18, 0.3, 0.9][s];
  const sep = s === 1 ? 13 : 0;
  const vesselsOn = s === 2;
  const valvesOn = s === 4;
  const flowOn = s === 3;
  const beat = (s === 0 || s === 5) && playing;

  return (
    <div className="w-full flex-1 min-h-[300px] sm:min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <svg viewBox="0 0 420 470" className="w-full h-full" role="img" aria-label="Anatomical heart, interactive diagram">
          {/* whole heart group with heartbeat */}
          <motion.g
            style={{ transformOrigin: '210px 260px' }}
            animate={beat ? { scale: [1, 1.035, 1] } : { scale: 1 }}
            transition={beat ? { repeat: Infinity, duration: 0.95, ease: 'easeInOut' } : { duration: 0.5 }}
          >
            {/* chambers */}
            <motion.g animate={{ opacity: 0.95 }}>
              <motion.ellipse cx={148 - sep} cy={190} rx="40" ry="48" animate={{ x: s === 1 ? -12 : 0 }} transition={{ duration: 0.8, ease: EASE }} fill={LAV} fillOpacity="0.09" stroke={LAV} strokeOpacity="0.55" strokeWidth="1.2" />
              <motion.ellipse cx={262 + sep} cy={186} rx="38" ry="44" animate={{ x: s === 1 ? 12 : 0 }} transition={{ duration: 0.8, ease: EASE }} fill={CORAL} fillOpacity="0.09" stroke={CORAL} strokeOpacity="0.55" strokeWidth="1.2" />
              <motion.ellipse cx={165 - sep * 0.7} cy={300} rx="50" ry="64" animate={{ x: s === 1 ? -9 : 0 }} transition={{ duration: 0.8, ease: EASE }} fill={LAV} fillOpacity="0.07" stroke={LAV} strokeOpacity="0.5" strokeWidth="1.2" />
              <motion.ellipse cx={258 + sep * 0.7} cy={308} rx="52" ry="70" animate={{ x: s === 1 ? 9 : 0 }} transition={{ duration: 0.8, ease: EASE }} fill={CORAL} fillOpacity="0.07" stroke={CORAL} strokeOpacity="0.5" strokeWidth="1.2" />
            </motion.g>

            {/* vessels */}
            <motion.g animate={{ opacity: vesselsOn ? 1 : 0.5, }} transition={{ duration: 0.6 }}>
              <motion.path d="M 224 150 C 220 100, 252 74, 290 84 C 318 92, 326 116, 318 138" fill="none" stroke={CORAL} strokeLinecap="round" animate={{ strokeWidth: vesselsOn ? 17 : 12, opacity: vesselsOn ? 1 : 0.8 }} transition={{ duration: 0.6 }} />
              <motion.path d="M 200 128 C 196 100, 178 84, 158 82" fill="none" stroke={LAV} strokeLinecap="round" animate={{ strokeWidth: vesselsOn ? 14 : 10, opacity: vesselsOn ? 1 : 0.8 }} transition={{ duration: 0.6 }} />
              <motion.path d="M 148 78 L 148 152" fill="none" stroke={LAV} strokeLinecap="round" animate={{ strokeWidth: vesselsOn ? 13 : 9, opacity: vesselsOn ? 1 : 0.8 }} transition={{ duration: 0.6 }} />
              <motion.path d="M 138 434 C 132 360, 140 292, 148 244" fill="none" stroke={LAV} strokeLinecap="round" animate={{ strokeWidth: vesselsOn ? 12 : 9, opacity: vesselsOn ? 1 : 0.8 }} transition={{ duration: 0.6 }} />
            </motion.g>

            {/* myocardium outline */}
            <motion.path
              d="M 200 108 C 148 84, 96 118, 92 186 C 88 262, 128 352, 196 402 C 214 414, 232 412, 248 398 C 312 348, 340 268, 334 196 C 330 128, 262 92, 200 108 Z"
              fill="none"
              stroke="#F3EBDD"
              strokeWidth="1.6"
              animate={{ opacity: myoOp }}
              transition={{ duration: 0.7 }}
            />

            {/* flow */}
            <motion.g animate={{ opacity: flowOn ? 1 : 0 }} transition={{ duration: 0.5 }}>
              <path className={flowOn ? 'flow-anim' : ''} d="M 148 78 C 148 140, 148 190, 158 246 C 168 292, 186 312, 204 292 C 216 272, 208 236, 200 196 C 194 158, 200 132, 200 128" fill="none" stroke={LAV} strokeWidth="2.4" strokeDasharray="10 14" strokeLinecap="round" />
              <path className={flowOn ? 'flow-anim' : ''} d="M 318 138 C 310 168, 292 182, 272 192 C 262 240, 262 280, 258 310 C 254 352, 236 362, 226 330 C 218 300, 220 220, 224 150 C 228 108, 258 84, 290 84" fill="none" stroke={CORAL} strokeWidth="2.4" strokeDasharray="10 14" strokeLinecap="round" />
              {flowOn && (
                <>
                  <circle cx="148" cy="70" r="3.5" fill={LAV} />
                  <text x="158" y="73" fontSize="9" letterSpacing="1.2" fill={LAV}>DEOXYGENATED</text>
                  <circle cx="322" cy="132" r="3.5" fill={CORAL} />
                  <text x="236" y="132" fontSize="9" letterSpacing="1.2" fill={CORAL}>OXYGENATED</text>
                </>
              )}
            </motion.g>

            {/* valves */}
            <Valve x={158} y={250} rot={70} active={valvesOn} />
            <Valve x={256} y={238} rot={-65} active={valvesOn} />
            <Valve x={224} y={152} rot={20} active={valvesOn} />
            <Valve x={198} y={132} rot={-40} active={valvesOn} />

            {/* labels */}
            <ChamberLabel x={120} y={178} tx={34} ty={150} anchor="start" on={s === 1}>RIGHT ATRIUM</ChamberLabel>
            <ChamberLabel x={290} y={176} tx={352} ty={140} anchor="end" on={s === 1}>LEFT ATRIUM</ChamberLabel>
            <ChamberLabel x={126} y={310} tx={30} ty={330} anchor="start" on={s === 1}>RIGHT VENTRICLE</ChamberLabel>
            <ChamberLabel x={294} y={322} tx={362} ty={352} anchor="end" on={s === 1}>LEFT VENTRICLE</ChamberLabel>
            <ChamberLabel x={302} y={90} tx={352} ty={66} anchor="end" on={s === 2}>AORTA</ChamberLabel>
            <ChamberLabel x={162} y={82} tx={92} ty={56} anchor="start" on={s === 2}>PULM. ARTERY</ChamberLabel>
            <ChamberLabel x={148} y={250} tx={60} ty={410} anchor="start" on={s === 4}>VALVE</ChamberLabel>
          </motion.g>
        </svg>
      </div>

      {/* caption + transport */}
      <div className="pt-4 border-t border-ivory/10">
        <AnimatePresence mode="wait">
          <motion.div
            key={s}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <h4 className="font-display text-lg sm:text-xl text-ivory">{STEPS[s].title}</h4>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ivory/55 min-h-[60px]">{STEPS[s].text}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-3 flex items-center gap-4">
          <button
            data-cursor="play"
            onClick={() => setPlaying((p) => !p)}
            className="w-9 h-9 shrink-0 grid place-items-center rounded-full bg-acid text-obsidian hover:shadow-[0_0_24px_rgba(215,255,69,0.4)] transition-shadow"
            aria-label={playing ? 'Pause sequence' : 'Play sequence'}
          >
            <Icon name={playing ? 'pause' : 'play'} className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setStep(i); setPlaying(false); }}
                aria-label={`Step ${i + 1}: ${STEPS[i].title}`}
                className="h-4 rounded-full transition-all duration-400"
                style={{ width: i === s ? 22 : 8, background: i === s ? '#D7FF45' : 'rgba(243,235,221,0.18)' }}
              />
            ))}
          </div>
          <span className="ml-auto text-[10px] tracking-[0.24em] text-ivory/35 tabular-nums">{String(s + 1).padStart(2, '0')} / 06</span>
        </div>
      </div>
    </div>
  );
}
