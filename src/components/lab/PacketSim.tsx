import { useRef, useState } from 'react';
import { useSimLoop } from './simkit';
import { ToggleChip, LabHint } from './OrbitSim';

const NODES = [
  { id: 'C1', x: 0.12, y: 0.2, kind: 'client' },
  { id: 'C2', x: 0.12, y: 0.52, kind: 'client' },
  { id: 'C3', x: 0.12, y: 0.82, kind: 'client' },
  { id: 'R1', x: 0.44, y: 0.3, kind: 'router' },
  { id: 'R2', x: 0.46, y: 0.7, kind: 'router' },
  { id: 'S1', x: 0.8, y: 0.26, kind: 'server' },
  { id: 'S2', x: 0.82, y: 0.72, kind: 'server' },
];
const EDGES: [number, number][] = [[0, 3], [1, 3], [1, 4], [2, 4], [3, 4], [3, 5], [3, 6], [4, 6], [5, 6]];

function findPath(from: number, to: number): number[] {
  const seen = new Set<number>([from]);
  const q: number[][] = [[from]];
  while (q.length) {
    const path = q.shift()!;
    const last = path[path.length - 1];
    if (last === to) return path;
    for (const [a, b] of EDGES) {
      const n = a === last ? b : b === last ? a : -1;
      if (n >= 0 && !seen.has(n)) { seen.add(n); q.push([...path, n]); }
    }
  }
  return [from, to];
}

interface Packet { path: number[]; t: number; color: string; }
interface Flash { x: number; y: number; t: number; ok: boolean; }

