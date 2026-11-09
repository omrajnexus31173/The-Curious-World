import { useRef, useState } from 'react';
import { useSimLoop } from './simkit';
import { Icon } from '../ui';

interface Planet { name: string; au: number; period: number; color: string; size: number; fact: string; ring?: boolean; _sx?: number; _sy?: number; }
const PLANETS: Planet[] = [
  { name: 'Mercury', au: 0.39, period: 88, color: '#C9B8A0', size: 3, fact: 'A year lasts 88 days, but a single solar day takes 176.' },
  { name: 'Venus', au: 0.72, period: 225, color: '#E8C57A', size: 4.2, fact: 'Spins backwards — the Sun rises in the west.' },
  { name: 'Earth', au: 1, period: 365, color: '#7ED9A7', size: 4.5, fact: 'The only confirmed place in the universe with life. You’re here.' },
  { name: 'Mars', au: 1.52, period: 687, color: '#FF704F', size: 3.8, fact: 'Home to Olympus Mons — a volcano 2.5× taller than Everest.' },
  { name: 'Jupiter', au: 5.2, period: 4333, color: '#E4C580', size: 7, fact: 'More massive than all the other planets combined.' },
  { name: 'Saturn', au: 9.58, period: 10759, color: '#D7C9A0', size: 6, fact: 'Its rings are mostly water ice — some chunks the size of houses.', ring: true },
  { name: 'Uranus', au: 19.2, period: 30687, color: '#A8D8C9', size: 5, fact: 'Tilted 98° — it rolls around the Sun on its side.' },
  { name: 'Neptune', au: 30, period: 60190, color: '#B59AFF', size: 5, fact: 'Winds reach 2,100 km/h — the fastest in the solar system.' },
];

export default function OrbitSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angles = useRef(PLANETS.map((_, i) => i * 1.7));
  const trails = useRef<Record<number, [number, number][]>>({});
  const ctrl = useRef({ speed: 5, scale: 1, trails: true, labels: true, hover: -1 });
  const [speed, setSpeed] = useState(5);
  const [scale, setScale] = useState(1);
  const [trailsOn, setTrailsOn] = useState(true);
  const [labelsOn, setLabelsOn] = useState(true);
  const [sel, setSel] = useState<Planet | null>(PLANETS[2]);

  ctrl.current.speed = speed;
  ctrl.current.scale = scale;
  ctrl.current.trails = trailsOn;
  ctrl.current.labels = labelsOn;

  useSimLoop(canvasRef, (ctx, dt) => {
    const canvas = canvasRef.current!;
    const { w, h } = { w: canvas.clientWidth, h: canvas.clientHeight };
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.46;
    const c = ctrl.current;

    // sun
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 42 * c.scale);
    g.addColorStop(0, 'rgba(255,178,92,0.9)');
    g.addColorStop(0.35, 'rgba(255,112,79,0.45)');
    g.addColorStop(1, 'rgba(255,112,79,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 42 * c.scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFE0A8';
    ctx.beginPath(); ctx.arc(cx, cy, 6 * c.scale, 0, Math.PI * 2); ctx.fill();

    PLANETS.forEach((p, i) => {
      const r = 34 + (i / (PLANETS.length - 1)) * (R - 36);
      const speed_i = (c.speed * 0.35) / Math.pow(p.period / 88, 0.62);
      angles.current[i] += dt * speed_i * 0.5;
      const a = angles.current[i];
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.92;

      // orbit
      ctx.globalAlpha = 0.13;
      ctx.strokeStyle = '#F3EBDD';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();

      // trail
      const tr = (trails.current[i] ??= []);
      tr.push([x, y]);
      if (tr.length > 46) tr.shift();
      if (c.trails && tr.length > 2) {
        for (let k = 1; k < tr.length; k++) {
          ctx.globalAlpha = (k / tr.length) * 0.35;
          ctx.strokeStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(tr[k - 1][0], tr[k - 1][1]);
          ctx.lineTo(tr[k][0], tr[k][1]);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      const pr = p.size * c.scale * (c.hover === i ? 1.35 : 1);
      if (p.ring) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.45);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(0, 0, pr * 2, pr * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = c.hover === i ? 14 : 7;
      ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      if (c.labels) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#F3EBDD';
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fillText(p.name, x + pr + 4, y - 3);
        ctx.globalAlpha = 1;
      }
      p._sx = x; p._sy = y; // stash for hit testing
    });
  });

  const onMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let hit = -1;
    PLANETS.forEach((p, i) => {
      if (p._sx !== undefined && p._sy !== undefined && Math.hypot(p._sx - mx, p._sy - my) < 12) hit = i;
    });
    ctrl.current.hover = hit;
    canvas.style.cursor = hit >= 0 ? 'pointer' : 'default';
  };
  const onClick = () => {
    if (ctrl.current.hover >= 0) setSel(PLANETS[ctrl.current.hover]);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_290px] gap-5 h-full">
      <div className="relative border border-ivory/12 rounded-2xl bg-coal/40 overflow-hidden min-h-[340px]">
        <canvas ref={canvasRef} className="w-full h-full block" onMouseMove={onMove} onClick={onClick} aria-label="Solar system simulation — hover or click a planet" />
        <span className="absolute top-3 left-4 tick-label text-ivory/35 pointer-events-none">Compressed time · relative order true</span>
      </div>
      <div className="flex flex-col gap-4 border border-ivory/12 rounded-2xl bg-coal/40 p-5">
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Time flow</span><span className="text-acid tabular-nums">{speed}×</span></div>
          <input type="range" min="0" max="20" step="1" value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-full" aria-label="Time speed" />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Planet scale</span><span className="text-acid tabular-nums">{scale.toFixed(1)}×</span></div>
          <input type="range" min="0.5" max="2" step="0.1" value={scale} onChange={(e) => setScale(+e.target.value)} className="w-full" aria-label="Planet scale" />
        </div>
        <div className="flex gap-2">
          <ToggleChip on={trailsOn} onClick={() => setTrailsOn((v) => !v)} label="Trails" />
          <ToggleChip on={labelsOn} onClick={() => setLabelsOn((v) => !v)} label="Labels" />
        </div>
        <div className="mt-auto border-t border-ivory/10 pt-4">
          {sel ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: sel.color, boxShadow: `0 0 10px ${sel.color}` }} />
                <h4 className="font-display text-lg text-ivory">{sel.name}</h4>
                <span className="ml-auto text-[10px] text-ivory/40 tabular-nums">{sel.au} AU · {sel.period.toLocaleString()} d</span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ivory/55">{sel.fact}</p>
            </>
          ) : (
            <p className="text-[12.5px] text-ivory/45">Click a planet to read its dossier.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ToggleChip({ on, onClick, label, color = '#D7FF45' }: { on: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      data-cursor="play"
      onClick={onClick}
      className={`flex-1 py-2 rounded-full border text-[10px] tracking-[0.2em] uppercase transition-all duration-300 ${on ? 'text-obsidian font-semibold border-transparent' : 'border-ivory/20 text-ivory/45'}`}
      style={on ? { background: color } : undefined}
    >
      {label}
    </button>
  );
}

export function LabHint({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <p className="text-[12px] text-ivory/45 leading-relaxed flex gap-2 items-start">
      <Icon name={icon} className="w-4 h-4 mt-0.5 shrink-0 text-ivory/30" />
      <span>{children}</span>
    </p>
  );
}
