import { C, TAU, arrow, bg, clamp, dot, fmt, grid2d, hash, lerp, rgba, seg, txt, type Spec } from '../sim/engine';
import { progress } from '../lib/progress';

/* ================================================================== */
/*  20 · ENERGY & POWER SYSTEMS                                        */
/* ================================================================== */
export const energy: Spec = {
  id: 'energy', name: 'Energy & Power', tag: 'Grid balance simulator', accent: C.amber, glyph: 'spark', orbit: false,
  blurb: 'Run a national grid through a day. Solar follows the sun, wind follows the cube of speed, storage charges on surplus — and the lights go out when supply cannot meet demand.',
  method: 'Wind power P = ½ρAv³Cp with Cp = 0.45. Solar uses a clear-sky sine profile scaled by capacity and cloud. Hydro P = ρgQh. Demand follows a typical daily curve. Dispatch and storage are simplified but energy-conserving.',
  facts: ['Wind power scales with the cube of speed — 20% more wind is 73% more power.', 'Grid frequency collapses if generation and demand differ for long.', 'Pumped hydro is still the largest form of grid storage worldwide.', 'Nuclear provides steady baseload; it does not ramp quickly.'],
  ctrls: [
    { k: 'hour', label: 'Time of day', min: 0, max: 24, step: 0.1, def: 12, unit: ' h' },
    { k: 'solar', label: 'Solar capacity', min: 0, max: 40, step: 1, def: 18, unit: ' GW' },
    { k: 'wind', label: 'Wind speed', min: 0, max: 25, step: 0.5, def: 9, unit: ' m/s' },
    { k: 'nuclear', label: 'Nuclear baseload', min: 0, max: 30, step: 1, def: 8, unit: ' GW' },
    { k: 'hydro', label: 'Hydro flow', min: 0, max: 1000, step: 20, def: 400, unit: ' m³/s' },
    { k: 'store', label: 'Storage capacity', min: 0, max: 100, step: 2, def: 40, unit: ' GWh' },
    { k: 'demand', label: 'Demand multiplier', min: 0.5, max: 2, step: 0.05, def: 1 },
    { k: 'clock', label: 'Hours per second', min: 0, max: 6, step: 0.1, def: 1.2 },
  ],
  toggles: [{ k: 'flow', label: 'Energy flows', def: true }, { k: 'labels', label: 'Labels', def: true }, { k: 'carbon', label: 'Carbon intensity', def: true }],
  scenarios: [
    { name: 'Dunkelflaute', note: 'Dark, still winter evening', set: { hour: 18, wind: 2, solar: 18, nuclear: 4, store: 20 } },
    { name: 'Renewable surplus', note: 'Windy sunny afternoon — storage fills', set: { hour: 13, wind: 16, solar: 36, store: 80 } },
    { name: 'Blackout', note: 'Demand exceeds everything available', set: { demand: 1.9, nuclear: 2, wind: 3, hydro: 100, store: 4 } },
  ],
  make: () => ({ soc: 0.5, t: 12, blackout: 0, served: 1, hist: [] as number[] }),
  step(m, p, dt) {
    m.t = p.clock > 0 ? (m.t + dt * p.clock) % 24 : p.hour;
    const s = supply(m.t, p);
    const dem = demandAt(m.t) * p.demand;
    let net = s.total - dem;
    if (net > 0 && p.store > 0) { const charge = Math.min(net, p.store * 0.25); m.soc = clamp(m.soc + (charge * dt * p.clock) / Math.max(1, p.store), 0, 1); net -= charge; }
    else if (net < 0 && p.store > 0 && m.soc > 0.01) { const draw = Math.min(-net, p.store * 0.25, m.soc * p.store); m.soc = clamp(m.soc - (draw * dt * p.clock) / Math.max(1, p.store), 0, 1); net += draw; }
    m.served = clamp((dem + Math.min(0, net)) / Math.max(0.01, dem), 0, 1);
    m.blackout = m.served < 0.98 ? m.blackout + dt : 0;
  },
  draw(ctx, m, p, e) {
    const night = Math.cos((m.t / 24) * TAU) < -0.1;
    bg(ctx, e, C.amber, night ? '#0d0f14' : '#171713');
    const s = supply(m.t, p), dem = demandAt(m.t) * p.demand;
    // sun / moon arc
    const ang = ((m.t - 6) / 12) * Math.PI;
    const sx = e.w * 0.5 - Math.cos(ang) * e.w * 0.38, sy = e.h * 0.42 - Math.sin(ang) * e.h * 0.3;
    dot(ctx, sx, sy, 18, night ? C.ivory : C.amber, 30);
    // sources
    const sources: [string, number, string][] = [['Solar', s.solar, C.amber], ['Wind', s.wind, C.sky], ['Hydro', s.hydro, C.mint], ['Nuclear', s.nuclear, C.lav]];
    sources.forEach(([nm, v, col], i) => {
      const X = 60 + i * ((e.w - 120) / 4), Y = e.h * 0.62;
      const h = clamp(v / 40, 0, 1) * 90;
      ctx.fillStyle = rgba(col as string, 0.2); ctx.strokeStyle = col as string; ctx.lineWidth = 1.4;
      ctx.fillRect(X - 26, Y - h, 52, h); ctx.strokeRect(X - 26, Y - h, 52, h);
      if (p.labels) { txt(ctx, nm as string, X, Y + 16, 10, col as string, 'center', 0.9); txt(ctx, `${(v as number).toFixed(1)} GW`, X, Y + 30, 9.5, C.ivory, 'center', 0.6); }
      if (p.flow && v > 0.2) for (let k = 0; k < 4; k++) {
        const t = (e.t * 0.7 + k / 4) % 1;
        dot(ctx, lerp(X, e.w * 0.5, t), lerp(Y - h, e.h * 0.82, t), 2.6, col as string, 8);
      }
      if (nm === 'Wind') for (let b = 0; b < 3; b++) { const a = e.t * clamp(p.wind / 6, 0, 4) + b * TAU / 3; seg(ctx, X, Y - h - 14, X + Math.cos(a) * 18, Y - h - 14 + Math.sin(a) * 18, rgba(C.sky, 0.8), 2); }
    });
    // city + demand
    const cy2 = e.h * 0.86;
    for (let i = 0; i < 16; i++) {
      const X = e.w * 0.28 + i * (e.w * 0.44 / 16), h = 16 + hash(i) * 40;
      ctx.fillStyle = rgba(C.ivory, m.served > 0.98 ? 0.18 : 0.05);
      ctx.fillRect(X, cy2 - h, 16, h);
      if (m.served > 0.98) for (let k = 0; k < 3; k++) dot(ctx, X + 4 + (k % 2) * 7, cy2 - h + 6 + k * 9, 1.6, rgba(C.amber, 0.8), 4);
    }
    // storage
    ctx.strokeStyle = rgba(C.acid, 0.6); ctx.lineWidth = 1.4;
    ctx.strokeRect(e.w - 92, e.h * 0.3, 60, 90);
    ctx.fillStyle = rgba(C.acid, 0.35);
    ctx.fillRect(e.w - 90, e.h * 0.3 + 88 * (1 - m.soc), 56, 88 * m.soc);
    txt(ctx, `storage ${(m.soc * 100).toFixed(0)}%`, e.w - 62, e.h * 0.3 - 8, 9.5, C.acid, 'center', 0.9);
    // balance bar
    const bx = 20, bw = e.w - 40;
    ctx.fillStyle = rgba(C.ivory, 0.08); ctx.fillRect(bx, 20, bw, 8);
    ctx.fillStyle = m.served > 0.98 ? C.acid : C.coral;
    ctx.fillRect(bx, 20, bw * clamp(s.total / Math.max(0.1, dem), 0, 1), 8);
    txt(ctx, `supply ${s.total.toFixed(1)} GW  /  demand ${dem.toFixed(1)} GW`, bx, 44, 10.5, m.served > 0.98 ? C.acid : C.coral, 'left', 0.95);
    if (m.served < 0.98) txt(ctx, 'LOAD SHEDDING — supply deficit', e.w / 2, e.h * 0.5, 15, C.coral, 'center', 0.5 + Math.sin(e.t * 7) * 0.4);
    txt(ctx, `${String(Math.floor(m.t)).padStart(2, '0')}:${String(Math.floor((m.t % 1) * 60)).padStart(2, '0')}`, e.w - 20, 44, 12, C.ivory, 'right', 0.8);
    grid2d(ctx, e, 80, C.ivory, 0.02);
  },
  readouts: (m, p) => {
    const s = supply(m.t, p), dem = demandAt(m.t) * p.demand;
    const ci = (s.nuclear * 12 + s.hydro * 24 + s.solar * 45 + s.wind * 11 + Math.max(0, dem - s.total) * 450) / Math.max(0.1, dem);
    return [
      { label: 'Generation', value: `${s.total.toFixed(1)} GW`, tone: C.amber },
      { label: 'Demand', value: `${dem.toFixed(1)} GW` },
      { label: 'Served', value: `${(m.served * 100).toFixed(1)}%`, tone: m.served > 0.98 ? C.acid : C.coral },
      { label: 'Storage', value: `${(m.soc * 100).toFixed(0)}% (${(m.soc * p.store).toFixed(1)} GWh)` },
      { label: 'Carbon intensity', value: `${ci.toFixed(0)} gCO₂/kWh`, tone: ci < 100 ? C.acid : C.coral },
      { label: 'Renewable share', value: `${(((s.solar + s.wind + s.hydro) / Math.max(0.1, s.total)) * 100).toFixed(0)}%` },
    ];
  },
  series: (m, p) => [{ label: 'Supply GW', color: C.amber, v: supply(m.t, p).total, max: 80 }, { label: 'Demand GW', color: C.coral, v: demandAt(m.t) * p.demand, max: 80 }, { label: 'Storage %', color: C.acid, v: m.soc * 100, max: 100 }],
  explain: (m, p) => {
    const s = supply(m.t, p), dem = demandAt(m.t) * p.demand;
    if (m.served < 0.98) return `Deficit of ${(dem - s.total).toFixed(1)} GW. With storage at ${(m.soc * 100).toFixed(0)}% there is not enough dispatchable power — the operator must shed load. This is exactly the situation flexible demand and long-duration storage are built for.`;
    if (s.total > dem * 1.15) return `Surplus of ${(s.total - dem).toFixed(1)} GW is charging storage (${(m.soc * 100).toFixed(0)}% full). Without storage this energy would be curtailed — wasted.`;
    return `Balanced at ${m.t.toFixed(1)} h. Wind contributes ${s.wind.toFixed(1)} GW because power scales with v³ — at ${p.wind} m/s that is ${Math.pow(p.wind / 9, 3).toFixed(1)}× the output at 9 m/s.`;
  },
};
function supply(t: number, p: Record<string, number>) {
  const solar = Math.max(0, Math.sin(((t - 6) / 12) * Math.PI)) * p.solar;
  const wind = clamp(0.5 * 1.225 * 3000 * Math.pow(p.wind, 3) * 0.45 / 1e9, 0, 30);
  const hydro = (1000 * 9.81 * p.hydro * 80) / 1e9;
  return { solar, wind, hydro, nuclear: p.nuclear, total: solar + wind + hydro + p.nuclear };
}
function demandAt(t: number) {
  return 22 + 10 * Math.exp(-Math.pow(t - 8, 2) / 6) + 14 * Math.exp(-Math.pow(t - 19, 2) / 8) - 6 * Math.exp(-Math.pow(t - 3, 2) / 8);
}

