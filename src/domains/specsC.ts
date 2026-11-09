import { C, TAU, arrow, bg, clamp, dot, fmt, grid2d, grid3d, hash, lerp, poly, proj, rgba, seg, txt, type Spec } from '../sim/engine';
import { progress } from '../lib/progress';

/* ================================================================== */
/*  13 · ENGINEERING & MACHINES                                        */
/* ================================================================== */
const EMODES = ['Gear train', 'Four-bar linkage', 'Hydraulic press', 'Truss bridge', 'Turbine'];
export const engineering: Spec = {
  id: 'engineering', name: 'Engineering & Machines', tag: 'Mechanisms under load', accent: C.acid, glyph: 'chip', orbit: true,
  blurb: 'Five working mechanisms with real ratios and forces. Teeth counts set the gear ratio, piston areas set hydraulic advantage, and truss members turn red in compression.',
  method: 'Gear ratio and torque are exact (ω₂ = ω₁·N₁/N₂, T₂ = T₁·N₂/N₁). Hydraulics use Pascal’s law F₂ = F₁·A₂/A₁. The truss uses a simplified method-of-joints load path; the four-bar is solved by circle intersection.',
  facts: ['Gears trade speed for torque — power in equals power out minus losses.', 'A hydraulic press multiplies force by the area ratio, never energy.', 'Triangles are the only inherently rigid polygon — hence trusses.', 'Betz’s limit caps a wind turbine at 59.3% of the kinetic energy in the wind.'],
  ctrls: [
    { k: 'rpm', label: 'Input speed', min: 0, max: 300, step: 5, def: 90, unit: ' rpm' },
    { k: 'n1', label: 'Driver teeth', min: 8, max: 40, step: 1, def: 12 },
    { k: 'n2', label: 'Driven teeth', min: 8, max: 60, step: 1, def: 36 },
    { k: 'torque', label: 'Input torque', min: 1, max: 100, step: 1, def: 20, unit: ' N·m' },
    { k: 'area', label: 'Piston area ratio', min: 1, max: 40, step: 0.5, def: 12 },
    { k: 'load', label: 'Applied load', min: 0, max: 100, step: 1, def: 40, unit: ' kN' },
    { k: 'crank', label: 'Crank length', min: 0.2, max: 1, step: 0.02, def: 0.5 },
  ],
  toggles: [{ k: 'labels', label: 'Labels', def: true }, { k: 'forces', label: 'Force colours', def: true }, { k: 'explode', label: 'Exploded view', def: false }],
  choices: [{ k: 'mode', label: 'Mechanism', options: EMODES, def: 0 }],
  scenarios: [
    { name: 'Reduction gearbox', note: '12 → 48 teeth: 4× torque, ¼ speed', set: { mode: 0, n1: 12, n2: 48, rpm: 120 } },
    { name: 'Hydraulic jack', note: '30:1 area ratio lifts 30× the force', set: { mode: 2, area: 30, load: 60 } },
    { name: 'Bridge overload', note: 'Push the truss past its comfort zone', set: { mode: 3, load: 95 } },
  ],
  make: () => ({ a: 0, press: 0 }),
  step(m, p, dt) { m.a += dt * (p.rpm / 60) * TAU * 0.2; m.press = (Math.sin(m.a * 0.6) * 0.5 + 0.5); },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.acid);
    grid2d(ctx, e, 48, C.ivory, 0.035);
    const mode = Math.round(p.mode), cx = e.w / 2, cy = e.h / 2;
    const ex = p.explode ? 34 : 0;
    const gear = (x: number, y: number, n: number, ang: number, col: string) => {
      const R = 14 + n * 1.7;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= n * 2; i++) {
        const a = ang + (i / (n * 2)) * TAU;
        const r = R + (i % 2 ? 5 : 0);
        const X = x + Math.cos(a) * r, Y = y + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = rgba(col, 0.1); ctx.fill();
      dot(ctx, x, y, 5, col, 0);
      seg(ctx, x, y, x + Math.cos(ang) * R, y + Math.sin(ang) * R, rgba(col, 0.7), 1.6);
      return R;
    };
    if (mode === 0) {
      const r1 = gear(cx - 70 - ex, cy, Math.round(p.n1), m.a, C.acid);
      const r2 = gear(cx - 70 + r1 + 14 + Math.round(p.n2) * 1.7 + ex, cy, Math.round(p.n2), -m.a * p.n1 / p.n2 + 0.1, C.coral);
      if (p.labels) {
        txt(ctx, `${Math.round(p.n1)}T · ${p.rpm} rpm`, cx - 70 - ex, cy + r1 + 26, 10, C.acid, 'center', 0.9);
        txt(ctx, `${Math.round(p.n2)}T · ${(p.rpm * p.n1 / p.n2).toFixed(0)} rpm`, cx - 70 + r1 + 14 + Math.round(p.n2) * 1.7 + ex, cy + r2 + 26, 10, C.coral, 'center', 0.9);
      }
      txt(ctx, `ratio ${(p.n2 / p.n1).toFixed(2)}:1 · output torque ${(p.torque * p.n2 / p.n1).toFixed(1)} N·m`, 14, e.h - 14, 11, C.acid, 'left', 0.9);
    } else if (mode === 1) {
      const O = { x: cx - 110, y: cy + 50 }, L1 = p.crank * 80, L2 = 150, L3 = 110, D = 200;
      const A = { x: O.x + Math.cos(m.a) * L1, y: O.y + Math.sin(m.a) * L1 };
      const Bx = O.x + D;
      const dx = Bx - A.x, dy = O.y - A.y, d = Math.hypot(dx, dy);
      const ok = d < L2 + L3 && d > Math.abs(L2 - L3);
      const a2 = ok ? Math.acos(clamp((L2 * L2 + d * d - L3 * L3) / (2 * L2 * d), -1, 1)) : 0;
      const base = Math.atan2(dy, dx);
      const B = { x: A.x + Math.cos(base - a2) * L2, y: A.y + Math.sin(base - a2) * L2 };
      seg(ctx, O.x, O.y, Bx, O.y, rgba(C.ivory, 0.25), 2);
      seg(ctx, O.x, O.y, A.x, A.y, C.acid, 4);
      if (ok) { seg(ctx, A.x, A.y, B.x, B.y, C.coral, 4); seg(ctx, B.x, B.y, Bx, O.y, C.lav, 4); }
      [O, A, B, { x: Bx, y: O.y }].forEach((q) => dot(ctx, q.x, q.y, 6, C.ivory, 6));
      txt(ctx, ok ? 'Grashof linkage — continuous rotation possible' : 'Non-Grashof at this crank length — linkage locks', 14, e.h - 14, 10.5, ok ? C.acid : C.coral, 'left', 0.9);
    } else if (mode === 2) {
      const s1 = 22, s2 = 22 * Math.sqrt(p.area);
      const y1 = cy + 40 - m.press * 40, y2 = cy + 40 + m.press * 40 / p.area;
      ctx.fillStyle = rgba(C.sky, 0.25);
      ctx.fillRect(cx - 140, cy + 40, 280, 60);
      ctx.fillRect(cx - 140 - s1 / 2, y1, s1, cy + 100 - y1);
      ctx.fillRect(cx + 140 - s2 / 2, y2, s2, cy + 100 - y2);
      ctx.strokeStyle = rgba(C.ivory, 0.5); ctx.lineWidth = 2;
      ctx.strokeRect(cx - 140 - s1 / 2, y1 - 16, s1, 16);
      ctx.strokeRect(cx + 140 - s2 / 2, y2 - 16, s2, 16);
      arrow(ctx, cx - 140, y1 - 60, cx - 140, y1 - 22, C.acid, 2.4);
      arrow(ctx, cx + 140, y2 - 22, cx + 140, y2 - 60 - Math.min(60, p.area), C.coral, 2.4);
      txt(ctx, `${p.load} kN in`, cx - 140, y1 - 70, 10, C.acid, 'center', 0.9);
      txt(ctx, `${(p.load * p.area).toFixed(0)} kN out`, cx + 140, y2 - 70 - Math.min(60, p.area), 10, C.coral, 'center', 0.9);
      txt(ctx, `Pascal: pressure is equal everywhere · area ratio ${p.area}:1`, 14, e.h - 14, 10.5, C.acid, 'left', 0.9);
    } else if (mode === 3) {
      const n = 6, span = e.w * 0.72, x0 = (e.w - span) / 2, y0 = cy + 60, h = 70;
      const nodes: { x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) nodes.push({ x: x0 + (i / n) * span, y: y0 });
      for (let i = 0; i < n; i++) nodes.push({ x: x0 + ((i + 0.5) / n) * span, y: y0 - h });
      const stress = p.load / 100;
      const drawMember = (a: { x: number; y: number }, b: { x: number; y: number }, comp: boolean) => {
        const col = p.forces ? (comp ? C.coral : C.acid) : C.ivory;
        seg(ctx, a.x, a.y + (comp ? stress * 3 : -stress * 2), b.x, b.y + (comp ? stress * 3 : -stress * 2), rgba(col, 0.35 + stress * 0.65), 2 + stress * 3);
      };
      for (let i = 0; i < n; i++) { drawMember(nodes[i], nodes[i + 1], false); drawMember(nodes[i], nodes[n + 1 + i], true); drawMember(nodes[n + 1 + i], nodes[i + 1], false); if (i < n - 1) drawMember(nodes[n + 1 + i], nodes[n + 2 + i], true); }
      const loadX = x0 + span / 2;
      arrow(ctx, loadX, y0 - h - 60, loadX, y0 - h - 6, C.amber, 3);
      txt(ctx, `${p.load} kN`, loadX, y0 - h - 68, 11, C.amber, 'center', 0.95);
      poly(ctx, [{ x: x0 - 12, y: y0 + 18 }, { x: x0 + 12, y: y0 + 18 }, { x: x0, y: y0 }], rgba(C.ivory, 0.4));
      poly(ctx, [{ x: x0 + span - 12, y: y0 + 18 }, { x: x0 + span + 12, y: y0 + 18 }, { x: x0 + span, y: y0 }], rgba(C.ivory, 0.4));
      txt(ctx, 'coral = compression · lime = tension', 14, e.h - 14, 10.5, C.ivory, 'left', 0.7);
    } else {
      const R = Math.min(e.w, e.h) * 0.28;
      for (let b = 0; b < 3; b++) {
        const a0 = m.a + (b / 3) * TAU;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a0);
        ctx.fillStyle = rgba(C.acid, 0.25); ctx.strokeStyle = C.acid; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(R * 0.5, -R * 0.22, R, -R * 0.06); ctx.quadraticCurveTo(R * 0.5, R * 0.06, 0, 0); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      dot(ctx, cx, cy, 14, C.slab, 0);
      for (let i = 0; i < 16; i++) {
        const y = cy - R + (i / 16) * R * 2;
        const t = (e.t * 0.6 + i / 16) % 1;
        seg(ctx, cx - R * 1.6 + t * R * 3.2, y, cx - R * 1.6 + t * R * 3.2 + 22, y, rgba(C.sky, 0.25), 1.4);
      }
      txt(ctx, `Cp ${(0.45 * (1 - Math.abs(p.rpm - 150) / 300)).toFixed(2)} · Betz limit 0.593`, 14, e.h - 14, 10.5, C.acid, 'left', 0.9);
    }
  },
  readouts: (_m, p) => [
    { label: 'Gear ratio', value: `${(p.n2 / p.n1).toFixed(2)} : 1`, tone: C.acid },
    { label: 'Output speed', value: `${(p.rpm * p.n1 / p.n2).toFixed(0)} rpm` },
    { label: 'Output torque', value: `${(p.torque * p.n2 / p.n1).toFixed(1)} N·m`, tone: C.coral },
    { label: 'Power', value: `${(p.torque * p.rpm * TAU / 60 / 1000).toFixed(2)} kW` },
    { label: 'Hydraulic force', value: `${(p.load * p.area).toFixed(0)} kN` },
    { label: 'Mech. advantage', value: `${p.area.toFixed(1)}×` },
  ],
  series: (_m, p) => [{ label: 'Torque N·m', color: C.coral, v: p.torque * p.n2 / p.n1, max: 400 }, { label: 'Output rpm', color: C.acid, v: p.rpm * p.n1 / p.n2, max: 300 }],
  explain: (_m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 0) return `${Math.round(p.n1)} teeth driving ${Math.round(p.n2)}: the output turns ${(p.n1 / p.n2).toFixed(2)}× as fast but carries ${(p.n2 / p.n1).toFixed(2)}× the torque. Power (${(p.torque * p.rpm * TAU / 60 / 1000).toFixed(2)} kW) is unchanged apart from friction.`;
    if (mode === 1) return `A four-bar linkage converts rotation into a complex coupler curve. Grashof’s condition decides whether the crank can turn fully — shorten it and the mechanism locks.`;
    if (mode === 2) return `Pressure is transmitted undiminished through the fluid, so the larger piston feels ${p.area}× the force — but moves ${p.area}× less distance. Work is conserved.`;
    if (mode === 3) return `Load travels through triangles to the supports. Top chords shorten (compression, coral), bottom chords stretch (tension, lime). At ${p.load} kN the members are visibly deflected.`;
    return `Blade pitch and tip-speed ratio set the power coefficient. No turbine can exceed Betz’s 59.3% — extracting more would stop the air behind it.`;
  },
};

