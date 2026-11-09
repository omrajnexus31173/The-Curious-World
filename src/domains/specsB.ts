import { C, TAU, arrow, bg, clamp, dot, grid2d, hash, lerp, poly, rgba, seg, txt, type Spec } from '../sim/engine';

/* ================================================================== */
/*  8 · GENETICS & DNA                                                 */
/* ================================================================== */
const BASES = 'TCAG';
const AA_TABLE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
const AA_NAME: Record<string, string> = { F: 'Phe', L: 'Leu', S: 'Ser', Y: 'Tyr', '*': 'STOP', C: 'Cys', W: 'Trp', P: 'Pro', H: 'His', Q: 'Gln', R: 'Arg', I: 'Ile', M: 'Met', T: 'Thr', N: 'Asn', K: 'Lys', V: 'Val', A: 'Ala', D: 'Asp', E: 'Glu', G: 'Gly' };
const COMP: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };
const translate = (seq: string) => {
  const out: string[] = [];
  for (let i = 0; i + 2 < seq.length; i += 3) {
    const c = seq.slice(i, i + 3);
    const idx = BASES.indexOf(c[0]) * 16 + BASES.indexOf(c[1]) * 4 + BASES.indexOf(c[2]);
    const aa = AA_TABLE[idx] ?? 'X';
    out.push(aa);
    if (aa === '*') break;
  }
  return out;
};
const GMODES = ['Replication', 'Transcription', 'Translation', 'Inheritance'];
const baseColor = (b: string) => b === 'A' ? C.acid : b === 'T' ? C.coral : b === 'C' ? C.lav : C.amber;

export const genetics: Spec = {
  id: 'genetics', name: 'Genetics & DNA', tag: 'Molecular information flow', accent: C.orchid, glyph: 'helix', orbit: true,
  blurb: 'A real genetic code runs here: unzip the helix, transcribe messenger RNA, then translate codons into an amino-acid chain using the standard codon table.',
  method: 'Translation uses the complete standard genetic code (NCBI table 1). Complementarity, codon reading frame and stop codons are exact; polymerase speed, mutation timing and molecular geometry are simplified for legibility.',
  facts: ['64 codons encode 20 amino acids plus stop — the code is redundant, not ambiguous.', 'DNA polymerase makes roughly one error per 10⁹ bases after proofreading.', 'A single base change can be silent, missense or nonsense depending on the codon.', 'Transcription copies DNA to RNA; translation reads RNA three bases at a time.'],
  ctrls: [
    { k: 'speed', label: 'Polymerase speed', min: 0.2, max: 6, step: 0.1, def: 1.6 },
    { k: 'mut', label: 'Mutation rate', min: 0, max: 1, step: 0.01, def: 0.08 },
    { k: 'unzip', label: 'Fork opening', min: 0, max: 1, step: 0.02, def: 0.5 },
    { k: 'twist', label: 'Helix twist', min: 1.5, max: 5, step: 0.1, def: 3 },
    { k: 'gen', label: 'Offspring sampled', min: 4, max: 64, step: 4, def: 16 },
    { k: 'zoomh', label: 'Molecular zoom', min: 0.5, max: 2, step: 0.05, def: 1 },
  ],
  toggles: [{ k: 'labels', label: 'Base labels', def: true }, { k: 'bonds', label: 'H-bonds', def: true }, { k: 'protein', label: 'Fold protein', def: true }],
  choices: [{ k: 'mode', label: 'Process', options: GMODES, def: 0 }, { k: 'allele', label: 'Parental cross', options: ['Aa × Aa', 'AA × aa', 'Aa × aa'], def: 0 }],
  actions: [{ id: 'mutate', label: 'Induce point mutation', tone: C.coral }],
  scenarios: [
    { name: 'Faithful copy', note: 'No mutations, fast fork', set: { mode: 0, mut: 0, speed: 3 } },
    { name: 'Protein synthesis', note: 'Watch codons become amino acids', set: { mode: 2, speed: 1.2, protein: 1 } },
    { name: 'Mendelian cross', note: 'Aa × Aa → 3:1 phenotype ratio', set: { mode: 3, allele: 0, gen: 64 } },
  ],
  make: () => {
    let s = 'ATG';
    for (let i = 0; i < 57; i++) s += BASES[Math.floor(Math.random() * 4)];
    return { seq: s, orig: s, pos: 0, rot: 0, mutations: 0, offspring: [] as string[], chain: [] as string[] };
  },
  step(m, p, dt) {
    m.rot += dt * 0.5;
    m.pos = (m.pos + dt * p.speed * 3) % 57;
    if (p.mut > 0 && Math.random() < dt * p.mut * 1.2) {
      const i = 3 + Math.floor(Math.random() * 54);
      m.seq = m.seq.slice(0, i) + BASES[Math.floor(Math.random() * 4)] + m.seq.slice(i + 1);
      m.mutations += 1;
    }
    m.chain = translate(m.seq);
  },
  onAction(a, m) {
    if (a !== 'mutate') return;
    const i = 3 + Math.floor(Math.random() * 54);
    m.seq = m.seq.slice(0, i) + BASES[Math.floor(Math.random() * 4)] + m.seq.slice(i + 1);
    m.mutations += 1;
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.orchid);
    const mode = Math.round(p.mode);
    if (mode <= 1) {
      const cx = e.w / 2, H = e.h * 0.8, S = Math.min(e.w, e.h) * 0.16 * p.zoomh;
      const n = 48;
      for (let i = 0; i < n; i++) {
        const t = i / n, y = e.h * 0.1 + t * H;
        const a = t * p.twist * TAU + m.rot;
        const fork = mode === 0 ? clamp((t - m.pos / 57) * 4, 0, 1) * p.unzip : clamp(1 - Math.abs(t - m.pos / 57) * 6, 0, 1) * p.unzip;
        const sep = 1 + fork * 2.2;
        const b = m.seq[i % m.seq.length];
        const x1 = cx + Math.sin(a) * S * sep, x2 = cx + Math.sin(a + Math.PI) * S * sep;
        const z1 = Math.cos(a), z2 = Math.cos(a + Math.PI);
        if (p.bonds && fork < 0.3) seg(ctx, x1, y, x2, y, rgba(C.ivory, 0.18), 1);
        dot(ctx, x1, y, 4 + z1 * 1.6, baseColor(b), 6);
        dot(ctx, x2, y, 4 + z2 * 1.6, baseColor(mode === 1 && fork > 0.3 ? (b === 'T' ? 'U' : COMP[b]) : COMP[b]), 6);
        if (p.labels && i % 3 === 0) {
          txt(ctx, b, x1 + 8, y + 3, 8.5, baseColor(b), 'left', 0.75);
          txt(ctx, COMP[b], x2 - 8, y + 3, 8.5, baseColor(COMP[b]), 'right', 0.75);
        }
      }
      const fy = e.h * 0.1 + (m.pos / 57) * H;
      ctx.strokeStyle = rgba(C.acid, 0.6); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(cx, fy, S * 3.4, 16, 0, 0, TAU); ctx.stroke();
      txt(ctx, mode === 0 ? 'DNA polymerase — replication fork' : 'RNA polymerase — transcription bubble', cx, fy - 24, 10, C.acid, 'center', 0.9);
      txt(ctx, `template 5′-${m.seq.slice(0, 24)}…-3′`, 14, e.h - 14, 9.5, C.ivory, 'left', 0.55);
    } else if (mode === 2) {
      const codons = Math.floor(m.seq.length / 3);
      const active = Math.floor(m.pos / 3) % codons;
      for (let i = 0; i < codons; i++) {
        const x = 30 + (i % 10) * ((e.w - 60) / 10), y = 60 + Math.floor(i / 10) * 44;
        const cod = m.seq.slice(i * 3, i * 3 + 3);
        const idx = BASES.indexOf(cod[0]) * 16 + BASES.indexOf(cod[1]) * 4 + BASES.indexOf(cod[2]);
        const aa = AA_TABLE[idx];
        const on = i === active, done = i < active;
        ctx.fillStyle = on ? rgba(C.acid, 0.2) : done ? rgba(C.orchid, 0.12) : rgba(C.ivory, 0.04);
        ctx.strokeStyle = on ? C.acid : rgba(C.ivory, 0.15); ctx.lineWidth = on ? 1.6 : 1;
        ctx.fillRect(x - 2, y - 14, 52, 34); ctx.strokeRect(x - 2, y - 14, 52, 34);
        txt(ctx, cod, x + 24, y - 2, 10, C.ivory, 'center', 0.85);
        txt(ctx, AA_NAME[aa] ?? '?', x + 24, y + 13, 9.5, aa === '*' ? C.coral : C.orchid, 'center', 0.95);
      }
      if (p.protein) {
        const chain: string[] = (m.chain as string[]).filter((a: string) => a !== '*');
        ctx.strokeStyle = rgba(C.acid, 0.5); ctx.lineWidth = 2; ctx.beginPath();
        chain.forEach((_aa: string, i: number) => {
          const a = i * 0.7 + e.t * 0.3;
          const x = e.w / 2 + Math.cos(a) * (40 + i * 3) * 0.6, y = e.h - 70 + Math.sin(a * 1.3) * 22;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        chain.forEach((aa: string, i: number) => {
          const a = i * 0.7 + e.t * 0.3;
          dot(ctx, e.w / 2 + Math.cos(a) * (40 + i * 3) * 0.6, e.h - 70 + Math.sin(a * 1.3) * 22, 5, aa === 'M' ? C.acid : C.orchid, 6);
        });
        txt(ctx, `polypeptide · ${chain.length} residues`, 14, e.h - 14, 10, C.acid, 'left', 0.85);
      }
    } else {
      const cross = Math.round(p.allele);
      const parents = [['A', 'a'], ['A', 'A'], ['A', 'a']][cross];
      const other = [['A', 'a'], ['a', 'a'], ['a', 'a']][cross];
      const bx = e.w * 0.12, by = e.h * 0.22, cell = Math.min(e.w * 0.2, 90);
      txt(ctx, 'Punnett square', bx, by - 30, 12, C.orchid, 'left', 0.9);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const g = [parents[i], other[j]].sort().reverse().join('');
        const dom = g.includes('A');
        ctx.fillStyle = rgba(dom ? C.acid : C.coral, 0.18);
        ctx.strokeStyle = rgba(dom ? C.acid : C.coral, 0.6); ctx.lineWidth = 1.2;
        ctx.fillRect(bx + j * cell, by + i * cell, cell - 4, cell - 4);
        ctx.strokeRect(bx + j * cell, by + i * cell, cell - 4, cell - 4);
        txt(ctx, g, bx + j * cell + cell / 2 - 2, by + i * cell + cell / 2, 18, dom ? C.acid : C.coral, 'center', 1);
      }
      txt(ctx, `${parents.join('')} × ${other.join('')}`, bx, by + cell * 2 + 24, 11, C.ivory, 'left', 0.7);
      const n = Math.round(p.gen);
      const counts = { dom: 0, rec: 0 };
      for (let i = 0; i < n; i++) {
        const g = parents[Math.floor(hash(i * 3 + 1) * 2)] + other[Math.floor(hash(i * 7 + 2) * 2)];
        const dom = g.includes('A');
        dom ? counts.dom++ : counts.rec++;
        const x = e.w * 0.6 + (i % 8) * 26, y = e.h * 0.24 + Math.floor(i / 8) * 26;
        dot(ctx, x, y, 8, dom ? C.acid : C.coral, 6);
      }
      txt(ctx, `${n} offspring · ${counts.dom} dominant : ${counts.rec} recessive`, e.w * 0.6, e.h - 24, 10.5, C.orchid, 'left', 0.9);
    }
  },
  readouts: (m, p) => {
    const chain = translate(m.seq);
    const orig = translate(m.orig);
    const changed = chain.filter((a, i) => a !== orig[i]).length;
    return [
      { label: 'Process', value: GMODES[Math.round(p.mode)], tone: C.orchid },
      { label: 'Bases', value: `${m.seq.length} nt` },
      { label: 'Residues', value: `${chain.filter((a) => a !== '*').length} aa` },
      { label: 'Mutations', value: `${m.mutations}`, tone: m.mutations ? C.coral : C.ivory },
      { label: 'Protein changes', value: `${changed}`, tone: changed ? C.coral : C.acid },
      { label: 'Stop codon', value: chain.includes('*') ? 'present' : 'read-through' },
    ];
  },
  series: (m) => [{ label: 'Mutations', color: C.coral, v: m.mutations, max: Math.max(10, m.mutations) }, { label: 'Residues', color: C.acid, v: translate(m.seq).length, max: 20 }],
  explain: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 0) return `The fork opens and each strand templates a new partner: A pairs T, C pairs G. Because the strands are antiparallel, one is copied continuously and the other in fragments.`;
    if (mode === 1) return `RNA polymerase reads the template and builds messenger RNA — identical to the coding strand except uracil replaces thymine.`;
    const chain = translate(m.seq);
    return `Ribosome reads codon ${Math.floor(m.pos / 3) + 1}: ${m.seq.slice(Math.floor(m.pos / 3) * 3, Math.floor(m.pos / 3) * 3 + 3)} → ${AA_NAME[chain[Math.floor(m.pos / 3)] ?? 0] ?? '—'}. ${m.mutations} mutation(s) introduced; the redundancy of the code means many base changes are silent.`;
  },
};