/* ================================================================== */
/*  21 · AGRICULTURE & FOOD SCIENCE                                    */
/* ================================================================== */
export const agriculture: Spec = {
  id: 'agriculture', name: 'Agriculture & Food', tag: 'Virtual farm ecosystem', accent: C.mint, glyph: 'leaf', orbit: false,
  blurb: 'Manage six plots through a season. Irrigation, nitrogen and pollinators all move the yield — and the soil profile shows exactly where the water goes.',
  method: 'Yield uses Liebig’s law of the minimum across water, nitrogen, phosphorus and temperature, scaled by pollination for fruiting crops. Soil water is a simple bucket model with drainage and evapotranspiration.',
  facts: ['Topsoil forms at roughly 0.1 mm per year — effectively non-renewable.', 'About 75% of leading global crops benefit from animal pollination.', 'Over-irrigation leaches nitrate into groundwater instead of feeding roots.', 'Crop rotation restores nitrogen naturally through legume root bacteria.'],
  ctrls: [
    { k: 'water', label: 'Irrigation', min: 0, max: 1, step: 0.02, def: 0.5 },
    { k: 'nitro', label: 'Nitrogen', min: 0, max: 1, step: 0.02, def: 0.5 },
    { k: 'phos', label: 'Phosphorus', min: 0, max: 1, step: 0.02, def: 0.5 },
    { k: 'temp', label: 'Temperature', min: 5, max: 42, step: 0.5, def: 24, unit: ' °C' },
    { k: 'bees', label: 'Pollinator density', min: 0, max: 1, step: 0.05, def: 0.6 },
    { k: 'days', label: 'Days per second', min: 0.5, max: 20, step: 0.5, def: 4 },
  ],
  toggles: [{ k: 'soil', label: 'Soil profile', def: true }, { k: 'beesOn', label: 'Show bees', def: true }, { k: 'roots', label: 'Root zone', def: true }],
  choices: [{ k: 'crop', label: 'Crop', options: ['Wheat', 'Maize', 'Soybean', 'Tomato'], def: 0 }],
  actions: [{ id: 'harvest', label: 'Harvest all plots', tone: C.amber }],
  scenarios: [
    { name: 'Balanced season', note: 'Everything near optimum', set: { water: 0.6, nitro: 0.6, phos: 0.6, temp: 24, bees: 0.7 } },
    { name: 'Pollinator collapse', note: 'No bees — fruiting crops fail', set: { crop: 3, bees: 0, water: 0.7, nitro: 0.7 } },
    { name: 'Over-fertilised', note: 'Nutrients leach, yield plateaus', set: { nitro: 1, phos: 1, water: 1 } },
  ],
  make: () => ({ day: 0, plots: Array.from({ length: 6 }, () => ({ g: 0.02, health: 1 })), store: 0, soilW: 0.5, beePos: Array.from({ length: 14 }, (_, i) => ({ x: hash(i), y: hash(i + 3), p: hash(i + 7) * TAU })) }),
  step(m, p, dt) {
    m.day += dt * p.days;
    m.soilW += (p.water * 0.9 - m.soilW * 0.5 - 0.12) * dt * 0.4;
    m.soilW = clamp(m.soilW, 0, 1);
    const tOpt = clamp(1 - Math.pow((p.temp - 24) / 18, 2), 0, 1);
    const poll = Math.round(p.crop) >= 2 ? 0.35 + p.bees * 0.65 : 1;
    const lim = Math.min(m.soilW, p.nitro, p.phos, tOpt) * poll;
    m.plots.forEach((q: { g: number; health: number }, i: number) => {
      q.g = clamp(q.g + dt * p.days * 0.008 * lim * (1 - q.g) * (0.9 + hash(i) * 0.2), 0.01, 1);
      q.health = clamp(0.4 + lim * 0.6, 0, 1);
    });
    m.beePos.forEach((b: { x: number; y: number; p: number }) => { b.p += dt * 2; b.x = clamp(b.x + Math.cos(b.p) * dt * 0.08, 0.05, 0.95); b.y = clamp(b.y + Math.sin(b.p * 1.3) * dt * 0.06, 0.1, 0.6); });
  },
  onAction(a, m) { if (a === 'harvest') { m.store += Math.round(m.plots.reduce((s: number, q: { g: number }) => s + q.g * 100, 0)); m.plots.forEach((q: { g: number }) => { q.g = 0.02; }); m.day = 0; } },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.mint);
    const soilY = e.h * (p.soil ? 0.66 : 0.86);
    if (p.soil) {
      const layers = [['Topsoil · organic matter', '#3d3324', 0.3], ['Subsoil · minerals', '#4a3d2c', 0.35], ['Parent material', '#5a4d3a', 0.35]] as [string, string, number][];
      let y = soilY;
      layers.forEach(([nm, col, frac]) => {
        const h = (e.h - soilY) * frac;
        ctx.fillStyle = col; ctx.fillRect(0, y, e.w, h);
        txt(ctx, nm, 10, y + 14, 9, C.ivory, 'left', 0.4);
        y += h;
      });
      ctx.fillStyle = rgba(C.sky, m.soilW * 0.3); ctx.fillRect(0, soilY, e.w, (e.h - soilY) * 0.45);
      for (let i = 0; i < 30; i++) dot(ctx, hash(i) * e.w, soilY + hash(i + 4) * (e.h - soilY) * m.soilW, 1.8, rgba(C.sky, 0.4), 0);
    }
    m.plots.forEach((q: { g: number; health: number }, i: number) => {
      const X = (i + 0.5) * (e.w / 6), H = q.g * (soilY - 50);
      const col = `rgb(${Math.round(lerp(180, 90, q.health))},${Math.round(lerp(140, 200, q.health))},${Math.round(lerp(70, 100, q.health))})`;
      ctx.strokeStyle = col; ctx.lineWidth = 2 + q.g * 3; ctx.lineCap = 'round';
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath(); ctx.moveTo(X + s * 9, soilY);
        ctx.quadraticCurveTo(X + s * 12, soilY - H * 0.6, X + s * 14 + Math.sin(m.day * 0.1 + i) * 3, soilY - H);
        ctx.stroke();
      }
      if (q.g > 0.6) for (let k = 0; k < 5; k++) dot(ctx, X + Math.sin(k * 2) * 8, soilY - H + k * 4, 3.4, Math.round(p.crop) === 3 ? C.coral : C.gold, 4);
      if (p.roots) { ctx.strokeStyle = rgba(C.gold, 0.35); ctx.lineWidth = 1; for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.moveTo(X, soilY); ctx.lineTo(X + (r - 1) * 18, soilY + 30 * q.g + 10); ctx.stroke(); } }
      txt(ctx, `${(q.g * 100).toFixed(0)}%`, X, soilY + (p.soil ? 60 : 24), 9, C.ivory, 'center', 0.5);
    });
    if (p.beesOn) for (let i = 0; i < Math.round(p.bees * 14); i++) {
      const b = m.beePos[i];
      dot(ctx, b.x * e.w, b.y * e.h, 3, C.amber, 6);
      seg(ctx, b.x * e.w - 4, b.y * e.h - 3, b.x * e.w + 4, b.y * e.h - 3, rgba(C.ivory, 0.5), 1);
    }
    txt(ctx, `${['Wheat', 'Maize', 'Soybean', 'Tomato'][Math.round(p.crop)]} · day ${m.day.toFixed(0)} · stored ${m.store} kg`, 14, 24, 11, C.mint, 'left', 0.9);
  },
  readouts: (m, p) => {
    const tOpt = clamp(1 - Math.pow((p.temp - 24) / 18, 2), 0, 1);
    const vals: [string, number][] = [['water', m.soilW], ['nitrogen', p.nitro], ['phosphorus', p.phos], ['temperature', tOpt]];
    vals.sort((a, b) => a[1] - b[1]);
    const yieldNow = m.plots.reduce((s: number, q: { g: number }) => s + q.g, 0) / 6;
    return [
      { label: 'Season day', value: m.day.toFixed(0), tone: C.mint },
      { label: 'Mean growth', value: `${(yieldNow * 100).toFixed(0)}%` },
      { label: 'Limiting factor', value: vals[0][0], tone: C.coral },
      { label: 'Soil moisture', value: `${(m.soilW * 100).toFixed(0)}%` },
      { label: 'Pollination', value: Math.round(p.crop) >= 2 ? `${(35 + p.bees * 65).toFixed(0)}%` : 'wind-pollinated' },
      { label: 'Stored harvest', value: `${m.store} kg`, tone: C.amber },
    ];
  },
  series: (m, p) => [{ label: 'Growth %', color: C.mint, v: (m.plots.reduce((s: number, q: { g: number }) => s + q.g, 0) / 6) * 100, max: 100 }, { label: 'Soil water %', color: C.sky, v: m.soilW * 100, max: 100 }, { label: 'Nitrogen %', color: C.amber, v: p.nitro * 100, max: 100 }],
  explain: (m, p) => {
    const tOpt = clamp(1 - Math.pow((p.temp - 24) / 18, 2), 0, 1);
    const vals: [string, number][] = [['water', m.soilW], ['nitrogen', p.nitro], ['phosphorus', p.phos], ['temperature', tOpt]];
    vals.sort((a, b) => a[1] - b[1]);
    return `Day ${m.day.toFixed(0)}. ${vals[0][0]} is limiting at ${(vals[0][1] * 100).toFixed(0)}%. ${Math.round(p.crop) >= 2 && p.bees < 0.3 ? 'With few pollinators this fruiting crop cannot set fruit no matter how well it is fed.' : 'Adding more of any other input will not raise yield until the limiting one is corrected.'}`;
  },
};