export default function PacketSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packets = useRef<Packet[]>([]);
  const flashes = useRef<Flash[]>([]);
  const autoTimer = useRef(0);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(5);
  const [drop, setDrop] = useState(0.15);
  const [speed, setSpeed] = useState(2.4);
  const [auto, setAuto] = useState(true);
  const [stats, setStats] = useState({ sent: 0, ok: 0, lost: 0 });
  const ctrl = useRef({ drop, speed, auto });
  ctrl.current.drop = drop;
  ctrl.current.speed = speed;
  ctrl.current.auto = auto;

  const send = (f: number, t: number) => {
    packets.current.push({ path: findPath(f, t), t: 0.0001, color: '#D7FF45' });
    setStats((s) => ({ ...s, sent: s.sent + 1 }));
  };

  useSimLoop(canvasRef, (ctx, dt) => {
    const canvas = canvasRef.current!;
    const { w, h } = { w: canvas.clientWidth, h: canvas.clientHeight };
    ctx.clearRect(0, 0, w, h);
    const c = ctrl.current;
    const XY = (i: number): [number, number] => [NODES[i].x * w, NODES[i].y * h];

    // edges
    for (const [a, b] of EDGES) {
      const [x1, y1] = XY(a);
      const [x2, y2] = XY(b);
      ctx.strokeStyle = 'rgba(243,235,221,0.16)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // auto traffic
    if (c.auto) {
      autoTimer.current += dt;
      if (autoTimer.current > 1.7) {
        autoTimer.current = 0;
        const f = Math.floor(Math.random() * 3);
        const t = 5 + Math.floor(Math.random() * 2);
        send(f, t);
      }
    }

    // packets
    for (let k = packets.current.length - 1; k >= 0; k--) {
      const p = packets.current[k];
      p.t += dt * c.speed;
      const hop = Math.floor(p.t);
      if (hop >= p.path.length - 1) {
        const [x, y] = XY(p.path[p.path.length - 1]);
        flashes.current.push({ x, y, t: 0, ok: true });
        packets.current.splice(k, 1);
        setStats((s) => ({ ...s, ok: s.ok + 1 }));
        continue;
      }
      // hop boundary: possible drop
      if (Math.floor(p.t - dt * c.speed) < hop && hop > 0 && hop < p.path.length - 1) {
        if (Math.random() < c.drop) {
          const [x, y] = XY(p.path[hop]);
          flashes.current.push({ x, y, t: 0, ok: false });
          packets.current.splice(k, 1);
          setStats((s) => ({ ...s, lost: s.lost + 1 }));
          continue;
        }
      }
      const [ax, ay] = XY(p.path[hop]);
      const [bx, by] = XY(p.path[hop + 1]);
      const u = p.t - hop;
      const x = ax + (bx - ax) * u;
      const y = ay + (by - ay) * u;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(ax + (bx - ax) * Math.max(0, u - 0.08), ay + (by - ay) * Math.max(0, u - 0.08), 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // flashes
    for (let k = flashes.current.length - 1; k >= 0; k--) {
      const f = flashes.current[k];
      f.t += dt;
      if (f.t > 0.8) { flashes.current.splice(k, 1); continue; }
      ctx.globalAlpha = 1 - f.t / 0.8;
      ctx.strokeStyle = f.ok ? '#D7FF45' : '#FF704F';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + f.t * 30, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // nodes
    NODES.forEach((n, i) => {
      const [x, y] = XY(i);
      ctx.lineWidth = 1.5;
      if (n.kind === 'router') {
        ctx.strokeStyle = 'rgba(243,235,221,0.55)';
        ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(243,235,221,0.25)';
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
      } else if (n.kind === 'server') {
        ctx.fillStyle = '#26261f';
        ctx.strokeStyle = n.id === 'S1' ? 'rgba(215,255,69,0.6)' : 'rgba(181,154,255,0.6)';
        ctx.beginPath(); ctx.rect(x - 11, y - 11, 22, 22); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.rect(x - 7, y - 7, 14, 14); ctx.stroke();
      } else {
        ctx.fillStyle = '#26261f';
        ctx.strokeStyle = 'rgba(255,112,79,0.6)';
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(243,235,221,0.7)';
      ctx.font = '10px "Space Grotesk", sans-serif';
      ctx.fillText(n.id, x - 7, y + 26);
    });
  });

  const rate = stats.sent ? Math.round((stats.ok / stats.sent) * 100) : 100;

  return (
    <div className="grid lg:grid-cols-[1fr_290px] gap-5 h-full">
      <div className="relative border border-ivory/12 rounded-2xl bg-coal/40 overflow-hidden min-h-[340px]">
        <canvas ref={canvasRef} className="w-full h-full block" aria-label="Network packet simulation" />
      </div>
      <div className="flex flex-col gap-4 border border-ivory/12 rounded-2xl bg-coal/40 p-5">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] tracking-[0.2em] uppercase text-ivory/45">From</span>
            <select value={from} onChange={(e) => setFrom(+e.target.value)} className="mt-1 w-full bg-obsidian border border-ivory/15 rounded-lg px-3 py-2 text-sm text-ivory" aria-label="Source">
              {NODES.slice(0, 5).map((n, i) => <option key={n.id} value={i}>{n.id}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] tracking-[0.2em] uppercase text-ivory/45">To</span>
            <select value={to} onChange={(e) => setTo(+e.target.value)} className="mt-1 w-full bg-obsidian border border-ivory/15 rounded-lg px-3 py-2 text-sm text-ivory" aria-label="Destination">
              {NODES.map((n, i) => <option key={n.id} value={i}>{n.id}</option>)}
            </select>
          </label>
        </div>
        <button data-cursor="play" onClick={() => send(from, to)} className="w-full bg-acid text-obsidian py-3 rounded-full text-[11px] font-semibold tracking-[0.24em] uppercase hover:shadow-[0_0_30px_rgba(215,255,69,0.35)] transition-shadow">
          Send packet
        </button>
        <ToggleChip on={auto} onClick={() => setAuto((v) => !v)} label="Auto-traffic" />
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Link drop rate</span><span className="text-coral tabular-nums">{Math.round(drop * 100)}%</span></div>
          <input type="range" min="0" max="0.9" step="0.05" value={drop} onChange={(e) => setDrop(+e.target.value)} className="w-full range-coral" aria-label="Drop rate" />
        </div>
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Link speed</span><span className="text-acid tabular-nums">{speed.toFixed(1)} hops/s</span></div>
          <input type="range" min="0.5" max="6" step="0.1" value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-full" aria-label="Link speed" />
        </div>
        <div className="mt-auto border-t border-ivory/10 pt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-obsidian/60 rounded-lg py-2"><div className="text-lg font-semibold text-ivory tabular-nums">{stats.sent}</div><div className="text-[9px] tracking-[0.18em] uppercase text-ivory/40">Sent</div></div>
            <div className="bg-obsidian/60 rounded-lg py-2"><div className="text-lg font-semibold text-acid tabular-nums">{stats.ok}</div><div className="text-[9px] tracking-[0.18em] uppercase text-ivory/40">Delivered</div></div>
            <div className="bg-obsidian/60 rounded-lg py-2"><div className="text-lg font-semibold text-coral tabular-nums">{stats.lost}</div><div className="text-[9px] tracking-[0.18em] uppercase text-ivory/40">Lost</div></div>
          </div>
          <div className="text-center text-[10px] tracking-[0.2em] uppercase text-ivory/45">Delivery rate <span className="text-acid">{rate}%</span></div>
          <LabHint icon="globe">Packets hop router to router along shortest paths. Crank the drop rate and watch the network degrade — exactly why real protocols retransmit.</LabHint>
        </div>
      </div>
    </div>
  );
}
