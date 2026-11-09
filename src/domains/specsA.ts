import { C, TAU, arrow, bg, clamp, dot, fmt, grid2d, grid3d, hash, lerp, poly, proj, rgba, seg, shade, txt, type Spec } from '../sim/engine';

/* ================================================================== */
/*  1 · SPACE & COSMOLOGY                                              */
/* ================================================================== */
const PLANETS = [
  { n: 'Mercury', a: 0.39, c: '#C9B8A0', r: 2.4, f: 'Smallest planet; a solar day lasts 176 Earth days.' },
  { n: 'Venus', a: 0.72, c: '#E8C57A', r: 3.6, f: 'Runaway greenhouse: 464 °C surface, 92 bar of CO₂.' },
  { n: 'Earth', a: 1.0, c: '#7ED9A7', r: 3.8, f: 'Liquid water, plate tectonics and a magnetic dynamo.' },
  { n: 'Mars', a: 1.52, c: '#FF704F', r: 3.0, f: 'Olympus Mons rises 22 km — the tallest volcano known.' },
  { n: 'Jupiter', a: 5.2, c: '#E4C580', r: 7.5, f: '2.5× the mass of all other planets combined.' },
  { n: 'Saturn', a: 9.58, c: '#D7C9A0', r: 6.6, f: 'Mean density 0.69 g/cm³ — it would float on water.' },
  { n: 'Uranus', a: 19.2, c: '#A8D8C9', r: 5.2, f: 'Axial tilt 98°: it orbits on its side.' },
  { n: 'Neptune', a: 30.05, c: '#B59AFF', r: 5.0, f: 'Supersonic winds up to 2,100 km/h.' },
];
const STAGES = ['Nebula', 'Main sequence', 'Red giant', 'Supernova', 'Remnant'];

export const space: Spec = {
  id: 'space', name: 'Space & Cosmology', tag: 'Universe simulator', accent: C.lav, glyph: 'orbit', orbit: true,
  blurb: 'A working orrery driven by Kepler’s third law, wrapped around a stellar evolution model. Change the star’s mass and its entire life story changes with it.',
  method: 'Orbits use T² ∝ a³ with real semi-major axes (distances compressed logarithmically for display). Stellar lifetime scales as M⁻²·⁵ and luminosity as M³·⁵ — standard main-sequence approximations, not a full stellar structure model.',
  facts: ['Kepler’s third law: T² = a³ in years and AU.', 'A 10 M☉ star lives ~32 million years; the Sun ~10 billion.', 'Above ~8 M☉ a star ends in core collapse, leaving a neutron star or black hole.', 'Schwarzschild radius ≈ 2.95 km per solar mass.'],
  ctrls: [
    { k: 'rate', label: 'Time flow', min: 1, max: 600, step: 1, def: 90, unit: ' d/s' },
    { k: 'mass', label: 'Star mass', min: 0.5, max: 30, step: 0.5, def: 1, unit: ' M☉' },
    { k: 'ecc', label: 'Orbital eccentricity', min: 0, max: 0.5, step: 0.01, def: 0.05 },
    { k: 'count', label: 'Planets shown', min: 3, max: 8, step: 1, def: 8 },
    { k: 'lens', label: 'Lensing strength', min: 0, max: 2, step: 0.05, def: 1 },
    { k: 'dust', label: 'Nebula density', min: 0, max: 1, step: 0.05, def: 0.5 },
  ],
  toggles: [{ k: 'orbits', label: 'Orbits', def: true }, { k: 'labels', label: 'Labels', def: true }, { k: 'lensing', label: 'Lensing', def: false }, { k: 'trails', label: 'Trails', def: true }],
  choices: [{ k: 'stage', label: 'Stellar stage', options: STAGES, def: 1 }],
  scenarios: [
    { name: 'Solar system', note: 'Our star, 1 M☉, all eight planets', set: { mass: 1, stage: 1, count: 8, rate: 90, lensing: 0 } },
    { name: 'Massive star death', note: '22 M☉ → supernova → black hole', set: { mass: 22, stage: 3, rate: 40, dust: 0.8 } },
    { name: 'Black hole lens', note: 'Remnant bending background starlight', set: { mass: 26, stage: 4, lensing: 1, lens: 1.7 } },
  ],
  make: () => ({ days: 0, shock: 0, stars: Array.from({ length: 190 }, (_, i) => ({ x: hash(i) * 2 - 1, y: hash(i + 99) * 2 - 1, z: hash(i + 7) * 2 - 1, s: hash(i + 31) })), trails: [] as number[][], pos: [] as { x: number; y: number; n: string }[] }),
  step(m, p, dt) {
    m.days += dt * p.rate;
    if (p.stage === 3) m.shock = Math.min(9, m.shock + dt * 1.6);
    else m.shock = Math.max(0, m.shock - dt * 2);
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.lav, '#0e0e12');
    const stage = Math.round(p.stage);
    const bh = stage === 4 && p.mass >= 20;
    // background stars with gravitational lensing
    for (const s of m.stars) {
      let x = (s.x * 0.5 + 0.5) * e.w, y = (s.y * 0.5 + 0.5) * e.h;
      if (p.lensing && bh) {
        const dx = x - e.w / 2, dy = y - e.h / 2;
        const d = Math.hypot(dx, dy) + 1;
        const bend = (p.lens * 5200) / (d * d + 900);
        x += (dx / d) * bend * 26; y += (dy / d) * bend * 26;
      }
      dot(ctx, x, y, 0.4 + s.s * 1.1, s.s > 0.85 ? C.lav : C.ivory, 0);
    }
    const cx = e.w / 2, cy = e.h / 2;
    // nebula
    if (stage === 0 || p.dust > 0.05) {
      const n = Math.round(70 * p.dust * e.q + 20);
      for (let i = 0; i < n; i++) {
        const a = hash(i) * TAU + e.t * 0.05 * (0.4 + hash(i + 5));
        const r = (0.2 + hash(i + 3) * 0.8) * Math.min(e.w, e.h) * 0.46;
        dot(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.55, 8 + hash(i + 9) * 22, rgba(stage === 0 ? C.lav : C.coral, 0.035 * (stage === 0 ? 2 : 1)), 0);
      }
    }
    // star
    const life = 10 / Math.pow(p.mass, 2.5);
    const R = (stage === 2 ? 30 : stage === 3 ? 34 : stage === 4 ? 6 : 12) * (0.7 + Math.min(1.6, Math.pow(p.mass, 0.35)) * 0.5) * e.cam.zoom;
    const col = stage === 0 ? C.lav : stage === 2 ? C.coral : stage === 4 ? (bh ? '#000000' : C.sky) : p.mass > 8 ? '#CFE0FF' : p.mass > 2 ? C.ivory : C.amber;
    if (bh) {
      const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 5);
      g.addColorStop(0, rgba(C.amber, 0.55)); g.addColorStop(0.4, rgba(C.coral, 0.22)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R * 5, R * 1.7, 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(C.amber, 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, TAU); ctx.stroke();
    } else {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 3.4);
      g.addColorStop(0, rgba(col, 0.95)); g.addColorStop(0.28, rgba(col, 0.4)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 3.4, 0, TAU); ctx.fill();
      dot(ctx, cx, cy, R, col, 26);
    }
    if (m.shock > 0.05) {
      ctx.strokeStyle = rgba(C.acid, clamp(1 - m.shock / 9, 0, 1) * 0.8); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, m.shock * Math.min(e.w, e.h) * 0.09, 0, TAU); ctx.stroke();
    }
    // planets
    m.pos = [];
    const n = Math.round(p.count);
    for (let i = 0; i < n; i++) {
      const pl = PLANETS[i];
      const T = 365.25 * Math.pow(pl.a, 1.5);
      const th = (m.days / T) * TAU + i;
      const rad = 0.32 + Math.log(1 + pl.a) * 0.44;
      const rx = rad * (1 + p.ecc), rz = rad * (1 - p.ecc);
      if (p.orbits) {
        ctx.strokeStyle = rgba(C.ivory, 0.13); ctx.lineWidth = 1; ctx.beginPath();
        for (let k = 0; k <= 60; k++) {
          const a2 = (k / 60) * TAU;
          const q = proj(e.cam, e.w, e.h, Math.cos(a2) * rx, 0, Math.sin(a2) * rz);
          k === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
      }
      const q = proj(e.cam, e.w, e.h, Math.cos(th) * rx, 0, Math.sin(th) * rz);
      const rr = pl.r * q.f * e.cam.zoom * (e.sel === pl.n || e.hover === pl.n ? 1.5 : 1);
      dot(ctx, q.x, q.y, rr, pl.c, e.sel === pl.n ? 18 : 8);
      if (pl.n === 'Saturn') { ctx.strokeStyle = rgba(pl.c, 0.7); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(q.x, q.y, rr * 2.1, rr * 0.7, -0.4, 0, TAU); ctx.stroke(); }
      if (p.labels) txt(ctx, pl.n, q.x + rr + 4, q.y - 3, 9.5, C.ivory, 'left', 0.55);
      m.pos.push({ x: q.x, y: q.y, n: pl.n });
    }
    txt(ctx, `${STAGES[stage]} · ${p.mass} M☉ · main-sequence life ${life >= 1 ? life.toFixed(2) + ' Gyr' : (life * 1000).toFixed(0) + ' Myr'}`, 14, e.h - 14, 10, C.lav, 'left', 0.8);
  },
  readouts: (m, p) => {
    const life = 10 / Math.pow(p.mass, 2.5);
    return [
      { label: 'Simulated time', value: `${fmt(m.days / 365.25, 1)} yr`, tone: C.lav },
      { label: 'Luminosity', value: `${fmt(Math.pow(p.mass, 3.5), 1)} L☉` },
      { label: 'MS lifetime', value: life >= 1 ? `${life.toFixed(2)} Gyr` : `${(life * 1000).toFixed(1)} Myr` },
      { label: 'Final remnant', value: p.mass < 8 ? 'White dwarf' : p.mass < 20 ? 'Neutron star' : 'Black hole', tone: p.mass >= 20 ? C.coral : C.ivory },
      { label: 'Schwarzschild R', value: `${(2.95 * p.mass).toFixed(1)} km` },
      { label: 'Shock front', value: `${m.shock.toFixed(2)} AU` },
    ];
  },
  series: (m, p) => [{ label: 'Luminosity L☉', color: C.amber, v: Math.pow(p.mass, 3.5), max: 3000 }, { label: 'Shock AU', color: C.coral, v: m.shock, max: 9 }],
  explain: (m, p) => {
    const s = Math.round(p.stage);
    if (s === 0) return `A molecular cloud is collapsing. Gravity wins over gas pressure once the core exceeds the Jeans mass; ${p.mass} M☉ of material is contracting toward ignition.`;
    if (s === 1) return `Hydrogen fusion balances gravity. At ${p.mass} M☉ the star burns ${fmt(Math.pow(p.mass, 3.5), 1)}× the Sun’s luminosity, so it exhausts its fuel far faster.`;
    if (s === 2) return `Core hydrogen is spent. The core contracts and heats while the envelope balloons — the surface cools to red even as total output rises.`;
    if (s === 3) return `Core collapse rebounds into a shock front, now ${m.shock.toFixed(2)} AU out, forging elements heavier than iron in the process.`;
    return p.mass >= 20 ? `Nothing halted the collapse: an event horizon of ${(2.95 * p.mass).toFixed(1)} km. Enable lensing to see background starlight bent around it.` : `Degeneracy pressure halted collapse — a neutron star roughly 20 km across holding more than a solar mass.`;
  },
  hit: (m, _p, _e, x, y) => m.pos.find((q: { x: number; y: number; n: string }) => Math.hypot(q.x - x, q.y - y) < 14)?.n ?? null,
  info: (id) => { const pl = PLANETS.find((q) => q.n === id); return pl ? { title: pl.n, body: pl.f, facts: [`Semi-major axis ${pl.a} AU`, `Period ${(Math.pow(pl.a, 1.5)).toFixed(2)} yr`] } : null; },
};