/* ================================================================== */
/*  22 · PSYCHOLOGY & SENSES                                           */
/* ================================================================== */
const PSY = ['Reaction time', 'Stroop effect', 'Memory span', 'Sleep cycles'];
const WORDS = ['RED', 'LIME', 'CORAL', 'VIOLET'];
const PCOLS = [C.coral, C.acid, '#FF9A6B', C.lav];
export const psychology: Spec = {
  id: 'psychology', name: 'Psychology & Senses', tag: 'Measure your own mind', accent: C.lav, glyph: 'target', orbit: false,
  blurb: 'Real cognitive tests that produce real data about you: simple reaction time, the Stroop interference effect, digit span, and a night of sleep architecture.',
  method: 'Reaction time is measured with performance.now() between the colour change and your click. Stroop compares congruent and incongruent naming latency. Digit span follows the standard forward-span procedure. These are demonstrations, not clinical instruments.',
  facts: ['Median simple visual reaction time is around 250 ms.', 'Stroop interference happens because reading is more automatic than colour naming.', 'Working memory span is famously around 7 ± 2 items — closer to 4 for pure chunks.', 'REM sleep dominates the second half of the night.'],
  ctrls: [
    { k: 'delay', label: 'Max wait', min: 1, max: 6, step: 0.5, def: 3.5, unit: ' s' },
    { k: 'trials', label: 'Target trials', min: 3, max: 20, step: 1, def: 8 },
    { k: 'speed', label: 'Digit speed', min: 0.4, max: 2, step: 0.1, def: 1 },
    { k: 'contrast', label: 'Stimulus contrast', min: 0.2, max: 1, step: 0.05, def: 1 },
    { k: 'hours', label: 'Sleep hours', min: 4, max: 10, step: 0.5, def: 8 },
    { k: 'caffeine', label: 'Caffeine (model)', min: 0, max: 1, step: 0.05, def: 0 },
  ],
  toggles: [{ k: 'stats', label: 'Show statistics', def: true }, { k: 'hypno', label: 'Hypnogram', def: true }],
  choices: [{ k: 'mode', label: 'Test', options: PSY, def: 0 }],
  actions: [{ id: 'start', label: 'Start trial', tone: C.lav }, { id: 'congruent', label: 'Congruent', tone: C.acid }, { id: 'incongruent', label: 'Incongruent', tone: C.coral }],
  scenarios: [
    { name: 'Reaction baseline', note: 'Eight trials, full contrast', set: { mode: 0, trials: 8, contrast: 1, caffeine: 0 } },
    { name: 'Stroop interference', note: 'Compare congruent vs incongruent', set: { mode: 1 } },
    { name: 'Short night', note: 'Five hours — REM is truncated', set: { mode: 3, hours: 5 } },
  ],
  make: () => ({ state: 'idle', wait: 0, t0: 0, rts: [] as number[], word: 0, ink: 1, stroopC: [] as number[], stroopI: [] as number[], stroopT: 0, digits: [] as number[], shown: 0, span: 0, phase: 0 }),
  step(m, p, dt) {
    const mode = Math.round(p.mode);
    if (mode === 0 && m.state === 'waiting') {
      m.wait -= dt;
      if (m.wait <= 0) { m.state = 'ready'; m.t0 = performance.now(); }
    }
    if (mode === 1 && m.stroopT > 0) m.stroopT += dt;
    if (mode === 2 && m.shown < m.digits.length) { m.phase += dt * p.speed; if (m.phase > 1) { m.phase = 0; m.shown++; } }
    if (mode === 3) m.phase += dt * 0.25;
  },
  onAction(a, m, p) {
    const mode = Math.round(p.mode);
    if (a === 'start') {
      if (mode === 0) { m.state = 'waiting'; m.wait = 0.8 + Math.random() * p.delay; }
      if (mode === 2) { m.span = Math.max(3, m.span || 3); m.digits = Array.from({ length: m.span }, () => Math.floor(Math.random() * 10)); m.shown = 0; m.phase = 0; }
    }
    if (mode === 1 && (a === 'congruent' || a === 'incongruent')) {
      m.word = Math.floor(Math.random() * 4);
      m.ink = a === 'congruent' ? m.word : (m.word + 1 + Math.floor(Math.random() * 3)) % 4;
      m.stroopT = 0.001;
      (m as any)._cong = a === 'congruent';
    }
  },
  hit(m, p, _e, x, y) {
    const mode = Math.round(p.mode);
    if (mode === 0) {
      if (m.state === 'ready') {
        const rt = performance.now() - m.t0;
        m.rts.push(rt); m.state = 'done';
        progress.completeMission('m-reaction'); progress.experiment();
        return 'result';
      }
      if (m.state === 'waiting') { m.state = 'idle'; return 'too-early'; }
    }
    if (mode === 1 && m.stroopT > 0) {
      const lat = m.stroopT * 1000;
      if ((m as any)._cong) m.stroopC.push(lat); else m.stroopI.push(lat);
      m.stroopT = 0;
      progress.experiment();
      return 'stroop';
    }
    if (mode === 2 && m.shown >= m.digits.length && y > 0) {
      const grid = Math.floor((x / Math.max(1, _e.w)) * 10);
      if (!(m as any)._entry) (m as any)._entry = [];
      (m as any)._entry.push(clamp(grid, 0, 9));
      if ((m as any)._entry.length >= m.digits.length) {
        const ok = (m as any)._entry.every((d: number, i: number) => d === m.digits[i]);
        if (ok) { m.span++; progress.experiment(); }
        (m as any)._entry = [];
        m.digits = []; m.shown = 0;
        return ok ? 'correct' : 'incorrect';
      }
      return 'entry';
    }
    return null;
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.lav);
    const mode = Math.round(p.mode);
    if (mode === 0) {
      const ready = m.state === 'ready';
      ctx.fillStyle = ready ? rgba(C.acid, p.contrast) : m.state === 'waiting' ? rgba(C.coral, 0.25 * p.contrast) : rgba(C.ivory, 0.05);
      ctx.fillRect(e.w * 0.15, e.h * 0.16, e.w * 0.7, e.h * 0.5);
      txt(ctx, ready ? 'CLICK NOW' : m.state === 'waiting' ? 'wait for green…' : m.state === 'done' ? `${m.rts[m.rts.length - 1].toFixed(0)} ms` : 'press START TRIAL', e.w / 2, e.h * 0.44, 22, ready ? C.obsidian : C.ivory, 'center', 1);
      if (p.stats && m.rts.length) {
        const mean = m.rts.reduce((a: number, b: number) => a + b, 0) / m.rts.length;
        const sd = Math.sqrt(m.rts.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / m.rts.length);
        m.rts.forEach((r: number, i: number) => {
          const X = e.w * 0.15 + (i / Math.max(1, Math.round(p.trials) - 1)) * e.w * 0.7;
          dot(ctx, X, e.h * 0.88 - clamp(r / 600, 0, 1) * e.h * 0.16, 4, C.lav, 8);
        });
        txt(ctx, `n=${m.rts.length} · mean ${mean.toFixed(0)} ms · sd ${sd.toFixed(0)} ms · best ${Math.min(...m.rts).toFixed(0)} ms`, e.w / 2, e.h - 16, 11, C.lav, 'center', 0.95);
      }
    } else if (mode === 1) {
      txt(ctx, WORDS[m.word], e.w / 2, e.h * 0.42, 64, PCOLS[m.ink], 'center', p.contrast);
      txt(ctx, 'Name the INK COLOUR, not the word — click the stage to respond', e.w / 2, e.h * 0.6, 11, C.ivory, 'center', 0.6);
      const mc = m.stroopC.length ? m.stroopC.reduce((a: number, b: number) => a + b, 0) / m.stroopC.length : 0;
      const mi = m.stroopI.length ? m.stroopI.reduce((a: number, b: number) => a + b, 0) / m.stroopI.length : 0;
      txt(ctx, `congruent ${mc ? mc.toFixed(0) + ' ms' : '—'}  ·  incongruent ${mi ? mi.toFixed(0) + ' ms' : '—'}  ·  interference ${mc && mi ? (mi - mc).toFixed(0) + ' ms' : '—'}`, e.w / 2, e.h - 20, 11, C.lav, 'center', 0.95);
    } else if (mode === 2) {
      if (m.shown < m.digits.length) txt(ctx, `${m.digits[m.shown]}`, e.w / 2, e.h * 0.48, 90, C.acid, 'center', 1);
      else if (m.digits.length) txt(ctx, 'Now click the digit positions 0–9 below', e.w / 2, e.h * 0.4, 14, C.ivory, 'center', 0.8);
      else txt(ctx, `Current span: ${Math.max(3, m.span)} digits — press START TRIAL`, e.w / 2, e.h * 0.4, 14, C.ivory, 'center', 0.8);
      for (let i = 0; i < 10; i++) {
        const X = (i + 0.5) * (e.w / 10);
        ctx.strokeStyle = rgba(C.ivory, 0.2); ctx.strokeRect(X - e.w / 24, e.h * 0.68, e.w / 12, 48);
        txt(ctx, `${i}`, X, e.h * 0.68 + 32, 20, C.lav, 'center', 0.85);
      }
      const entry = (m as any)._entry ?? [];
      txt(ctx, `entered: ${entry.join(' ') || '—'}`, e.w / 2, e.h - 20, 11, C.acid, 'center', 0.9);
    } else {
      const H = p.hours, cycles = H / 1.5;
      const bx = 40, bw = e.w - 80, by = e.h * 0.72, bh = e.h * 0.44;
      const stages = ['Awake', 'REM', 'N1', 'N2', 'N3'];
      stages.forEach((s, i) => txt(ctx, s, bx - 8, by - bh + (i / 4) * bh + 4, 9, C.ivory, 'right', 0.5));
      ctx.strokeStyle = C.lav; ctx.lineWidth = 2; ctx.beginPath();
      for (let t = 0; t <= H; t += 0.05) {
        const cyc = t / 1.5;
        const remShare = clamp(cyc / cycles, 0, 1);
        const inRem = (cyc % 1) > (1 - 0.12 - remShare * 0.25);
        const depth = inRem ? 1 : 2 + Math.round(2 * Math.max(0, 1 - remShare * 1.4) * Math.abs(Math.sin(cyc * Math.PI)));
        const st = t < 0.2 ? 0 : clamp(depth, 1, 4);
        const X = bx + (t / H) * bw, Y = by - bh + (st / 4) * bh;
        t === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();
      const remTotal = H * clamp(0.2 + p.caffeine * -0.06, 0.1, 0.28);
      txt(ctx, `${H} h sleep · ~${cycles.toFixed(1)} cycles · REM ≈ ${remTotal.toFixed(1)} h`, bx, 30, 11, C.lav, 'left', 0.95);
      txt(ctx, 'deep N3 dominates early; REM lengthens toward morning', bx, e.h - 16, 10, C.ivory, 'left', 0.55);
    }
  },
  info: (id, m) => {
    const mean = m.rts.length ? m.rts.reduce((a: number, b: number) => a + b, 0) / m.rts.length : 0;
    const map: Record<string, { title: string; body: string }> = {
      result: { title: `Reaction time — ${m.rts.length ? m.rts[m.rts.length - 1].toFixed(0) : '—'} ms`, body: `Measured from the colour change to your click using performance.now(). Simple visual reaction time is typically 200–300 ms: retinal transduction, cortical processing, motor planning and muscle activation all take time. Your mean across ${m.rts.length} trial(s) is ${mean.toFixed(0)} ms.` },
      'too-early': { title: 'Anticipated response', body: 'You clicked before the stimulus appeared. That measures prediction, not reaction, so the trial was discarded. The delay is randomised precisely to make anticipation unreliable.' },
      stroop: { title: 'Stroop trial recorded', body: 'Naming the ink colour while reading the competing word is slower than naming a congruent one. The difference is the interference cost — reading is automatic, colour naming is not.' },
      entry: { title: 'Digit entry', body: 'Click the digit positions in the order they were shown. The sequence length increases by one each time you reproduce it correctly.' },
      correct: { title: 'Span increased', body: 'Correct recall. Forward digit span measures the phonological loop of working memory; most adults manage six to seven digits.' },
      incorrect: { title: 'Recall mismatch', body: 'The sequence did not match. Span is the longest length you can reproduce reliably, so the test holds at the previous level.' },
    };
    const e = map[id];
    return e ? { ...e, facts: ['Demonstration, not a clinical instrument', `${m.rts.length} reaction trials recorded`] } : null;
  },
  readouts: (m, p) => {
    const mean = m.rts.length ? m.rts.reduce((a: number, b: number) => a + b, 0) / m.rts.length : 0;
    const mc = m.stroopC.length ? m.stroopC.reduce((a: number, b: number) => a + b, 0) / m.stroopC.length : 0;
    const mi = m.stroopI.length ? m.stroopI.reduce((a: number, b: number) => a + b, 0) / m.stroopI.length : 0;
    return [
      { label: 'Mean RT', value: mean ? `${mean.toFixed(0)} ms` : '—', tone: C.lav },
      { label: 'Best RT', value: m.rts.length ? `${Math.min(...m.rts).toFixed(0)} ms` : '—' },
      { label: 'Trials', value: `${m.rts.length} / ${Math.round(p.trials)}` },
      { label: 'Stroop cost', value: mc && mi ? `${(mi - mc).toFixed(0)} ms` : '—', tone: C.coral },
      { label: 'Digit span', value: `${Math.max(3, m.span)}` },
      { label: 'Sleep cycles', value: `${(p.hours / 1.5).toFixed(1)}` },
    ];
  },
  series: (m) => [{ label: 'Reaction ms', color: C.lav, v: m.rts.length ? m.rts[m.rts.length - 1] : 0, max: 600 }, { label: 'Span', color: C.acid, v: m.span, max: 12 }],
  explain: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 0) return m.state === 'ready' ? 'GO — the signal is on the screen and the clock is running.' : m.rts.length ? `${m.rts.length} trials recorded. Simple visual reaction time is typically 200–300 ms; anything faster than ~120 ms usually means anticipation rather than response.` : 'Press START TRIAL, wait for the panel to turn lime, then click as fast as you can. The delay is randomised so you cannot anticipate it.';
    if (mode === 1) return `Reading is automatic; colour naming is not. When the word and ink disagree, the two processes compete and your response slows — that difference is the Stroop interference effect.`;
    if (mode === 2) return `Forward digit span measures the phonological loop of working memory. Most adults manage 6–7 digits; the span rises by one each time you reproduce a sequence correctly.`;
    return `Sleep runs in ~90-minute cycles. Deep slow-wave sleep is front-loaded for physical restoration; REM lengthens toward morning and supports memory consolidation. Cutting the night short removes REM disproportionately.`;
  },
};

