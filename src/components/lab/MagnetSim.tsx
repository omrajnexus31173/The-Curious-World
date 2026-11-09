import { useRef, useState } from 'react';
import { useSimLoop } from './simkit';
import { ToggleChip, LabHint } from './OrbitSim';

interface Pole { x: number; y: number; q: number; }

function poles(d: number, flipL: boolean, flipR: boolean): Pole[] {
  const a = flipL ? -1 : 1;
  const b = flipR ? 1 : -1; // right magnet defaults S facing centre? choose: left magnet N on its right face (toward centre)
  return [
    { x: -d - 0.55, y: 0, q: a * 1 },
    { x: -d + 0.55, y: 0, q: -a },
    { x: d - 0.55, y: 0, q: b },
    { x: d + 0.55, y: 0, q: -b },
  ];
}

function fieldAt(ps: Pole[], x: number, y: number): [number, number] {
  let fx = 0, fy = 0;
  for (const pole of ps) {
    const dx = x - pole.x, dy = y - pole.y;
    const r2 = dx * dx + dy * dy + 0.015;
    const r = Math.sqrt(r2);
    const s = pole.q / (r2 * r);
    fx += dx * s; fy += dy * s;
  }
  return [fx, fy];
}

export default function MagnetSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dist, setDist] = useState(0.85);
  const [flipL, setFlipL] = useState(false);
  const [flipR, setFlipR] = useState(false);
  const [grains, setGrains] = useState(true);
  const ctrl = useRef({ dist, flipL, flipR, grains });
  const grainsRef = useRef<[number, number][]>([]);
  ctrl.current.dist = dist;
  ctrl.current.flipL = flipL;
  ctrl.current.flipR = flipR;
  ctrl.current.grains = grains;

  // attract or repel?
  const leftFace = flipL ? -1 : 1;
  const rightFace = flipR ? 1 : -1;
  const attracting = leftFace !== rightFace;

  useSimLoop(canvasRef, (ctx, dt) => {
    const canvas = canvasRef.current!;
    const { w, h } = { w: canvas.clientWidth, h: canvas.clientHeight };
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const S = Math.min(w, h) / 3.4;
    const c = ctrl.current;
    const P = poles(c.dist, c.flipL, c.flipR);
    const toXY = (x: number, y: number): [number, number] => [cx + x * S, cy + y * S];

    // field lines from + poles
    ctx.lineWidth = 1;
    for (const p of P) {
      if (p.q <= 0) continue;
      for (let k = 0; k < 12; k++) {
        const a0 = (k / 12) * Math.PI * 2;
        let [x, y] = [p.x + Math.cos(a0) * 0.06, p.y + Math.sin(a0) * 0.06];
        ctx.beginPath();
        ctx.strokeStyle = p.q > 0 ? 'rgba(255,112,79,0.34)' : 'rgba(181,154,255,0.34)';
        const [sx, sy] = toXY(x, y);
        ctx.moveTo(sx, sy);
        let broke = false;
        for (let s = 0; s < 420; s++) {
          const [fx, fy] = fieldAt(P, x, y);
          const m = Math.hypot(fx, fy) || 1;
          x += (fx / m) * 0.028;
          y += (fy / m) * 0.028;
          if (Math.abs(x) > 1.9 || Math.abs(y) > 1.35) broke = true;
          for (const np of P) if (np.q < 0 && Math.hypot(x - np.x, y - np.y) < 0.05) broke = true;
          if (broke) break;
          const [px2, py2] = toXY(x, y);
          ctx.lineTo(px2, py2);
        }
        ctx.stroke();
      }
    }

    // drifting field grains
    if (c.grains) {
      if (grainsRef.current.length === 0) {
        for (let i = 0; i < 160; i++) grainsRef.current.push([(Math.random() - 0.5) * 3.4, (Math.random() - 0.5) * 2.2]);
      }
      ctx.globalAlpha = 0.5;
      for (const gp of grainsRef.current) {
        const [fx, fy] = fieldAt(P, gp[0], gp[1]);
        const m = Math.hypot(fx, fy) || 1;
        gp[0] += (fx / m) * dt * 0.5;
        gp[1] += (fy / m) * dt * 0.5;
        if (Math.abs(gp[0]) > 1.8 || Math.abs(gp[1]) > 1.3) {
          gp[0] = (Math.random() - 0.5) * 3.4;
          gp[1] = (Math.random() - 0.5) * 2.2;
        }
        const [px, py] = toXY(gp[0], gp[1]);
        ctx.fillStyle = 'rgba(215,255,69,0.5)';
        ctx.fillRect(px, py, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }

    // magnets
    const bar = (bx: number, flip: boolean) => {
      const [x1] = toXY(bx - 0.55, 0);
      const [x2] = toXY(bx + 0.55, 0);
      const by = cy - 13, bh = 26;
      const nLeft = flip;
      const nColor = '#FF704F', sColor = '#B59AFF';
      ctx.fillStyle = nLeft ? nColor : sColor;
      ctx.fillRect(x1, by, (x2 - x1) / 2, bh);
      ctx.fillStyle = nLeft ? sColor : nColor;
      ctx.fillRect((x1 + x2) / 2, by, (x2 - x1) / 2, bh);
      ctx.strokeStyle = 'rgba(243,235,221,0.4)';
      ctx.strokeRect(x1, by, x2 - x1, bh);
      ctx.fillStyle = '#171713';
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.fillText(nLeft ? 'N' : 'S', x1 + 8, cy + 4);
      ctx.fillText(nLeft ? 'S' : 'N', x2 - 15, cy + 4);
    };
    bar(-c.dist, c.flipL);
    bar(c.dist, !c.flipR);

    // status word
    ctx.globalAlpha = 0.85;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillStyle = attracting ? '#D7FF45' : '#FF704F';
    ctx.textAlign = 'center';
    ctx.fillText(attracting ? 'OPPONENT POLES — ATTRACTING' : 'LIKE POLES — REPELLING', cx, 26);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  });

  return (
    <div className="grid lg:grid-cols-[1fr_290px] gap-5 h-full">
      <div className="relative border border-ivory/12 rounded-2xl bg-coal/40 overflow-hidden min-h-[340px]">
        <canvas ref={canvasRef} className="w-full h-full block" aria-label="Magnetic field line simulation" />
      </div>
      <div className="flex flex-col gap-4 border border-ivory/12 rounded-2xl bg-coal/40 p-5">
        <div>
          <div className="flex justify-between mb-2 text-[10px] tracking-[0.2em] uppercase"><span className="text-ivory/45">Gap between magnets</span><span className="text-acid tabular-nums">{dist.toFixed(2)}</span></div>
          <input type="range" min="0.55" max="1.5" step="0.01" value={dist} onChange={(e) => setDist(+e.target.value)} className="w-full" aria-label="Distance between magnets" />
        </div>
        <div className="flex gap-2">
          <ToggleChip on={flipL} onClick={() => setFlipL((v) => !v)} label="Flip left" color="#FF704F" />
          <ToggleChip on={flipR} onClick={() => setFlipR((v) => !v)} label="Flip right" color="#FF704F" />
        </div>
        <ToggleChip on={grains} onClick={() => setGrains((v) => !v)} label="Field grains" />
        <div className="mt-auto space-y-3 border-t border-ivory/10 pt-4">
          <LabHint icon="spark">{attracting ? 'The poles facing each other are opposite, so the field lines run straight from one to the other — the magnets would pull together.' : 'The poles facing each other are identical, so the lines bow apart around a neutral zone — the magnets would push apart.'}</LabHint>
          <div className="flex items-center gap-4 text-[10px] text-ivory/50">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-coral" /> North</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-lav" /> South</span>
          </div>
        </div>
      </div>
    </div>
  );
}