/* ================================================================== */
/*  3 · EARTH & GEOLOGY                                                */
/* ================================================================== */
export const earth: Spec = {
  id: 'earth', name: 'Earth & Geology', tag: 'Deep-time planet engine', accent: C.coral, glyph: 'globe', orbit: false,
  blurb: 'Drive plate tectonics, fire earthquakes and watch mountains rise or erode away over hundreds of millions of years.',
  method: 'Seismic energy uses the Gutenberg–Richter relation log₁₀E = 1.5M + 4.8 (joules). P and S wave speeds are real crustal averages (6.0 and 3.5 km/s). Plate motion, uplift and erosion are simplified linear models.',
  facts: ['Earth’s inner core is solid iron at ~5,200 °C — held solid by pressure.', 'Plates move 2–15 cm per year, about the rate fingernails grow.', 'Each magnitude step releases ~32× more energy.', 'S-waves cannot travel through the liquid outer core — that is how we know it is liquid.'],
  ctrls: [
    { k: 'drift', label: 'Plate speed', min: 0, max: 15, step: 0.5, def: 5, unit: ' cm/yr' },
    { k: 'mantle', label: 'Mantle temp', min: 1000, max: 2200, step: 10, def: 1600, unit: ' °C' },
    { k: 'mag', label: 'Quake magnitude', min: 3, max: 9, step: 0.1, def: 6.5, unit: ' Mw' },
    { k: 'erosion', label: 'Erosion rate', min: 0, max: 1, step: 0.02, def: 0.3 },
    { k: 'ma', label: 'Deep time', min: 0, max: 250, step: 1, def: 0, unit: ' Ma' },
    { k: 'depth', label: 'Section depth', min: 0.2, max: 1, step: 0.02, def: 1 },
  ],
  toggles: [{ k: 'layers', label: 'Layers', def: true }, { k: 'waves', label: 'Seismic', def: true }, { k: 'conv', label: 'Convection', def: true }, { k: 'labels', label: 'Labels', def: true }],
  choices: [{ k: 'bound', label: 'Plate boundary', options: ['Convergent', 'Divergent', 'Transform'], def: 0 }],
  actions: [{ id: 'quake', label: 'Trigger earthquake', tone: C.coral }, { id: 'erupt', label: 'Erupt volcano', tone: C.amber }],
  scenarios: [
    { name: 'Himalayan collision', note: 'Convergent boundary, fast uplift', set: { bound: 0, drift: 5, erosion: 0.25, mag: 7.8 } },
    { name: 'Mid-Atlantic ridge', note: 'Divergent — new ocean crust', set: { bound: 1, drift: 2.5, mantle: 1800 } },
    { name: 'San Andreas', note: 'Transform — strike-slip stress', set: { bound: 2, drift: 5, mag: 7.2 } },
  ],
  make: () => ({ off: 0, quake: 0, wr: 0, sr: 0, erupt: 0, height: 3.2, stress: 0, parts: [] as { x: number; y: number; vx: number; vy: number; l: number }[] }),
  step(m, p, dt) {
    m.off += dt * p.drift * 0.02;
    m.stress = Math.min(1, m.stress + dt * p.drift * 0.01);
    if (p.bound === 0) m.height = clamp(m.height + dt * (p.drift * 0.02 - p.erosion * 0.05), 0.4, 9);
    else m.height = clamp(m.height - dt * p.erosion * 0.05, 0.4, 9);
    if (m.quake > 0) { m.quake -= dt; m.wr += dt * 190; m.sr += dt * 111; if (m.quake <= 0) { m.wr = 0; m.sr = 0; } }
    if (m.erupt > 0) {
      m.erupt -= dt;
      for (let i = 0; i < 2; i++) m.parts.push({ x: 0, y: 0, vx: (Math.random() - 0.5) * 90, vy: -80 - Math.random() * 130, l: 1 });
    }
    m.parts.forEach((q: { x: number; y: number; vx: number; vy: number; l: number }) => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 160 * dt; q.l -= dt * 0.5; });
    m.parts = m.parts.filter((q: { l: number }) => q.l > 0).slice(-160);
  },
  onAction(a, m, p) {
    if (a === 'quake') { m.quake = 4; m.wr = 0; m.sr = 0; m.stress = 0; }
    if (a === 'erupt') m.erupt = 2.4 + p.mantle / 2000;
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.coral);
    const gy = e.h * 0.42, cx = e.w / 2;
    // mantle / core section
    if (p.layers) {
      const layers = [
        { d: 0.06, c: '#4a4034', n: 'Crust 5–70 km' },
        { d: 0.34, c: shade(C.coral, 0.42), n: 'Mantle → 2,890 km' },
        { d: 0.24, c: shade(C.amber, 0.55), n: 'Outer core (liquid)' },
        { d: 0.2, c: shade(C.amber, 0.95), n: 'Inner core (solid)' },
      ];
      let y = gy;
      layers.forEach((L) => {
        const h = e.h * L.d * p.depth * 1.5;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, rgba(L.c, 0.85)); g.addColorStop(1, rgba(L.c, 0.45));
        ctx.fillStyle = g; ctx.fillRect(0, y, e.w, h);
        if (p.labels) txt(ctx, L.n, 12, y + 14, 9.5, C.ivory, 'left', 0.5);
        y += h;
      });
      if (p.conv) {
        for (let i = 0; i < 6; i++) {
          const a = e.t * 0.3 + i;
          const x = cx + Math.cos(a) * e.w * 0.3;
          const yy = gy + 60 + Math.sin(a) * 40;
          dot(ctx, x, yy, 3, rgba(C.amber, 0.5), 8);
        }
      }
    }
    // surface topography
    ctx.beginPath(); ctx.moveTo(0, gy);
    const shift = Math.sin(m.off * 0.2) * 20;
    for (let x = 0; x <= e.w; x += 6) {
      const peak = Math.exp(-Math.pow((x - cx - shift) / (e.w * 0.16), 2)) * m.height * 13;
      const ridge = p.bound === 1 ? -Math.exp(-Math.pow((x - cx) / 40, 2)) * 18 : 0;
      ctx.lineTo(x, gy - peak + ridge + Math.sin(x * 0.05) * 1.6);
    }
    ctx.lineTo(e.w, gy); ctx.closePath();
    ctx.fillStyle = shade('#6b5f4a', 0.9); ctx.fill();
    ctx.strokeStyle = rgba(C.ivory, 0.35); ctx.lineWidth = 1.2; ctx.stroke();
    // plate arrows
    const dir = p.bound === 0 ? 1 : p.bound === 1 ? -1 : 0;
    if (dir !== 0) {
      for (let s = -1; s <= 1; s += 2) {
        const x0 = cx + s * e.w * 0.34, x1 = x0 - s * dir * 44;
        seg(ctx, x0, gy - 42, x1, gy - 42, C.acid, 2, 0.8);
        dot(ctx, x1, gy - 42, 3, C.acid, 6);
      }
    } else {
      seg(ctx, cx - 60, gy - 52, cx + 60, gy - 34, C.acid, 2, 0.7);
      txt(ctx, 'strike-slip', cx + 66, gy - 40, 9, C.acid, 'left', 0.8);
    }
    // volcano
    if (p.bound !== 2) {
      const vx = cx + shift;
      poly(ctx, [{ x: vx - 34, y: gy - m.height * 10 }, { x: vx, y: gy - m.height * 13 - 16 }, { x: vx + 34, y: gy - m.height * 10 }], rgba(C.coral, m.erupt > 0 ? 0.5 : 0.16), rgba(C.coral, 0.5));
      m.parts.forEach((q: { x: number; y: number; l: number }) => dot(ctx, vx + q.x, gy - m.height * 13 - 16 + q.y, 2.4, rgba(C.amber, q.l), 8));
    }
    // seismic waves
    if (p.waves && m.quake > 0) {
      ctx.strokeStyle = rgba(C.acid, clamp(m.quake / 4, 0, 1) * 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, gy, m.wr, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = rgba(C.lav, clamp(m.quake / 4, 0, 1) * 0.7);
      ctx.beginPath(); ctx.arc(cx, gy, m.sr, 0, Math.PI); ctx.stroke();
      txt(ctx, 'P 6.0 km/s', cx + m.wr + 6, gy + 14, 9, C.acid, 'left', 0.8);
      txt(ctx, 'S 3.5 km/s', cx + m.sr + 6, gy + 28, 9, C.lav, 'left', 0.8);
    }
    // stress meter
    ctx.fillStyle = rgba(C.ivory, 0.1); ctx.fillRect(e.w - 130, 16, 116, 5);
    ctx.fillStyle = m.stress > 0.8 ? C.coral : C.acid; ctx.fillRect(e.w - 130, 16, 116 * m.stress, 5);
    txt(ctx, 'accumulated strain', e.w - 130, 34, 9, C.ivory, 'left', 0.45);
    grid2d(ctx, e, 60, C.ivory, 0.025);
  },
  readouts: (m, p) => [
    { label: 'Quake energy', value: `${fmt(Math.pow(10, 1.5 * p.mag + 4.8), 2)} J`, tone: C.coral },
    { label: 'vs Hiroshima', value: `${fmt(Math.pow(10, 1.5 * p.mag + 4.8) / 6.3e13, 2)}×` },
    { label: 'Range height', value: `${(m.height * 1000).toFixed(0)} m`, tone: C.acid },
    { label: 'Plate travel', value: `${(m.off * 50).toFixed(0)} km` },
    { label: 'Strain', value: `${(m.stress * 100).toFixed(0)}%`, tone: m.stress > 0.8 ? C.coral : C.ivory },
    { label: 'Boundary', value: ['Convergent', 'Divergent', 'Transform'][Math.round(p.bound)] },
  ],
  series: (m) => [{ label: 'Strain', color: C.coral, v: m.stress, max: 1 }, { label: 'Uplift km', color: C.acid, v: m.height, max: 9 }],
  explain: (m, p) => {
    const b = Math.round(p.bound);
    if (m.quake > 0) return `Rupture. Stored elastic strain releases as seismic waves — the P front (compressional, 6 km/s) always outruns the S front (shear, 3.5 km/s). The gap between arrivals is how seismologists locate the epicentre.`;
    if (b === 0) return `Two plates converge at ${p.drift} cm/yr. Crust thickens and rises faster than erosion removes it, so the range is now ${(m.height * 1000).toFixed(0)} m tall.`;
    if (b === 1) return `Plates pull apart. Mantle rises, decompresses and melts, freezing new basaltic crust onto both edges — this is how ocean basins are born.`;
    return `Plates grind sideways. Friction locks the fault while strain accumulates (${(m.stress * 100).toFixed(0)}%); when it exceeds friction the fault slips catastrophically.`;
  },
};