/* ================================================================== */
/*  24 · FORENSICS                                                     */
/* ================================================================== */
const FMODES = ['Fingerprints', 'DNA profile', 'Footwear & gait', 'Case timeline'];
export const forensics: Spec = {
  id: 'forensics', name: 'Forensics & Evidence', tag: 'Analysis, not guesswork', accent: C.gold, glyph: 'search', orbit: false,
  blurb: 'Compare ridge patterns, read an STR profile and compute a real random-match probability, estimate stature from a footprint, then rebuild a case timeline from evidence.',
  method: 'Random match probability is the product of per-locus genotype frequencies (2pq for heterozygotes, p² for homozygotes) — the standard product rule. Stature ≈ foot length × 6.6 is a population-average regression, not an identification.',
  facts: ['The three basic ridge patterns are loop (~65%), whorl (~30%) and arch (~5%).', 'Modern STR kits examine 20 loci, giving match probabilities below one in a quintillion.', 'A match probability is not a probability of guilt — that is the prosecutor’s fallacy.', 'Locard’s principle: every contact leaves a trace.'],
  ctrls: [
    { k: 'ridge', label: 'Ridge frequency', min: 6, max: 26, step: 1, def: 14 },
    { k: 'noise', label: 'Print quality', min: 0, max: 1, step: 0.05, def: 0.7 },
    { k: 'loci', label: 'STR loci', min: 3, max: 20, step: 1, def: 13 },
    { k: 'freq', label: 'Allele frequency', min: 0.02, max: 0.5, step: 0.01, def: 0.15 },
    { k: 'foot', label: 'Foot length', min: 20, max: 32, step: 0.5, def: 26, unit: ' cm' },
    { k: 'stride', label: 'Stride length', min: 40, max: 180, step: 5, def: 120, unit: ' cm' },
  ],
  toggles: [{ k: 'minutiae', label: 'Minutiae', def: true }, { k: 'match', label: 'Overlay comparison', def: true }, { k: 'labels', label: 'Labels', def: true }],
  choices: [{ k: 'mode', label: 'Evidence type', options: FMODES, def: 0 }, { k: 'pattern', label: 'Pattern', options: ['Loop', 'Whorl', 'Arch'], def: 0 }],
  actions: [{ id: 'resample', label: 'Take new sample', tone: C.gold }],
  scenarios: [
    { name: 'Full profile', note: '20 loci — astronomically rare', set: { mode: 1, loci: 20, freq: 0.15 } },
    { name: 'Partial print', note: 'Poor quality lift, few minutiae', set: { mode: 0, noise: 0.2 } },
    { name: 'Running suspect', note: 'Long stride implies speed', set: { mode: 2, stride: 170, foot: 28 } },
  ],
  make: () => ({ seed: 3, matched: 0, evidence: [
    { t: '21:04', txt: 'Door contact trace recovered', kind: 'trace' },
    { t: '21:12', txt: 'Footwear impression in soil', kind: 'print' },
    { t: '21:26', txt: 'Biological sample on handle', kind: 'dna' },
    { t: '22:40', txt: 'CCTV frame captured', kind: 'digital' },
    { t: '23:15', txt: 'Reference sample obtained', kind: 'dna' },
  ], order: [0, 1, 2, 3, 4] }),
  step() { /* static analysis domain */ },
  onAction(a, m) { if (a === 'resample') m.seed = Math.floor(Math.random() * 999); },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.gold);
    const mode = Math.round(p.mode);
    if (mode === 0) {
      const drawPrint = (cx: number, cy: number, R: number, seed: number, alpha: number) => {
        const pat = Math.round(p.pattern);
        for (let r = 6; r < R; r += Math.max(3, 30 - p.ridge)) {
          ctx.strokeStyle = rgba(C.ivory, alpha * (0.25 + p.noise * 0.5)); ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let a = 0; a <= TAU + 0.1; a += 0.08) {
            let rr = r;
            if (pat === 0) rr = r * (1 + 0.22 * Math.cos(a)) + Math.sin(a * 3 + seed) * 2;
            else if (pat === 1) rr = r + Math.sin(a * 2 + r * 0.15 + seed) * 5;
            else rr = r * (1 - 0.3 * Math.max(0, Math.sin(a)));
            const X = cx + Math.cos(a) * rr, Y = cy + Math.sin(a) * rr * 1.25;
            if (hash(Math.floor(a * 10) + r + seed) > p.noise) { a === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
            else ctx.moveTo(X, Y);
          }
          ctx.stroke();
        }
        if (p.minutiae) for (let i = 0; i < Math.round(12 * p.noise); i++) {
          const a = hash(i + seed) * TAU, rr = 10 + hash(i + seed + 5) * (R - 14);
          dot(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.25, 3, C.coral, 6);
        }
      };
      const R = Math.min(e.w * 0.18, e.h * 0.34);
      drawPrint(e.w * 0.3, e.h * 0.48, R, m.seed, 1);
      if (p.match) drawPrint(e.w * 0.7, e.h * 0.48, R, m.seed + 0, 0.85);
      if (p.labels) { txt(ctx, 'LATENT (scene)', e.w * 0.3, e.h * 0.86, 10, C.gold, 'center', 0.9); txt(ctx, 'REFERENCE', e.w * 0.7, e.h * 0.86, 10, C.gold, 'center', 0.9); }
      txt(ctx, `${['Loop', 'Whorl', 'Arch'][Math.round(p.pattern)]} pattern · ${Math.round(12 * p.noise)} minutiae marked`, e.w / 2, 28, 11, C.ivory, 'center', 0.8);
    } else if (mode === 1) {
      const n = Math.round(p.loci);
      const bx = 40, bw = e.w - 80;
      for (let i = 0; i < n; i++) {
        const X = bx + (i / n) * bw, w = bw / n - 3;
        const a1 = 20 + hash(i + m.seed) * 60, a2 = 20 + hash(i + m.seed + 50) * 60;
        [a1, a2].forEach((v, k) => {
          const h = (v / 80) * (e.h * 0.42);
          ctx.fillStyle = rgba(k ? C.lav : C.acid, 0.65);
          ctx.fillRect(X, e.h * 0.62 - h, w / 2 - 1, h);
          ctx.fillStyle = rgba(C.gold, 0.5);
          ctx.fillRect(X + w / 2, e.h * 0.62 - h * (0.94 + hash(i) * 0.1), w / 2 - 1, h * (0.94 + hash(i) * 0.1));
        });
        if (p.labels && n <= 14) txt(ctx, `D${i + 1}`, X + w / 2, e.h * 0.66, 8, C.ivory, 'center', 0.4);
      }
      seg(ctx, bx, e.h * 0.62, bx + bw, e.h * 0.62, rgba(C.ivory, 0.25), 1);
      const rmp = Math.pow(2 * p.freq * (1 - p.freq), n);
      txt(ctx, `${n} loci · lime = reference, lavender = evidence`, bx, 28, 10.5, C.ivory, 'left', 0.7);
      txt(ctx, `random match probability ≈ 1 in ${fmt(1 / rmp, 0)}`, bx, e.h - 20, 13, C.acid, 'left', 0.95);
    } else if (mode === 2) {
      const L = p.foot * 6, S = p.stride * 1.6;
      for (let i = 0; i < 5; i++) {
        const X = 60 + i * S * 0.5, Y = e.h * 0.5 + (i % 2 ? 34 : -34);
        ctx.fillStyle = rgba(C.gold, 0.4); ctx.strokeStyle = rgba(C.gold, 0.8); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(X, Y, L * 0.5, L * 0.2, i % 2 ? 0.1 : -0.1, 0, TAU); ctx.fill(); ctx.stroke();
      }
      const speed = (p.stride / 100) / 0.75;
      arrow(ctx, 60, e.h * 0.8, 60 + clamp(speed * 60, 20, e.w - 120), e.h * 0.8, C.acid, 2);
      txt(ctx, `stature ≈ ${(p.foot * 6.6).toFixed(0)} cm · gait ${speed < 1.2 ? 'walking' : speed < 2.4 ? 'jogging' : 'running'} (${speed.toFixed(1)} m/s)`, 14, 30, 11, C.gold, 'left', 0.95);
      txt(ctx, 'population regression — supportive evidence, never an identification', 14, e.h - 16, 10, C.ivory, 'left', 0.5);
    } else {
      m.order.forEach((idx: number, i: number) => {
        const ev = m.evidence[idx];
        const Y = 50 + i * ((e.h - 100) / 5);
        seg(ctx, 60, Y, e.w - 60, Y, rgba(C.ivory, 0.1), 1);
        dot(ctx, 60, Y, 6, C.gold, 8);
        txt(ctx, ev.t, 78, Y + 4, 12, C.acid, 'left', 0.95);
        txt(ctx, ev.txt, 140, Y + 4, 11.5, C.ivory, 'left', 0.8);
        txt(ctx, ev.kind.toUpperCase(), e.w - 60, Y + 4, 9, C.lav, 'right', 0.7);
      });
      txt(ctx, 'reconstructed sequence — chain of custody preserved at every step', 14, e.h - 16, 10, C.ivory, 'left', 0.55);
    }
  },
  readouts: (_m, p) => {
    const rmp = Math.pow(2 * p.freq * (1 - p.freq), Math.round(p.loci));
    return [
      { label: 'Loci examined', value: `${Math.round(p.loci)}`, tone: C.gold },
      { label: 'Match probability', value: `1 in ${fmt(1 / rmp, 0)}`, tone: C.acid },
      { label: 'Minutiae', value: `${Math.round(12 * p.noise)}` },
      { label: 'Estimated stature', value: `${(p.foot * 6.6).toFixed(0)} cm` },
      { label: 'Gait speed', value: `${((p.stride / 100) / 0.75).toFixed(1)} m/s` },
      { label: 'Pattern class', value: ['Loop', 'Whorl', 'Arch'][Math.round(p.pattern)] },
    ];
  },
  series: (_m, p) => [{ label: 'log10(1/RMP)', color: C.acid, v: -Math.log10(Math.pow(2 * p.freq * (1 - p.freq), Math.round(p.loci))), max: 25 }, { label: 'Loci', color: C.gold, v: p.loci, max: 20 }],
  explain: (_m, p) => {
    const mode = Math.round(p.mode);
    const rmp = Math.pow(2 * p.freq * (1 - p.freq), Math.round(p.loci));
    if (mode === 1) return `With ${Math.round(p.loci)} independent loci at allele frequency ${p.freq}, the product rule gives a random match probability of about 1 in ${fmt(1 / rmp, 0)}. This is the chance a random unrelated person would match — not the chance the suspect is innocent.`;
    if (mode === 0) return `Examiners compare ridge flow and minutiae — bifurcations and endings. ${p.noise < 0.4 ? 'This lift is too degraded for a confident conclusion; a responsible examiner would report inconclusive.' : 'Pattern class narrows the field; individual minutiae carry the identification.'}`;
    if (mode === 2) return `Foot length correlates with stature (×6.6 on average) and stride length with speed. Both are population regressions with wide error bars — useful for narrowing a search, never for naming a person.`;
    return `A timeline turns isolated traces into a sequence. Every item must have an unbroken chain of custody, or its interpretation collapses in court.`;
  },
};