/* ================================================================== */
/*  9 · EVOLUTION & BIOLOGY                                            */
/* ================================================================== */
export const evolution: Spec = {
  id: 'evolution', name: 'Evolution & Biology', tag: 'Selection in real time', accent: C.mint, glyph: 'leaf', orbit: false,
  blurb: 'A population under real selection pressure. Predators remove the most visible individuals, survivors breed with mutation, and allele frequencies shift generation by generation.',
  method: 'Selection is fitness-proportional culling on a single heritable trait with Gaussian mutation. The response follows the breeder’s equation R = h²S qualitatively. Cell and photosynthesis views are schematic, not to scale.',
  facts: ['Natural selection needs variation, heritability and differential survival — all three.', 'Response to selection R = h²S: heritability times the selection differential.', 'Photosynthesis saturates: beyond a point, more light adds nothing.', 'Roughly 99% of all species that ever lived are extinct.'],
  ctrls: [
    { k: 'env', label: 'Environment tone', min: 0, max: 1, step: 0.01, def: 0.3 },
    { k: 'press', label: 'Predation pressure', min: 0, max: 1, step: 0.02, def: 0.5 },
    { k: 'mut', label: 'Mutation spread', min: 0, max: 0.3, step: 0.005, def: 0.06 },
    { k: 'pop', label: 'Population cap', min: 20, max: 200, step: 10, def: 90 },
    { k: 'genrate', label: 'Generations / s', min: 0.1, max: 3, step: 0.1, def: 0.6 },
    { k: 'light', label: 'Light (cell view)', min: 0, max: 1, step: 0.02, def: 0.6 },
  ],
  toggles: [{ k: 'pred', label: 'Show predators', def: true }, { k: 'hist', label: 'Trait histogram', def: true }, { k: 'cell', label: 'Cell view', def: false }],
  choices: [{ k: 'view', label: 'Lens', options: ['Population', 'Cell & photosynthesis'], def: 0 }],
  scenarios: [
    { name: 'Sudden darkening', note: 'Environment shifts — watch adaptation', set: { env: 0.85, press: 0.8, mut: 0.06 } },
    { name: 'No selection', note: 'Drift only — traits wander', set: { press: 0, mut: 0.1 } },
    { name: 'Tight selection', note: 'Low mutation, strong predation', set: { press: 0.95, mut: 0.01 } },
  ],
  make: () => ({ agents: Array.from({ length: 90 }, (_, i) => ({ t: hash(i), x: hash(i + 5), y: hash(i + 9), alive: true })), gen: 0, acc: 0, mean: 0.5, history: [] as number[], predX: 0 }),
  step(m, p, dt) {
    if (Math.round(p.view) === 1) return;
    m.predX = (m.predX + dt * 0.3) % 1;
    m.acc += dt * p.genrate;
    if (m.acc < 1) return;
    m.acc = 0;
    m.gen += 1;
    const scored = m.agents.map((a: { t: number }) => ({ a, fit: 1 - Math.abs(a.t - p.env) * p.press * 1.6 }));
    scored.sort((x: { fit: number }, y: { fit: number }) => y.fit - x.fit);
    const survivors = scored.slice(0, Math.max(4, Math.floor(scored.length * (1 - p.press * 0.6)))).map((s: { a: unknown }) => s.a);
    const next: { t: number; x: number; y: number; alive: boolean }[] = [];
    const cap = Math.round(p.pop);
    for (let i = 0; i < cap; i++) {
      const par = survivors[i % survivors.length] as { t: number };
      next.push({ t: clamp(par.t + (Math.random() - 0.5) * p.mut * 2, 0, 1), x: Math.random(), y: Math.random(), alive: true });
    }
    m.agents = next;
    m.mean = next.reduce((s, a) => s + a.t, 0) / next.length;
    m.history.push(m.mean);
    if (m.history.length > 120) m.history.shift();
  },
  draw(ctx, m, p, e) {
    const envCol = `rgb(${Math.round(lerp(38, 96, p.env))},${Math.round(lerp(40, 78, p.env))},${Math.round(lerp(32, 52, p.env))})`;
    ctx.fillStyle = envCol; ctx.fillRect(0, 0, e.w, e.h);
    bg(ctx, e, C.mint, envCol);
    if (Math.round(p.view) === 1) {
      const cx = e.w / 2, cy = e.h / 2, R = Math.min(e.w, e.h) * 0.3;
      ctx.fillStyle = rgba(C.mint, 0.09); ctx.strokeStyle = rgba(C.mint, 0.6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.3, R, 0, 0, TAU); ctx.fill(); ctx.stroke();
      dot(ctx, cx - R * 0.2, cy, R * 0.32, rgba(C.lav, 0.5), 14);
      txt(ctx, 'nucleus', cx - R * 0.2, cy + 4, 9, C.ivory, 'center', 0.8);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU + e.t * 0.1;
        const x = cx + Math.cos(a) * R * 0.85, y = cy + Math.sin(a) * R * 0.62;
        ctx.fillStyle = rgba(C.acid, 0.35 + p.light * 0.5); ctx.strokeStyle = rgba(C.acid, 0.7);
        ctx.beginPath(); ctx.ellipse(x, y, 17, 9, a, 0, TAU); ctx.fill(); ctx.stroke();
        if (p.light > 0.05) for (let k = 0; k < 3; k++) {
          const t = (e.t * p.light + k / 3) % 1;
          dot(ctx, x + (cx - x) * t, y + (cy - y) * t - 30 * (1 - t), 2, C.amber, 6);
        }
      }
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU + 1;
        ctx.strokeStyle = rgba(C.coral, 0.6); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.4, 13, 6, a, 0, TAU); ctx.stroke();
      }
      const rate = p.light / (p.light + 0.25);
      txt(ctx, `chloroplasts · light-limited rate ${(rate * 100).toFixed(0)}% of maximum`, 14, e.h - 14, 10.5, C.acid, 'left', 0.9);
      txt(ctx, 'mitochondria', cx + R * 0.55, cy - R * 0.5, 9, C.coral, 'center', 0.7);
      return;
    }
    m.agents.forEach((a: { t: number; x: number; y: number }) => {
      const x = a.x * e.w, y = a.y * e.h * 0.82 + 20;
      const v = Math.round(lerp(38, 210, a.t));
      dot(ctx, x, y, 6, `rgb(${v},${Math.round(v * 0.9)},${Math.round(v * 0.6)})`, 0);
    });
    if (p.pred) {
      const px = m.predX * e.w;
      poly(ctx, [{ x: px, y: 30 }, { x: px - 14, y: 8 }, { x: px + 14, y: 8 }], rgba(C.coral, 0.85));
      seg(ctx, px, 30, px, e.h * 0.85, rgba(C.coral, 0.12), 24);
    }
    if (p.hist) {
      const bins = new Array(20).fill(0);
      m.agents.forEach((a: { t: number }) => { bins[clamp(Math.floor(a.t * 20), 0, 19)] += 1; });
      const mx = Math.max(1, ...bins);
      bins.forEach((v, i) => {
        const h = (v / mx) * 54;
        ctx.fillStyle = rgba(C.acid, 0.6);
        ctx.fillRect(14 + i * ((e.w - 28) / 20), e.h - 14 - h, (e.w - 28) / 20 - 2, h);
      });
      const ex = 14 + p.env * (e.w - 28);
      seg(ctx, ex, e.h - 74, ex, e.h - 10, C.coral, 2, 0.9);
      txt(ctx, 'optimum', ex + 5, e.h - 66, 9, C.coral, 'left', 0.9);
    }
    txt(ctx, `generation ${m.gen} · mean trait ${m.mean.toFixed(3)}`, 14, 24, 11, C.mint, 'left', 0.9);
  },
  readouts: (m, p) => [
    { label: 'Generation', value: `${m.gen}`, tone: C.mint },
    { label: 'Mean trait', value: m.mean.toFixed(3) },
    { label: 'Optimum', value: p.env.toFixed(2) },
    { label: 'Mismatch', value: Math.abs(m.mean - p.env).toFixed(3), tone: Math.abs(m.mean - p.env) > 0.2 ? C.coral : C.acid },
    { label: 'Population', value: `${m.agents.length}` },
    { label: 'Selection', value: `${(p.press * 100).toFixed(0)}%` },
  ],
  series: (m, p) => [{ label: 'Mean trait', color: C.acid, v: m.mean, max: 1 }, { label: 'Optimum', color: C.coral, v: p.env, max: 1 }],
  explain: (m, p) => Math.round(p.view) === 1
    ? `A plant cell at ${(p.light * 100).toFixed(0)}% light. Photosynthesis follows a saturating curve — chloroplasts can only process photons as fast as their enzymes allow, so doubling bright light does not double output.`
    : `Generation ${m.gen}. Predators take the most conspicuous individuals, so the survivors' average trait (${m.mean.toFixed(3)}) is pulled toward the environment optimum (${p.env.toFixed(2)}). Mutation spread ${p.mut.toFixed(3)} keeps supplying the variation selection needs.`,
};