/* ================================================================== */
/*  4 · OCEAN & MARINE LIFE                                            */
/* ================================================================== */
const ZONES = [
  { d: 200, n: 'Epipelagic', c: '#7ED9A7', life: 'Sunlight, 90% of marine life' },
  { d: 1000, n: 'Mesopelagic', c: '#8FD8E8', life: 'Twilight zone, daily vertical migration' },
  { d: 4000, n: 'Bathypelagic', c: '#B59AFF', life: 'Midnight zone, bioluminescence' },
  { d: 6000, n: 'Abyssopelagic', c: '#8f7fd0', life: 'Near-freezing, immense pressure' },
  { d: 11000, n: 'Hadopelagic', c: '#FF704F', life: 'Trenches — amphipods, snailfish' },
];
export const ocean: Spec = {
  id: 'ocean', name: 'Ocean & Marine Life', tag: 'Submarine descent', accent: C.mint, glyph: 'leaf', orbit: false,
  blurb: 'Pilot a submersible from sunlit reef to hadal trench. Pressure, light and temperature are computed from depth as you descend.',
  method: 'Pressure uses the hydrostatic relation P = P₀ + ρgh with ρ = 1,025 kg/m³. Light follows Beer–Lambert attenuation. Temperature and species bands are representative profiles, not a live ocean model.',
  facts: ['Every 10 m of seawater adds about one atmosphere of pressure.', 'At Challenger Deep the pressure is over 1,000 atmospheres.', 'Below 1,000 m no sunlight remains — all light is biological.', 'Hydrothermal vent ecosystems run on chemosynthesis, not sunlight.'],
  ctrls: [
    { k: 'target', label: 'Target depth', min: 0, max: 11000, step: 50, def: 800, unit: ' m' },
    { k: 'speed', label: 'Descent rate', min: 5, max: 300, step: 5, def: 90, unit: ' m/s' },
    { k: 'sst', label: 'Surface temp', min: -2, max: 32, step: 0.5, def: 22, unit: ' °C' },
    { k: 'turb', label: 'Turbidity', min: 0.02, max: 0.4, step: 0.01, def: 0.08 },
    { k: 'current', label: 'Current', min: 0, max: 3, step: 0.05, def: 0.6, unit: ' m/s' },
    { k: 'lamp', label: 'Floodlight', min: 0, max: 1, step: 0.05, def: 0.6 },
  ],
  toggles: [{ k: 'life', label: 'Creatures', def: true }, { k: 'bubbles', label: 'Bubbles', def: true }, { k: 'thermo', label: 'Thermocline', def: true }, { k: 'sonar', label: 'Sonar', def: true }],
  choices: [{ k: 'scene', label: 'Environment', options: ['Open water', 'Coral reef', 'Hydrothermal vent'], def: 0 }],
  scenarios: [
    { name: 'Reef shallows', note: 'Warm, bright, bleaching risk', set: { target: 25, sst: 30, scene: 1, turb: 0.05 } },
    { name: 'Midnight zone', note: '2,500 m — bioluminescence only', set: { target: 2500, lamp: 0.8, scene: 0 } },
    { name: 'Challenger Deep', note: '10,935 m — 1,086 bar', set: { target: 10935, speed: 300, lamp: 1 } },
  ],
  make: () => ({ depth: 0, ping: 0, bubbles: [] as { x: number; y: number; r: number }[], fish: Array.from({ length: 26 }, (_, i) => ({ x: hash(i), y: hash(i + 4), s: 0.4 + hash(i + 8), ph: hash(i + 12) * TAU })) }),
  step(m, p, dt) {
    m.depth += clamp(p.target - m.depth, -p.speed * dt, p.speed * dt);
    m.ping = (m.ping + dt * 0.6) % 1;
    if (p.bubbles && Math.random() < dt * 14) m.bubbles.push({ x: Math.random(), y: 1, r: 1 + Math.random() * 3 });
    m.bubbles.forEach((b: { y: number; x: number }) => { b.y -= dt * 0.25; b.x += Math.sin(b.y * 12) * dt * 0.02; });
    m.bubbles = m.bubbles.filter((b: { y: number }) => b.y > -0.05).slice(-70);
  },
  draw(ctx, m, p, e) {
    const light = Math.exp(-p.turb * m.depth * 0.06);
    const zone = ZONES.find((z) => m.depth <= z.d) ?? ZONES[4];
    const g = ctx.createLinearGradient(0, 0, 0, e.h);
    g.addColorStop(0, rgba(zone.c, 0.16 * light + 0.02));
    g.addColorStop(1, '#0b0d0e');
    ctx.fillStyle = '#0b0d0e'; ctx.fillRect(0, 0, e.w, e.h);
    ctx.fillStyle = g; ctx.fillRect(0, 0, e.w, e.h);
    // surface shimmer
    if (m.depth < 220) {
      for (let i = 0; i < 9; i++) {
        const y = (i / 9) * e.h * 0.5;
        seg(ctx, 0, y + Math.sin(e.t + i) * 4, e.w, y + Math.cos(e.t * 0.8 + i) * 4, rgba(C.ivory, 0.05 * light), 8);
      }
    }
    // thermocline
    if (p.thermo && m.depth > 100 && m.depth < 1400) {
      const y = e.h * 0.4;
      ctx.strokeStyle = rgba(C.coral, 0.35); ctx.setLineDash([6, 6]); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(e.w, y); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, 'thermocline — temperature drops sharply', 12, y - 8, 9, C.coral, 'left', 0.7);
    }
    // scene features
    if (p.scene === 1) {
      for (let i = 0; i < 14; i++) {
        const x = (i / 14) * e.w + Math.sin(i) * 12;
        const bleach = clamp((p.sst - 28) / 4, 0, 1);
        const c = bleach > 0.5 ? C.ivory : [C.coral, C.orchid, C.amber][i % 3];
        for (let k = 0; k < 5; k++) dot(ctx, x + Math.cos(k * 1.3) * 12, e.h - 26 - Math.abs(Math.sin(k * 2)) * 26, 7 - k, rgba(c, 0.5), 6);
      }
    }
    if (p.scene === 2) {
      poly(ctx, [{ x: e.w * 0.4, y: e.h }, { x: e.w * 0.46, y: e.h * 0.55 }, { x: e.w * 0.54, y: e.h * 0.55 }, { x: e.w * 0.6, y: e.h }], '#241f1c', rgba(C.coral, 0.4));
      for (let i = 0; i < 26; i++) {
        const t = (e.t * 0.4 + i / 26) % 1;
        dot(ctx, e.w * 0.5 + Math.sin(i * 3 + t * 6) * 22 * t, e.h * 0.55 - t * e.h * 0.5, 4 + t * 16, rgba('#3a3a34', 0.5 * (1 - t)), 0);
      }
      txt(ctx, 'black smoker · 350 °C fluid', e.w * 0.5, e.h * 0.52, 9, C.amber, 'center', 0.8);
    }
    // creatures
    if (p.life) {
      m.fish.forEach((f: { x: number; y: number; s: number; ph: number }, i: number) => {
        const bio = m.depth > 1000;
        const x = ((f.x + e.t * 0.02 * (0.4 + f.s) * (1 + p.current)) % 1) * e.w;
        const y = f.y * e.h * 0.85 + Math.sin(e.t * 1.4 + f.ph) * 8;
        const c = bio ? (i % 3 === 0 ? C.acid : C.lav) : zone.c;
        ctx.globalAlpha = bio ? 0.9 : 0.5;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, y, 7 * f.s, 3 * f.s, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 7 * f.s, y); ctx.lineTo(x - 12 * f.s, y - 3.4 * f.s); ctx.lineTo(x - 12 * f.s, y + 3.4 * f.s); ctx.fill();
        if (bio) dot(ctx, x + 6 * f.s, y - 1, 1.4, C.acid, 8);
        ctx.globalAlpha = 1;
      });
    }
    // submersible + lamp cone
    const sx = e.w * 0.5, sy = e.h * 0.46;
    if (p.lamp > 0.02) {
      const lg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 190 * p.lamp);
      lg.addColorStop(0, rgba(C.ivory, 0.16 * p.lamp)); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(sx, sy, 190 * p.lamp, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = shade(C.amber, 0.8);
    ctx.beginPath(); ctx.ellipse(sx, sy, 26, 14, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(C.ivory, 0.5); ctx.lineWidth = 1.4; ctx.stroke();
    dot(ctx, sx + 10, sy - 2, 5, rgba(C.sky, 0.8), 8);
    if (p.sonar) { ctx.strokeStyle = rgba(C.acid, (1 - m.ping) * 0.5); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(sx, sy, m.ping * 180, 0, TAU); ctx.stroke(); }
    m.bubbles.forEach((b: { x: number; y: number; r: number }) => { ctx.strokeStyle = rgba(C.ivory, 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x * e.w, b.y * e.h, b.r, 0, TAU); ctx.stroke(); });
    // depth ruler
    for (let i = 0; i <= 5; i++) {
      const d = (i / 5) * 11000, y = 20 + (i / 5) * (e.h - 40);
      seg(ctx, e.w - 26, y, e.w - 14, y, rgba(C.ivory, 0.25), 1);
      txt(ctx, `${d / 1000}km`, e.w - 30, y + 3, 8.5, C.ivory, 'right', 0.35);
    }
    const my = 20 + (m.depth / 11000) * (e.h - 40);
    dot(ctx, e.w - 20, my, 4, C.acid, 10);
    txt(ctx, `${zone.n} · ${zone.life}`, 14, e.h - 14, 10, zone.c, 'left', 0.85);
  },
  readouts: (m, p) => {
    const bar = 1 + (1025 * 9.81 * m.depth) / 101325;
    const temp = m.depth < 1000 ? lerp(p.sst, 4, clamp(m.depth / 1000, 0, 1)) : lerp(4, 1.5, clamp((m.depth - 1000) / 5000, 0, 1));
    return [
      { label: 'Depth', value: `${m.depth.toFixed(0)} m`, tone: C.mint },
      { label: 'Pressure', value: `${bar.toFixed(1)} bar`, tone: bar > 500 ? C.coral : C.ivory },
      { label: 'Temperature', value: `${temp.toFixed(1)} °C` },
      { label: 'Surface light', value: `${(Math.exp(-p.turb * m.depth * 0.06) * 100).toFixed(2)}%` },
      { label: 'Zone', value: (ZONES.find((z) => m.depth <= z.d) ?? ZONES[4]).n },
      { label: 'Hull load', value: `${fmt(bar * 101325 * 0.01, 0)} N/cm²` },
    ];
  },
  series: (m, p) => [{ label: 'Pressure bar', color: C.coral, v: 1 + m.depth / 10.06, max: 1100 }, { label: 'Light %', color: C.acid, v: Math.exp(-p.turb * m.depth * 0.06) * 100, max: 100 }],
  explain: (m, p) => {
    const bar = 1 + m.depth / 10.06;
    if (m.depth < 200) return `Sunlit water. Photosynthesis is possible here, which is why roughly 90% of marine life crowds into this thin surface layer.${p.sst > 29 && p.scene === 1 ? ' Above ~29 °C corals expel their symbiotic algae — bleaching.' : ''}`;
    if (m.depth < 1000) return `The twilight zone. Light is too weak for photosynthesis; animals here make the largest daily migration on Earth, rising at night to feed.`;
    return `No sunlight reaches here. At ${bar.toFixed(0)} bar every square centimetre of hull carries ${(bar * 1.033).toFixed(0)} kg of force — life adapts with pressure-stable proteins and no gas-filled cavities.`;
  },
};