/* ================================================================== */
/*  14 · ELECTRONICS & CIRCUITS                                        */
/* ================================================================== */
const CIRCUITS = ['Series R', 'Parallel R', 'RC charge', 'Diode rectifier', 'Logic gates'];
const GATES = ['AND', 'OR', 'XOR', 'NOT', 'NAND'];
export const electronics: Spec = {
  id: 'electronics', name: 'Electronics & Circuits', tag: 'Live circuit bench', accent: C.amber, glyph: 'chip', orbit: false,
  blurb: 'Ohm’s law, capacitor charging and logic, all solved every frame. Electrons move at a speed proportional to the actual current, and the oscilloscope traces the real waveform.',
  method: 'DC networks solved analytically (series/parallel). RC uses Vc = V(1 − e^(−t/RC)) with τ = RC. The diode uses a 0.7 V forward drop. Logic gates evaluate a real truth table.',
  facts: ['τ = RC: after one time constant a capacitor reaches 63.2% of supply.', 'In parallel, voltage is shared; in series, current is shared.', 'A silicon diode drops about 0.7 V when conducting.', 'NAND is functionally complete — every logic function can be built from it.'],
  ctrls: [
    { k: 'v', label: 'Supply voltage', min: 0, max: 24, step: 0.5, def: 9, unit: ' V' },
    { k: 'r1', label: 'R₁', min: 10, max: 2000, step: 10, def: 220, unit: ' Ω' },
    { k: 'r2', label: 'R₂', min: 10, max: 2000, step: 10, def: 470, unit: ' Ω' },
    { k: 'cap', label: 'Capacitance', min: 1, max: 1000, step: 1, def: 220, unit: ' µF' },
    { k: 'freq', label: 'AC frequency', min: 0.2, max: 20, step: 0.2, def: 2, unit: ' Hz' },
    { k: 'duty', label: 'PWM duty', min: 0, max: 1, step: 0.02, def: 0.5 },
  ],
  toggles: [{ k: 'flow', label: 'Electron flow', def: true }, { k: 'scope', label: 'Oscilloscope', def: true }, { k: 'vals', label: 'Values', def: true }, { k: 'a', label: 'Input A', def: true }, { k: 'b', label: 'Input B', def: false }],
  choices: [{ k: 'mode', label: 'Circuit', options: CIRCUITS, def: 2 }, { k: 'gate', label: 'Gate', options: GATES, def: 0 }],
  scenarios: [
    { name: 'RC timing', note: '220 Ω × 220 µF → τ = 48 ms', set: { mode: 2, r1: 220, cap: 220, v: 9 } },
    { name: 'Slow charge', note: '1000 µF — watch the curve crawl', set: { mode: 2, cap: 1000, r1: 1000 } },
    { name: 'XOR gate', note: 'Output high only when inputs differ', set: { mode: 4, gate: 2, a: 1, b: 0 } },
  ],
  make: () => ({ vc: 0, t: 0, scope: [] as number[], phase: 0 }),
  step(m, p, dt) {
    m.t += dt;
    const mode = Math.round(p.mode);
    const tau = (p.r1 * p.cap) / 1e6;
    const src = mode === 3 ? Math.abs(Math.sin(m.t * p.freq * TAU)) * p.v : p.v;
    const target = mode === 3 ? Math.max(0, src - 0.7) : src;
    m.vc += (target - m.vc) * clamp(dt / Math.max(0.001, tau), 0, 1);
    m.phase += dt * (mode === 3 ? p.freq : 1);
    m.scope.push(mode === 2 ? m.vc : mode === 3 ? Math.max(0, Math.sin(m.t * p.freq * TAU) * p.v - 0.7) : (Math.sin(m.t * p.freq * TAU) * 0.5 + 0.5) * p.v * p.duty);
    if (m.scope.length > 220) m.scope.shift();
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.amber);
    grid2d(ctx, e, 40, C.ivory, 0.03);
    const mode = Math.round(p.mode);
    const x0 = e.w * 0.16, x1 = e.w * 0.84, y0 = e.h * 0.2, y1 = e.h * 0.56;
    const I = mode === 1 ? p.v / p.r1 + p.v / p.r2 : p.v / (p.r1 + (mode === 0 ? p.r2 : 0));
    const wire = (pts: number[][]) => {
      ctx.strokeStyle = rgba(C.ivory, 0.45); ctx.lineWidth = 2;
      ctx.beginPath(); pts.forEach((q, i) => i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])); ctx.stroke();
    };
    const resistor = (x: number, y: number, label: string) => {
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.fillStyle = C.coal;
      ctx.beginPath(); ctx.rect(x - 26, y - 10, 52, 20); ctx.fill(); ctx.stroke();
      if (p.vals) txt(ctx, label, x, y + 26, 9.5, C.amber, 'center', 0.9);
    };
    if (mode <= 2) {
      wire([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
      ctx.fillStyle = C.obsidian; ctx.fillRect(x0 - 16, (y0 + y1) / 2 - 22, 32, 44);
      seg(ctx, x0 - 12, (y0 + y1) / 2 - 10, x0 + 12, (y0 + y1) / 2 - 10, C.acid, 3);
      seg(ctx, x0 - 7, (y0 + y1) / 2 + 4, x0 + 7, (y0 + y1) / 2 + 4, C.acid, 3);
      txt(ctx, `${p.v} V`, x0 - 26, (y0 + y1) / 2, 10, C.acid, 'right', 0.95);
      resistor((x0 + x1) / 2, y0, `R₁ ${p.r1}Ω`);
      if (mode === 0) resistor((x0 + x1) / 2, y1, `R₂ ${p.r2}Ω`);
      if (mode === 1) { wire([[x1, y0], [x1, y1]]); resistor(x1, (y0 + y1) / 2, `R₂ ${p.r2}Ω`); }
      if (mode === 2) {
        const cx2 = (x0 + x1) / 2;
        seg(ctx, cx2 - 4, y1 - 18, cx2 - 4, y1 + 18, C.lav, 3);
        seg(ctx, cx2 + 4, y1 - 18, cx2 + 4, y1 + 18, C.lav, 3);
        txt(ctx, `${p.cap}µF · ${m.vc.toFixed(2)} V`, cx2, y1 + 36, 10, C.lav, 'center', 0.95);
        const pct = clamp(m.vc / Math.max(0.01, p.v), 0, 1);
        ctx.fillStyle = rgba(C.lav, 0.25); ctx.fillRect(cx2 - 40, y1 + 44, 80, 6);
        ctx.fillStyle = C.lav; ctx.fillRect(cx2 - 40, y1 + 44, 80 * pct, 6);
      }
      if (p.flow) for (let i = 0; i < 26; i++) {
        const t = ((e.t * clamp(I * 6, 0.05, 3) + i / 26) % 1);
        const per = 2 * (x1 - x0) + 2 * (y1 - y0);
        let d = t * per, X = x0, Y = y0;
        if (d < x1 - x0) { X = x0 + d; Y = y0; }
        else if ((d -= x1 - x0) < y1 - y0) { X = x1; Y = y0 + d; }
        else if ((d -= y1 - y0) < x1 - x0) { X = x1 - d; Y = y1; }
        else { d -= x1 - x0; X = x0; Y = y1 - d; }
        dot(ctx, X, Y, 2.6, C.acid, 8);
      }
      txt(ctx, `I = ${(I * 1000).toFixed(1)} mA · P = ${(p.v * I).toFixed(3)} W`, 14, e.h - 14, 11, C.acid, 'left', 0.9);
    } else if (mode === 3) {
      wire([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
      const dx = (x0 + x1) / 2;
      poly(ctx, [{ x: dx - 14, y: y0 - 14 }, { x: dx - 14, y: y0 + 14 }, { x: dx + 12, y: y0 }], rgba(C.coral, 0.5), C.coral);
      seg(ctx, dx + 12, y0 - 14, dx + 12, y0 + 14, C.coral, 3);
      txt(ctx, 'diode 0.7 V', dx, y0 - 24, 9.5, C.coral, 'center', 0.9);
      txt(ctx, `half-wave rectified · ${p.freq} Hz`, 14, e.h - 14, 10.5, C.amber, 'left', 0.9);
    } else {
      const g = Math.round(p.gate), A = p.a ? 1 : 0, B = p.b ? 1 : 0;
      const out = [A && B, A || B, A !== B ? 1 : 0, A ? 0 : 1, A && B ? 0 : 1][g] as number;
      const gx = e.w / 2, gy = e.h * 0.38;
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.fillStyle = rgba(C.amber, 0.08);
      ctx.beginPath();
      if (g === 1 || g === 2) { ctx.moveTo(gx - 40, gy - 34); ctx.quadraticCurveTo(gx + 10, gy - 34, gx + 46, gy); ctx.quadraticCurveTo(gx + 10, gy + 34, gx - 40, gy + 34); ctx.quadraticCurveTo(gx - 22, gy, gx - 40, gy - 34); }
      else if (g === 3) { ctx.moveTo(gx - 30, gy - 30); ctx.lineTo(gx + 30, gy); ctx.lineTo(gx - 30, gy + 30); ctx.closePath(); }
      else { ctx.moveTo(gx - 40, gy - 34); ctx.lineTo(gx, gy - 34); ctx.arc(gx, gy, 34, -Math.PI / 2, Math.PI / 2); ctx.lineTo(gx - 40, gy + 34); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      if (g === 4 || g === 3) { ctx.beginPath(); ctx.arc(gx + (g === 3 ? 36 : 40), gy, 6, 0, TAU); ctx.stroke(); }
      seg(ctx, gx - 100, gy - 16, gx - 40, gy - 16, A ? C.acid : rgba(C.ivory, 0.3), 2.4);
      if (g !== 3) seg(ctx, gx - 100, gy + 16, gx - 40, gy + 16, B ? C.acid : rgba(C.ivory, 0.3), 2.4);
      seg(ctx, gx + 46, gy, gx + 120, gy, out ? C.acid : rgba(C.ivory, 0.3), 2.6);
      dot(ctx, gx + 130, gy, 10, out ? C.acid : C.slab, out ? 20 : 0);
      txt(ctx, `A=${A}`, gx - 116, gy - 12, 11, A ? C.acid : C.ivory, 'right', 0.9);
      if (g !== 3) txt(ctx, `B=${B}`, gx - 116, gy + 20, 11, B ? C.acid : C.ivory, 'right', 0.9);
      txt(ctx, `${GATES[g]} → ${out}`, gx + 150, gy + 4, 12, out ? C.acid : C.ivory, 'left', 0.95);
      const ty = e.h * 0.66;
      txt(ctx, 'A B | OUT', e.w / 2 - 40, ty, 10, C.ivory, 'left', 0.5);
      [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([a, b], i) => {
        const o = [a && b, a || b, a !== b ? 1 : 0, a ? 0 : 1, a && b ? 0 : 1][g] as number;
        const on = a === A && (g === 3 || b === B);
        txt(ctx, `${a} ${b} |  ${o}`, e.w / 2 - 40, ty + 16 + i * 15, 10.5, on ? C.acid : C.ivory, 'left', on ? 1 : 0.4);
      });
    }
    if (p.scope && mode !== 4) {
      const sy = e.h - 70, sh = 48;
      ctx.fillStyle = rgba(C.obsidian, 0.7); ctx.fillRect(e.w - 240, sy - sh, 226, sh + 8);
      ctx.strokeStyle = rgba(C.acid, 0.2); ctx.strokeRect(e.w - 240, sy - sh, 226, sh + 8);
      ctx.strokeStyle = C.acid; ctx.lineWidth = 1.4; ctx.beginPath();
      m.scope.forEach((v: number, i: number) => {
        const X = e.w - 238 + (i / 220) * 222, Y = sy - clamp(v / 24, 0, 1) * sh;
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      });
      ctx.stroke();
      txt(ctx, 'scope 0–24 V', e.w - 236, sy - sh - 4, 8.5, C.acid, 'left', 0.6);
    }
  },
  readouts: (m, p) => {
    const mode = Math.round(p.mode);
    const I = mode === 1 ? p.v / p.r1 + p.v / p.r2 : p.v / (p.r1 + (mode === 0 ? p.r2 : 0));
    const tau = (p.r1 * p.cap) / 1e6;
    const A = p.a ? 1 : 0, B = p.b ? 1 : 0, g = Math.round(p.gate);
    return [
      { label: 'Current', value: `${(I * 1000).toFixed(2)} mA`, tone: C.amber },
      { label: 'Power', value: `${(p.v * I * 1000).toFixed(1)} mW` },
      { label: 'τ = RC', value: `${(tau * 1000).toFixed(1)} ms`, tone: C.lav },
      { label: 'Capacitor', value: `${m.vc.toFixed(2)} V (${((m.vc / Math.max(0.01, p.v)) * 100).toFixed(0)}%)` },
      { label: 'Equivalent R', value: mode === 1 ? `${(1 / (1 / p.r1 + 1 / p.r2)).toFixed(0)} Ω` : `${(p.r1 + (mode === 0 ? p.r2 : 0)).toFixed(0)} Ω` },
      { label: 'Gate output', value: `${[A && B, A || B, A !== B ? 1 : 0, A ? 0 : 1, A && B ? 0 : 1][g]}`, tone: C.acid },
    ];
  },
  series: (m, p) => [{ label: 'Vcap', color: C.lav, v: m.vc, max: Math.max(1, p.v) }, { label: 'Supply', color: C.amber, v: p.v, max: 24 }],
  explain: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 2) {
      const tau = (p.r1 * p.cap) / 1e6;
      if (m.vc / Math.max(0.01, p.v) > 0.62 && m.vc / Math.max(0.01, p.v) < 0.66) progress.completeMission('m-circuit');
      return `Charging through ${p.r1} Ω into ${p.cap} µF gives τ = ${(tau * 1000).toFixed(1)} ms. The capacitor is at ${((m.vc / Math.max(0.01, p.v)) * 100).toFixed(0)}% — it reaches 63.2% after exactly one τ and is essentially full after five.`;
    }
    if (mode === 1) return `Parallel branches share the same voltage but split current. Total resistance (${(1 / (1 / p.r1 + 1 / p.r2)).toFixed(0)} Ω) is lower than either branch alone.`;
    if (mode === 0) return `In series the same current flows through both resistors and the supply voltage divides in proportion to resistance.`;
    if (mode === 3) return `The diode conducts only on positive half-cycles and loses 0.7 V doing so. The scope shows the resulting half-wave rectified waveform.`;
    return `${GATES[Math.round(p.gate)]} evaluates its inputs instantly. Toggle A and B in the instrument rail to walk the whole truth table.`;
  },
};

/* ================================================================== */
/*  15 · COMPUTER SCIENCE                                              */
/* ================================================================== */
const PROGRAM = [
  ['LDI', 5, 0], ['STA', 0, 0], ['LDI', 3, 0], ['STA', 1, 0],
  ['LDA', 0, 0], ['ADD', 1, 0], ['STA', 2, 0], ['LDA', 2, 0],
  ['SUB', 1, 0], ['STA', 2, 0], ['JNZ', 5, 0], ['HLT', 0, 0],
];
const CSMODES = ['CPU cycle', 'Sorting', 'Binary', 'Network stack'];
const ALGOS = ['Bubble', 'Selection', 'Insertion', 'Quick'];
export const computers: Spec = {
  id: 'computers', name: 'Computer Science', tag: 'Execution made visible', accent: C.sky, glyph: 'chip', orbit: false,
  blurb: 'A real 8-opcode processor runs a loop one instruction at a time. Step it manually, or switch benches to watch sorting algorithms, binary place value and packet encapsulation.',
  method: 'The CPU is a genuine interpreter: LDI, LDA, STA, ADD, SUB, JMP, JNZ, HLT with a program counter, accumulator and 16-cell memory. Sorting counts real comparisons and swaps.',
  facts: ['Every program is fetch → decode → execute, billions of times a second.', 'Bubble sort is O(n²); quicksort averages O(n log n).', 'One byte holds 256 distinct values, 0–255.', 'Encapsulation wraps the same payload in a header at every network layer.'],
  ctrls: [
    { k: 'clock', label: 'Clock rate', min: 0.5, max: 12, step: 0.5, def: 2, unit: ' Hz' },
    { k: 'size', label: 'Array size', min: 8, max: 60, step: 2, def: 28 },
    { k: 'value', label: 'Binary value', min: 0, max: 255, step: 1, def: 42 },
    { k: 'layers', label: 'OSI layers shown', min: 3, max: 7, step: 1, def: 5 },
    { k: 'speed', label: 'Sort speed', min: 1, max: 60, step: 1, def: 20 },
  ],
  toggles: [{ k: 'auto', label: 'Auto-run CPU', def: true }, { k: 'regs', label: 'Registers', def: true }, { k: 'hl', label: 'Highlight compares', def: true }],
  choices: [{ k: 'mode', label: 'Bench', options: CSMODES, def: 0 }, { k: 'algo', label: 'Algorithm', options: ALGOS, def: 0 }],
  actions: [{ id: 'step', label: 'Execute one instruction', tone: C.sky }, { id: 'shuffle', label: 'Shuffle array', tone: C.acid }],
  scenarios: [
    { name: 'Single step', note: 'Auto-run off — drive the CPU yourself', set: { mode: 0, auto: 0 } },
    { name: 'Quicksort', note: 'Divide and conquer on 40 items', set: { mode: 1, algo: 3, size: 40 } },
    { name: 'Packet journey', note: 'Follow encapsulation down the stack', set: { mode: 3, layers: 7 } },
  ],
  make: () => ({ pc: 0, acc: 0, mem: new Array(16).fill(0), cycles: 0, acc2: 0, arr: Array.from({ length: 60 }, (_, i) => hash(i) * 100), i: 0, j: 0, cmp: 0, swp: 0, done: false, pivot: 30, phase: 0 }),
  step(m, p, dt) {
    const mode = Math.round(p.mode);
    if (mode === 0 && p.auto) {
      m.acc2 += dt * p.clock;
      while (m.acc2 >= 1) { m.acc2 -= 1; cpuStep(m); }
    }
    if (mode === 1 && !m.done) {
      m.phase += dt * p.speed;
      while (m.phase >= 1 && !m.done) { m.phase -= 1; sortStep(m, p); }
    }
  },
  onAction(a, m, p) {
    if (a === 'step') cpuStep(m);
    if (a === 'shuffle') { m.arr = Array.from({ length: 60 }, () => Math.random() * 100); m.i = 0; m.j = 0; m.cmp = 0; m.swp = 0; m.done = false; m.pivot = Math.round(p.size) - 1; }
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.sky);
    const mode = Math.round(p.mode);
    if (mode === 0) {
      const bx = 20, bw = e.w * 0.42;
      txt(ctx, 'PROGRAM MEMORY', bx, 26, 9.5, C.sky, 'left', 0.7);
      PROGRAM.forEach((ins, i) => {
        const y = 42 + i * 20, on = i === m.pc;
        if (on) { ctx.fillStyle = rgba(C.acid, 0.16); ctx.fillRect(bx - 4, y - 12, bw, 18); }
        txt(ctx, `${String(i).padStart(2, '0')}  ${ins[0]} ${ins[1]}`, bx, y, 11, on ? C.acid : C.ivory, 'left', on ? 1 : 0.45);
      });
      const rx = e.w * 0.56;
      txt(ctx, 'REGISTERS', rx, 26, 9.5, C.sky, 'left', 0.7);
      [['PC', m.pc], ['ACC', m.acc], ['CYCLES', m.cycles]].forEach(([k, v], i) => {
        ctx.strokeStyle = rgba(C.ivory, 0.15); ctx.strokeRect(rx, 38 + i * 38, 150, 30);
        txt(ctx, k as string, rx + 8, 58 + i * 38, 9.5, C.ivory, 'left', 0.5);
        txt(ctx, `${v}`, rx + 140, 58 + i * 38, 13, C.acid, 'right', 1);
      });
      txt(ctx, 'DATA MEMORY', rx, 176, 9.5, C.sky, 'left', 0.7);
      m.mem.forEach((v: number, i: number) => {
        const X = rx + (i % 4) * 40, Y = 188 + Math.floor(i / 4) * 32;
        ctx.fillStyle = v ? rgba(C.sky, 0.18) : rgba(C.ivory, 0.04);
        ctx.strokeStyle = rgba(C.ivory, 0.12);
        ctx.fillRect(X, Y, 34, 26); ctx.strokeRect(X, Y, 34, 26);
        txt(ctx, `${v}`, X + 17, Y + 17, 10, v ? C.sky : C.ivory, 'center', v ? 1 : 0.3);
      });
      const ph = ['FETCH', 'DECODE', 'EXECUTE'][m.cycles % 3];
      txt(ctx, `▸ ${ph}`, bx, e.h - 16, 12, C.acid, 'left', 0.95);
    } else if (mode === 1) {
      const n = Math.round(p.size), bw = (e.w - 40) / n;
      for (let i = 0; i < n; i++) {
        const h = (m.arr[i] / 100) * (e.h - 90);
        const active = p.hl && (i === m.j || i === m.j + 1);
        ctx.fillStyle = m.done ? rgba(C.acid, 0.7) : active ? C.coral : rgba(C.sky, 0.55);
        ctx.fillRect(20 + i * bw, e.h - 40 - h, bw - 2, h);
      }
      txt(ctx, `${ALGOS[Math.round(p.algo)]} sort · ${m.cmp} comparisons · ${m.swp} swaps ${m.done ? '· SORTED' : ''}`, 20, 28, 11, m.done ? C.acid : C.sky, 'left', 0.95);
    } else if (mode === 2) {
      const v = Math.round(p.value);
      for (let i = 7; i >= 0; i--) {
        const bit = (v >> i) & 1, X = e.w / 2 + (3.5 - i) * 52 - 20;
        ctx.fillStyle = bit ? rgba(C.acid, 0.2) : rgba(C.ivory, 0.04);
        ctx.strokeStyle = bit ? C.acid : rgba(C.ivory, 0.15); ctx.lineWidth = 1.4;
        ctx.fillRect(X, e.h * 0.34, 44, 56); ctx.strokeRect(X, e.h * 0.34, 44, 56);
        txt(ctx, `${bit}`, X + 22, e.h * 0.34 + 37, 22, bit ? C.acid : C.ivory, 'center', bit ? 1 : 0.35);
        txt(ctx, `${Math.pow(2, i)}`, X + 22, e.h * 0.34 + 74, 9.5, C.ivory, 'center', 0.45);
      }
      txt(ctx, `decimal ${v}   hex 0x${v.toString(16).toUpperCase().padStart(2, '0')}   octal 0o${v.toString(8)}`, e.w / 2, e.h * 0.72, 13, C.sky, 'center', 0.95);
    } else {
      const names = ['Application', 'Presentation', 'Session', 'Transport', 'Network', 'Data link', 'Physical'];
      const n = Math.round(p.layers);
      const list = names.slice(7 - n);
      list.forEach((nm, i) => {
        const y = 40 + i * ((e.h - 90) / list.length);
        const t = clamp((e.t * 0.4) % 1 * list.length - i, 0, 1);
        ctx.fillStyle = rgba(C.sky, 0.06 + t * 0.2);
        ctx.strokeStyle = rgba(C.sky, 0.25 + t * 0.6); ctx.lineWidth = 1.2;
        const pad = i * 12;
        ctx.fillRect(e.w * 0.2 + pad, y, e.w * 0.6 - pad * 2, 30);
        ctx.strokeRect(e.w * 0.2 + pad, y, e.w * 0.6 - pad * 2, 30);
        txt(ctx, nm, e.w * 0.2 + pad + 10, y + 20, 10.5, C.ivory, 'left', 0.8);
        txt(ctx, ['data', 'data', 'data', 'segment', 'packet', 'frame', 'bits'][7 - n + i], e.w * 0.8 - pad - 10, y + 20, 9.5, C.acid, 'right', 0.8);
      });
    }
  },
  readouts: (m, p) => [
    { label: 'Program counter', value: `${m.pc}`, tone: C.sky },
    { label: 'Accumulator', value: `${m.acc}`, tone: C.acid },
    { label: 'Cycles', value: `${m.cycles}` },
    { label: 'Comparisons', value: `${m.cmp}` },
    { label: 'Swaps', value: `${m.swp}` },
    { label: 'Binary', value: Math.round(p.value).toString(2).padStart(8, '0') },
  ],
  series: (m) => [{ label: 'Accumulator', color: C.acid, v: Math.abs(m.acc), max: 40 }, { label: 'Comparisons', color: C.sky, v: m.cmp, max: Math.max(100, m.cmp) }],
  explain: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 0) return `Instruction ${m.pc}: ${PROGRAM[m.pc]?.[0]} ${PROGRAM[m.pc]?.[1]}. The accumulator holds ${m.acc}. This program adds 5 + 3, then repeatedly subtracts 3 until zero — a loop built from JNZ.`;
    if (mode === 1) return `${ALGOS[Math.round(p.algo)]} sort has made ${m.cmp} comparisons and ${m.swp} swaps on ${Math.round(p.size)} items${m.done ? ' and finished' : ''}. Comparison count is the honest measure of an algorithm’s cost.`;
    if (mode === 2) return `Each position is a power of two. ${Math.round(p.value)} = ${Math.round(p.value).toString(2).split('').map((b, i, a) => b === '1' ? Math.pow(2, a.length - 1 - i) : null).filter(Boolean).join(' + ') || '0'}.`;
    return `The same payload gains a header at each layer going down and loses one coming up. Routers only read the network layer; switches only read the data-link layer.`;
  },
};
function cpuStep(m: any) {
  const ins = PROGRAM[m.pc]; if (!ins) { m.pc = 0; return; }
  const [op, arg] = ins as [string, number, number];
  m.cycles++;
  if (op === 'LDI') m.acc = arg;
  else if (op === 'LDA') m.acc = m.mem[arg];
  else if (op === 'STA') m.mem[arg] = m.acc;
  else if (op === 'ADD') m.acc += m.mem[arg];
  else if (op === 'SUB') m.acc -= m.mem[arg];
  else if (op === 'JNZ') { if (m.acc !== 0) { m.pc = arg; return; } }
  else if (op === 'HLT') { m.pc = 0; return; }
  m.pc = (m.pc + 1) % PROGRAM.length;
}
function sortStep(m: any, p: any) {
  const n = Math.round(p.size), a = m.arr, algo = Math.round(p.algo);
  if (algo === 0) {
    m.cmp++;
    if (a[m.j] > a[m.j + 1]) { const t = a[m.j]; a[m.j] = a[m.j + 1]; a[m.j + 1] = t; m.swp++; }
    m.j++;
    if (m.j >= n - 1 - m.i) { m.j = 0; m.i++; }
    if (m.i >= n - 1) m.done = true;
  } else if (algo === 1) {
    let min = m.i;
    for (let k = m.i; k < n; k++) { m.cmp++; if (a[k] < a[min]) min = k; }
    const t = a[m.i]; a[m.i] = a[min]; a[min] = t; m.swp++;
    m.i++; m.j = m.i;
    if (m.i >= n - 1) m.done = true;
  } else if (algo === 2) {
    const key = a[m.i + 1]; let k = m.i;
    while (k >= 0 && a[k] > key) { m.cmp++; a[k + 1] = a[k]; k--; m.swp++; }
    a[k + 1] = key; m.i++; m.j = m.i;
    if (m.i >= n - 1) m.done = true;
  } else {
    if (m.j < m.pivot) {
      m.cmp++;
      if (a[m.j] < a[m.pivot]) { const t = a[m.i]; a[m.i] = a[m.j]; a[m.j] = t; m.swp++; m.i++; }
      m.j++;
    } else {
      const t = a[m.i]; a[m.i] = a[m.pivot]; a[m.pivot] = t; m.swp++;
      m.pivot--; m.i = 0; m.j = 0;
      if (m.pivot <= 0) m.done = true;
    }
  }
}