/* ================================================================== */
/*  10 · ANIMAL KINGDOM                                                */
/* ================================================================== */
const SPECIES = ['Cheetah', 'Horse', 'Albatross', 'Tuna'];
export const animals: Spec = {
  id: 'animals', name: 'Animal Kingdom', tag: 'Locomotion & flight', accent: C.gold, glyph: 'compass', orbit: false,
  blurb: 'Gait transitions, wing loading and drag, computed live. Push a runner past its Froude threshold and it changes gait; load a wing too heavily and it cannot stay airborne.',
  method: 'Gait selection uses the Froude number Fr = v²/(gL) with walk→trot near 0.5 and trot→gallop near 2.5. Flight uses L = ½ρv²SC_L with C_L rising linearly to stall. Limb kinematics are procedural, not motion-captured.',
  facts: ['Animals of very different sizes change gait at similar Froude numbers.', 'Wing loading (mass ÷ wing area) sets minimum flight speed.', 'A cheetah’s spine flexes to add stride length — up to 7 m per stride.', 'Tuna are regionally endothermic: they keep swimming muscle warmer than the sea.'],
  ctrls: [
    { k: 'speed', label: 'Speed', min: 0.2, max: 32, step: 0.2, def: 8, unit: ' m/s' },
    { k: 'mass', label: 'Body mass', min: 1, max: 500, step: 1, def: 50, unit: ' kg' },
    { k: 'leg', label: 'Limb length', min: 0.3, max: 1.6, step: 0.05, def: 0.9, unit: ' m' },
    { k: 'span', label: 'Wing area', min: 0.1, max: 3, step: 0.05, def: 0.7, unit: ' m²' },
    { k: 'flap', label: 'Flap rate', min: 0.2, max: 8, step: 0.1, def: 2, unit: ' Hz' },
    { k: 'camo', label: 'Camouflage', min: 0, max: 1, step: 0.02, def: 0.5 },
  ],
  toggles: [{ k: 'skel', label: 'Skeleton', def: true }, { k: 'forces', label: 'Force vectors', def: true }, { k: 'trail', label: 'Motion trail', def: true }],
  choices: [{ k: 'sp', label: 'Species', options: SPECIES, def: 0 }],
  scenarios: [
    { name: 'Cheetah sprint', note: '29 m/s — full gallop, spine flexing', set: { sp: 0, speed: 29, mass: 50, leg: 0.9 } },
    { name: 'Albatross soaring', note: 'Huge wing area, almost no flapping', set: { sp: 2, span: 0.7, flap: 0.3, mass: 9, speed: 16 } },
    { name: 'Heavy load stall', note: 'Too much mass for the wing', set: { sp: 2, mass: 40, span: 0.25, speed: 8 } },
  ],
  make: () => ({ phase: 0, x: 0, alt: 0.5, trail: [] as number[][] }),
  step(m, p, dt) {
    const sp = Math.round(p.sp);
    const fr = (p.speed * p.speed) / (9.81 * p.leg);
    const stride = sp === 0 ? (fr < 0.5 ? 1.2 : fr < 2.5 ? 2.4 : 3.4) : 2;
    m.phase += dt * (p.speed / Math.max(0.4, p.leg * stride)) * (sp >= 2 ? p.flap * 0.5 : 1);
    m.x = (m.x + dt * p.speed * 0.02) % 1;
    if (sp === 2) {
      const cl = clamp(0.2 + p.flap * 0.25, 0.1, 1.6);
      const lift = 0.5 * 1.225 * p.speed * p.speed * p.span * cl;
      m.alt = clamp(m.alt + (lift / (p.mass * 9.81) - 1) * dt * 0.3, 0.02, 0.98);
    }
    m.trail.push([m.x, m.alt]);
    if (m.trail.length > 90) m.trail.shift();
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.gold);
    const sp = Math.round(p.sp);
    const ground = e.h * 0.78;
    if (sp < 2) {
      seg(ctx, 0, ground, e.w, ground, rgba(C.ivory, 0.25), 1.5);
      for (let i = 0; i < 22; i++) seg(ctx, ((i / 22 + m.x) % 1) * e.w, ground, ((i / 22 + m.x) % 1) * e.w - 12, ground + 10, rgba(C.ivory, 0.08), 1);
    } else if (sp === 3) {
      for (let i = 0; i < 12; i++) seg(ctx, 0, (i / 12) * e.h, e.w, (i / 12) * e.h + Math.sin(e.t + i) * 6, rgba(C.sky, 0.06), 10);
    } else {
      for (let i = 0; i < 6; i++) dot(ctx, ((i / 6 + e.t * 0.02) % 1) * e.w, 40 + i * 24, 26, rgba(C.ivory, 0.05), 0);
    }
    const fr = (p.speed * p.speed) / (9.81 * p.leg);
    const gait = sp >= 2 ? '' : fr < 0.5 ? 'WALK' : fr < 2.5 ? 'TROT' : 'GALLOP';
    const cx = e.w * 0.5, cy = sp === 2 ? e.h * (1 - m.alt) : sp === 3 ? e.h * 0.5 : ground - 40 - p.leg * 22;
    const bodyLen = 70 + p.mass * 0.12;
    const vis = clamp(1 - p.camo * 0.85, 0.15, 1);
    ctx.globalAlpha = vis;
    if (sp <= 1) {
      const flex = sp === 0 && fr > 2.5 ? Math.sin(m.phase * 2) * 12 : 0;
      ctx.strokeStyle = C.gold; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - bodyLen / 2, cy); ctx.quadraticCurveTo(cx, cy - flex, cx + bodyLen / 2, cy); ctx.stroke();
      dot(ctx, cx + bodyLen / 2 + 10, cy - 6, 9, C.gold, 0);
      for (let l = 0; l < 4; l++) {
        const front = l < 2, side = l % 2;
        const off = front ? bodyLen * 0.34 : -bodyLen * 0.34;
        const ph = m.phase * TAU + (front ? 0 : Math.PI) + side * (fr < 0.5 ? Math.PI : 0.5);
        const kneeX = cx + off + Math.cos(ph) * 14;
        const kneeY = cy + 20 + Math.abs(Math.sin(ph)) * 4;
        const footX = kneeX + Math.cos(ph) * 16;
        const footY = Math.min(ground, kneeY + 22 - Math.max(0, Math.sin(ph)) * 14);
        if (p.skel) { seg(ctx, cx + off, cy, kneeX, kneeY, rgba(C.ivory, 0.75), 2.4); seg(ctx, kneeX, kneeY, footX, footY, rgba(C.ivory, 0.75), 2.4); }
        else { seg(ctx, cx + off, cy, footX, footY, C.gold, 5); }
        dot(ctx, footX, footY, 3, C.acid, 6);
      }
      if (p.skel) { seg(ctx, cx - bodyLen / 2, cy, cx + bodyLen / 2, cy, rgba(C.ivory, 0.6), 2); }
    } else if (sp === 2) {
      const flap = Math.sin(m.phase * TAU) * 0.5 * clamp(p.flap / 3, 0.1, 1);
      ctx.strokeStyle = C.gold; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(cx - 70, cy + flap * 40); ctx.quadraticCurveTo(cx, cy - 12, cx + 70, cy + flap * 40); ctx.stroke();
      dot(ctx, cx, cy, 11, C.gold, 8);
      if (p.forces) {
        const cl = clamp(0.2 + p.flap * 0.25, 0.1, 1.6);
        const lift = 0.5 * 1.225 * p.speed * p.speed * p.span * cl;
        arrow(ctx, cx, cy, cx, cy - clamp(lift / (p.mass * 9.81), 0, 2) * 50, C.acid, 2);
        arrow(ctx, cx, cy, cx, cy + 50, C.coral, 2);
        arrow(ctx, cx, cy, cx - 40, cy, C.lav, 1.6);
      }
    } else {
      const wag = Math.sin(m.phase * TAU) * 12;
      ctx.fillStyle = C.sky;
      ctx.beginPath(); ctx.ellipse(cx, cy, 52, 16, 0, 0, TAU); ctx.fill();
      poly(ctx, [{ x: cx - 50, y: cy }, { x: cx - 76, y: cy - 16 + wag }, { x: cx - 76, y: cy + 16 + wag }], rgba(C.sky, 0.8));
      if (p.forces) arrow(ctx, cx + 40, cy, cx + 90, cy, C.acid, 2);
    }
    ctx.globalAlpha = 1;
    if (p.trail) { ctx.strokeStyle = rgba(C.acid, 0.25); ctx.lineWidth = 1.4; ctx.beginPath(); m.trail.forEach((q: number[], i: number) => { const X = q[0] * e.w, Y = sp === 2 ? e.h * (1 - q[1]) : cy; i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }); ctx.stroke(); }
    grid2d(ctx, e, 70, C.ivory, 0.02);
    txt(ctx, `${SPECIES[sp]}${gait ? ` · ${gait}` : ''} · Fr ${fr.toFixed(2)}`, 14, e.h - 14, 11, C.gold, 'left', 0.9);
  },
  readouts: (_m, p) => {
    const fr = (p.speed * p.speed) / (9.81 * p.leg);
    const cl = clamp(0.2 + p.flap * 0.25, 0.1, 1.6);
    const lift = 0.5 * 1.225 * p.speed * p.speed * p.span * cl;
    return [
      { label: 'Speed', value: `${p.speed.toFixed(1)} m/s`, tone: C.gold },
      { label: 'Froude number', value: fr.toFixed(2) },
      { label: 'Gait', value: Math.round(p.sp) >= 2 ? '—' : fr < 0.5 ? 'Walk' : fr < 2.5 ? 'Trot' : 'Gallop', tone: C.acid },
      { label: 'Wing loading', value: `${(p.mass / p.span).toFixed(1)} kg/m²` },
      { label: 'Lift / weight', value: `${(lift / (p.mass * 9.81)).toFixed(2)}`, tone: lift < p.mass * 9.81 ? C.coral : C.acid },
      { label: 'Altitude trend', value: Math.round(p.sp) === 2 ? (lift > p.mass * 9.81 ? 'Climbing' : 'Sinking') : '—' },
    ];
  },
  series: (m, p) => [{ label: 'Froude', color: C.gold, v: (p.speed * p.speed) / (9.81 * p.leg), max: 10 }, { label: 'Altitude', color: C.acid, v: m.alt, max: 1 }],
  explain: (_m, p) => {
    const sp = Math.round(p.sp);
    const fr = (p.speed * p.speed) / (9.81 * p.leg);
    if (sp <= 1) return `At Fr = ${fr.toFixed(2)} the animal ${fr < 0.5 ? 'walks — at least one foot is always grounded' : fr < 2.5 ? 'trots — diagonal limb pairs move together' : 'gallops — a flight phase appears between strides'}. The threshold is dimensionless, so it holds for mice and horses alike.`;
    if (sp === 2) {
      const cl = clamp(0.2 + p.flap * 0.25, 0.1, 1.6);
      const lift = 0.5 * 1.225 * p.speed * p.speed * p.span * cl;
      return lift > p.mass * 9.81 ? `Lift (${lift.toFixed(0)} N) exceeds weight (${(p.mass * 9.81).toFixed(0)} N) — climbing. Albatrosses achieve this with almost no flapping by harvesting wind gradients.` : `Lift (${lift.toFixed(0)} N) is below weight (${(p.mass * 9.81).toFixed(0)} N) — the bird sinks. More airspeed or wing area is the only way out.`;
    }
    return `Tuna generate thrust with a stiff, high-aspect-ratio tail. Body undulation is confined to the rear third — the rest stays rigid for efficiency at cruising speed.`;
  },
};