/* ================================================================== */
/*  5 · PHYSICS LABORATORY                                             */
/* ================================================================== */
const PMODES = ['Projectile', 'Collision', 'Pendulum', 'Waves', 'Optics'];
export const physics: Spec = {
  id: 'physics', name: 'Physics Laboratory', tag: 'Mechanics · waves · optics', accent: C.acid, glyph: 'atom', orbit: false,
  blurb: 'Five benches sharing one set of instruments. Launch projectiles, collide carts, swing pendulums, interfere waves and refract light — all integrated live.',
  method: 'Newtonian integration with optional quadratic drag; collisions conserve momentum with a coefficient of restitution; the pendulum uses the full nonlinear equation θ̈ = −(g/L)sinθ; optics uses Snell’s law n₁sinθ₁ = n₂sinθ₂.',
  facts: ['Momentum is conserved in every collision; kinetic energy only when e = 1.', 'A pendulum is only approximately harmonic for small angles.', 'Total internal reflection begins at the critical angle arcsin(n₂/n₁).', 'Range is maximised at 45° only when drag is negligible.'],
  ctrls: [
    { k: 'g', label: 'Gravity', min: 0, max: 25, step: 0.1, def: 9.81, unit: ' m/s²' },
    { k: 'v0', label: 'Launch speed', min: 1, max: 60, step: 0.5, def: 26, unit: ' m/s' },
    { k: 'ang', label: 'Launch angle', min: 5, max: 85, step: 1, def: 45, unit: '°' },
    { k: 'm1', label: 'Mass A', min: 0.5, max: 10, step: 0.1, def: 3, unit: ' kg' },
    { k: 'm2', label: 'Mass B', min: 0.5, max: 10, step: 0.1, def: 5, unit: ' kg' },
    { k: 'rest', label: 'Restitution', min: 0, max: 1, step: 0.02, def: 0.85 },
    { k: 'mu', label: 'Friction / drag', min: 0, max: 1, step: 0.02, def: 0.15 },
    { k: 'freq', label: 'Wave frequency', min: 0.2, max: 4, step: 0.05, def: 1.2, unit: ' Hz' },
    { k: 'n2', label: 'Refractive index', min: 1, max: 2.4, step: 0.01, def: 1.5 },
  ],
  toggles: [{ k: 'vec', label: 'Vectors', def: true }, { k: 'trail', label: 'Trails', def: true }, { k: 'grid', label: 'Grid', def: true }, { k: 'drag', label: 'Air drag', def: false }],
  choices: [{ k: 'mode', label: 'Bench', options: PMODES, def: 0 }],
  actions: [{ id: 'fire', label: 'Launch / release', tone: C.acid }],
  scenarios: [
    { name: 'Perfectly elastic', note: 'e = 1 — kinetic energy conserved', set: { mode: 1, rest: 1, m1: 3, m2: 3 } },
    { name: 'Moon projectile', note: 'g = 1.62 m/s², no atmosphere', set: { mode: 0, g: 1.62, drag: 0, v0: 26 } },
    { name: 'Total internal reflection', note: 'Dense medium, steep incidence', set: { mode: 4, n2: 1.0, ang: 62 } },
  ],
  make: () => ({ x: 0, y: 0, vx: 0, vy: 0, fly: false, trail: [] as number[][], ax: 0.2, av: 3, bx: 0.75, bv: 0, hit: false, th: 0.9, om: 0, ke0: 0, ke1: 0, range: 0, apex: 0 }),
  step(m, p, dt) {
    const mode = Math.round(p.mode);
    if (mode === 0 && m.fly) {
      const k = p.drag ? p.mu * 0.02 : 0;
      const sp = Math.hypot(m.vx, m.vy);
      m.vx -= k * sp * m.vx * dt; m.vy -= (p.g + k * sp * m.vy) * dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.apex = Math.max(m.apex, m.y);
      m.trail.push([m.x, m.y]); if (m.trail.length > 400) m.trail.shift();
      if (m.y <= 0) { m.y = 0; m.fly = false; m.range = m.x; }
    } else if (mode === 1) {
      const fr = p.mu * 0.4;
      m.av -= Math.sign(m.av) * fr * dt; m.bv -= Math.sign(m.bv) * fr * dt;
      m.ax += m.av * dt * 0.08; m.bx += m.bv * dt * 0.08;
      if (m.bx - m.ax < 0.1 && !m.hit) {
        m.hit = true;
        const u1 = m.av, u2 = m.bv, M = p.m1 + p.m2, e = p.rest;
        m.av = ((p.m1 - e * p.m2) * u1 + (1 + e) * p.m2 * u2) / M;
        m.bv = ((p.m2 - e * p.m1) * u2 + (1 + e) * p.m1 * u1) / M;
        m.ke1 = 0.5 * p.m1 * m.av * m.av + 0.5 * p.m2 * m.bv * m.bv;
      }
      if (m.bx - m.ax > 0.14) m.hit = false;
      if (m.ax < 0.02 || m.ax > 0.96) m.av *= -0.6;
      if (m.bx < 0.02 || m.bx > 0.96) m.bv *= -0.6;
    } else if (mode === 2) {
      const L = 2;
      m.om += (-(p.g / L) * Math.sin(m.th) - p.mu * 0.4 * m.om) * dt;
      m.th += m.om * dt;
    }
  },
  onAction(a, m, p) {
    if (a !== 'fire') return;
    const mode = Math.round(p.mode);
    if (mode === 0) { m.x = 0; m.y = 0.01; m.vx = p.v0 * Math.cos(p.ang * Math.PI / 180); m.vy = p.v0 * Math.sin(p.ang * Math.PI / 180); m.fly = true; m.trail = []; m.apex = 0; }
    if (mode === 1) { m.ax = 0.18; m.bx = 0.78; m.av = p.v0 * 0.12; m.bv = -p.v0 * 0.03; m.hit = false; m.ke0 = 0.5 * p.m1 * m.av * m.av + 0.5 * p.m2 * m.bv * m.bv; }
    if (mode === 2) { m.th = p.ang * Math.PI / 180; m.om = 0; }
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.acid);
    if (p.grid) grid2d(ctx, e, 44, C.ivory, 0.045);
    const mode = Math.round(p.mode);
    if (mode === 0) {
      const S = Math.min(e.w / 90, e.h / 55), gy = e.h - 40;
      seg(ctx, 30, gy, e.w - 10, gy, rgba(C.ivory, 0.3), 1.5);
      if (p.trail) { ctx.strokeStyle = rgba(C.acid, 0.55); ctx.lineWidth = 1.6; ctx.beginPath(); m.trail.forEach((q: number[], i: number) => { const X = 30 + q[0] * S, Y = gy - q[1] * S; i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }); ctx.stroke(); }
      const X = 30 + m.x * S, Y = gy - m.y * S;
      dot(ctx, X, Y, 7, C.coral, 14);
      if (p.vec && m.fly) { arrow(ctx, X, Y, X + m.vx * 1.6, Y, C.acid); arrow(ctx, X, Y, X, Y - m.vy * 1.6, C.lav); }
      const a = p.ang * Math.PI / 180;
      arrow(ctx, 30, gy, 30 + Math.cos(a) * 60, gy - Math.sin(a) * 60, rgba(C.ivory, 0.5), 1.4);
      txt(ctx, `range ${m.range.toFixed(1)} m · apex ${m.apex.toFixed(1)} m`, 34, gy + 24, 10, C.acid, 'left', 0.85);
    } else if (mode === 1) {
      const gy = e.h * 0.6;
      seg(ctx, 20, gy + 26, e.w - 20, gy + 26, rgba(C.ivory, 0.3), 1.5);
      [[m.ax, p.m1, C.acid, 'A'], [m.bx, p.m2, C.coral, 'B']].forEach(([x, mass, col, nm]) => {
        const s = 18 + (mass as number) * 3.2;
        const X = (x as number) * e.w;
        ctx.fillStyle = rgba(col as string, 0.25); ctx.strokeStyle = col as string; ctx.lineWidth = 1.6;
        ctx.fillRect(X - s / 2, gy - s + 26, s, s); ctx.strokeRect(X - s / 2, gy - s + 26, s, s);
        txt(ctx, `${nm} ${mass}kg`, X, gy + 44, 9.5, col as string, 'center', 0.8);
      });
      if (p.vec) { arrow(ctx, m.ax * e.w, gy - 30, m.ax * e.w + m.av * 60, gy - 30, C.acid); arrow(ctx, m.bx * e.w, gy - 46, m.bx * e.w + m.bv * 60, gy - 46, C.coral); }
      txt(ctx, `Σp = ${(p.m1 * m.av + p.m2 * m.bv).toFixed(2)} kg·m/s (conserved)`, 20, 30, 10.5, C.ivory, 'left', 0.8);
    } else if (mode === 2) {
      const px = e.w / 2, py = e.h * 0.18, L = Math.min(e.h * 0.6, 240);
      const bx = px + Math.sin(m.th) * L, by = py + Math.cos(m.th) * L;
      seg(ctx, px, py, bx, by, rgba(C.ivory, 0.45), 1.6);
      dot(ctx, px, py, 4, C.ivory, 0);
      dot(ctx, bx, by, 14 + p.m1, C.acid, 18);
      ctx.strokeStyle = rgba(C.lav, 0.3); ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(px, py, L, Math.PI / 2 - 1, Math.PI / 2 + 1); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, `θ = ${(m.th * 180 / Math.PI).toFixed(1)}° · T ≈ ${(2 * Math.PI * Math.sqrt(2 / Math.max(0.1, p.g))).toFixed(2)} s`, 20, 30, 10.5, C.acid, 'left', 0.85);
    } else if (mode === 3) {
      const mid = e.h / 2;
      for (let s = 0; s < 2; s++) {
        ctx.strokeStyle = s ? rgba(C.coral, 0.75) : rgba(C.acid, 0.75); ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let x = 0; x <= e.w; x += 3) {
          const y = mid + Math.sin(x * 0.02 * p.freq - e.t * 3 + (s ? Math.PI * p.mu * 2 : 0)) * (s ? 34 : 46) * (s ? 0.8 : 1);
          x === 0 ? ctx.moveTo(x, y + (s ? 60 : -60)) : ctx.lineTo(x, y + (s ? 60 : -60));
        }
        ctx.stroke();
      }
      ctx.strokeStyle = C.ivory; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x <= e.w; x += 3) {
        const a1 = Math.sin(x * 0.02 * p.freq - e.t * 3) * 46;
        const a2 = Math.sin(x * 0.02 * p.freq - e.t * 3 + Math.PI * p.mu * 2) * 34;
        const y = mid + (a1 + a2) * 0.6;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      txt(ctx, 'superposition — phase offset set by the friction slider', 20, 26, 10, C.ivory, 'left', 0.6);
    } else {
      const iy = e.h * 0.5, ix = e.w * 0.5;
      ctx.fillStyle = rgba(C.sky, 0.1); ctx.fillRect(0, iy, e.w, e.h - iy);
      seg(ctx, 0, iy, e.w, iy, rgba(C.ivory, 0.35), 1.4);
      seg(ctx, ix, iy - 120, ix, iy + 120, rgba(C.ivory, 0.2), 1);
      const t1 = (90 - p.ang) * Math.PI / 180;
      const s2 = Math.sin(t1) / p.n2;
      const tir = Math.abs(s2) > 1;
      const t2 = tir ? t1 : Math.asin(s2);
      arrow(ctx, ix - Math.sin(t1) * 170, iy - Math.cos(t1) * 170, ix, iy, C.acid, 2);
      if (tir) arrow(ctx, ix, iy, ix + Math.sin(t1) * 170, iy - Math.cos(t1) * 170, C.coral, 2);
      else arrow(ctx, ix, iy, ix + Math.sin(t2) * 170, iy + Math.cos(t2) * 170, C.lav, 2);
      txt(ctx, `θ₁ ${(t1 * 180 / Math.PI).toFixed(1)}°  →  ${tir ? 'total internal reflection' : `θ₂ ${(t2 * 180 / Math.PI).toFixed(1)}°`}`, 20, 28, 11, tir ? C.coral : C.acid, 'left', 0.9);
      txt(ctx, `n₁ 1.00 (air)   n₂ ${p.n2.toFixed(2)}`, 20, e.h - 20, 10, C.ivory, 'left', 0.6);
    }
  },
  readouts: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 0) return [
      { label: 'Speed', value: `${Math.hypot(m.vx, m.vy).toFixed(1)} m/s`, tone: C.acid },
      { label: 'Height', value: `${m.y.toFixed(1)} m` },
      { label: 'Range', value: `${m.range.toFixed(1)} m` },
      { label: 'Ideal range', value: `${(p.v0 * p.v0 * Math.sin(2 * p.ang * Math.PI / 180) / Math.max(0.1, p.g)).toFixed(1)} m` },
    ];
    if (mode === 1) return [
      { label: 'Momentum', value: `${(p.m1 * m.av + p.m2 * m.bv).toFixed(2)} kg·m/s`, tone: C.acid },
      { label: 'KE before', value: `${m.ke0.toFixed(2)} J` },
      { label: 'KE after', value: `${m.ke1.toFixed(2)} J` },
      { label: 'Energy lost', value: m.ke0 ? `${((1 - m.ke1 / m.ke0) * 100).toFixed(0)}%` : '—', tone: C.coral },
    ];
    if (mode === 2) return [
      { label: 'Angle', value: `${(m.th * 180 / Math.PI).toFixed(1)}°`, tone: C.acid },
      { label: 'Angular vel', value: `${m.om.toFixed(2)} rad/s` },
      { label: 'Small-angle T', value: `${(2 * Math.PI * Math.sqrt(2 / Math.max(0.1, p.g))).toFixed(2)} s` },
      { label: 'Energy', value: `${(0.5 * m.om * m.om * 4 + p.g * 2 * (1 - Math.cos(m.th))).toFixed(2)} J/kg` },
    ];
    if (mode === 3) return [
      { label: 'Frequency', value: `${p.freq.toFixed(2)} Hz`, tone: C.acid },
      { label: 'Wavelength', value: `${(343 / p.freq).toFixed(0)} m (air)` },
      { label: 'Phase offset', value: `${(p.mu * 360).toFixed(0)}°` },
      { label: 'Interference', value: p.mu < 0.25 ? 'Constructive' : p.mu > 0.75 ? 'Destructive' : 'Partial', tone: p.mu > 0.75 ? C.coral : C.ivory },
    ];
    const t1 = (90 - p.ang) * Math.PI / 180;
    return [
      { label: 'Incidence', value: `${(t1 * 180 / Math.PI).toFixed(1)}°`, tone: C.acid },
      { label: 'Critical angle', value: `${(Math.asin(Math.min(1, 1 / p.n2)) * 180 / Math.PI).toFixed(1)}°` },
      { label: 'Speed in medium', value: `${(299792 / p.n2).toFixed(0)} km/s` },
      { label: 'Result', value: Math.sin(t1) / p.n2 > 1 ? 'TIR' : 'Refraction', tone: Math.sin(t1) / p.n2 > 1 ? C.coral : C.ivory },
    ];
  },
  series: (m, p) => Math.round(p.mode) === 2
    ? [{ label: 'θ (deg)', color: C.acid, v: Math.abs(m.th * 180 / Math.PI), max: 90 }, { label: 'ω', color: C.coral, v: Math.abs(m.om), max: 6 }]
    : [{ label: 'Speed', color: C.acid, v: Math.round(p.mode) === 0 ? Math.hypot(m.vx, m.vy) : Math.abs(m.av) * 10, max: 60 }, { label: 'Height', color: C.lav, v: m.y, max: 40 }],
  explain: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 0) return m.fly ? `In flight at ${Math.hypot(m.vx, m.vy).toFixed(1)} m/s. Gravity removes ${p.g.toFixed(1)} m/s of vertical speed every second${p.drag ? ', and quadratic drag bleeds horizontal speed too' : ''}.` : `Press LAUNCH. Ideal range at this angle is ${(p.v0 * p.v0 * Math.sin(2 * p.ang * Math.PI / 180) / Math.max(0.1, p.g)).toFixed(1)} m — drag will shorten it.`;
    if (mode === 1) return `Momentum stays at ${(p.m1 * m.av + p.m2 * m.bv).toFixed(2)} kg·m/s through the impact. With e = ${p.rest.toFixed(2)}, ${((1 - p.rest * p.rest) * 100).toFixed(0)}% of the relative kinetic energy is lost to deformation and heat.`;
    if (mode === 2) return `Full nonlinear pendulum. At ${(Math.abs(m.th) * 180 / Math.PI).toFixed(0)}° the small-angle formula is already noticeably wrong — the real period lengthens with amplitude.`;
    if (mode === 3) return `Two waves of ${p.freq.toFixed(2)} Hz superpose. Shift the phase with the friction slider to move between constructive and destructive interference.`;
    return `Snell’s law bends the ray toward the normal entering a denser medium. Past the critical angle no refracted solution exists and all light reflects.`;
  },
};