/* ================================================================== */
/*  16 · AI & ROBOTICS                                                 */
/* ================================================================== */
const AIMODES = ['Train network', 'Decision boundary', 'Robot arm', 'Reinforcement learning'];
export const ai: Spec = {
  id: 'ai', name: 'AI & Robotics', tag: 'Learning you can watch', accent: C.orchid, glyph: 'atom', orbit: false,
  blurb: 'A real multilayer perceptron learns XOR by backpropagation while you watch the loss fall. Then drive a two-link arm with inverse kinematics, or train a Q-learning agent through a maze.',
  method: 'Genuine gradient descent: tanh hidden layer, sigmoid output, mean-squared-error loss, analytic backprop. Q-learning uses the standard update Q(s,a) ← Q + α[r + γ·max Q(s′) − Q] with ε-greedy exploration.',
  facts: ['XOR is not linearly separable — it needs at least one hidden layer.', 'Learning rate too high diverges; too low crawls.', 'ε-greedy balances exploring new actions against exploiting known rewards.', 'Inverse kinematics solves joint angles from a desired hand position.'],
  ctrls: [
    { k: 'lr', label: 'Learning rate', min: 0.01, max: 2, step: 0.01, def: 0.5 },
    { k: 'hidden', label: 'Hidden neurons', min: 2, max: 8, step: 1, def: 4 },
    { k: 'epochs', label: 'Steps / frame', min: 1, max: 60, step: 1, def: 12 },
    { k: 'noise', label: 'Input noise', min: 0, max: 0.4, step: 0.01, def: 0 },
    { k: 'eps', label: 'Exploration ε', min: 0, max: 1, step: 0.02, def: 0.2 },
    { k: 'alpha', label: 'Q learning rate α', min: 0.05, max: 1, step: 0.05, def: 0.3 },
    { k: 'gamma', label: 'Discount γ', min: 0.5, max: 0.99, step: 0.01, def: 0.92 },
  ],
  toggles: [{ k: 'train', label: 'Training on', def: true }, { k: 'weights', label: 'Show weights', def: true }, { k: 'policy', label: 'Show policy', def: true }],
  choices: [{ k: 'mode', label: 'Environment', options: AIMODES, def: 0 }],
  actions: [{ id: 'reinit', label: 'Reinitialise weights', tone: C.orchid }],
  scenarios: [
    { name: 'Learn XOR', note: '4 hidden neurons, lr 0.5', set: { mode: 0, hidden: 4, lr: 0.5, train: 1 } },
    { name: 'Divergence', note: 'Learning rate far too high', set: { mode: 0, lr: 1.9, train: 1 } },
    { name: 'Maze agent', note: 'Q-learning with 20% exploration', set: { mode: 3, eps: 0.2, alpha: 0.3 } },
  ],
  make: () => ({ w: [] as number[][], b: [] as number[], loss: 1, epoch: 0, hist: [] as number[], grid: Array.from({ length: 36 }, (_, i) => ([1, 8, 14, 15, 21, 27, 28].includes(i) ? 1 : 0)), q: Array.from({ length: 36 }, () => [0, 0, 0, 0]), s: 0, steps: 0, wins: 0, reward: 0 }),
  step(m, p, dt) {
    const mode = Math.round(p.mode);
    const H = Math.round(p.hidden);
    if (m.w.length === 0 || m.w[0].length !== H) initNet(m, H);
    if (mode <= 1 && p.train) {
      const X = [[0, 0], [0, 1], [1, 0], [1, 1]], Y = [0, 1, 1, 0];
      let loss = 0;
      for (let it = 0; it < Math.round(p.epochs); it++) {
        for (let s = 0; s < 4; s++) {
          const x = [X[s][0] + (Math.random() - 0.5) * p.noise, X[s][1] + (Math.random() - 0.5) * p.noise];
          const h = m.w[0].map((w: number[], j: number) => Math.tanh(w[0] * x[0] + w[1] * x[1] + m.b[0][j]));
          const z = h.reduce((a: number, hv: number, j: number) => a + hv * m.w[1][j], 0) + m.b[1];
          const o = 1 / (1 + Math.exp(-z));
          const err = o - Y[s];
          loss += err * err;
          const dz = err * o * (1 - o);
          for (let j = 0; j < H; j++) {
            const dh = dz * m.w[1][j] * (1 - h[j] * h[j]);
            m.w[1][j] -= p.lr * dz * h[j];
            m.w[0][j][0] -= p.lr * dh * x[0];
            m.w[0][j][1] -= p.lr * dh * x[1];
            m.b[0][j] -= p.lr * dh;
          }
          m.b[1] -= p.lr * dz;
        }
        m.epoch++;
      }
      m.loss = loss / 4;
      if (m.loss < 0.05) progress.completeMission('m-train');
      m.hist.push(m.loss);
      if (m.hist.length > 160) m.hist.shift();
    }
    if (mode === 3) {
      m.steps += dt * 22;
      while (m.steps >= 1) {
        m.steps -= 1;
        const s = m.s;
        const a = Math.random() < p.eps ? Math.floor(Math.random() * 4) : m.q[s].indexOf(Math.max(...m.q[s]));
        const r = Math.floor(s / 6), c = s % 6;
        const nr = clamp(r + [-1, 0, 1, 0][a], 0, 5), nc = clamp(c + [0, 1, 0, -1][a], 0, 5);
        const ns = nr * 6 + nc;
        const next = m.grid[ns] === 1 ? s : ns;
        const reward = next === 35 ? 1 : m.grid[ns] === 1 ? -0.3 : -0.01;
        m.q[s][a] += p.alpha * (reward + p.gamma * Math.max(...m.q[next]) - m.q[s][a]);
        m.s = next;
        m.reward = m.reward * 0.98 + reward * 0.02;
        if (next === 35) { m.wins++; m.s = 0; }
      }
    }
  },
  onAction(a, m, p) { if (a === 'reinit') { initNet(m, Math.round(p.hidden)); m.hist = []; m.epoch = 0; m.q = Array.from({ length: 36 }, () => [0, 0, 0, 0]); m.wins = 0; m.s = 0; } },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.orchid);
    const mode = Math.round(p.mode);
    if (mode === 1) {
      const N = 30;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = i / N, y = j / N;
        const o = forward(m, x, y);
        ctx.fillStyle = `rgba(${Math.round(lerp(215, 255, o))},${Math.round(lerp(255, 112, o))},${Math.round(lerp(69, 79, o))},0.5)`;
        ctx.fillRect((i / N) * e.w, (j / N) * e.h, e.w / N + 1, e.h / N + 1);
      }
      [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([x, y], i) => {
        dot(ctx, x * e.w * 0.94 + e.w * 0.03, y * e.h * 0.94 + e.h * 0.03, 9, i === 0 || i === 3 ? C.obsidian : C.ivory, 10);
      });
      txt(ctx, 'learned decision surface — lime = 0, coral = 1', 14, e.h - 14, 10.5, C.ivory, 'left', 0.9);
      return;
    }
    if (mode === 2) {
      const ox = e.w / 2, oy = e.h * 0.78, L1 = Math.min(e.w, e.h) * 0.24, L2 = L1 * 0.85;
      const tx = e.mx > 0 ? e.mx : ox + Math.cos(e.t) * L1, ty = e.my > 0 ? e.my : oy - L1;
      const dx = tx - ox, dy = ty - oy, d = clamp(Math.hypot(dx, dy), 1, L1 + L2 - 1);
      const a = Math.atan2(dy, dx);
      const cos2 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
      const q2 = Math.acos(cos2);
      const q1 = a - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
      const jx = ox + Math.cos(q1) * L1, jy = oy + Math.sin(q1) * L1;
      const hx = jx + Math.cos(q1 + q2) * L2, hy = jy + Math.sin(q1 + q2) * L2;
      grid3d(ctx, e, 5, 2, C.ivory, 0.04);
      seg(ctx, ox, oy, jx, jy, C.orchid, 10);
      seg(ctx, jx, jy, hx, hy, C.lav, 8);
      [ [ox, oy], [jx, jy] ].forEach(([X, Y]) => { dot(ctx, X, Y, 9, C.ivory, 0); dot(ctx, X, Y, 4, C.obsidian, 0); });
      dot(ctx, hx, hy, 7, C.acid, 16);
      ctx.strokeStyle = rgba(C.acid, 0.5); ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(ox, oy, L1 + L2, Math.PI, TAU); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, `θ₁ ${(q1 * 180 / Math.PI).toFixed(1)}°  θ₂ ${(q2 * 180 / Math.PI).toFixed(1)}°  reach ${d.toFixed(0)}px`, 14, e.h - 14, 10.5, C.acid, 'left', 0.9);
      txt(ctx, 'move the pointer to command the end effector', 14, 24, 10, C.ivory, 'left', 0.5);
      return;
    }
    if (mode === 3) {
      const S = Math.min(e.w, e.h) * 0.72, x0 = (e.w - S) / 2, y0 = (e.h - S) / 2, cs = S / 6;
      for (let i = 0; i < 36; i++) {
        const r = Math.floor(i / 6), c = i % 6;
        const X = x0 + c * cs, Y = y0 + r * cs;
        if (m.grid[i] === 1) { ctx.fillStyle = rgba(C.ivory, 0.16); ctx.fillRect(X, Y, cs - 2, cs - 2); }
        else {
          const v = Math.max(...m.q[i]);
          ctx.fillStyle = rgba(C.acid, clamp(v, 0, 1) * 0.4);
          ctx.fillRect(X, Y, cs - 2, cs - 2);
          if (p.policy && v > 0.01) {
            const a = m.q[i].indexOf(v);
            const cx2 = X + cs / 2, cy2 = Y + cs / 2;
            arrow(ctx, cx2, cy2, cx2 + [0, 1, 0, -1][a] * cs * 0.28, cy2 + [-1, 0, 1, 0][a] * cs * 0.28, rgba(C.ivory, 0.6), 1.4);
          }
        }
        ctx.strokeStyle = rgba(C.ivory, 0.08); ctx.strokeRect(X, Y, cs - 2, cs - 2);
      }
      ctx.fillStyle = rgba(C.acid, 0.5); ctx.fillRect(x0 + 5 * cs, y0 + 5 * cs, cs - 2, cs - 2);
      txt(ctx, 'GOAL', x0 + 5 * cs + cs / 2, y0 + 5 * cs + cs / 2, 9, C.obsidian, 'center', 1);
      dot(ctx, x0 + (m.s % 6) * cs + cs / 2, y0 + Math.floor(m.s / 6) * cs + cs / 2, cs * 0.22, C.coral, 16);
      txt(ctx, `${m.wins} successful runs · ε ${p.eps.toFixed(2)}`, 14, e.h - 14, 10.5, C.orchid, 'left', 0.9);
      return;
    }
    const H = m.w[0]?.length ?? 4;
    const layers = [2, H, 1];
    const pos: { x: number; y: number }[][] = layers.map((n, li) => Array.from({ length: n }, (_, i) => ({
      x: e.w * (0.2 + li * 0.3), y: e.h * (0.2 + ((i + 1) / (n + 1)) * 0.6),
    })));
    if (p.weights) {
      pos[0].forEach((a, ai2) => pos[1].forEach((b, bi) => {
        const w = m.w[0][bi][ai2];
        seg(ctx, a.x, a.y, b.x, b.y, w > 0 ? rgba(C.coral, clamp(Math.abs(w) * 0.4, 0.05, 0.8)) : rgba(C.lav, clamp(Math.abs(w) * 0.4, 0.05, 0.8)), clamp(Math.abs(w), 0.4, 4));
      }));
      pos[1].forEach((a, i) => {
        const w = m.w[1][i];
        seg(ctx, a.x, a.y, pos[2][0].x, pos[2][0].y, w > 0 ? rgba(C.coral, clamp(Math.abs(w) * 0.4, 0.05, 0.8)) : rgba(C.lav, clamp(Math.abs(w) * 0.4, 0.05, 0.8)), clamp(Math.abs(w), 0.4, 4));
      });
    }
    pos.forEach((layer, li) => layer.forEach((q, i) => {
      const act = li === 0 ? 0.5 : li === 1 ? 0.6 : 1 - m.loss;
      dot(ctx, q.x, q.y, 13, rgba(li === 2 ? C.acid : C.orchid, 0.25 + act * 0.5), 12);
      ctx.strokeStyle = li === 2 ? C.acid : C.orchid; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(q.x, q.y, 13, 0, TAU); ctx.stroke();
      if (li === 0) txt(ctx, ['x₁', 'x₂'][i], q.x - 26, q.y + 4, 11, C.ivory, 'right', 0.7);
    }));
    txt(ctx, `epoch ${m.epoch} · loss ${m.loss.toFixed(5)}`, 14, 26, 12, m.loss < 0.05 ? C.acid : C.orchid, 'left', 0.95);
    const X = [[0, 0], [0, 1], [1, 0], [1, 1]];
    X.forEach((x, i) => {
      const o = forward(m, x[0], x[1]);
      txt(ctx, `${x[0]} XOR ${x[1]} → ${o.toFixed(3)}`, 14, e.h - 70 + i * 16, 10.5, Math.abs(o - [0, 1, 1, 0][i]) < 0.2 ? C.acid : C.coral, 'left', 0.9);
    });
  },
  readouts: (m, p) => [
    { label: 'Loss (MSE)', value: m.loss.toFixed(5), tone: m.loss < 0.05 ? C.acid : C.orchid },
    { label: 'Epochs', value: `${m.epoch}` },
    { label: 'Hidden units', value: `${Math.round(p.hidden)}` },
    { label: 'Solved', value: m.loss < 0.05 ? 'YES' : 'learning…', tone: m.loss < 0.05 ? C.acid : C.ivory },
    { label: 'Maze wins', value: `${m.wins}` },
    { label: 'Mean reward', value: m.reward.toFixed(3) },
  ],
  series: (m) => [{ label: 'Loss', color: C.orchid, v: m.loss, max: 0.3 }, { label: 'Maze wins', color: C.acid, v: m.wins, max: Math.max(10, m.wins) }],
  explain: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode <= 1) return m.loss < 0.05 ? `Converged after ${m.epoch} epochs. The hidden layer has learned an internal representation that makes XOR linearly separable — that is exactly what hidden layers are for.` : `Loss ${m.loss.toFixed(4)}. Gradients flow backward from the output error, nudging every weight downhill. ${p.lr > 1.2 ? 'The learning rate is so high the updates overshoot — watch the loss bounce.' : 'Lower loss means the four XOR cases are being classified correctly.'}`;
    if (mode === 2) return `Two-link inverse kinematics: given a target, the law of cosines yields the elbow angle, then the shoulder follows. Beyond the dashed reach circle no solution exists.`;
    return `Q-learning has completed ${m.wins} runs. Each cell stores the value of four actions; the agent follows the arrows when exploiting and tries random moves ε of the time.`;
  },
};
function initNet(m: any, H: number) {
  m.w = [Array.from({ length: H }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1]), Array.from({ length: H }, () => Math.random() * 2 - 1)];
  m.b = [Array.from({ length: H }, () => Math.random() * 0.4 - 0.2), 0];
  m.loss = 1;
}
function forward(m: any, x: number, y: number) {
  if (!m.w[0]) return 0.5;
  const h = m.w[0].map((w: number[], j: number) => Math.tanh(w[0] * x + w[1] * y + m.b[0][j]));
  const z = h.reduce((a: number, hv: number, j: number) => a + hv * m.w[1][j], 0) + m.b[1];
  return 1 / (1 + Math.exp(-z));
}