/* ================================================================== */
/*  11 · PLANT WORLD                                                   */
/* ================================================================== */
export const plants: Spec = {
  id: 'plants', name: 'Plant World', tag: 'Growth from seed to seed', accent: C.mint, glyph: 'leaf', orbit: false,
  blurb: 'Germinate a seed and run its life on accelerated time. Growth is limited by whichever resource is scarcest — light, water, nitrogen or temperature.',
  method: 'Biomass follows logistic growth scaled by Liebig’s law of the minimum across four resources. Photosynthesis uses a saturating light response; transpiration drives the xylem column. Stage thresholds are illustrative.',
  facts: ['Liebig’s law: growth is capped by the scarcest resource, not the average.', 'Water is pulled up the xylem by evaporation — a passive tension chain.', 'A single sunflower head can hold 2,000 seeds in Fibonacci spirals.', 'Stomata close under water stress, trading CO₂ intake for survival.'],
  ctrls: [
    { k: 'light', label: 'Light intensity', min: 0, max: 1, step: 0.02, def: 0.7 },
    { k: 'water', label: 'Soil water', min: 0, max: 1, step: 0.02, def: 0.6 },
    { k: 'nut', label: 'Nitrogen', min: 0, max: 1, step: 0.02, def: 0.5 },
    { k: 'temp', label: 'Temperature', min: 0, max: 45, step: 0.5, def: 22, unit: ' °C' },
    { k: 'days', label: 'Days per second', min: 0.5, max: 30, step: 0.5, def: 6 },
    { k: 'co2', label: 'CO₂', min: 200, max: 1000, step: 10, def: 420, unit: ' ppm' },
  ],
  toggles: [{ k: 'roots', label: 'Root system', def: true }, { k: 'xylem', label: 'Water column', def: true }, { k: 'stomata', label: 'Gas exchange', def: true }, { k: 'labels', label: 'Stage labels', def: true }],
  actions: [{ id: 'seed', label: 'Plant new seed', tone: C.mint }, { id: 'harvest', label: 'Harvest', tone: C.amber }],
  scenarios: [
    { name: 'Ideal season', note: 'Everything near optimum', set: { light: 0.85, water: 0.7, nut: 0.7, temp: 24 } },
    { name: 'Drought', note: 'Water is the limiting factor', set: { water: 0.12, light: 0.9, temp: 34 } },
    { name: 'Deep shade', note: 'Light-limited under a canopy', set: { light: 0.12, water: 0.8, nut: 0.8 } },
  ],
  make: () => ({ day: 0, mass: 0.01, seed: 1, harvested: 0, branches: [] as number[] }),
  step(m, p, dt) {
    m.day += dt * p.days;
    const tOpt = 1 - Math.pow((p.temp - 24) / 24, 2);
    const photo = p.light / (p.light + 0.22);
    const co2f = clamp(p.co2 / 420, 0.3, 1.6);
    const limit = Math.min(photo * co2f, p.water, p.nut, clamp(tOpt, 0, 1));
    m.mass = clamp(m.mass + dt * p.days * 0.012 * limit * (1 - m.mass), 0.005, 1);
    if (m.mass > 0.1 && m.branches.length < 8 && Math.random() < dt * 0.6) m.branches.push(Math.random());
  },
  onAction(a, m) { if (a === 'seed') { m.day = 0; m.mass = 0.01; m.branches = []; } if (a === 'harvest') { m.harvested += Math.round(m.mass * 100); m.mass = 0.02; m.branches = []; } },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.mint);
    const soil = e.h * 0.72;
    const g = ctx.createLinearGradient(0, soil, 0, e.h);
    g.addColorStop(0, rgba('#4a3d2c', 0.9)); g.addColorStop(1, rgba('#2a231a', 0.95));
    ctx.fillStyle = g; ctx.fillRect(0, soil, e.w, e.h - soil);
    for (let i = 0; i < 40; i++) dot(ctx, hash(i) * e.w, soil + hash(i + 2) * (e.h - soil), 1.6, rgba(C.ivory, 0.08 * p.water + 0.02), 0);
    const cx = e.w / 2, H = m.mass * (soil - 40);
    if (p.roots) {
      const rd = Math.min(1, m.mass * 2.2);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.25 + (i / 8) * Math.PI * 0.5;
        ctx.strokeStyle = rgba(C.gold, 0.5); ctx.lineWidth = 2 - i * 0.1;
        ctx.beginPath(); ctx.moveTo(cx, soil);
        ctx.quadraticCurveTo(cx + Math.cos(a) * 40 * rd, soil + 30 * rd, cx + Math.cos(a) * 110 * rd * (i % 2 ? 1 : -1), soil + (e.h - soil) * 0.75 * rd);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = shadeGreen(m.mass); ctx.lineWidth = 3 + m.mass * 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, soil); ctx.quadraticCurveTo(cx + Math.sin(m.day * 0.05) * 8, soil - H / 2, cx, soil - H); ctx.stroke();
    if (p.xylem && m.mass > 0.05) {
      for (let i = 0; i < 8; i++) {
        const t = ((e.t * 0.4 + i / 8) % 1);
        dot(ctx, cx + Math.sin(m.day * 0.05) * 8 * (1 - t), soil - t * H, 2.2, rgba(C.sky, 0.8), 6);
      }
    }
    m.branches.forEach((b: number, i: number) => {
      const t = 0.25 + (i / 8) * 0.7, y = soil - H * t;
      const dir = i % 2 ? 1 : -1, len = 30 + m.mass * 60 * (0.5 + b);
      const droop = p.water < 0.25 ? 18 : 0;
      ctx.strokeStyle = shadeGreen(m.mass); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.quadraticCurveTo(cx + dir * len * 0.6, y - 10 + droop, cx + dir * len, y + droop); ctx.stroke();
      ctx.fillStyle = rgba(C.mint, 0.35 + p.light * 0.4);
      ctx.beginPath(); ctx.ellipse(cx + dir * len, y + droop, 17, 8, dir * 0.4, 0, TAU); ctx.fill();
      if (p.stomata && p.light > 0.1) for (let k = 0; k < 2; k++) {
        const tt = (e.t * 0.6 + k / 2 + i * 0.2) % 1;
        dot(ctx, cx + dir * len + tt * 18 * dir, y + droop - tt * 24, 1.8, rgba(C.sky, 1 - tt), 4);
      }
    });
    if (m.mass > 0.72) {
      const fy = soil - H - 8;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.fillStyle = rgba(C.amber, 0.85);
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 16, fy + Math.sin(a) * 16, 9, 5, a, 0, TAU); ctx.fill();
      }
      dot(ctx, cx, fy, 12, '#5a4a2a', 0);
      for (let i = 0; i < 26; i++) { const a = i * 2.399, r = Math.sqrt(i) * 2.1; dot(ctx, cx + Math.cos(a) * r, fy + Math.sin(a) * r, 1.3, rgba(C.gold, 0.8), 0); }
    }
    const stage = m.mass < 0.05 ? 'Germination' : m.mass < 0.25 ? 'Seedling' : m.mass < 0.72 ? 'Vegetative' : 'Flowering';
    if (p.labels) txt(ctx, `day ${m.day.toFixed(0)} · ${stage}`, 14, 24, 11, C.mint, 'left', 0.9);
    const lim = limiting(p);
    txt(ctx, `limiting factor: ${lim}`, 14, e.h - 14, 10.5, C.coral, 'left', 0.85);
  },
  readouts: (m, p) => [
    { label: 'Age', value: `${m.day.toFixed(0)} days`, tone: C.mint },
    { label: 'Biomass', value: `${(m.mass * 100).toFixed(1)}%` },
    { label: 'Limiting factor', value: limiting(p), tone: C.coral },
    { label: 'Photo rate', value: `${((p.light / (p.light + 0.22)) * 100).toFixed(0)}%` },
    { label: 'Stage', value: m.mass < 0.05 ? 'Germination' : m.mass < 0.25 ? 'Seedling' : m.mass < 0.72 ? 'Vegetative' : 'Flowering' },
    { label: 'Harvested', value: `${m.harvested} g` },
  ],
  series: (m, p) => [{ label: 'Biomass %', color: C.mint, v: m.mass * 100, max: 100 }, { label: 'Water %', color: C.sky, v: p.water * 100, max: 100 }],
  explain: (m, p) => `Day ${m.day.toFixed(0)}. Growth is capped by ${limiting(p)} — Liebig’s law means improving any other resource will not help until that one is fixed. ${p.water < 0.25 ? 'Leaves are drooping as cells lose turgor and stomata close to conserve water.' : 'The xylem column is under tension, pulled upward by evaporation from the leaves.'}`,
};
function shadeGreen(mass: number) { return `rgb(${Math.round(lerp(120, 70, mass))},${Math.round(lerp(190, 150, mass))},${Math.round(lerp(110, 80, mass))})`; }
function limiting(p: Record<string, number>) {
  const tOpt = clamp(1 - Math.pow((p.temp - 24) / 24, 2), 0, 1);
  const vals: [string, number][] = [['light', p.light / (p.light + 0.22)], ['water', p.water], ['nitrogen', p.nut], ['temperature', tOpt]];
  vals.sort((a, b) => a[1] - b[1]);
  return vals[0][0];
}

