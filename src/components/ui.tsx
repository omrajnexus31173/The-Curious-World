import { useRef, type ReactNode, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

/* ---------------- icons ---------------- */

const PATHS: Record<string, ReactNode> = {
  chip: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3" /></>,
  orbit: <><circle cx="12" cy="12" r="3.2" /><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(-22 12 12)" /><circle cx="20" cy="8" r="1.1" fill="currentColor" stroke="none" /></>,
  heart: <path d="M12 20s-7-4.6-8.6-9C2.2 7.6 4.2 4.6 7.4 4.6c2 0 3.6 1.1 4.6 2.7 1-1.6 2.6-2.7 4.6-2.7 3.2 0 5.2 3 4 6.4C19 15.4 12 20 12 20Z" />,
  leaf: <><path d="M5 19C5 9 11 5 20 4c-.6 9-4.6 15-14 15Z" /><path d="M5 19c3-6 7-9 11-10.5" /></>,
  column: <><path d="M5 9h14M6 9v9M10 9v9M14 9v9M18 9v9M4 18h16M12 3 4 7h16Z" /></>,
  atom: <><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><ellipse cx="12" cy="12" rx="9" ry="3.6" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)" /></>,
  rocket: <><path d="M12 3c3 2.4 4.5 6 4.5 9.5L14 16h-4l-2.5-3.5C7.5 9 9 5.4 12 3Z" /><circle cx="12" cy="9.5" r="1.6" /><path d="M10 16l-1.5 5L12 18.5 15.5 21 14 16M8.5 12.5 6 15c1.5.5 3 .5 4 0M15.5 12.5 18 15c-1.5.5-3 .5-4 0" /></>,
  sigma: <path d="M17 5H7.5L13 12l-5.5 7H17" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  arrow: <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" />,
  play: <path d="M8 5.5v13l11-6.5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  check: <path d="m4.5 12.5 5 5L19.5 6.5" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><ellipse cx="12" cy="12" rx="4" ry="8.5" /><path d="M3.5 12h17" /></>,
  flask: <><path d="M9.5 3h5M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3" /><path d="M7.5 15h9" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2.2 5-5 2.2 2.2-5Z" /></>,
  spark: <path d="M12 3v18M3 12h18M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5V5.5M20 18v3H6.5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" /></>,
};

export function Icon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cn('w-5 h-5', className)} style={style} aria-hidden>
      {PATHS[name] ?? PATHS.spark}
    </svg>
  );
}

/* ---------------- reveal on scroll ---------------- */

export function Reveal({ children, delay = 0, y = 30, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- section heading ---------------- */

export function SectionHead({ index, label, title, sub, accent = '#D7FF45' }: {
  index: string; label: string; title: ReactNode; sub?: string; accent?: string;
}) {
  return (
    <div className="relative">
      <Reveal>
        <div className="flex items-center gap-4">
          <span className="tick-label" style={{ color: accent }}>{index}</span>
          <span className="h-px w-12" style={{ background: accent, opacity: 0.7 }} />
          <span className="tick-label text-ivory/50">{label}</span>
        </div>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="font-display mt-5 text-4xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tight text-ivory">{title}</h2>
      </Reveal>
      {sub && (
        <Reveal delay={0.16}>
          <p className="mt-5 max-w-xl text-sm sm:text-base leading-relaxed text-ivory/55">{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

/* ---------------- magnetic button ---------------- */

export function Magnetic({ children, className, inner, strength = 16, ...rest }: {
  children: ReactNode; className?: string; inner?: string; strength?: number;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null);
  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = 'translate(0,0)';
  };
  return (
    <button
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      className={cn('transition-transform duration-300 ease-out will-change-transform', className)}
      style={{ borderRadius: 999 }}
      {...rest}
    >
      <span className={cn('inline-flex items-center gap-2.5 transition-transform duration-300', inner)}>
        {children}
      </span>
    </button>
  );
}

/* ---------------- stat ring ---------------- */

export function StatRing({ value, size = 76, stroke = 5, color = '#D7FF45', label, sub }: {
  value: number; size?: number; stroke?: number; color?: string; label: string; sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(243,235,221,0.12)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            whileInView={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold" style={{ color }}>{Math.round(value * 100)}%</span>
        </div>
      </div>
      <span className="text-[10px] tracking-[0.22em] uppercase text-ivory/50 text-center leading-tight">{label}</span>
      {sub && <span className="text-[10px] text-ivory/35 -mt-1.5">{sub}</span>}
    </div>
  );
}

/* ---------------- misc ---------------- */

export function AccentBar({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block h-[3px] w-8 rounded-full', className)} style={{ background: color }} />;
}

export function KeyDot({ active, color = '#D7FF45' }: { active: boolean; color?: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full transition-all duration-300"
      style={{ background: active ? color : 'rgba(243,235,221,0.2)', boxShadow: active ? `0 0 10px ${color}` : 'none' }}
    />
  );
}
