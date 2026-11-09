import { useRef, useState } from 'react';
import { useSimLoop } from './simkit';
import { ToggleChip, LabHint } from './OrbitSim';

const LAYERS = [3, 4, 4, 2];
const wgt = (l: number, a: number, b: number) =>
  Math.sin(l * 13.7 + a * 7.31 + b * 3.17) * Math.cos(l * 2.3 + b * 5.1);

interface Pulse { fromL: number; fromI: number; toL: number; toI: number; t: number; }

export default function NeuralSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulses = useRef<Pulse[]>([]);
  const energy = useRef<number[][]>(LAYERS.map((n, l) => Array.from({ length: n }, () => (l === 0 ? 0.4 : 0))));
  const autoTimer = useRef(0);
  const outBar = useRef<HTMLDivElement>(null);
  const outVal = useRef<HTMLSpanElement>(null);
  const out = useRef(0);
  const ctrl = useRef({ gain: 1, rate: 1, speed: 1, auto: true });
  const [gain, setGain] = useState(1);
  const [rate, setRate] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [auto, setAuto] = useState(true);
  ctrl.current.gain = gain;
  ctrl.current.rate = rate;
  ctrl.current.speed = speed;
  ctrl.current.auto = auto;

  const fire = () => {
    for (let i = 0; i < LAYERS[0]; i++) {
      for (let j = 0; j < LAYERS[1]; j++) {
        pulses.current.push({ fromL: 0, fromI: i, toL: 1, toI: j, t: 0 });
      }
    }
  };

  const pos = (l: number, i: number): [number, number] => [
    0.13 + l * 0.25,
    0.12 + (i + 1) / (LAYERS[l] + 1) * 0.76,
  ];

  useSimLoop(canvasRef, (ctx, dt) => {
    const canvas = canvasRef.current!;
    const { w, h } = { w: canvas.clientWidth, h: canvas.clientHeight };
    ctx.clearRect(0, 0, w, h);
    const c = ctrl.current;
    const px = (l: number, i: number): [number, number] => { const [nx, ny] = pos(l, i); return [nx * w, ny * h]; };

    // auto firing
    if (c.auto) {
      autoTimer.current += dt * c.rate;
      if (autoTimer.current >= 1) { autoTimer.current = 0; fire(); }
    }

    // advance pulses
    for (let k = pulses.current.length - 1; k >= 0; k--) {
      const p = pulses.current[k];
      p.t += dt * 1.6 * c.speed;
      if (p.t >= 1) {
        pulses.current.splice(k, 1);
        const e = energy.current;
        const wv = wgt(p.fromL, p.fromI, p.toI) * c.gain;
        e[p.toL][p.toI] = Math.min(1.4, e[p.toL][p.toI] + 0.35 + Math.abs(wv) * 0.4);
        if (p.toL === LAYERS.length - 1) {
          out.current = Math.tanh(out.current * 0.6 + wv * 0.55);
        } else {
          for (let j = 0; j < LAYERS[p.toL + 1]; j++) {
            if (Math.random() < 0.75) pulses.current.push({ fromL: p.toL, fromI: p.toI, toL: p.toL + 1, toI: j, t: 0 });
          }
        }
      }
    }
    // decay
    for (const layer of energy.current) for (let i = 0; i < layer.length; i++) layer[i] *= Math.exp(-dt * 2.4);

    // readouts
    if (outBar.current) outBar.current.style.width = `${Math.min(100, Math.abs(out.current) * 100)}%`;
    if (outVal.current) outVal.current.textContent = out.current.toFixed(2);

    // edges
    for (let l = 0; l < LAYERS.length - 1; l++) {
      for (let a = 0; a < LAYERS[l]; a++) {
        for (let b = 0; b < LAYERS[l + 1]; b++) {
          const wv = wgt(l, a, b) * c.gain;
          const [x1, y1] = px(l, a);
          const [x2, y2] = px(l + 1, b);
          ctx.strokeStyle = wv >= 0 ? 'rgba(255,112,79,1)' : 'rgba(181,154,255,1)';
          ctx.globalAlpha = 0.08 + Math.min(0.4, Math.abs(wv) * 0.22);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
      }
    }

    // pulses
    for (const p of pulses.current) {
      const [x1, y1] = px(p.fromL, p.fromI);
      const [x2, y2] = px(p.toL, p.toI);
      const x = x1 + (x2 - x1) * p.t;
      const y = y1 + (y2 - y1) * p.t;
      const wv = wgt(p.fromL, p.fromI, p.toI) * c.gain;
      ctx.fillStyle = wv >= 0 ? '#FF704F' : '#B59AFF';
      ctx.shadowColor = ctx.fillStyle as string;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // nodes
    LAYERS.forEach((n, l) => {
      for (let i = 0; i < n; i++) {
        const [x, y] = px(l, i);
        const e = energy.current[l][i];
        const r = 7 + e * 5;
        if (e > 0.05) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
          g.addColorStop(0, `rgba(215,255,69,${0.4 * e})`);
          g.addColorStop(1, 'rgba(215,255,69,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#20201a';
        ctx.strokeStyle = `rgba(243,235,221,${0.35 + e * 0.5})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#F3EBDD';
      ctx.font = '9px "Space Grotesk", sans-serif';
      ctx.fillText(['INPUT', 'HIDDEN A', 'HIDDEN B', 'OUTPUT'][l], px(l, 0)[0] - 10, h - 12);
      ctx.globalAlpha = 1;
    });
  });

  return (
    <div className="grid lg:grid-cols-[1fr_290px] gap-5 h-full">
      <div className="relative border border-ivory/12 rounded-2xl bg-coal/40 overflow-hidden min-h-[340px]">
        <canvas ref={canvasRef} className="w-full h-full block" aria-label="Neural network simulation" />
        <div className="absolute top-3 left-4 flex items-center gap-4 text-[10px] text-ivory/45">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-coral" /> Excitatory</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lav" /> Inhibitory</span>
        </div>
      </div>
      <div className="flex flex-col gap-4 border border-ivory/12 rounded-2xl bg-coal/40 p-5">
        <button data-cursor="play" onClick={fire} className="w-full bg-acid text-obsidian py-3 rounded-full text-[11px] font-semibold tracking-[0.24em] uppercase hover:shadow-[0_0_30px_rgba(215,255,69,0.35)] transition-shadow">
          Fire input layer
        </button>
        <ToggleChip on={auto} onClick={() => setAuto((v) => !v)} label="Auto-traffic" />
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Synapse gain</span><span className="text-acid tabular-nums">{gain.toFixed(1)}×</span></div>
          <input type="range" min="0.2" max="2" step="0.1" value={gain} onChange={(e) => setGain(+e.target.value)} className="w-full" aria-label="Synapse gain" />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Signal speed</span><span className="text-acid tabular-nums">{speed.toFixed(1)}×</span></div>
          <input type="range" min="0.3" max="2.5" step="0.1" value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-full" aria-label="Signal speed" />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Firing rate</span><span className="text-acid tabular-nums">{rate.toFixed(1)}/s</span></div>
          <input type="range" min="0.2" max="4" step="0.1" value={rate} onChange={(e) => setRate(+e.target.value)} className="w-full" aria-label="Firing rate" />
        </div>
        <div className="mt-auto border-t border-ivory/10 pt-4 space-y-3">
          <div>
            <div className="flex justify-between text-[10px] tracking-[0.2em] uppercase text-ivory/45 mb-1.5">
              <span>Output activation</span>
              <span ref={outVal} className="text-acid tabular-nums">0.00</span>
            </div>
            <div className="h-1.5 rounded-full bg-ivory/10 overflow-hidden">
              <div ref={outBar} className="h-full bg-acid rounded-full transition-none" style={{ width: '0%' }} />
            </div>
          </div>
          <LabHint icon="chip">Signals travel neuron to neuron. Excitatory synapses (coral) push activation up, inhibitory (lavender) pull it down — the output is the tanh of everything that arrived.</LabHint>
        </div>
      </div>
    </div>
  );
}