/* ================================================================== */
/*  12 · WEATHER & CLIMATE                                             */
/* ================================================================== */
const WMODES = ['Cyclone', 'Front', 'Tornado', 'Greenhouse'];
export const weather: Spec = {
  id: 'weather', name: 'Weather & Climate', tag: 'Atmosphere under control', accent: C.sky, glyph: 'spark', orbit: false,
  blurb: 'Spin up a cyclone, collide air masses along a front, or raise CO₂ and watch the energy balance shift. Coriolis deflection changes sign with hemisphere.',
  method: 'Coriolis parameter f = 2Ω·sin(φ) with Ω = 7.292×10⁻⁵ rad/s. Radiative forcing ΔF = 5.35·ln(C/C₀) W/m² and ΔT = λΔF with λ ≈ 0.8 K/(W/m²). Moisture capacity follows Clausius–Clapeyron (~7% per K). Storm structure is illustrative.',
  facts: ['Cyclones cannot form within about 5° of the equator — Coriolis force vanishes there.', 'Warmer air holds ~7% more water vapour per degree, intensifying rainfall.', 'Doubling CO₂ gives ~3.7 W/m² of forcing.', 'The eye of a hurricane is calm because air descends there.'],
  ctrls: [
    { k: 'lat', label: 'Latitude', min: -80, max: 80, step: 1, def: 25, unit: '°' },
    { k: 'sst', label: 'Sea surface temp', min: 18, max: 34, step: 0.5, def: 28, unit: ' °C' },
    { k: 'hum', label: 'Humidity', min: 0.1, max: 1, step: 0.02, def: 0.7 },
    { k: 'shear', label: 'Wind shear', min: 0, max: 1, step: 0.02, def: 0.2 },
    { k: 'co2', label: 'CO₂ concentration', min: 180, max: 1200, step: 10, def: 420, unit: ' ppm' },
    { k: 'press', label: 'Central pressure', min: 880, max: 1010, step: 2, def: 960, unit: ' hPa' },
  ],
  toggles: [{ k: 'rain', label: 'Precipitation', def: true }, { k: 'lightning', label: 'Lightning', def: true }, { k: 'isobars', label: 'Isobars', def: true }, { k: 'layers', label: 'Atmosphere layers', def: false }],
  choices: [{ k: 'mode', label: 'System', options: WMODES, def: 0 }],
  scenarios: [
    { name: 'Category 5', note: '30 °C ocean, low shear, 900 hPa', set: { mode: 0, sst: 30, shear: 0.05, press: 900, lat: 20 } },
    { name: 'Sheared apart', note: 'Strong shear tears the storm open', set: { mode: 0, shear: 0.9, sst: 27 } },
    { name: 'Doubled CO₂', note: '840 ppm — +3.7 W/m² forcing', set: { mode: 3, co2: 840 } },
  ],
  make: () => ({ parts: Array.from({ length: 240 }, (_, i) => ({ a: hash(i) * TAU, r: 0.1 + hash(i + 3) * 0.9, y: hash(i + 7), s: 0.5 + hash(i + 11) })), bolt: 0, anom: 0 }),
  step(m, p, dt) {
    const f = 2 * 7.292e-5 * Math.sin(p.lat * Math.PI / 180);
    const intensity = clamp((p.sst - 26) / 6, 0, 1) * (1 - p.shear) * Math.sign(f || 1);
    m.parts.forEach((q: { a: number; r: number }) => {
      q.a += dt * (0.4 + Math.abs(intensity) * 2.4) * Math.sign(f || 1) / Math.max(0.15, q.r);
      q.r -= dt * 0.05 * Math.abs(intensity);
      if (q.r < 0.08) q.r = 1;
    });
    if (p.lightning && Math.random() < dt * Math.abs(intensity) * 2) m.bolt = 0.18;
    m.bolt = Math.max(0, m.bolt - dt);
    const forcing = 5.35 * Math.log(p.co2 / 280);
    m.anom += (forcing * 0.8 - m.anom) * dt * 0.4;
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.sky, '#12151a');
    const mode = Math.round(p.mode);
    const cx = e.w / 2, cy = e.h / 2;
    if (mode === 0 || mode === 2) {
      const R = Math.min(e.w, e.h) * (mode === 2 ? 0.28 : 0.42);
      if (p.isobars) for (let i = 1; i <= 5; i++) {
        ctx.strokeStyle = rgba(C.ivory, 0.1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, R * i / 5, R * i / 5 * (mode === 2 ? 1 : 0.8), 0, 0, TAU); ctx.stroke();
      }
      m.parts.forEach((q: { a: number; r: number; s: number }) => {
        const skew = p.shear * q.r * 90;
        const x = cx + Math.cos(q.a) * q.r * R + skew, y = cy + Math.sin(q.a) * q.r * R * (mode === 2 ? 1 : 0.8);
        const wet = q.r > 0.25 && p.hum > 0.4;
        dot(ctx, x, y, (mode === 2 ? 2 : 3) * q.s, rgba(wet ? C.ivory : C.sky, 0.25 + q.s * 0.35), 0);
      });
      if (mode === 0) { dot(ctx, cx, cy, 12, rgba('#0d0f12', 0.95), 0); ctx.strokeStyle = rgba(C.ivory, 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.stroke(); txt(ctx, 'eye', cx, cy + 30, 9, C.ivory, 'center', 0.6); }
      else {
        for (let i = 0; i < 18; i++) {
          const t = i / 18, r = R * (0.15 + t * 0.9);
          ctx.strokeStyle = rgba(C.gold, 0.25 * (1 - t)); ctx.lineWidth = 2 + t * 12;
          ctx.beginPath(); ctx.ellipse(cx + Math.sin(e.t * 2 + t * 4) * 12 * t, cy + t * 40, r, r * 0.3, 0, 0, TAU); ctx.stroke();
        }
      }
      if (m.bolt > 0) {
        ctx.strokeStyle = rgba(C.ivory, m.bolt * 5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx + 40, cy - 60);
        for (let i = 0; i < 6; i++) ctx.lineTo(cx + 40 + (Math.random() - 0.5) * 40, cy - 60 + i * 22);
        ctx.stroke();
      }
    } else if (mode === 1) {
      ctx.fillStyle = rgba(C.sky, 0.12); ctx.fillRect(0, 0, e.w, e.h * 0.55);
      ctx.fillStyle = rgba(C.coral, 0.1); ctx.fillRect(0, e.h * 0.55, e.w, e.h * 0.45);
      const fy = e.h * 0.55;
      ctx.strokeStyle = C.lav; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(0, fy);
      for (let x = 0; x <= e.w; x += 8) ctx.lineTo(x, fy - Math.sin(x * 0.01 + e.t) * 18 - x * 0.06);
      ctx.stroke();
      for (let i = 0; i < 16; i++) {
        const x = ((i / 16 + e.t * 0.05) % 1) * e.w;
        arrow(ctx, x, fy + 40, x + 26, fy - 10, rgba(C.coral, 0.5), 1.4);
        arrow(ctx, x + 40, fy - 60, x + 14, fy - 30, rgba(C.sky, 0.5), 1.4);
      }
      txt(ctx, 'warm air overruns cold — stratiform cloud and steady rain', 14, 26, 10.5, C.ivory, 'left', 0.7);
    } else {
      const forcing = 5.35 * Math.log(p.co2 / 280);
      const sunY = 40;
      dot(ctx, e.w * 0.2, sunY, 22, C.amber, 30);
      for (let i = 0; i < 8; i++) {
        const x = e.w * 0.2 + i * 14;
        arrow(ctx, x, sunY + 20, x + 60, e.h - 60, rgba(C.amber, 0.35), 1.2);
      }
      seg(ctx, 0, e.h - 50, e.w, e.h - 50, rgba(C.mint, 0.6), 3);
      const trapped = clamp(forcing / 8, 0, 1);
      for (let i = 0; i < 10; i++) {
        const x = e.w * 0.35 + i * 22;
        arrow(ctx, x, e.h - 56, x, e.h - 56 - 120 * (1 - trapped * 0.7), rgba(C.coral, 0.5), 1.4);
        if (hash(i) < trapped) arrow(ctx, x, e.h - 176, x - 10, e.h - 66, rgba(C.coral, 0.6), 1.4);
      }
      for (let i = 0; i < Math.round(p.co2 / 30); i++) dot(ctx, hash(i) * e.w, 80 + hash(i + 3) * (e.h - 180), 2.2, rgba(C.ivory, 0.35), 0);
      txt(ctx, `ΔF = ${forcing.toFixed(2)} W/m²   ΔT ≈ ${m.anom.toFixed(2)} K`, 14, 26, 12, C.coral, 'left', 0.95);
    }
    if (p.rain && mode !== 3) {
      const rate = p.hum * (1 + (p.sst - 26) * 0.07);
      for (let i = 0; i < Math.round(rate * 90); i++) {
        const x = (hash(i) * e.w + e.t * 40 * p.shear) % e.w;
        const y = (hash(i + 5) * e.h + e.t * 340) % e.h;
        seg(ctx, x, y, x - 3, y + 11, rgba(C.sky, 0.35), 1);
      }
    }
    if (p.layers) {
      ['Troposphere 0–12 km', 'Stratosphere 12–50 km', 'Mesosphere 50–85 km'].forEach((s, i) => {
        const y = e.h - (i + 1) * (e.h / 4);
        seg(ctx, 0, y, e.w, y, rgba(C.ivory, 0.12), 1);
        txt(ctx, s, e.w - 12, y - 6, 9, C.ivory, 'right', 0.4);
      });
    }
    const f = 2 * 7.292e-5 * Math.sin(p.lat * Math.PI / 180);
    txt(ctx, `f = ${f.toExponential(2)} s⁻¹ · rotation ${f >= 0 ? 'counter-clockwise (N)' : 'clockwise (S)'}`, 14, e.h - 14, 10, C.sky, 'left', 0.8);
  },
  readouts: (m, p) => {
    const f = 2 * 7.292e-5 * Math.sin(p.lat * Math.PI / 180);
    const forcing = 5.35 * Math.log(p.co2 / 280);
    const intensity = clamp((p.sst - 26) / 6, 0, 1) * (1 - p.shear);
    return [
      { label: 'Coriolis f', value: `${f.toExponential(2)} s⁻¹`, tone: C.sky },
      { label: 'Storm potential', value: `${(intensity * 100).toFixed(0)}%`, tone: intensity > 0.7 ? C.coral : C.ivory },
      { label: 'Category', value: intensity > 0.85 ? '5' : intensity > 0.65 ? '4' : intensity > 0.45 ? '3' : intensity > 0.25 ? '1–2' : 'Tropical storm' },
      { label: 'Radiative forcing', value: `${forcing.toFixed(2)} W/m²` },
      { label: 'Warming', value: `+${m.anom.toFixed(2)} K`, tone: C.coral },
      { label: 'Vapour capacity', value: `+${((Math.exp(0.07 * (p.sst - 26)) - 1) * 100).toFixed(0)}%` },
    ];
  },
  series: (m, p) => [{ label: 'Warming K', color: C.coral, v: Math.max(0, m.anom), max: 8 }, { label: 'Storm %', color: C.sky, v: clamp((p.sst - 26) / 6, 0, 1) * (1 - p.shear) * 100, max: 100 }],
  explain: (m, p) => {
    const mode = Math.round(p.mode);
    if (mode === 0) return `Warm ocean feeds latent heat into rising air; Coriolis at ${p.lat}° bends the inflow into rotation. ${p.shear > 0.6 ? 'Strong vertical shear tilts the vortex and ventilates the warm core — the storm cannot organise.' : p.sst < 26 ? 'Below ~26 °C there is not enough evaporation to sustain deep convection.' : 'Low shear lets the warm core stack vertically — the classic recipe for intensification.'}`;
    if (mode === 1) return `A warm front: less dense warm air rides up over the cold wedge, cooling adiabatically until vapour condenses into layered cloud and prolonged rain.`;
    if (mode === 2) return `A tornado is a violently rotating column in contact with both cloud and ground. Wind speeds concentrate as the vortex narrows — conservation of angular momentum in action.`;
    return `CO₂ at ${p.co2} ppm gives ${5.35 * Math.log(p.co2 / 280) > 0 ? '+' : ''}${(5.35 * Math.log(p.co2 / 280)).toFixed(2)} W/m² of forcing. The system is relaxing toward +${m.anom.toFixed(2)} K; the real climate takes decades because of ocean heat uptake.`;
  },
};