/* ================================================================== */
/*  6 · CHEMISTRY LABORATORY                                           */
/* ================================================================== */
const ELEMENTS = [
  { s: 'H', z: 1, n: 'Hydrogen', sh: [1], c: '#F3EBDD' }, { s: 'He', z: 2, n: 'Helium', sh: [2], c: '#E4C580' },
  { s: 'C', z: 6, n: 'Carbon', sh: [2, 4], c: '#8f8a7a' }, { s: 'N', z: 7, n: 'Nitrogen', sh: [2, 5], c: '#B59AFF' },
  { s: 'O', z: 8, n: 'Oxygen', sh: [2, 6], c: '#FF704F' }, { s: 'Na', z: 11, n: 'Sodium', sh: [2, 8, 1], c: '#FFD24A' },
  { s: 'Mg', z: 12, n: 'Magnesium', sh: [2, 8, 2], c: '#7ED9A7' }, { s: 'Al', z: 13, n: 'Aluminium', sh: [2, 8, 3], c: '#C9B8A0' },
  { s: 'Si', z: 14, n: 'Silicon', sh: [2, 8, 4], c: '#A8D8C9' }, { s: 'P', z: 15, n: 'Phosphorus', sh: [2, 8, 5], c: '#E88BF0' },
  { s: 'S', z: 16, n: 'Sulfur', sh: [2, 8, 6], c: '#FFD24A' }, { s: 'Cl', z: 17, n: 'Chlorine', sh: [2, 8, 7], c: '#D7FF45' },
  { s: 'K', z: 19, n: 'Potassium', sh: [2, 8, 8, 1], c: '#E4C580' }, { s: 'Fe', z: 26, n: 'Iron', sh: [2, 8, 14, 2], c: '#FF704F' },
  { s: 'Cu', z: 29, n: 'Copper', sh: [2, 8, 18, 1], c: '#E09A5C' }, { s: 'Au', z: 79, n: 'Gold', sh: [2, 8, 18, 32, 18, 1], c: '#FFD24A' },
];
const CMODES = ['Atom', 'Bonding', 'Reaction rate', 'Titration', 'States of matter'];
const MOLS = ['H₂O', 'CO₂', 'CH₄', 'NaCl', 'NH₃'];
export const chemistry: Spec = {
  id: 'chemistry', name: 'Chemistry Laboratory', tag: 'Atoms · bonds · kinetics', accent: C.amber, glyph: 'flask', orbit: true,
  blurb: 'Build atoms shell by shell, join them into molecules, then push temperature and concentration to see reaction rates obey Arrhenius.',
  method: 'Electron shells follow the standard 2/8/18/32 filling for the elements shown. Rate constants use k = A·e^(−Ea/RT) with A = 10¹³ s⁻¹. The titration curve is a strong acid–strong base model; states of matter use a Lennard-Jones-flavoured particle model.',
  facts: ['A catalyst lowers activation energy; it never changes the equilibrium position.', 'Room-temperature rate roughly doubles for every 10 K — a consequence of the exponential.', 'Water’s bent 104.5° geometry is why it is polar and such a good solvent.', 'At the equivalence point of a strong acid–base titration, pH = 7.'],
  ctrls: [
    { k: 'temp', label: 'Temperature', min: 200, max: 1200, step: 10, def: 300, unit: ' K' },
    { k: 'conc', label: 'Concentration', min: 0.1, max: 2, step: 0.05, def: 1, unit: ' M' },
    { k: 'ea', label: 'Activation energy', min: 20, max: 120, step: 1, def: 60, unit: ' kJ/mol' },
    { k: 'cat', label: 'Catalyst effect', min: 0, max: 40, step: 1, def: 0, unit: ' kJ' },
    { k: 'vol', label: 'Titrant added', min: 0, max: 50, step: 0.5, def: 0, unit: ' mL' },
    { k: 'press', label: 'Pressure', min: 0.2, max: 3, step: 0.05, def: 1, unit: ' atm' },
  ],
  toggles: [{ k: 'labels', label: 'Labels', def: true }, { k: 'shells', label: 'Shell rings', def: true }, { k: 'cloud', label: 'Electron cloud', def: false }],
  choices: [
    { k: 'mode', label: 'Bench', options: CMODES, def: 0 },
    { k: 'el', label: 'Element', options: ELEMENTS.map((x) => x.s), def: 4 },
    { k: 'mol', label: 'Molecule', options: MOLS, def: 0 },
  ],
  scenarios: [
    { name: 'Cold reaction', note: '250 K — almost nothing happens', set: { mode: 2, temp: 250, ea: 80, cat: 0 } },
    { name: 'Catalysed', note: 'Same reaction, 35 kJ less barrier', set: { mode: 2, temp: 300, ea: 80, cat: 35 } },
    { name: 'Equivalence point', note: '25 mL titrant into 25 mL acid', set: { mode: 3, vol: 25 } },
  ],
  make: () => ({ parts: Array.from({ length: 90 }, (_, i) => ({ x: hash(i) * 2 - 1, y: hash(i + 3) * 2 - 1, vx: 0, vy: 0 })), reacted: 0, curve: [] as number[] }),
  step(m, p, dt) {
    if (Math.round(p.mode) === 2) {
      const k = 1e13 * Math.exp((-(p.ea - p.cat) * 1000) / (8.314 * p.temp));
      m.reacted = clamp(m.reacted + k * p.conc * dt * 0.02, 0, 1);
    }
    if (Math.round(p.mode) === 4) {
      const energy = p.temp / 400 / p.press;
      m.parts.forEach((q: { x: number; y: number; vx: number; vy: number }) => {
        q.vx += (Math.random() - 0.5) * energy * dt * 6;
        q.vy += (Math.random() - 0.5) * energy * dt * 6;
        if (energy < 0.5) { q.vx -= q.x * dt * 0.6; q.vy -= q.y * dt * 0.6; }
        q.vx *= 0.985; q.vy *= 0.985;
        q.x = clamp(q.x + q.vx * dt, -1, 1); q.y = clamp(q.y + q.vy * dt, -1, 1);
      });
    }
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.amber);
    const mode = Math.round(p.mode);
    const cx = e.w / 2, cy = e.h / 2;
    if (mode === 0) {
      const el = ELEMENTS[Math.round(p.el)];
      const S = Math.min(e.w, e.h) * 0.36 * e.cam.zoom;
      if (p.cloud) for (let i = 0; i < 200; i++) {
        const a = hash(i) * TAU + e.t * 0.2, r = Math.pow(hash(i + 2), 0.5) * S * 0.9;
        dot(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 1.2, rgba(el.c, 0.18), 0);
      }
      dot(ctx, cx, cy, 14 + el.z * 0.12, el.c, 24);
      txt(ctx, el.s, cx, cy + 5, 15, C.obsidian, 'center', 1);
      el.sh.forEach((count: number, si: number) => {
        const r = S * (0.32 + si * 0.2);
        if (p.shells) { ctx.strokeStyle = rgba(C.ivory, 0.16); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.42, e.cam.yaw * 0.3, 0, TAU); ctx.stroke(); }
        for (let k = 0; k < count; k++) {
          const a = (k / count) * TAU + e.t * (1.2 - si * 0.2);
          const q = proj(e.cam, e.w, e.h, Math.cos(a) * (0.32 + si * 0.2) * 2.2, 0, Math.sin(a) * (0.32 + si * 0.2) * 2.2);
          dot(ctx, q.x, q.y, 3.2 * q.f, C.acid, 8);
        }
        if (p.labels) txt(ctx, `n=${si + 1}: ${count}e⁻`, cx + r + 8, cy - 4, 9, C.ivory, 'left', 0.45);
      });
      txt(ctx, `${el.n} · Z=${el.z} · ${el.sh.join('-')}`, 14, e.h - 14, 11, el.c, 'left', 0.9);
    } else if (mode === 1) {
      const mol = MOLS[Math.round(p.mol)];
      const S = Math.min(e.w, e.h) * 0.2 * e.cam.zoom;
      const geom: Record<string, { a: [number, number, number]; c: string; s: string }[]> = {
        'H₂O': [{ a: [0, 0, 0], c: C.coral, s: 'O' }, { a: [-0.79, 0.61, 0], c: C.ivory, s: 'H' }, { a: [0.79, 0.61, 0], c: C.ivory, s: 'H' }],
        'CO₂': [{ a: [0, 0, 0], c: '#8f8a7a', s: 'C' }, { a: [-1.2, 0, 0], c: C.coral, s: 'O' }, { a: [1.2, 0, 0], c: C.coral, s: 'O' }],
        'CH₄': [{ a: [0, 0, 0], c: '#8f8a7a', s: 'C' }, { a: [1, 1, 1], c: C.ivory, s: 'H' }, { a: [-1, -1, 1], c: C.ivory, s: 'H' }, { a: [-1, 1, -1], c: C.ivory, s: 'H' }, { a: [1, -1, -1], c: C.ivory, s: 'H' }],
        'NaCl': [{ a: [-0.7, 0, 0], c: C.amber, s: 'Na⁺' }, { a: [0.7, 0, 0], c: C.acid, s: 'Cl⁻' }],
        'NH₃': [{ a: [0, 0.3, 0], c: C.lav, s: 'N' }, { a: [0.94, -0.3, 0], c: C.ivory, s: 'H' }, { a: [-0.47, -0.3, 0.82], c: C.ivory, s: 'H' }, { a: [-0.47, -0.3, -0.82], c: C.ivory, s: 'H' }],
      };
      const atoms = geom[mol].map((at) => ({ ...at, q: proj(e.cam, e.w, e.h, at.a[0], at.a[1], at.a[2]) })).sort((a, b) => b.q.z - a.q.z);
      atoms.forEach((at, i) => { if (i > 0) seg(ctx, atoms[0].q.x, atoms[0].q.y, at.q.x, at.q.y, rgba(C.ivory, 0.45), 4 * at.q.f); });
      atoms.forEach((at) => {
        dot(ctx, at.q.x, at.q.y, (at.s.length > 1 ? 16 : 20) * at.q.f * (S / 60), at.c, 14);
        if (p.labels) txt(ctx, at.s, at.q.x, at.q.y + 4, 10 * at.q.f, C.obsidian, 'center', 1);
      });
      txt(ctx, `${mol} — ${mol === 'H₂O' ? 'bent, 104.5°, polar' : mol === 'CO₂' ? 'linear, 180°, non-polar' : mol === 'CH₄' ? 'tetrahedral, 109.5°' : mol === 'NaCl' ? 'ionic lattice pair' : 'trigonal pyramidal, 107°'}`, 14, e.h - 14, 10.5, C.amber, 'left', 0.9);
    } else if (mode === 2) {
      const k = 1e13 * Math.exp((-(p.ea - p.cat) * 1000) / (8.314 * p.temp));
      const bx = 60, bw = e.w - 120, by = e.h * 0.72;
      ctx.strokeStyle = rgba(C.ivory, 0.35); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.bezierCurveTo(bx + bw * 0.3, by, bx + bw * 0.35, by - (p.ea - p.cat) * 1.5, bx + bw * 0.5, by - (p.ea - p.cat) * 1.5);
      ctx.bezierCurveTo(bx + bw * 0.65, by - (p.ea - p.cat) * 1.5, bx + bw * 0.7, by + 40, bx + bw, by + 40);
      ctx.stroke();
      if (p.cat > 0) {
        ctx.strokeStyle = rgba(C.acid, 0.5); ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(bx, by);
        ctx.bezierCurveTo(bx + bw * 0.35, by, bx + bw * 0.4, by - p.ea * 1.5, bx + bw * 0.5, by - p.ea * 1.5);
        ctx.bezierCurveTo(bx + bw * 0.6, by - p.ea * 1.5, bx + bw * 0.7, by + 40, bx + bw, by + 40);
        ctx.stroke(); ctx.setLineDash([]);
      }
      for (let i = 0; i < 30; i++) {
        const t = (e.t * (0.15 + k * 0.02) + i / 30) % 1;
        const x = bx + t * bw;
        const y = by - Math.sin(t * Math.PI) * (p.ea - p.cat) * 1.5 + (t > 0.5 ? (t - 0.5) * 80 : 0);
        dot(ctx, x, y, 3, t < m.reacted ? C.acid : C.coral, 6);
      }
      txt(ctx, `k = ${k.toExponential(2)} s⁻¹`, bx, 40, 13, C.acid, 'left', 0.95);
      txt(ctx, 'reactants', bx, by + 22, 9.5, C.ivory, 'left', 0.5);
      txt(ctx, 'products', bx + bw, by + 62, 9.5, C.ivory, 'right', 0.5);
      ctx.fillStyle = rgba(C.ivory, 0.1); ctx.fillRect(bx, e.h - 30, bw, 6);
      ctx.fillStyle = C.acid; ctx.fillRect(bx, e.h - 30, bw * m.reacted, 6);
      txt(ctx, `conversion ${(m.reacted * 100).toFixed(1)}%`, bx, e.h - 38, 9.5, C.acid, 'left', 0.8);
    } else if (mode === 3) {
      const bx = 50, bw = e.w - 100, by = e.h - 46, bh = e.h - 100;
      ctx.strokeStyle = rgba(C.ivory, 0.15);
      for (let i = 0; i <= 14; i += 2) { const y = by - (i / 14) * bh; seg(ctx, bx, y, bx + bw, y, rgba(C.ivory, 0.08), 1); txt(ctx, `${i}`, bx - 8, y + 3, 8.5, C.ivory, 'right', 0.4); }
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.beginPath();
      for (let v = 0; v <= 50; v += 0.5) {
        const ph = titrationPH(v);
        const X = bx + (v / 50) * bw, Y = by - (ph / 14) * bh;
        v === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();
      const ph = titrationPH(p.vol);
      const X = bx + (p.vol / 50) * bw, Y = by - (ph / 14) * bh;
      dot(ctx, X, Y, 6, ph < 6 ? C.coral : ph > 8 ? C.lav : C.acid, 14);
      txt(ctx, `pH ${ph.toFixed(2)}`, X + 10, Y - 8, 12, C.ivory, 'left', 0.95);
      txt(ctx, '25 mL of 0.1 M HCl titrated with 0.1 M NaOH', bx, 26, 10, C.ivory, 'left', 0.6);
    } else {
      const energy = p.temp / 400 / p.press;
      const state = energy < 0.5 ? 'Solid' : energy < 1.4 ? 'Liquid' : 'Gas';
      m.parts.forEach((q: { x: number; y: number }, i: number) => {
        dot(ctx, cx + q.x * e.w * 0.36, cy + q.y * e.h * 0.36, 4, energy < 0.5 ? C.sky : energy < 1.4 ? C.amber : C.coral, 6);
        if (energy < 0.5 && i % 6 === 0) seg(ctx, cx + q.x * e.w * 0.36, cy + q.y * e.h * 0.36, cx, cy, rgba(C.ivory, 0.03), 1);
      });
      txt(ctx, `${state} — kinetic energy vs intermolecular attraction`, 14, e.h - 14, 11, C.amber, 'left', 0.9);
    }
  },
  readouts: (_m, p) => {
    const k = 1e13 * Math.exp((-(p.ea - p.cat) * 1000) / (8.314 * p.temp));
    const el = ELEMENTS[Math.round(p.el)];
    return [
      { label: 'Rate constant', value: `${k.toExponential(2)} s⁻¹`, tone: C.amber },
      { label: 'Half-life', value: k > 1e-6 ? `${(0.693 / k).toExponential(1)} s` : '≫ age of Earth' },
      { label: 'Effective Ea', value: `${(p.ea - p.cat).toFixed(0)} kJ/mol` },
      { label: 'pH at cursor', value: titrationPH(p.vol).toFixed(2), tone: titrationPH(p.vol) < 6 ? C.coral : C.acid },
      { label: 'Element', value: `${el.n} (Z=${el.z})` },
      { label: 'Valence e⁻', value: `${el.sh[el.sh.length - 1]}` },
    ];
  },
  series: (m, p) => [{ label: 'Conversion %', color: C.acid, v: m.reacted * 100, max: 100 }, { label: 'pH', color: C.lav, v: titrationPH(p.vol), max: 14 }],
  explain: (m, p) => {
    const mode = Math.round(p.mode);
    const el = ELEMENTS[Math.round(p.el)];
    if (mode === 0) return `${el.n}: ${el.z} electrons in shells ${el.sh.join(', ')}. The ${el.sh[el.sh.length - 1]} outer electrons decide almost all of its chemistry.`;
    if (mode === 1) return `${MOLS[Math.round(p.mol)]} — geometry follows from electron-pair repulsion. Lone pairs push harder than bonds, which is why water is bent rather than linear.`;
    if (mode === 2) return `At ${p.temp} K only a fraction of collisions carry the ${(p.ea - p.cat).toFixed(0)} kJ/mol needed. ${p.cat > 0 ? 'The dashed curve is the uncatalysed path — the catalyst opens a lower barrier without changing the products.' : 'Raise temperature or add a catalyst and watch the exponential respond.'} Conversion: ${(m.reacted * 100).toFixed(1)}%.`;
    if (mode === 3) return `Strong acid meets strong base. The curve is nearly flat until the equivalence point at 25 mL, where a single drop swings pH by several units. Current pH ${titrationPH(p.vol).toFixed(2)}.`;
    return `Particle kinetic energy scales with temperature and falls with pressure. Cross the thresholds and the same particles reorganise from lattice to liquid to gas.`;
  },
};
function titrationPH(v: number) {
  const molH = 0.025 * 0.1, molOH = (v / 1000) * 0.1, tot = 0.025 + v / 1000;
  const diff = (molH - molOH) / tot;
  if (Math.abs(diff) < 1e-9) return 7;
  return diff > 0 ? -Math.log10(diff) : 14 + Math.log10(-diff);
}