/* ================================================================== */
/*  17 · ARCHITECTURE                                                  */
/* ================================================================== */
export const architecture: Spec = {
  id: 'architecture', name: 'Architecture & Structure', tag: 'Build, load, disassemble', accent: C.gold, glyph: 'column', orbit: true,
  blurb: 'Raise a tower floor by floor, choose its material, then load it and watch the sway. Exploded view separates the structure so you can read the load path.',
  method: 'Sway is a damped harmonic response to wind pressure q = ½ρv². Member stress is estimated from tributary load and material capacity (steel 250 MPa, concrete 30 MPa, timber 40 MPa). This is a teaching model, not a structural code check.',
  facts: ['Wind pressure grows with the square of speed — double the wind, quadruple the load.', 'Tall buildings are usually stiffness-governed, not strength-governed.', 'A tuned mass damper can cut sway by 40%.', 'Concrete is strong in compression, weak in tension — hence rebar.'],
  ctrls: [
    { k: 'floors', label: 'Floors', min: 3, max: 40, step: 1, def: 14 },
    { k: 'wind', label: 'Wind speed', min: 0, max: 60, step: 1, def: 12, unit: ' m/s' },
    { k: 'load', label: 'Live load', min: 0, max: 5, step: 0.1, def: 2, unit: ' kPa' },
    { k: 'width', label: 'Floor width', min: 0.4, max: 1.6, step: 0.05, def: 1 },
    { k: 'damp', label: 'Damping', min: 0.01, max: 1, step: 0.01, def: 0.25 },
    { k: 'explode', label: 'Explode floors', min: 0, max: 1, step: 0.02, def: 0 },
  ],
  toggles: [{ k: 'frame', label: 'Structural frame', def: true }, { k: 'glass', label: 'Facade', def: true }, { k: 'stress', label: 'Stress colours', def: true }, { k: 'found', label: 'Foundation', def: true }],
  choices: [{ k: 'mat', label: 'Material', options: ['Steel', 'Concrete', 'Timber'], def: 0 }],
  scenarios: [
    { name: 'Storm test', note: '50 m/s wind on a 30-storey tower', set: { floors: 30, wind: 50, damp: 0.15 } },
    { name: 'Timber tower', note: 'Mass timber, low capacity', set: { mat: 2, floors: 12, load: 3 } },
    { name: 'Exploded assembly', note: 'Read the load path floor by floor', set: { explode: 0.7, floors: 10 } },
  ],
  make: () => ({ sway: 0, vel: 0 }),
  step(m, p, dt) {
    const q = 0.5 * 1.225 * p.wind * p.wind / 1000;
    const stiff = [1.4, 1.0, 0.6][Math.round(p.mat)] * (p.width * 1.2);
    const force = q * p.floors * 0.02;
    m.vel += (force - m.sway * stiff * 8 - m.vel * p.damp * 6) * dt;
    m.sway += m.vel * dt;
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.gold, '#14140f');
    grid3d(ctx, e, 6, 2.6, C.ivory, 0.05);
    const F = Math.round(p.floors), cap = [250, 30, 40][Math.round(p.mat)];
    const matCol = [C.sky, C.ivory, C.gold][Math.round(p.mat)];
    const totalH = 3.2, fh = totalH / F;
    for (let i = 0; i < F; i++) {
      const t = i / F;
      const bend = m.sway * t * t * 1.4;
      const y = -1 + i * fh + p.explode * i * 0.06;
      const w = 0.6 * p.width * (1 - t * 0.25);
      const stress = clamp((p.load * (F - i) * 0.6 + p.wind * 0.4) / cap * 6, 0, 1);
      const col = p.stress ? `rgb(${Math.round(lerp(126, 255, stress))},${Math.round(lerp(217, 112, stress))},${Math.round(lerp(167, 79, stress))})` : matCol;
      const c1 = proj(e.cam, e.w, e.h, -w + bend, y, -w), c2 = proj(e.cam, e.w, e.h, w + bend, y, -w);
      const c3 = proj(e.cam, e.w, e.h, w + bend, y, w), c4 = proj(e.cam, e.w, e.h, -w + bend, y, w);
      if (p.glass) poly(ctx, [c1, c2, c3, c4], rgba(matCol, 0.1), rgba(col, 0.5));
      if (p.frame) {
        const t1 = proj(e.cam, e.w, e.h, -w + bend, y + fh * 0.9, -w), t2 = proj(e.cam, e.w, e.h, w + bend, y + fh * 0.9, -w);
        const t3 = proj(e.cam, e.w, e.h, w + bend, y + fh * 0.9, w), t4 = proj(e.cam, e.w, e.h, -w + bend, y + fh * 0.9, w);
        [[c1, t1], [c2, t2], [c3, t3], [c4, t4]].forEach(([a, b]) => seg(ctx, a.x, a.y, b.x, b.y, rgba(col, 0.9), 2));
        seg(ctx, t1.x, t1.y, t3.x, t3.y, rgba(col, 0.3), 1);
        seg(ctx, t2.x, t2.y, t4.x, t4.y, rgba(col, 0.3), 1);
      }
    }
    if (p.found) {
      const f1 = proj(e.cam, e.w, e.h, -0.9, -1.16, -0.9), f2 = proj(e.cam, e.w, e.h, 0.9, -1.16, -0.9);
      const f3 = proj(e.cam, e.w, e.h, 0.9, -1.16, 0.9), f4 = proj(e.cam, e.w, e.h, -0.9, -1.16, 0.9);
      poly(ctx, [f1, f2, f3, f4], rgba(C.gold, 0.2), rgba(C.gold, 0.5));
    }
    const q = 0.5 * 1.225 * p.wind * p.wind / 1000;
    txt(ctx, `${F} floors · ${['steel', 'concrete', 'timber'][Math.round(p.mat)]} · wind pressure ${q.toFixed(2)} kPa`, 14, e.h - 14, 10.5, C.gold, 'left', 0.9);
  },
  readouts: (m, p) => {
    const q = 0.5 * 1.225 * p.wind * p.wind / 1000;
    const cap = [250, 30, 40][Math.round(p.mat)];
    const util = clamp((p.load * p.floors * 0.6 + p.wind * 0.4) / cap * 6, 0, 1);
    return [
      { label: 'Height', value: `${(p.floors * 3.5).toFixed(0)} m`, tone: C.gold },
      { label: 'Wind pressure', value: `${q.toFixed(2)} kPa` },
      { label: 'Tip deflection', value: `${(Math.abs(m.sway) * 1000).toFixed(0)} mm`, tone: Math.abs(m.sway) > 0.3 ? C.coral : C.ivory },
      { label: 'Base utilisation', value: `${(util * 100).toFixed(0)}%`, tone: util > 0.8 ? C.coral : C.acid },
      { label: 'Drift ratio', value: `1/${Math.max(1, Math.round((p.floors * 3.5) / Math.max(0.001, Math.abs(m.sway))))}` },
      { label: 'Material', value: ['Steel 250 MPa', 'Concrete 30 MPa', 'Timber 40 MPa'][Math.round(p.mat)] },
    ];
  },
  series: (m, p) => [{ label: 'Sway mm', color: C.coral, v: Math.abs(m.sway) * 1000, max: 600 }, { label: 'Wind kPa', color: C.gold, v: 0.5 * 1.225 * p.wind * p.wind / 1000, max: 3 }],
  explain: (m, p) => `A ${Math.round(p.floors)}-storey ${['steel', 'concrete', 'timber'][Math.round(p.mat)]} frame under ${p.wind} m/s wind. Tip deflection is ${(Math.abs(m.sway) * 1000).toFixed(0)} mm. ${Math.abs(m.sway) > 0.3 ? 'Occupants would feel this — real towers add tuned mass dampers or outrigger trusses.' : 'Within typical comfort limits (roughly height/500).'} Colour shows how much of each member’s capacity is being used.`,
};