/* ================================================================== */
/*  23 · MICROBIOLOGY & IMMUNOLOGY                                     */
/* ================================================================== */
export const micro: Spec = {
  id: 'micro', name: 'Microbiology & Immunity', tag: 'Host–pathogen dynamics', accent: C.acid, glyph: 'target', orbit: false,
  blurb: 'An agent-level immune response coupled to a real SIR epidemic model. Vaccinate the population and the memory response shortens the second encounter dramatically.',
  method: 'Population spread uses the SIR equations dS/dt = −βSI, dI/dt = βSI − γI, dR/dt = γI with R₀ = β/γ. Cell-level behaviour (phagocytosis, antibody tagging, memory) is an illustrative agent model, not a quantitative immunological simulation.',
  facts: ['R₀ above 1 means an outbreak grows; below 1 it dies out.', 'Herd immunity threshold ≈ 1 − 1/R₀.', 'Memory B cells make the secondary response faster and stronger.', 'Antibiotics act on bacteria, never on viruses.'],
  ctrls: [
    { k: 'beta', label: 'Transmission β', min: 0.05, max: 1.2, step: 0.01, def: 0.45 },
    { k: 'gamma', label: 'Recovery γ', min: 0.02, max: 0.6, step: 0.01, def: 0.15 },
    { k: 'vax', label: 'Vaccine coverage', min: 0, max: 1, step: 0.02, def: 0 },
    { k: 'immune', label: 'Immune strength', min: 0.2, max: 2, step: 0.05, def: 1 },
    { k: 'load', label: 'Initial pathogen load', min: 1, max: 40, step: 1, def: 8 },
    { k: 'temp', label: 'Body temperature', min: 36, max: 40, step: 0.1, def: 37, unit: ' °C' },
  ],
  toggles: [{ k: 'ab', label: 'Antibodies', def: true }, { k: 'memory', label: 'Memory cells', def: true }, { k: 'sir', label: 'SIR curves', def: true }, { k: 'inflam', label: 'Inflammation', def: true }],
  choices: [{ k: 'agent', label: 'Pathogen', options: ['Bacterium', 'Virus', 'Fungus'], def: 0 }],
  actions: [{ id: 'infect', label: 'Introduce pathogen', tone: C.coral }, { id: 'vaccinate', label: 'Vaccinate now', tone: C.acid }],
  scenarios: [
    { name: 'Naïve host', note: 'No prior immunity', set: { vax: 0, memory: 0, beta: 0.5 } },
    { name: 'Vaccinated', note: 'Memory cells respond in hours', set: { vax: 0.8, memory: 1 } },
    { name: 'Herd immunity', note: 'Coverage above 1 − 1/R₀', set: { vax: 0.85, beta: 0.45, gamma: 0.15 } },
  ],
  make: () => ({ S: 0.99, I: 0.01, R: 0, t: 0, cells: Array.from({ length: 18 }, (_, i) => ({ x: hash(i), y: hash(i + 4), k: i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2, vx: (hash(i + 8) - 0.5) * 0.06, vy: (hash(i + 12) - 0.5) * 0.06, tag: 0 })) as { x: number; y: number; k: number; vx: number; vy: number; tag: number }[], hist: [] as number[][], boosted: false }),
  step(m, p, dt) {
    const beta = p.beta * (1 - p.vax * 0.9), gamma = p.gamma * p.immune;
    const dS = -beta * m.S * m.I, dI = beta * m.S * m.I - gamma * m.I;
    m.S = clamp(m.S + dS * dt, 0, 1); m.I = clamp(m.I + dI * dt, 0, 1); m.R = clamp(1 - m.S - m.I, 0, 1);
    m.t += dt;
    if (m.cells.length < 90 && Math.random() < dt * 24) {
      const k = Math.random() < clamp(m.I * 2, 0.05, 0.7) ? 0 : Math.random() < 0.6 ? 1 : 2;
      m.cells.push({ x: Math.random(), y: Math.random(), k, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.06, tag: 0 });
    }
    m.cells.forEach((c: { x: number; y: number; vx: number; vy: number; k: number; tag: number }) => {
      if (c.k > 0) {
        const target = m.cells.find((o: { k: number }) => o.k === 0);
        if (target) { c.vx += (target.x - c.x) * dt * p.immune * 0.6; c.vy += (target.y - c.y) * dt * p.immune * 0.6; }
      }
      c.x = clamp(c.x + c.vx * dt, 0, 1); c.y = clamp(c.y + c.vy * dt, 0, 1);
      c.vx *= 0.98; c.vy *= 0.98;
      if (c.k === 0) {
        const near = m.cells.some((o: { k: number; x: number; y: number }) => o.k > 0 && Math.hypot(o.x - c.x, o.y - c.y) < 0.05);
        if (near) c.tag += dt * p.immune * (p.temp > 37.5 ? 1.4 : 1);
      }
    });
    m.cells = m.cells.filter((c: { tag: number }) => c.tag < 1);
    if (m.hist.length === 0 || m.t - (m.hist[m.hist.length - 1]?.[0] ?? -1) > 0.2) m.hist.push([m.t, m.S, m.I, m.R]);
    if (m.hist.length > 200) m.hist.shift();
  },
  onAction(a, m, p) {
    if (a === 'infect') { m.I = clamp(p.load / 100, 0.01, 0.5); m.S = 1 - m.I - m.R; }
    if (a === 'vaccinate') { m.boosted = true; m.R = clamp(m.R + 0.4, 0, 0.95); m.S = clamp(1 - m.I - m.R, 0, 1); }
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.acid, '#141513');
    if (p.inflam) {
      const g = ctx.createRadialGradient(e.w / 2, e.h / 2, 0, e.w / 2, e.h / 2, Math.max(e.w, e.h) * 0.5);
      g.addColorStop(0, rgba(C.coral, m.I * 0.22)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, e.w, e.h);
    }
    const H = p.sir ? e.h * 0.66 : e.h;
    m.cells.forEach((c: { x: number; y: number; k: number; tag: number }) => {
      const x = c.x * e.w, y = c.y * H;
      if (c.k === 0) {
        const type = Math.round(p.agent);
        ctx.fillStyle = rgba(C.coral, 0.85 - c.tag * 0.6);
        if (type === 0) { ctx.beginPath(); ctx.ellipse(x, y, 9, 5, c.x * 6, 0, TAU); ctx.fill(); }
        else if (type === 1) {
          dot(ctx, x, y, 5, rgba(C.coral, 0.9 - c.tag * 0.6), 6);
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; seg(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, x + Math.cos(a) * 9, y + Math.sin(a) * 9, rgba(C.coral, 0.7), 1.2); }
        } else { ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); seg(ctx, x, y, x + 16, y - 10, rgba(C.coral, 0.5), 2); }
        if (p.ab && c.tag > 0.1) for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU + c.tag * 3;
          seg(ctx, x + Math.cos(a) * 10, y + Math.sin(a) * 10, x + Math.cos(a) * 15, y + Math.sin(a) * 15, C.acid, 1.4, 0.9);
        }
      } else if (c.k === 1) {
        dot(ctx, x, y, 11, rgba(C.ivory, 0.22), 0);
        ctx.strokeStyle = rgba(C.ivory, 0.6); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
        dot(ctx, x + 2, y - 2, 4, rgba(C.lav, 0.6), 0);
      } else {
        dot(ctx, x, y, 7, rgba(p.memory ? C.acid : C.lav, 0.5), 8);
        ctx.strokeStyle = rgba(p.memory ? C.acid : C.lav, 0.9); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.stroke();
      }
    });
    if (p.sir) {
      const by = e.h - 12, bh = e.h * 0.28;
      [['S', C.sky, 1], ['I', C.coral, 2], ['R', C.acid, 3]].forEach(([nm, col, idx]) => {
        ctx.strokeStyle = col as string; ctx.lineWidth = 1.8; ctx.beginPath();
        m.hist.forEach((h: number[], i: number) => {
          const x = (i / Math.max(1, m.hist.length - 1)) * e.w, y = by - h[idx as number] * bh;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        txt(ctx, nm as string, e.w - 40, by - bh * (idx === 1 ? m.S : idx === 2 ? m.I : m.R) - 4, 10, col as string, 'left', 0.9);
      });
      seg(ctx, 0, by - bh, e.w, by - bh, rgba(C.ivory, 0.08), 1);
    }
    txt(ctx, `${['Bacteria', 'Viruses', 'Fungi'][Math.round(p.agent)]} · R₀ ${(p.beta / p.gamma).toFixed(2)} · ${m.boosted || p.vax > 0 ? 'immune memory present' : 'naïve host'}`, 14, 22, 10.5, C.acid, 'left', 0.9);
  },
  readouts: (m, p) => [
    { label: 'R₀', value: (p.beta / p.gamma).toFixed(2), tone: p.beta / p.gamma > 1 ? C.coral : C.acid },
    { label: 'Effective R', value: ((p.beta * (1 - p.vax * 0.9) * m.S) / p.gamma).toFixed(2) },
    { label: 'Infected', value: `${(m.I * 100).toFixed(1)}%`, tone: C.coral },
    { label: 'Recovered', value: `${(m.R * 100).toFixed(1)}%`, tone: C.acid },
    { label: 'Herd threshold', value: `${((1 - p.gamma / p.beta) * 100).toFixed(0)}%` },
    { label: 'Pathogens tracked', value: `${m.cells.filter((c: { k: number }) => c.k === 0).length}` },
  ],
  series: (m) => [{ label: 'Infected %', color: C.coral, v: m.I * 100, max: 100 }, { label: 'Recovered %', color: C.acid, v: m.R * 100, max: 100 }],
  explain: (m, p) => {
    const r0 = p.beta / p.gamma;
    if (m.I < 0.005 && m.R > 0.1) return `The outbreak has burned out. ${(m.R * 100).toFixed(0)}% of the population is now immune — enough that each case infects fewer than one other person.`;
    if (p.vax > 1 - 1 / r0) return `Coverage ${(p.vax * 100).toFixed(0)}% exceeds the herd threshold of ${((1 - 1 / r0) * 100).toFixed(0)}%. Transmission chains break before they reach the vulnerable.`;
    return `R₀ = ${r0.toFixed(2)}: each infection produces ${r0.toFixed(1)} new ones in a fully susceptible population. ${p.temp > 37.5 ? 'Fever is accelerating immune activity — many pathogens replicate more slowly above 38 °C.' : 'Macrophages (white) engulf pathogens; lymphocytes (green) tag them with antibodies.'}`;
  },
};