/* ================================================================== */
/*  7 · MATHEMATICS & LOGIC                                            */
/* ================================================================== */
const MMODES = ['Fractal', 'Surface', 'Probability', 'Calculus', 'Graph theory'];
export const math: Spec = {
  id: 'math', name: 'Mathematics & Logic', tag: 'Abstract made visible', accent: C.orchid, glyph: 'sigma', orbit: true,
  blurb: 'Zoom into the Mandelbrot set, warp a 3D surface, drop a thousand balls through a Galton board, or watch Riemann sums converge on an integral.',
  method: 'The fractal is a true escape-time computation (cached, recomputed only when parameters change). The Galton board is a physical binomial sampler. Riemann sums use the actual function f(x) = sin(x) + 0.3x with an analytic reference integral.',
  facts: ['The Mandelbrot boundary has Hausdorff dimension 2 — infinitely intricate.', 'A Galton board is the central limit theorem made of wood and brass.', 'Halving rectangle width roughly halves midpoint-rule error… squared.', 'Königsberg’s bridges founded graph theory: an Euler path needs 0 or 2 odd-degree nodes.'],
  ctrls: [
    { k: 'iter', label: 'Iterations', min: 20, max: 300, step: 10, def: 90 },
    { k: 'zoom', label: 'Fractal zoom', min: 0.4, max: 40, step: 0.2, def: 1 },
    { k: 'cx', label: 'Centre / param A', min: -2, max: 1, step: 0.005, def: -0.6 },
    { k: 'cy', label: 'Param B', min: -1.5, max: 1.5, step: 0.005, def: 0 },
    { k: 'n', label: 'Rectangles / nodes', min: 4, max: 120, step: 2, def: 16 },
    { k: 'amp', label: 'Surface amplitude', min: 0, max: 1.5, step: 0.05, def: 0.7 },
    { k: 'balls', label: 'Ball rate', min: 1, max: 60, step: 1, def: 20 },
  ],
  toggles: [{ k: 'labels', label: 'Labels', def: true }, { k: 'wire', label: 'Wireframe', def: true }, { k: 'theory', label: 'Theory curve', def: true }],
  choices: [{ k: 'mode', label: 'World', options: MMODES, def: 0 }, { k: 'surf', label: 'Surface', options: ['Saddle', 'Ripple', 'Torus wave'], def: 0 }],
  scenarios: [
    { name: 'Seahorse valley', note: 'Deep zoom into the boundary', set: { mode: 0, zoom: 26, cx: -0.745, cy: 0.113, iter: 220 } },
    { name: 'Julia breathing', note: 'Animated c parameter', set: { mode: 0, zoom: 1, cx: -0.8, cy: 0.156 } },
    { name: 'Central limit', note: 'Galton board → normal curve', set: { mode: 2, balls: 45, n: 24 } },
  ],
  make: () => ({ key: '', img: null as HTMLCanvasElement | null, bins: new Array(25).fill(0), drops: [] as { x: number; y: number; vx: number; r: number }[], total: 0, path: [] as number[] }),
  step(m, p, dt) {
    if (Math.round(p.mode) === 2) {
      if (Math.random() < dt * p.balls) m.drops.push({ x: 0, y: -1, vx: 0, r: 0 });
      m.drops.forEach((d: { y: number; x: number; vx: number; r: number }) => {
        d.y += dt * 1.6;
        const row = Math.floor((d.y + 1) * 6);
        if (row > d.r) { d.r = row; d.vx += (Math.random() < 0.5 ? -1 : 1) * 0.09; }
        d.x += d.vx * dt;
      });
      const landed = m.drops.filter((d: { y: number }) => d.y > 0.75);
      landed.forEach((d: { x: number }) => {
        const b = clamp(Math.round((d.x + 1) * 12), 0, 24);
        m.bins[b] += 1; m.total += 1;
      });
      m.drops = m.drops.filter((d: { y: number }) => d.y <= 0.75).slice(-200);
    }
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.orchid);
    const mode = Math.round(p.mode);
    if (mode === 0) {
      const key = `${p.iter}|${p.zoom}|${p.cx.toFixed(3)}|${p.cy.toFixed(3)}|${Math.round(e.w / 40)}`;
      if (m.key !== key) {
        m.key = key;
        const W = 200, H = Math.max(60, Math.round(200 * e.h / Math.max(1, e.w)));
        const cv = m.img ?? document.createElement('canvas');
        cv.width = W; cv.height = H;
        const c2 = cv.getContext('2d');
        if (c2) {
          const im = c2.createImageData(W, H);
          const sc = 3 / p.zoom;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const cr = p.cx + (x / W - 0.5) * sc * (W / H), ci = p.cy + (y / H - 0.5) * sc;
            let zr = 0, zi = 0, i = 0;
            while (zr * zr + zi * zi < 4 && i < p.iter) { const t = zr * zr - zi * zi + cr; zi = 2 * zr * zi + ci; zr = t; i++; }
            const t = i / p.iter;
            const idx = (y * W + x) * 4;
            if (i >= p.iter) { im.data[idx] = 12; im.data[idx + 1] = 12; im.data[idx + 2] = 10; }
            else {
              im.data[idx] = Math.round(lerp(23, 255, Math.pow(t, 0.4)));
              im.data[idx + 1] = Math.round(lerp(23, 240, Math.pow(t, 0.9)));
              im.data[idx + 2] = Math.round(lerp(19, 120, Math.pow(t, 2.2)));
            }
            im.data[idx + 3] = 255;
          }
          c2.putImageData(im, 0, 0);
          m.img = cv;
        }
      }
      if (m.img) ctx.drawImage(m.img, 0, 0, e.w, e.h);
      txt(ctx, `escape-time · ${p.iter} iterations · zoom ×${p.zoom.toFixed(1)}`, 14, e.h - 14, 10, C.ivory, 'left', 0.85);
    } else if (mode === 1) {
      grid3d(ctx, e, 6, 2.2, C.ivory, 0.05);
      const N = 26, S = Math.round(p.surf);
      for (let i = 0; i < N; i++) {
        ctx.strokeStyle = rgba(C.orchid, 0.5); ctx.lineWidth = 1; ctx.beginPath();
        for (let j = 0; j <= N; j++) {
          const x = (i / N - 0.5) * 4, z = (j / N - 0.5) * 4;
          const r = Math.hypot(x, z);
          const y = S === 0 ? (x * x - z * z) * 0.22 * p.amp : S === 1 ? Math.sin(r * 2.4 - e.t) * p.amp * 0.5 : Math.sin(Math.atan2(z, x) * 3 + e.t) * 0.3 * p.amp + (r - 1.2) * (r - 1.2) * 0.3;
          const q = proj(e.cam, e.w, e.h, x, y, z);
          j === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
      }
      txt(ctx, ['z = x² − y² (hyperbolic paraboloid)', 'z = sin(r − t) (radial wave)', 'toroidal harmonic'][S], 14, e.h - 14, 10.5, C.orchid, 'left', 0.9);
    } else if (mode === 2) {
      const cx = e.w / 2, top = 30, bw = e.w * 0.8;
      for (let r = 0; r < 10; r++) for (let k = 0; k <= r; k++) {
        dot(ctx, cx + (k - r / 2) * (bw / 12), top + r * ((e.h * 0.5) / 10), 2.6, rgba(C.ivory, 0.35), 0);
      }
      m.drops.forEach((d: { x: number; y: number }) => dot(ctx, cx + d.x * bw * 0.5, top + ((d.y + 1) / 1.75) * e.h * 0.55, 3.4, C.acid, 8));
      const maxB = Math.max(6, ...m.bins);
      m.bins.forEach((v: number, i: number) => {
        const x = cx + (i - 12) * (bw / 25), h = (v / maxB) * e.h * 0.26;
        ctx.fillStyle = rgba(C.orchid, 0.75);
        ctx.fillRect(x - bw / 55, e.h - 30 - h, bw / 30, h);
      });
      if (p.theory && m.total > 20) {
        ctx.strokeStyle = C.coral; ctx.lineWidth = 1.8; ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const mu = 12, sd = 2.45;
          const g = Math.exp(-Math.pow(i - mu, 2) / (2 * sd * sd));
          const x = cx + (i - 12) * (bw / 25), y = e.h - 30 - g * e.h * 0.26;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      txt(ctx, `${m.total} balls · binomial → normal`, 14, e.h - 12, 10, C.orchid, 'left', 0.85);
    } else if (mode === 3) {
      const bx = 50, bw = e.w - 100, by = e.h * 0.78, sx = bw / 6, sy = e.h * 0.28;
      const f = (x: number) => Math.sin(x) + 0.3 * x;
      seg(ctx, bx, by, bx + bw, by, rgba(C.ivory, 0.3), 1.2);
      const n = Math.round(p.n);
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const x0 = (i / n) * 6, xm = x0 + 3 / n;
        const h = f(xm); sum += h * (6 / n);
        ctx.fillStyle = rgba(C.orchid, 0.25); ctx.strokeStyle = rgba(C.orchid, 0.6);
        ctx.fillRect(bx + x0 * sx, by - h * sy, (6 / n) * sx - 1, h * sy);
        ctx.strokeRect(bx + x0 * sx, by - h * sy, (6 / n) * sx - 1, h * sy);
      }
      ctx.strokeStyle = C.acid; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x <= 6; x += 0.04) { const X = bx + x * sx, Y = by - f(x) * sy; x === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      ctx.stroke();
      const exact = 1 - Math.cos(6) + 0.15 * 36;
      txt(ctx, `Σ = ${sum.toFixed(4)}   exact = ${exact.toFixed(4)}   error = ${Math.abs(sum - exact).toExponential(2)}`, bx, 30, 11, C.acid, 'left', 0.95);
      txt(ctx, 'f(x) = sin x + 0.3x on [0, 6] — midpoint rule', bx, e.h - 16, 10, C.ivory, 'left', 0.6);
    } else {
      const n = clamp(Math.round(p.n / 8) + 4, 5, 18);
      const nodes = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * TAU - Math.PI / 2;
        return { x: e.w / 2 + Math.cos(a) * Math.min(e.w, e.h) * 0.33, y: e.h / 2 + Math.sin(a) * Math.min(e.w, e.h) * 0.33, d: 0 };
      });
      const edges: [number, number][] = [];
      for (let i = 0; i < n; i++) { edges.push([i, (i + 1) % n]); if (i % 3 === 0) edges.push([i, (i + 4) % n]); }
      edges.forEach(([a, b], i) => {
        const onPath = i % 4 === Math.floor(e.t) % 4;
        seg(ctx, nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, onPath ? C.acid : rgba(C.ivory, 0.2), onPath ? 2 : 1);
      });
      nodes.forEach((q, i) => {
        const deg = edges.filter(([a, b]) => a === i || b === i).length;
        dot(ctx, q.x, q.y, 9, deg % 2 ? C.coral : C.orchid, 10);
        if (p.labels) txt(ctx, `${deg}`, q.x, q.y + 3.5, 9, C.obsidian, 'center', 1);
      });
      const odd = nodes.filter((_, i) => edges.filter(([a, b]) => a === i || b === i).length % 2).length;
      txt(ctx, `${n} nodes · ${edges.length} edges · ${odd} odd-degree → Euler path ${odd === 0 || odd === 2 ? 'EXISTS' : 'IMPOSSIBLE'}`, 14, e.h - 14, 10.5, odd === 0 || odd === 2 ? C.acid : C.coral, 'left', 0.9);
    }
  },
  readouts: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 2) {
      const mean = m.total ? m.bins.reduce((a: number, v: number, i: number) => a + v * i, 0) / m.total : 0;
      const varr = m.total ? m.bins.reduce((a: number, v: number, i: number) => a + v * (i - mean) ** 2, 0) / m.total : 0;
      return [{ label: 'Balls dropped', value: `${m.total}`, tone: C.orchid }, { label: 'Mean bin', value: mean.toFixed(2) }, { label: 'Std deviation', value: Math.sqrt(varr).toFixed(2) }, { label: 'Theory σ', value: '2.45' }];
    }
    if (mode === 3) {
      const n = Math.round(p.n); let sum = 0;
      for (let i = 0; i < n; i++) sum += (Math.sin((i + 0.5) * 6 / n) + 0.3 * ((i + 0.5) * 6 / n)) * (6 / n);
      const exact = 1 - Math.cos(6) + 5.4;
      return [{ label: 'Riemann sum', value: sum.toFixed(5), tone: C.orchid }, { label: 'Exact integral', value: exact.toFixed(5) }, { label: 'Absolute error', value: Math.abs(sum - exact).toExponential(2), tone: C.acid }, { label: 'Rectangles', value: `${n}` }];
    }
    return [{ label: 'Iterations', value: `${p.iter}`, tone: C.orchid }, { label: 'Zoom', value: `×${p.zoom.toFixed(1)}` }, { label: 'Centre', value: `${p.cx.toFixed(3)}, ${p.cy.toFixed(3)}` }, { label: 'Mode', value: MMODES[mode] }];
  },
  series: (m, p) => Math.round(p.mode) === 2
    ? [{ label: 'Balls', color: C.orchid, v: m.total, max: Math.max(100, m.total) }, { label: 'Peak bin', color: C.acid, v: Math.max(...m.bins), max: Math.max(20, Math.max(...m.bins)) }]
    : [{ label: 'Iterations', color: C.orchid, v: p.iter, max: 300 }, { label: 'Zoom', color: C.acid, v: p.zoom, max: 40 }],
  explain: (_m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 0) return `Each pixel iterates z → z² + c. Points that never escape are inside the set (black). Colour shows how quickly the rest diverge — at ×${p.zoom.toFixed(1)} zoom the boundary keeps revealing new structure.`;
    if (mode === 1) return `A surface in three dimensions. The saddle has negative Gaussian curvature: it curves up in one direction and down in the other, which is why it cannot be flattened without distortion.`;
    if (mode === 2) return `Every peg is a fair coin flip. After ten rows the bin counts trace a binomial distribution — and with enough balls, the normal curve overlays it almost exactly.`;
    if (mode === 3) return `Midpoint rectangles approximate the area under sin x + 0.3x. Error falls roughly with 1/n² — double the rectangles and the error drops about fourfold.`;
    return `Euler’s theorem: a walk crossing every edge exactly once exists only if the graph has zero or two odd-degree vertices. Coral nodes are odd.`;
  },
};