/* ================================================================== */
/*  18 · AVIATION                                                      */
/* ================================================================== */
export const aviation: Spec = {
  id: 'aviation', name: 'Aviation & Flight', tag: 'Aerodynamics bench', accent: C.sky, glyph: 'rocket', orbit: false,
  blurb: 'Fly a real lift-and-drag model. Increase angle of attack until the wing stalls, deploy flaps to recover lift, and watch the four forces rebalance.',
  method: 'C_L = 2πα below stall with a smooth post-stall drop; drag polar C_D = C_D0 + kC_L². Flight path integrates thrust, drag, lift and weight. Air density falls exponentially with altitude. Simplified 2-D point-mass flight.',
  facts: ['Lift grows with the square of airspeed.', 'Beyond about 15° angle of attack most wings stall — lift collapses.', 'Flaps increase camber, buying lift at lower speed.', 'Induced drag dominates at low speed; parasite drag at high speed.'],
  ctrls: [
    { k: 'thr', label: 'Throttle', min: 0, max: 1, step: 0.02, def: 0.6 },
    { k: 'aoa', label: 'Angle of attack', min: -4, max: 22, step: 0.5, def: 5, unit: '°' },
    { k: 'flap', label: 'Flaps', min: 0, max: 1, step: 0.05, def: 0 },
    { k: 'mass', label: 'Aircraft mass', min: 500, max: 8000, step: 50, def: 1200, unit: ' kg' },
    { k: 'area', label: 'Wing area', min: 8, max: 40, step: 0.5, def: 16, unit: ' m²' },
    { k: 'alt', label: 'Air density alt', min: 0, max: 9000, step: 100, def: 0, unit: ' m' },
    { k: 'gear', label: 'Landing gear', min: 0, max: 1, step: 1, def: 0 },
  ],
  toggles: [{ k: 'stream', label: 'Streamlines', def: true }, { k: 'forces', label: 'Force vectors', def: true }, { k: 'polar', label: 'Drag polar', def: true }],
  actions: [{ id: 'stall', label: 'Force a stall', tone: C.coral }],
  scenarios: [
    { name: 'Cruise', note: 'Balanced, efficient, low drag', set: { aoa: 4, thr: 0.55, flap: 0, gear: 0 } },
    { name: 'Final approach', note: 'Flaps down, gear down, slow', set: { aoa: 10, thr: 0.3, flap: 1, gear: 1 } },
    { name: 'Stall recovery', note: 'Past the critical angle', set: { aoa: 19, thr: 0.8 } },
  ],
  make: () => ({ v: 55, alt: 300, vs: 0, stalled: false }),
  step(m, p, dt) {
    const rho = 1.225 * Math.exp(-p.alt / 8500);
    const a = p.aoa * Math.PI / 180;
    const stallA = 15 * Math.PI / 180;
    let cl = 2 * Math.PI * a + p.flap * 0.6;
    if (p.aoa > 15) cl = Math.max(0.3, (2 * Math.PI * stallA + p.flap * 0.6) * Math.exp(-(p.aoa - 15) * 0.22));
    const cd = 0.025 + 0.045 * cl * cl + p.gear * 0.02 + p.flap * 0.03;
    const L = 0.5 * rho * m.v * m.v * p.area * cl;
    const D = 0.5 * rho * m.v * m.v * p.area * cd;
    const T = p.thr * 4200;
    m.v = clamp(m.v + ((T - D) / p.mass) * dt, 8, 160);
    m.vs = (L - p.mass * 9.81) / p.mass * 2.2;
    m.alt = clamp(m.alt + m.vs * dt, 0, 12000);
    m.stalled = p.aoa > 15;
  },
  onAction(a2) { if (a2 === 'stall') return { aoa: 20 }; return undefined; },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.sky, '#101418');
    const cx = e.w * 0.42, cy = e.h * 0.5, chord = Math.min(e.w * 0.34, 260);
    const a = -p.aoa * Math.PI / 180;
    if (p.stream) for (let i = -6; i <= 6; i++) {
      ctx.strokeStyle = rgba(m.stalled && i < 0 ? C.coral : C.sky, 0.28); ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = -1; x <= 2.2; x += 0.05) {
        const near = Math.exp(-Math.pow(x - 0.3, 2) * 2.2);
        const sep = m.stalled && x > 0.5 && i < 1 ? Math.sin(x * 12 + e.t * 8) * 14 * (x - 0.5) : 0;
        const y = i * 16 - near * (i < 0 ? 22 : -10) * (1 + p.flap * 0.4) + sep;
        const X = cx + x * chord * Math.cos(a) - y * Math.sin(a) * 0.2;
        const Y = cy + y + x * chord * Math.sin(a) * 0.4;
        x === -1 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = rgba(C.ivory, 0.85); ctx.strokeStyle = C.ivory; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(chord * 0.25, -chord * 0.13 * (1 + p.flap * 0.5), chord * 0.7, -chord * 0.07, chord, 0);
    ctx.bezierCurveTo(chord * 0.7, chord * 0.03, chord * 0.25, chord * 0.05, 0, 0);
    ctx.fill(); ctx.stroke();
    if (p.flap > 0.05) { ctx.save(); ctx.translate(chord * 0.82, 0); ctx.rotate(p.flap * 0.5); ctx.fillStyle = C.amber; ctx.fillRect(0, -3, chord * 0.2, 6); ctx.restore(); }
    ctx.restore();
    const rho = 1.225 * Math.exp(-p.alt / 8500);
    const stallA = 15 * Math.PI / 180;
    let cl = 2 * Math.PI * (p.aoa * Math.PI / 180) + p.flap * 0.6;
    if (p.aoa > 15) cl = Math.max(0.3, (2 * Math.PI * stallA + p.flap * 0.6) * Math.exp(-(p.aoa - 15) * 0.22));
    const cd = 0.025 + 0.045 * cl * cl + p.gear * 0.02 + p.flap * 0.03;
    const L = 0.5 * rho * m.v * m.v * p.area * cl, D = 0.5 * rho * m.v * m.v * p.area * cd;
    if (p.forces) {
      arrow(ctx, cx + chord / 2, cy, cx + chord / 2, cy - clamp(L / 400, 10, 130), C.acid, 2.4);
      arrow(ctx, cx + chord / 2, cy, cx + chord / 2, cy + clamp(p.mass * 9.81 / 400, 10, 130), C.coral, 2.4);
      arrow(ctx, cx + chord / 2, cy, cx + chord / 2 - clamp(D / 60, 8, 90), cy, C.lav, 2);
      arrow(ctx, cx + chord / 2, cy, cx + chord / 2 + clamp(p.thr * 90, 4, 90), cy, C.amber, 2);
      txt(ctx, 'lift', cx + chord / 2 + 8, cy - clamp(L / 400, 10, 130), 9, C.acid, 'left', 0.9);
      txt(ctx, 'weight', cx + chord / 2 + 8, cy + clamp(p.mass * 9.81 / 400, 10, 130), 9, C.coral, 'left', 0.9);
    }
    if (p.polar) {
      const px = e.w - 170, py = e.h - 130;
      ctx.strokeStyle = rgba(C.ivory, 0.2); ctx.strokeRect(px, py, 150, 110);
      ctx.strokeStyle = C.sky; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let al = -4; al <= 22; al += 0.5) {
        let c = 2 * Math.PI * al * Math.PI / 180 + p.flap * 0.6;
        if (al > 15) c = Math.max(0.3, (2 * Math.PI * stallA + p.flap * 0.6) * Math.exp(-(al - 15) * 0.22));
        const d = 0.025 + 0.045 * c * c;
        const X = px + clamp(d / 0.4, 0, 1) * 150, Y = py + 110 - clamp(c / 2.2, 0, 1) * 110;
        al === -4 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();
      dot(ctx, px + clamp(cd / 0.4, 0, 1) * 150, py + 110 - clamp(cl / 2.2, 0, 1) * 110, 4, C.acid, 10);
      txt(ctx, 'C_L vs C_D', px, py - 6, 9, C.ivory, 'left', 0.5);
    }
    if (m.stalled) txt(ctx, 'STALL — flow separated', e.w / 2, 40, 16, C.coral, 'center', 0.6 + Math.sin(e.t * 8) * 0.4);
    txt(ctx, `${m.v.toFixed(0)} m/s · ${m.alt.toFixed(0)} m · V/S ${m.vs.toFixed(1)} m/s`, 14, e.h - 14, 11, C.sky, 'left', 0.9);
  },
  readouts: (m, p) => {
    const rho = 1.225 * Math.exp(-p.alt / 8500);
    let cl = 2 * Math.PI * (p.aoa * Math.PI / 180) + p.flap * 0.6;
    if (p.aoa > 15) cl = Math.max(0.3, (2 * Math.PI * 15 * Math.PI / 180 + p.flap * 0.6) * Math.exp(-(p.aoa - 15) * 0.22));
    const cd = 0.025 + 0.045 * cl * cl + p.gear * 0.02 + p.flap * 0.03;
    const L = 0.5 * rho * m.v * m.v * p.area * cl;
    return [
      { label: 'Airspeed', value: `${m.v.toFixed(1)} m/s`, tone: C.sky },
      { label: 'Lift', value: `${fmt(L, 0)} N`, tone: L > p.mass * 9.81 ? C.acid : C.coral },
      { label: 'L/D ratio', value: (cl / cd).toFixed(1) },
      { label: 'C_L', value: cl.toFixed(3) },
      { label: 'Vertical speed', value: `${m.vs.toFixed(1)} m/s` },
      { label: 'State', value: m.stalled ? 'STALLED' : L > p.mass * 9.81 ? 'Climbing' : 'Descending', tone: m.stalled ? C.coral : C.ivory },
    ];
  },
  series: (m) => [{ label: 'Airspeed', color: C.sky, v: m.v, max: 160 }, { label: 'Altitude km', color: C.acid, v: m.alt / 1000, max: 12 }],
  explain: (m, p) => m.stalled
    ? `Past the critical angle the boundary layer separates from the upper surface. Lift collapses while drag soars — recovery means reducing angle of attack, not adding power.`
    : `At ${p.aoa}° the wing makes C_L ${((2 * Math.PI * p.aoa * Math.PI / 180) + p.flap * 0.6).toFixed(2)}. Lift scales with v², so the ${m.v.toFixed(0)} m/s airspeed matters more than anything else. ${p.flap > 0.5 ? 'Flaps add camber, letting the wing fly slower without stalling.' : ''}`,
};

