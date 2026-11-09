import { useRef, useState } from 'react';
import { useSimLoop } from './simkit';
import { ToggleChip, LabHint } from './OrbitSim';

const N = 46;

export default function DnaSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rot = useRef(0.8);
  const [turns, setTurns] = useState(2.6);
  const [spin, setSpin] = useState(0.8);
  const [unzip, setUnzip] = useState(0);
  const [highlight, setHighlight] = useState(true);
  const ctrl = useRef({ turns, spin, unzip, highlight });
  ctrl.current.turns = turns;
  ctrl.current.spin = spin;
  ctrl.current.unzip = unzip;
  ctrl.current.highlight = highlight;

  useSimLoop(canvasRef, (ctx, dt) => {
    const canvas = canvasRef.current!;
    const { w, h } = { w: canvas.clientWidth, h: canvas.clientHeight };
    ctx.clearRect(0, 0, w, h);
    const c = ctrl.current;
    rot.current += dt * c.spin;
    const cx = w / 2, cy = h / 2;
    const S = Math.min(w, h) / 4.1;
    const cosX = Math.cos(0.5), sinX = Math.sin(0.5);

    const pairColor = (k: number) => (k % 2 === 0 ? '#FF704F' : '#B59AFF');
    const highlightIdx = Math.floor((performance.now() / 1000) / 1.2) % (N / 3);

    // project helper: strand point (angle, t)
    const point = (s: number, i: number): [number, number, number] => {
      const t = i / N;
      const a = t * c.turns * Math.PI * 2 + s * Math.PI + rot.current;
      const xo = (s === 0 ? -1 : 1) * c.unzip * 0.8;
      const x = Math.sin(a) * 0.5 + xo;
      const y = (t - 0.5) * 3.4;
      const z = Math.cos(a) * 0.5;
      const y2 = y * cosX - z * sinX;
      const z2 = y * sinX + z * cosX;
      return [cx + x * S, cy - y2 * S, z2];
    };

    // rungs
    for (let i = 0; i <= N; i += 3) {
      const k = i / 3;
      const [x1, y1, z1] = point(0, i);
      const [x2, y2, z2] = point(1, i);
      const z = (z1 + z2) / 2;
      const alpha = 0.08 + Math.max(0, (z + 0.5)) * 0.5;
      const isHi = c.highlight && k === highlightIdx;
      ctx.globalAlpha = isHi ? 1 : alpha;
      ctx.strokeStyle = isHi ? '#D7FF45' : pairColor(k);
      ctx.lineWidth = isHi ? 3 : 1.2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (isHi && z > -0.1) {
        const label = k % 2 === 0 ? 'A · T' : 'G · C';
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fillStyle = '#D7FF45';
        ctx.fillText(label, (x1 + x2) / 2 + 10, (y1 + y2) / 2 + 3);
      }
    }
    ctx.globalAlpha = 1;

    // strands
    for (let s = 0; s < 2; s++) {
      const color = s === 0 ? '#FF704F' : '#B59AFF';
      ctx.lineCap = 'round';
      let prev: [number, number, number] | null = null;
      for (let i = 0; i <= N; i++) {
        const p = point(s, i);
        if (prev) {
          const zm = (p[2] + prev[2]) / 2;
          ctx.globalAlpha = 0.25 + Math.max(0, zm + 0.5) * 0.6;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.4 + Math.max(0, zm) * 1.1;
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(p[0], p[1]);
          ctx.stroke();
        }
        prev = p;
      }
      // strand beads
      for (let i = 0; i <= N; i += 2) {
        const p = point(s, i);
        ctx.globalAlpha = 0.35 + Math.max(0, p[2] + 0.5) * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 + Math.max(0, p[2]) * 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  });

  return (
    <div className="grid lg:grid-cols-[1fr_290px] gap-5 h-full">
      <div className="relative border border-ivory/12 rounded-2xl bg-coal/40 overflow-hidden min-h-[340px]">
        <canvas ref={canvasRef} className="w-full h-full block" aria-label="DNA double helix simulation" />
        <div className="absolute top-3 left-4 flex items-center gap-4 text-[10px] text-ivory/45">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-coral" /> Strand 1</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lav" /> Strand 2</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-acid" /> Pair in focus</span>
        </div>
      </div>
      <div className="flex flex-col gap-4 border border-ivory/12 rounded-2xl bg-coal/40 p-5">
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Twist per unit</span><span className="text-acid tabular-nums">{turns.toFixed(1)}</span></div>
          <input type="range" min="1.2" max="4.5" step="0.1" value={turns} onChange={(e) => setTurns(+e.target.value)} className="w-full" aria-label="Helix twist" />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Rotation</span><span className="text-acid tabular-nums">{spin.toFixed(1)}×</span></div>
          <input type="range" min="0" max="2.5" step="0.1" value={spin} onChange={(e) => setSpin(+e.target.value)} className="w-full" aria-label="Rotation speed" />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Unzip strands</span><span className="text-coral tabular-nums">{Math.round(unzip * 100)}%</span></div>
          <input type="range" min="0" max="1" step="0.02" value={unzip} onChange={(e) => setUnzip(+e.target.value)} className="w-full range-coral" aria-label="Unzip helix" />
        </div>
        <ToggleChip on={highlight} onClick={() => setHighlight((v) => !v)} label="Cycle base pairs" />
        <div className="mt-auto border-t border-ivory/10 pt-4">
          <LabHint icon="leaf">Real DNA: 3.4 nanometres per turn, 10 base pairs per turn. Adenine always pairs with thymine; guanine with cytosine — the rule that lets the molecule copy itself.</LabHint>
        </div>
      </div>
    </div>
  );
}