/* ================================================================== */
/*  25 · FUTURE WORLD                                                  */
/* ================================================================== */
export const future: Spec = {
  id: 'future', name: 'Future World', tag: 'Speculation with physics', accent: C.orchid, glyph: 'rocket', orbit: true,
  blurb: 'Design a city and a rotating space habitat. Every number here comes from a real equation — but the society that uses them is clearly marked as speculative.',
  method: 'Habitat artificial gravity a = ω²r is exact; 1 rpm at 895 m gives 1 g. City energy and transit figures are order-of-magnitude projections from current technology, explicitly labelled speculative rather than predicted.',
  facts: ['A rotating habitat needs ~900 m radius for 1 g at a comfortable 1 rpm.', 'Above ~2 rpm most people experience Coriolis-induced motion sickness.', 'Vertical farms cut water use by up to 95% but need substantial electricity.', 'Every claim on this page beyond the physics is a scenario, not a forecast.'],
  ctrls: [
    { k: 'pop', label: 'Population', min: 0.1, max: 20, step: 0.1, def: 4, unit: ' M' },
    { k: 'renew', label: 'Renewables', min: 0, max: 1, step: 0.02, def: 0.7 },
    { k: 'auto', label: 'Automation', min: 0, max: 1, step: 0.02, def: 0.5 },
    { k: 'transit', label: 'Transit density', min: 0, max: 1, step: 0.02, def: 0.6 },
    { k: 'radius', label: 'Habitat radius', min: 50, max: 1500, step: 10, def: 900, unit: ' m' },
    { k: 'rpm', label: 'Habitat spin', min: 0.2, max: 4, step: 0.1, def: 1, unit: ' rpm' },
    { k: 'green', label: 'Vertical farming', min: 0, max: 1, step: 0.02, def: 0.4 },
  ],
  toggles: [{ k: 'drones', label: 'Air traffic', def: true }, { k: 'labels', label: 'Labels', def: true }, { k: 'spec', label: 'Mark speculation', def: true }],
  choices: [{ k: 'view', label: 'Scene', options: ['City', 'Orbital habitat'], def: 0 }],
  scenarios: [
    { name: 'Earth-like habitat', note: '895 m at 1 rpm = 1 g', set: { view: 1, radius: 895, rpm: 1 } },
    { name: 'Spin sickness', note: 'Small radius, fast rotation', set: { view: 1, radius: 120, rpm: 3.4 } },
    { name: 'Net-zero city', note: 'Full renewables and transit', set: { view: 0, renew: 1, transit: 0.95, green: 0.8 } },
  ],
  make: () => ({ rot: 0, drones: Array.from({ length: 12 }, (_, i) => ({ x: hash(i), y: hash(i + 2), s: 0.3 + hash(i + 5) })) }),
  step(m, p, dt) { m.rot += dt * (p.rpm / 60) * TAU; m.drones.forEach((d: { x: number; s: number }) => { d.x = (d.x + dt * 0.04 * d.s) % 1; }); },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.orchid, '#0f0d14');
    if (Math.round(p.view) === 1) {
      const cx = e.w / 2, cy = e.h / 2, R = Math.min(e.w, e.h) * 0.34;
      for (let i = 0; i < 150; i++) dot(ctx, hash(i) * e.w, hash(i + 9) * e.h, 0.7, rgba(C.ivory, 0.4), 0);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(m.rot);
      ctx.strokeStyle = rgba(C.orchid, 0.8); ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba(C.ivory, 0.25); ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; seg(ctx, 0, 0, Math.cos(a) * R, Math.sin(a) * R, rgba(C.ivory, 0.25), 2); }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        dot(ctx, Math.cos(a) * (R - 9), Math.sin(a) * (R - 9), 3, i % 3 ? rgba(C.mint, 0.8) : rgba(C.amber, 0.9), 4);
      }
      dot(ctx, 0, 0, 12, C.slab, 0);
      ctx.restore();
      const g = (Math.pow(p.rpm * TAU / 60, 2) * p.radius) / 9.81;
      arrow(ctx, cx + R + 20, cy, cx + R + 20 + clamp(g, 0, 2) * 40, cy, C.acid, 2);
      txt(ctx, `${g.toFixed(2)} g at the rim`, cx + R + 24, cy - 10, 11, g > 0.8 && g < 1.2 ? C.acid : C.coral, 'left', 0.95);
      txt(ctx, `${p.radius} m radius · ${p.rpm} rpm ${p.rpm > 2 ? '· above comfort limit' : '· within comfort limit'}`, 14, e.h - 14, 10.5, p.rpm > 2 ? C.coral : C.orchid, 'left', 0.9);
      return;
    }
    const horizon = e.h * 0.72;
    for (let i = 0; i < 26; i++) {
      const X = (i / 26) * e.w + Math.sin(i) * 8;
      const h = 40 + hash(i) * 170 * (0.5 + p.pop / 20);
      const green = hash(i + 3) < p.green;
      ctx.fillStyle = rgba(green ? C.mint : C.orchid, 0.14);
      ctx.strokeStyle = rgba(green ? C.mint : C.orchid, 0.5); ctx.lineWidth = 1;
      ctx.fillRect(X, horizon - h, e.w / 30, h); ctx.strokeRect(X, horizon - h, e.w / 30, h);
      for (let k = 0; k < Math.floor(h / 16); k++) dot(ctx, X + e.w / 60, horizon - h + 8 + k * 16, 1.6, rgba(p.renew > 0.5 ? C.acid : C.amber, 0.7), 3);
      if (green) for (let k = 0; k < 5; k++) seg(ctx, X, horizon - h + k * (h / 5), X + e.w / 30, horizon - h + k * (h / 5), rgba(C.mint, 0.6), 2);
    }
    seg(ctx, 0, horizon, e.w, horizon, rgba(C.ivory, 0.25), 1.5);
    if (p.transit > 0.2) {
      const ty = horizon + 26;
      seg(ctx, 0, ty, e.w, ty, rgba(C.sky, 0.4), 2);
      for (let i = 0; i < Math.round(p.transit * 5); i++) {
        const X = ((e.t * 0.12 + i / 5) % 1) * e.w;
        ctx.fillStyle = rgba(C.sky, 0.8); ctx.fillRect(X, ty - 7, 44, 12);
      }
    }
    if (p.drones) m.drones.forEach((d: { x: number; y: number; s: number }) => dot(ctx, d.x * e.w, 60 + d.y * (horizon - 120), 2.4, C.acid, 8));
    if (p.renew > 0.3) for (let i = 0; i < 5; i++) {
      const X = 40 + i * (e.w / 5), Y = horizon - 200 - hash(i) * 40;
      for (let b = 0; b < 3; b++) { const a = e.t * 1.4 + b * TAU / 3; seg(ctx, X, Y, X + Math.cos(a) * 22, Y + Math.sin(a) * 22, rgba(C.ivory, 0.5), 2); }
    }
    if (p.spec) txt(ctx, 'SPECULATIVE SCENARIO — energy and transit figures are projections, not predictions', 14, 26, 10, C.coral, 'left', 0.85);
    txt(ctx, `${p.pop.toFixed(1)} M people · ${(p.renew * 100).toFixed(0)}% renewable · ${(p.auto * 100).toFixed(0)}% automated`, 14, e.h - 14, 10.5, C.orchid, 'left', 0.9);
  },
  readouts: (_m, p) => {
    const g = (Math.pow(p.rpm * TAU / 60, 2) * p.radius) / 9.81;
    const demand = p.pop * 1.1 * (1 - p.transit * 0.25) * (1 + p.auto * 0.15);
    return [
      { label: 'Rim gravity', value: `${g.toFixed(2)} g`, tone: g > 0.8 && g < 1.2 ? C.acid : C.coral },
      { label: 'Comfort', value: p.rpm <= 2 ? 'within limit' : 'Coriolis risk', tone: p.rpm <= 2 ? C.acid : C.coral },
      { label: 'City demand', value: `${demand.toFixed(1)} GW (est.)` },
      { label: 'Fossil share', value: `${((1 - p.renew) * 100).toFixed(0)}%` },
      { label: 'Land saved', value: `${(p.green * 60).toFixed(0)}% (vertical)` },
      { label: 'Evidence level', value: 'physics exact · society speculative', tone: C.orchid },
    ];
  },
  series: (_m, p) => [{ label: 'Rim g', color: C.acid, v: (Math.pow(p.rpm * TAU / 60, 2) * p.radius) / 9.81, max: 3 }, { label: 'Renewables %', color: C.orchid, v: p.renew * 100, max: 100 }],
  explain: (_m, p) => Math.round(p.view) === 1
    ? `Centripetal acceleration a = ω²r. At ${p.radius} m and ${p.rpm} rpm the rim feels ${((Math.pow(p.rpm * TAU / 60, 2) * p.radius) / 9.81).toFixed(2)} g. ${p.rpm > 2 ? 'Above roughly 2 rpm, head movements produce cross-coupled Coriolis sensations and most people feel sick — which is why realistic habitats are enormous.' : 'This is inside the comfort envelope established by centrifuge studies.'}`
    : `A scenario, not a forecast: ${p.pop.toFixed(1)} million people with ${(p.renew * 100).toFixed(0)}% renewable supply and ${(p.transit * 100).toFixed(0)}% transit coverage. The physics of the energy balance is real; whether a society chooses this configuration is an open question.`,
};

export const SPECS_D = [energy, agriculture, psychology, forensics, future];