/* ================================================================== */
/*  19 · AUTOMOBILES                                                   */
/* ================================================================== */
const AMODES = ['4-stroke engine', 'EV drivetrain', 'Braking physics', 'Exploded assembly'];
export const autos: Spec = {
  id: 'autos', name: 'Automobiles & Transport', tag: 'Powertrain to pavement', accent: C.coral, glyph: 'rocket', orbit: true,
  blurb: 'Watch intake, compression, power and exhaust in a running cylinder, follow energy through an EV drivetrain, or measure how braking distance grows with the square of speed.',
  method: 'Four-stroke valve and piston timing follows the real 720° cycle. Braking distance d = v²/(2μg) is exact for locked-wheel deceleration. EV path uses battery → inverter → motor → wheels with stated efficiencies.',
  facts: ['A four-stroke cycle takes two full crankshaft revolutions.', 'Doubling speed quadruples braking distance.', 'EV drivetrains convert ~85% of battery energy to motion; petrol engines ~25%.', 'ABS keeps tyres near peak slip instead of locking them.'],
  ctrls: [
    { k: 'rpm', label: 'Engine speed', min: 600, max: 7000, step: 100, def: 2400, unit: ' rpm' },
    { k: 'speed', label: 'Road speed', min: 0, max: 200, step: 5, def: 100, unit: ' km/h' },
    { k: 'mu', label: 'Tyre friction µ', min: 0.1, max: 1.2, step: 0.05, def: 0.8 },
    { k: 'mass', label: 'Vehicle mass', min: 800, max: 3000, step: 50, def: 1500, unit: ' kg' },
    { k: 'gear', label: 'Gear ratio', min: 1, max: 14, step: 0.5, def: 3.5 },
    { k: 'batt', label: 'Battery charge', min: 0, max: 1, step: 0.02, def: 0.8 },
    { k: 'explode', label: 'Explode assembly', min: 0, max: 1, step: 0.02, def: 0 },
  ],
  toggles: [{ k: 'valves', label: 'Valve timing', def: true }, { k: 'flow', label: 'Energy flow', def: true }, { k: 'abs', label: 'ABS', def: true }, { k: 'labels', label: 'Labels', def: true }],
  choices: [{ k: 'mode', label: 'System', options: AMODES, def: 0 }],
  scenarios: [
    { name: 'Wet road stop', note: 'µ 0.35 at 100 km/h', set: { mode: 2, mu: 0.35, speed: 100 } },
    { name: 'Motorway efficiency', note: 'EV drivetrain at 110 km/h', set: { mode: 1, speed: 110, batt: 0.7 } },
    { name: 'Teardown', note: 'Every subsystem separated', set: { mode: 3, explode: 0.8 } },
  ],
  make: () => ({ crank: 0, dist: 0, braking: false }),
  step(m, p, dt) { m.crank += dt * (p.rpm / 60) * TAU * 0.12; if (m.braking) m.dist += dt * p.speed / 3.6; },
  onAction(a, m) { if (a === 'brake') { m.braking = true; m.dist = 0; } },
  actions: [{ id: 'brake', label: 'Emergency stop', tone: C.coral }],
  draw(ctx, m, p, e) {
    bg(ctx, e, C.coral);
    const mode = Math.round(p.mode), cx = e.w / 2, cy = e.h / 2;
    if (mode === 0) {
      const phase = (m.crank % (TAU * 2)) / (TAU * 2);
      const stroke = Math.floor(phase * 4);
      const names = ['INTAKE', 'COMPRESSION', 'POWER', 'EXHAUST'];
      const cols = [C.sky, C.amber, C.coral, C.ivory];
      const R = 44, rod = 120;
      const py = cy - 40 - Math.cos(m.crank) * R;
      ctx.strokeStyle = rgba(C.ivory, 0.4); ctx.lineWidth = 2;
      ctx.strokeRect(cx - 46, cy - 150, 92, 190);
      ctx.fillStyle = rgba(cols[stroke], 0.18);
      ctx.fillRect(cx - 44, cy - 148, 88, py - (cy - 148));
      ctx.fillStyle = C.slab; ctx.strokeStyle = C.ivory;
      ctx.fillRect(cx - 44, py, 88, 26); ctx.strokeRect(cx - 44, py, 88, 26);
      const crankX = cx + Math.sin(m.crank) * R, crankY = cy + 80 + Math.cos(m.crank) * R;
      seg(ctx, cx, py + 26, crankX, crankY, rgba(C.ivory, 0.7), 5);
      ctx.strokeStyle = rgba(C.ivory, 0.35); ctx.beginPath(); ctx.arc(cx, cy + 80, R, 0, TAU); ctx.stroke();
      dot(ctx, crankX, crankY, 6, C.coral, 8);
      dot(ctx, cx, cy + 80, 5, C.ivory, 0);
      void rod;
      if (p.valves) {
        const inOpen = stroke === 0, exOpen = stroke === 3;
        [[-24, inOpen, C.sky], [24, exOpen, C.coral]].forEach(([dx, open, col]) => {
          const vy = cy - 150 - (open ? 12 : 0);
          seg(ctx, cx + (dx as number), vy - 26, cx + (dx as number), vy, col as string, 4);
          dot(ctx, cx + (dx as number), vy, 7, open ? (col as string) : C.slab, open ? 10 : 0);
        });
      }
      if (stroke === 2) for (let i = 0; i < 12; i++) dot(ctx, cx + (Math.random() - 0.5) * 70, cy - 130 + Math.random() * 40, 3, rgba(C.amber, 0.8), 10);
      txt(ctx, names[stroke], cx, cy + 160, 16, cols[stroke], 'center', 0.95);
      txt(ctx, `${p.rpm} rpm · ${(p.rpm / 120).toFixed(1)} power strokes per second`, 14, e.h - 14, 10.5, C.coral, 'left', 0.85);
    } else if (mode === 1) {
      const nodes = [['Battery', 0.14, C.acid], ['Inverter', 0.36, C.amber], ['Motor', 0.58, C.coral], ['Wheels', 0.82, C.sky]] as [string, number, string][];
      const eff = [1, 0.97, 0.94, 0.95];
      nodes.forEach(([nm, x, col], i) => {
        const X = x * e.w, Y = cy;
        ctx.strokeStyle = col as string; ctx.fillStyle = rgba(col as string, 0.12); ctx.lineWidth = 1.6;
        ctx.fillRect(X - 42, Y - 34, 84, 68); ctx.strokeRect(X - 42, Y - 34, 84, 68);
        txt(ctx, nm as string, X, Y - 4, 11, col as string, 'center', 0.95);
        let power = 60 * p.batt;
        for (let k = 0; k <= i; k++) power *= eff[k];
        txt(ctx, `${power.toFixed(1)} kW`, X, Y + 16, 10, C.ivory, 'center', 0.7);
        if (i < 3 && p.flow) for (let k = 0; k < 5; k++) {
          const t = (e.t * 0.6 + k / 5) % 1;
          dot(ctx, X + 42 + t * (e.w * 0.22 - 84), Y, 3, C.acid, 8);
        }
      });
      ctx.fillStyle = rgba(C.ivory, 0.1); ctx.fillRect(e.w * 0.14 - 42, cy + 52, 84, 8);
      ctx.fillStyle = p.batt < 0.2 ? C.coral : C.acid; ctx.fillRect(e.w * 0.14 - 42, cy + 52, 84 * p.batt, 8);
      txt(ctx, `overall efficiency ~86% · consumption ${(p.speed * 0.16).toFixed(1)} kWh/100km`, 14, e.h - 14, 10.5, C.acid, 'left', 0.9);
    } else if (mode === 2) {
      const v = p.speed / 3.6, mu = p.abs ? p.mu : p.mu * 0.75;
      const d = (v * v) / (2 * mu * 9.81);
      const react = v * 1.5;
      const gy = e.h * 0.62, scale = (e.w - 80) / Math.max(60, d + react);
      seg(ctx, 40, gy, e.w - 40, gy, rgba(C.ivory, 0.3), 2);
      ctx.fillStyle = rgba(C.amber, 0.25); ctx.fillRect(40, gy - 20, react * scale, 20);
      ctx.fillStyle = rgba(C.coral, 0.35); ctx.fillRect(40 + react * scale, gy - 20, d * scale, 20);
      txt(ctx, `reaction ${react.toFixed(0)} m`, 44, gy - 26, 9.5, C.amber, 'left', 0.9);
      txt(ctx, `braking ${d.toFixed(0)} m`, 44 + react * scale, gy - 26, 9.5, C.coral, 'left', 0.9);
      const carX = 40 + clamp(m.dist, 0, d + react) * scale;
      ctx.fillStyle = C.ivory; ctx.fillRect(carX - 18, gy - 16, 36, 12);
      dot(ctx, carX - 10, gy - 2, 4, C.slab, 0); dot(ctx, carX + 10, gy - 2, 4, C.slab, 0);
      txt(ctx, `total stopping distance ${(d + react).toFixed(0)} m at ${p.speed} km/h`, 14, e.h - 14, 11, C.coral, 'left', 0.95);
      txt(ctx, `kinetic energy ${(0.5 * p.mass * v * v / 1000).toFixed(0)} kJ must become heat`, 14, 30, 10.5, C.ivory, 'left', 0.6);
    } else {
      const parts = [
        ['Engine / motor', 0, -0.5, C.coral], ['Transmission', 0.5, -0.2, C.amber],
        ['Suspension', -0.7, 0.4, C.sky], ['Brakes', 0.7, 0.4, C.lav],
        ['Battery / tank', -0.4, 0.1, C.acid], ['Chassis', 0, 0.25, C.ivory],
      ] as [string, number, number, string][];
      parts.forEach(([nm, x, y, col]) => {
        const ex = 1 + p.explode * 1.6;
        const q = proj(e.cam, e.w, e.h, x * ex, y * ex, 0);
        ctx.fillStyle = rgba(col as string, 0.16); ctx.strokeStyle = col as string; ctx.lineWidth = 1.6;
        ctx.fillRect(q.x - 46, q.y - 20, 92, 40); ctx.strokeRect(q.x - 46, q.y - 20, 92, 40);
        if (p.labels) txt(ctx, nm as string, q.x, q.y + 4, 10, col as string, 'center', 0.95);
      });
      txt(ctx, 'drag to orbit the assembly · explode slider separates subsystems', 14, e.h - 14, 10, C.ivory, 'left', 0.5);
    }
  },
  readouts: (_m, p) => {
    const v = p.speed / 3.6, mu = p.abs ? p.mu : p.mu * 0.75;
    const d = (v * v) / (2 * mu * 9.81);
    return [
      { label: 'Braking distance', value: `${d.toFixed(1)} m`, tone: C.coral },
      { label: 'Total stop', value: `${(d + v * 1.5).toFixed(1)} m` },
      { label: 'Kinetic energy', value: `${(0.5 * p.mass * v * v / 1000).toFixed(0)} kJ` },
      { label: 'Deceleration', value: `${(mu * 9.81).toFixed(2)} m/s² (${(mu).toFixed(2)} g)` },
      { label: 'Power strokes', value: `${(p.rpm / 120).toFixed(1)} /s` },
      { label: 'Wheel torque', value: `${(p.gear * 40).toFixed(0)} N·m` },
    ];
  },
  series: (m, p) => [{ label: 'Stop distance m', color: C.coral, v: (p.speed / 3.6) ** 2 / (2 * (p.abs ? p.mu : p.mu * 0.75) * 9.81), max: 300 }, { label: 'Travel m', color: C.acid, v: m.dist, max: 300 }],
  explain: (_m, p) => {
    const mode = Math.round(p.mode);
    const v = p.speed / 3.6, mu = p.abs ? p.mu : p.mu * 0.75;
    if (mode === 2) return `At ${p.speed} km/h the car carries ${(0.5 * p.mass * v * v / 1000).toFixed(0)} kJ. Friction can only remove it at µg = ${(mu * 9.81).toFixed(1)} m/s², giving ${((v * v) / (2 * mu * 9.81)).toFixed(0)} m of braking plus ${(v * 1.5).toFixed(0)} m of reaction distance. ${p.abs ? 'ABS keeps the tyres at peak slip.' : 'Without ABS locked wheels slide on lower kinetic friction.'}`;
    if (mode === 0) return `Two crankshaft revolutions complete one cycle. At ${p.rpm} rpm that is ${(p.rpm / 120).toFixed(1)} power strokes every second in this cylinder.`;
    if (mode === 1) return `Energy flows battery → inverter → motor → wheels, losing a few percent at each stage. Roughly 86% reaches the road, against about 25% for a petrol engine.`;
    return `An exploded assembly view: every subsystem separated along its mounting axis so the connections stay readable.`;
  },
};
