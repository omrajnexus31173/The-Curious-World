import { C, TAU, bg, clamp, dot, grid3d, hash, lerp, poly, proj, rgba, seg, txt, type Spec, type Env } from '../sim/engine';
import { bake, blob, boxMesh, ellipsoid, lathe, merge, renderMeshes, torusMesh, tube, spline, projectPoint, type Mesh, type Placed, type V3 } from '../sim/mesh3d';
import { audio } from '../lib/audio';
import { progress } from '../lib/progress';

interface Era {
  id: string; name: string; span: string; from: number; to: number; accent: string; scale: string;
  sky: string; ground: string; build: string; desc: string; certainty: 'documented' | 'reconstructed' | 'speculative';
  stats: { pop: number; tech: number; energy: number; travel: number; life: number };
  events: { y: string; t: string }[];
  artifacts: { n: string; d: string }[];
  people: string; transport: string; tools: string;
}

export const ERAS: Era[] = [
  { id: 'deep', name: 'Deep Time Earth', span: '4.5 Ga – 540 Ma', from: -4500, to: -540, accent: '#8FD8E8', scale: 'Geological',
    sky: '#1a1410', ground: '#3a2a20', build: 'strata', certainty: 'reconstructed',
    desc: 'A world without oxygen, then without land life. Banded iron formations record the moment photosynthesis poisoned the atmosphere with oxygen — and made complex life possible.',
    stats: { pop: 0, tech: 0, energy: 1, travel: 0, life: 0 },
    events: [{ y: '4.5 Ga', t: 'Earth accretes from the solar nebula' }, { y: '2.4 Ga', t: 'Great Oxidation Event' }, { y: '541 Ma', t: 'Cambrian explosion of body plans' }],
    artifacts: [{ n: 'Stromatolite', d: 'Layered mats built by cyanobacteria — the oldest widespread fossils, still forming today in Shark Bay.' }, { n: 'Banded iron formation', d: 'Alternating red and grey bands: dissolved iron precipitating as oxygen appeared.' }, { n: 'Zircon crystal', d: '4.4-billion-year-old grains, the oldest known terrestrial material.' }],
    people: 'None — no humans for another four billion years', transport: 'Plate motion, 2–15 cm/yr', tools: 'None' },
  { id: 'prehist', name: 'Prehistoric World', span: '300,000 – 10,000 BCE', from: -300000, to: -10000, accent: '#E4C580', scale: 'Prehistoric',
    sky: '#1c1a14', ground: '#4a4230', build: 'cave', certainty: 'reconstructed',
    desc: 'Anatomically modern humans spread across every continent but Antarctica, sharing the world with megafauna and other human species.',
    stats: { pop: 5, tech: 8, energy: 3, travel: 5, life: 33 },
    events: [{ y: '300 ka', t: 'Earliest Homo sapiens fossils, Jebel Irhoud' }, { y: '45 ka', t: 'Cave art in Sulawesi and Europe' }, { y: '12 ka', t: 'Agriculture begins independently in several regions' }],
    artifacts: [{ n: 'Hand axe', d: 'Acheulean bifaces were made to a consistent design for over a million years — evidence of transmitted culture.' }, { n: 'Bone flute', d: 'A 40,000-year-old vulture-bone flute from Hohle Fels: music predates writing by tens of millennia.' }, { n: 'Ochre pigment', d: 'Ground and heated for paint; used on bodies, hides and cave walls.' }],
    people: 'Bands of 20–50 foragers', transport: 'Walking, later skin boats', tools: 'Knapped stone, bone, fire' },
  { id: 'egypt', name: 'Ancient Egypt', span: '3100 – 30 BCE', from: -3100, to: -30, accent: '#FFD24A', scale: 'Ancient',
    sky: '#241c10', ground: '#6b563a', build: 'pyramid', certainty: 'documented',
    desc: 'Three thousand years of continuity along a river that flooded on schedule. Monumental building, hieroglyphic writing and a state bureaucracy of remarkable durability.',
    stats: { pop: 3, tech: 30, energy: 12, travel: 18, life: 35 },
    events: [{ y: '2560 BCE', t: 'Great Pyramid completed at Giza' }, { y: '1479 BCE', t: 'Reign of Hatshepsut' }, { y: '196 BCE', t: 'Rosetta Stone inscribed' }],
    artifacts: [{ n: 'Cubit rod', d: 'A standard measure of 52.4 cm. Pyramid base lengths match to within a few centimetres using these.' }, { n: 'Shabti figure', d: 'Small servant figurines placed in tombs to work for the deceased in the afterlife.' }, { n: 'Papyrus scroll', d: 'Made from pressed reed pith; the Book of the Dead survives on hundreds of them.' }],
    people: '~3 million in the Nile valley', transport: 'Reed and cedar boats on the Nile', tools: 'Copper chisels, dolerite pounders, ramps' },
  { id: 'indus', name: 'Indus Valley', span: '3300 – 1300 BCE', from: -3300, to: -1300, accent: '#7ED9A7', scale: 'Ancient',
    sky: '#1e2018', ground: '#5c5240', build: 'grid', certainty: 'reconstructed',
    desc: 'Mohenjo-daro and Harappa had gridded streets, standardised bricks and covered drains a millennium before Rome. Their script remains undeciphered.',
    stats: { pop: 5, tech: 34, energy: 12, travel: 20, life: 35 },
    events: [{ y: '2600 BCE', t: 'Mature Harappan cities at peak' }, { y: '1900 BCE', t: 'Gradual urban decline as rivers shift' }, { y: '1300 BCE', t: 'Late Harappan villages persist' }],
    artifacts: [{ n: 'Standardised brick', d: 'Ratio 4:2:1 across hundreds of kilometres — an enforced building standard.' }, { n: 'Steatite seal', d: 'Carved with animals and undeciphered script; probably used for trade and identity.' }, { n: 'Great Bath', d: 'A waterproofed public tank at Mohenjo-daro, sealed with bitumen.' }],
    people: '~40,000 per major city', transport: 'Bullock carts, river craft', tools: 'Bronze, fired brick, precision weights' },
  { id: 'greece', name: 'Classical Greece', span: '800 – 146 BCE', from: -800, to: -146, accent: '#F3EBDD', scale: 'Ancient',
    sky: '#161c20', ground: '#5a5a4e', build: 'temple', certainty: 'documented',
    desc: 'City-states, geometry and the first systematic attempt to explain nature without invoking gods for every event.',
    stats: { pop: 8, tech: 45, energy: 15, travel: 28, life: 38 },
    events: [{ y: '508 BCE', t: 'Athenian democratic reforms' }, { y: '447 BCE', t: 'Parthenon begun on the Acropolis' }, { y: '240 BCE', t: 'Eratosthenes measures Earth’s circumference' }],
    artifacts: [{ n: 'Antikythera mechanism', d: 'A geared bronze astronomical computer from ~100 BCE — nothing as complex survives again for 1,400 years.' }, { n: 'Black-figure amphora', d: 'Storage vessel and canvas: myth, athletics and daily life painted in slip.' }, { n: 'Ostrakon', d: 'A pottery shard scratched with a name — Athenians voted to exile citizens this way.' }],
    people: '~250,000 in Attica', transport: 'Trireme, merchant sail, foot', tools: 'Iron, bronze, geometry' },
  { id: 'rome', name: 'Roman World', span: '753 BCE – 476 CE', from: -753, to: 476, accent: '#FF704F', scale: 'Ancient',
    sky: '#1e1714', ground: '#5e5145', build: 'aqueduct', certainty: 'documented',
    desc: 'Concrete, aqueducts, roads and law. Rome moved water hundreds of kilometres on gradients of a few centimetres per kilometre.',
    stats: { pop: 60, tech: 55, energy: 20, travel: 40, life: 35 },
    events: [{ y: '312 BCE', t: 'First aqueduct, Aqua Appia' }, { y: '80 CE', t: 'Colosseum inaugurated' }, { y: '476 CE', t: 'Western imperial authority ends' }],
    artifacts: [{ n: 'Roman concrete core', d: 'Volcanic ash and lime; it grows stronger in seawater as minerals crystallise in the cracks.' }, { n: 'Hypocaust tile', d: 'Stacked pilae tiles carried hot air under floors — central heating in the first century.' }, { n: 'Milestone', d: 'Placed every Roman mile (1,480 m) along 400,000 km of road.' }],
    people: '~1 million in Rome at its height', transport: 'Paved roads, galleys, carts', tools: 'Concrete, iron, water power' },
  { id: 'china', name: 'Imperial China', span: '221 BCE – 1600 CE', from: -221, to: 1600, accent: '#E88BF0', scale: 'Ancient',
    sky: '#1c1620', ground: '#4e4438', build: 'wall', certainty: 'documented',
    desc: 'Paper, printing, the compass and gunpowder — four inventions that reshaped every other civilisation they reached.',
    stats: { pop: 70, tech: 70, energy: 25, travel: 45, life: 40 },
    events: [{ y: '221 BCE', t: 'Unification under the First Emperor' }, { y: '105 CE', t: 'Cai Lun standardises papermaking' }, { y: '1044', t: 'First written gunpowder formula' }],
    artifacts: [{ n: 'South-pointing spoon', d: 'A lodestone spoon on a bronze plate — the earliest compass, used for divination before navigation.' }, { n: 'Movable type', d: 'Bi Sheng’s ceramic characters, ~1040 — four centuries before Gutenberg.' }, { n: 'Silk bolt', d: 'Currency and diplomatic gift along the routes that took its name.' }],
    people: '~60–100 million', transport: 'Canal barges, junks, horse relay', tools: 'Cast iron, paper, printing' },
  { id: 'medieval', name: 'Medieval Worlds', span: '500 – 1400', from: 500, to: 1400, accent: '#B59AFF', scale: 'Medieval',
    sky: '#15151c', ground: '#464034', build: 'castle', certainty: 'reconstructed',
    desc: 'Not a dark age: Islamic scholars preserved and extended Greek science while European builders pushed stone vaulting to its structural limits.',
    stats: { pop: 400, tech: 60, energy: 30, travel: 42, life: 35 },
    events: [{ y: '830', t: 'House of Wisdom flourishes in Baghdad' }, { y: '1088', t: 'University of Bologna founded' }, { y: '1347', t: 'Black Death reaches Europe' }],
    artifacts: [{ n: 'Astrolabe', d: 'An analogue computer for the sky: time, latitude and star positions from one brass disc.' }, { n: 'Flying buttress', d: 'Moves the vault’s outward thrust to an external pier, letting walls become windows.' }, { n: 'Illuminated manuscript', d: 'Months of labour per page; gold leaf applied before pigment so it could be burnished.' }],
    people: '~400 million worldwide', transport: 'Horse, cog, camel caravan', tools: 'Water mills, heavy plough, windmills' },
  { id: 'renaissance', name: 'Renaissance', span: '1400 – 1650', from: 1400, to: 1650, accent: '#FFD24A', scale: 'Medieval',
    sky: '#1a1712', ground: '#584c3c', build: 'dome', certainty: 'documented',
    desc: 'Perspective in painting, double-entry bookkeeping, and a dome in Florence built without centring that still stands as the largest masonry dome on Earth.',
    stats: { pop: 550, tech: 72, energy: 34, travel: 55, life: 40 },
    events: [{ y: '1436', t: 'Brunelleschi’s dome completed' }, { y: '1450', t: 'Gutenberg’s press' }, { y: '1543', t: 'Copernicus publishes heliocentrism' }],
    artifacts: [{ n: 'Printing type', d: 'Hand-cast lead alloy matrices made identical letters — the first mass-produced precision parts.' }, { n: 'Camera obscura lens', d: 'Projected the world onto a wall; painters used it to study perspective and light.' }, { n: 'Brunelleschi’s hoist', d: 'An ox-driven reversible gearbox that lifted 1,000 kg stones 90 m.' }],
    people: '~550 million worldwide', transport: 'Carrack, caravel, coach', tools: 'Printing, optics, clockwork' },
  { id: 'industrial', name: 'Industrial Revolution', span: '1760 – 1900', from: 1760, to: 1900, accent: '#FF704F', scale: 'Modern',
    sky: '#1a1614', ground: '#3e3830', build: 'factory', certainty: 'documented',
    desc: 'For the first time, energy stopped being limited by muscle, wind and water. Coal broke a ceiling that had held all of human history.',
    stats: { pop: 1600, tech: 85, energy: 78, travel: 78, life: 45 },
    events: [{ y: '1769', t: 'Watt’s separate condenser' }, { y: '1825', t: 'First public steam railway' }, { y: '1879', t: 'Practical incandescent lamp' }],
    artifacts: [{ n: 'Governor flyball', d: 'A feedback controller: spinning weights close the steam valve as speed rises. Cybernetics before the word.' }, { n: 'Bessemer converter', d: 'Blew air through molten iron to burn out carbon, dropping steel’s price by 80%.' }, { n: 'Telegraph key', d: 'Separated communication from transport for the first time in history.' }],
    people: '1.6 billion by 1900', transport: 'Steam rail and ship', tools: 'Steam, coal, machine tools' },
  { id: 'modern', name: 'Modern World', span: '1900 – 2020', from: 1900, to: 2020, accent: '#D7FF45', scale: 'Contemporary',
    sky: '#141618', ground: '#3a3a34', build: 'tower', certainty: 'documented',
    desc: 'Flight, antibiotics, nuclear energy, the transistor and a network connecting most of the species. Life expectancy roughly doubled.',
    stats: { pop: 7800, tech: 96, energy: 95, travel: 95, life: 73 },
    events: [{ y: '1928', t: 'Penicillin discovered' }, { y: '1969', t: 'Apollo 11 lands on the Moon' }, { y: '1991', t: 'World Wide Web released publicly' }],
    artifacts: [{ n: 'Transistor', d: 'The first point-contact device, 1947. Its descendants now number in the sextillions.' }, { n: 'Silicon wafer', d: 'Hundreds of identical dies patterned by light in a single pass.' }, { n: 'Vaccine vial', d: 'Smallpox — the only human disease eradicated — was stopped by this.' }],
    people: '7.8 billion', transport: 'Jet aircraft, container ship, car', tools: 'Electricity, semiconductors, antibiotics' },
  { id: 'future', name: 'Speculative Futures', span: '2050 – 2300', from: 2050, to: 2300, accent: '#E88BF0', scale: 'Future',
    sky: '#120f18', ground: '#2e2a3a', build: 'arcology', certainty: 'speculative',
    desc: 'A scenario, not a forecast. The physics of fusion, orbital habitats and closed-loop agriculture is understood; whether societies build them, and when, is unknown.',
    stats: { pop: 9700, tech: 100, energy: 100, travel: 99, life: 88 },
    events: [{ y: '2050?', t: 'Scenario: grid-scale fusion contributes power' }, { y: '2120?', t: 'Scenario: permanent off-world settlement' }, { y: '2300?', t: 'Scenario: closed-loop planetary stewardship' }],
    artifacts: [{ n: 'Fusion first wall', d: 'Speculative: materials that survive neutron flux for decades remain an open problem.' }, { n: 'Habitat window', d: 'Speculative: radiation shielding and Coriolis comfort set the design, not aesthetics.' }, { n: 'Seed vault cartridge', d: 'Real precedent exists at Svalbard; the fictional version is autonomous.' }],
    people: 'Scenario only', transport: 'Speculative', tools: 'Speculative' },
];


/* --- era artefacts as real 3D meshes --- */
const artCache = new Map<string, Mesh>();
function artifact(kind: string, q: number, col: string): Mesh {
  const key = kind + q + col;
  const hit = artCache.get(key); if (hit) return hit;
  const n = (v: number) => Math.max(5, Math.round(v * q));
  let m: Mesh;
  if (kind === 'vessel') {
    m = merge([
      lathe([[0.02, -0.5], [0.26, -0.28], [0.3, 0.0], [0.2, 0.26], [0.11, 0.38], [0.16, 0.46]], n(20), col, { spec: 0.5 }),
      bake(torusMesh(0.1, 0.022, n(12), n(6), col), { pos: [0.2, 0.24, 0], rotY: Math.PI / 2 }),
      bake(torusMesh(0.1, 0.022, n(12), n(6), col), { pos: [-0.2, 0.24, 0], rotY: Math.PI / 2 }),
    ], col);
  } else if (kind === 'disc') {
    m = merge([
      lathe([[0.34, -0.03], [0.34, 0.03]], n(26), col, { spec: 0.75 }),
      bake(torusMesh(0.24, 0.015, n(24), n(5), '#171713'), { rotX: Math.PI / 2, pos: [0, 0.04, 0] }),
      bake(torusMesh(0.14, 0.012, n(20), n(5), '#171713'), { rotX: Math.PI / 2, pos: [0, 0.04, 0] }),
      bake(boxMesh(0.6, 0.02, 0.03, '#171713'), { pos: [0, 0.05, 0], rotY: 0.6 }),
    ], col);
  } else if (kind === 'tablet') {
    m = merge([
      boxMesh(0.5, 0.66, 0.1, col, { spec: 0.4 }),
      ...Array.from({ length: 6 }, (_, i) => bake(boxMesh(0.36, 0.03, 0.02, '#3A342C'), { pos: [0, 0.24 - i * 0.1, 0.06] })),
    ], col);
  } else if (kind === 'tool') {
    m = merge([
      tube(spline([[0, -0.45, 0], [0.03, 0.1, 0], [0, 0.4, 0]] as V3[], n(10)), () => 0.045, n(8), '#6B4A32', { spec: 0.4 }),
      bake(blob((th, phi) => { const r = 0.16 * (1 + 0.2 * Math.cos(th * 2)); return [Math.sin(phi) * Math.cos(th) * r * 0.7, Math.cos(phi) * r * 1.3, Math.sin(phi) * Math.sin(th) * r * 0.4]; }, n(12), n(9), col, { spec: 0.5 }), { pos: [0, 0.46, 0] }),
    ], col);
  } else if (kind === 'machine') {
    m = merge([
      boxMesh(0.6, 0.4, 0.4, '#3A3A34', { spec: 0.6 }),
      bake(lathe([[0.16, -0.05], [0.16, 0.05]], n(18), col, { spec: 0.8 }), { pos: [0, 0.3, 0], rotX: Math.PI / 2 }),
      bake(torusMesh(0.2, 0.03, n(18), n(6), '#C9B87A', { spec: 0.8 }), { pos: [0, 0.3, 0.1] }),
      bake(lathe([[0.05, 0], [0.05, 0.4]], n(10), '#8E8878'), { pos: [0.22, 0.2, 0] }),
    ], col);
  } else {
    m = merge([
      boxMesh(0.55, 0.08, 0.55, '#20241C', { spec: 0.5 }),
      bake(boxMesh(0.3, 0.05, 0.3, col, { emissive: 0.25, spec: 0.8 }), { pos: [0, 0.06, 0] }),
      ...Array.from({ length: 8 }, (_, i) => bake(boxMesh(0.04, 0.02, 0.08, '#C9B87A'), { pos: [(i - 3.5) * 0.06, -0.04, 0.3] })),
    ], col);
  }
  artCache.set(key, m);
  return m;
}
const ERA_ART: Record<string, string> = {
  deep: 'tablet', prehist: 'tool', egypt: 'vessel', indus: 'tablet', greece: 'vessel',
  rome: 'vessel', china: 'vessel', medieval: 'disc', renaissance: 'disc',
  industrial: 'machine', modern: 'chip', future: 'chip',
};

const TMODES = ['Time portal', 'Era world', 'Interior', 'Compare eras'];

function box3(ctx: CanvasRenderingContext2D, e: Env, x: number, y: number, z: number, w: number, h: number, d: number, col: string, a = 0.9) {
  const c = [
    proj(e.cam, e.w, e.h, x - w, y, z - d), proj(e.cam, e.w, e.h, x + w, y, z - d),
    proj(e.cam, e.w, e.h, x + w, y, z + d), proj(e.cam, e.w, e.h, x - w, y, z + d),
    proj(e.cam, e.w, e.h, x - w, y + h, z - d), proj(e.cam, e.w, e.h, x + w, y + h, z - d),
    proj(e.cam, e.w, e.h, x + w, y + h, z + d), proj(e.cam, e.w, e.h, x - w, y + h, z + d),
  ];
  const faces: [number[], string][] = [
    [[0, 1, 5, 4], shadeK(col, 0.7)], [[1, 2, 6, 5], shadeK(col, 1.0)],
    [[2, 3, 7, 6], shadeK(col, 0.55)], [[3, 0, 4, 7], shadeK(col, 0.85)],
    [[4, 5, 6, 7], shadeK(col, 1.25)],
  ];
  faces.sort((f, g) => {
    const za = (f[0] as number[]).reduce((s, i) => s + c[i].z, 0) / 4;
    const zb = (g[0] as number[]).reduce((s, i) => s + c[i].z, 0) / 4;
    return zb - za;
  });
  faces.forEach(([idx, fill]) => poly(ctx, (idx as number[]).map((i) => c[i]), fill as string, rgba('#000000', 0.25), a));
  return c;
}
function shadeK(hex: string, k: number) {
  const h = hex.replace('#', '');
  const r = Math.round(clamp(parseInt(h.slice(0, 2), 16) * k, 0, 255));
  const g = Math.round(clamp(parseInt(h.slice(2, 4), 16) * k, 0, 255));
  const b = Math.round(clamp(parseInt(h.slice(4, 6), 16) * k, 0, 255));
  return `rgb(${r},${g},${b})`;
}

export const timemachine: Spec = {
  id: 'timemachine', name: 'The Time Machine', tag: 'Navigate 4.5 billion years', accent: C.lav, glyph: 'orbit', orbit: true,
  blurb: 'Step into the portal, choose an era, and walk through a reconstruction. Enter buildings, inspect artefacts, play the events that defined the period, and compare civilisations side by side.',
  method: 'Architecture and artefacts are procedurally reconstructed from documented forms. Every era is tagged: DOCUMENTED (contemporary records survive), RECONSTRUCTED (inferred from archaeology), or SPECULATIVE (a scenario, not a prediction). Population figures are order-of-magnitude scholarly estimates.',
  facts: ['Anatomically modern humans have existed for ~300,000 years; writing for ~5,200.', 'If Earth’s history were one day, humans appear in the last 4 seconds.', 'Roman concrete self-heals in seawater — modern research is copying it.', 'Everything after 2050 in this machine is explicitly a scenario.'],
  ctrls: [
    { k: 'travel', label: 'Portal position', min: 0, max: 11, step: 0.01, def: 2 },
    { k: 'walk', label: 'Walk forward / back', min: -1, max: 1, step: 0.05, def: 0 },
    { k: 'year', label: 'Scrub within era', min: 0, max: 1, step: 0.01, def: 0.3 },
    { k: 'detail', label: 'Reconstruction detail', min: 0.3, max: 1, step: 0.05, def: 0.85 },
    { k: 'crowd', label: 'Population density', min: 0, max: 1, step: 0.05, def: 0.5 },
    { k: 'light', label: 'Time of day', min: 0, max: 1, step: 0.02, def: 0.55 },
    { k: 'eventSpeed', label: 'Event playback speed', min: 0.2, max: 3, step: 0.1, def: 1 },
  ],
  toggles: [{ k: 'labels', label: 'Labels', def: true }, { k: 'certainty', label: 'Certainty tags', def: true }, { k: 'people', label: 'Inhabitants', def: true }, { k: 'grid', label: 'Ground grid', def: true }, { k: 'autoWalk', label: 'Auto-walk', def: false }],
  choices: [{ k: 'mode', label: 'Machine', options: TMODES, def: 0 }, { k: 'compare', label: 'Compare against', options: ERAS.map((x) => x.name), def: 10 }],
  actions: [
    { id: 'enter', label: 'Enter this era', tone: C.lav },
    { id: 'building', label: 'Enter the building', tone: C.acid },
    { id: 'play', label: 'Play the events', tone: C.amber },
    { id: 'return', label: 'Return to the timeline', tone: C.ivory },
  ],
  scenarios: [
    { name: 'Walk Giza', note: 'Egypt at the height of pyramid building', set: { mode: 1, travel: 2, year: 0.2, light: 0.7 } },
    { name: 'Inside a Roman house', note: 'Hypocaust, frescoes and everyday objects', set: { mode: 2, travel: 5 } },
    { name: 'Compare Rome & Modern', note: 'Population, energy, travel, lifespan', set: { mode: 3, travel: 5, compare: 10 } },
    { name: 'Deep time', note: 'Four billion years before people', set: { mode: 1, travel: 0, people: 0 } },
  ],
  make: () => ({ z: 0, ev: -1, evT: 0, hits: [] as { x: number; y: number; id: string; r: number }[], last: -1 }),
  step(m, p, dt) {
    const v = p.autoWalk ? 0.35 : p.walk;
    m.z += v * dt * 1.6;
    if (m.z > 6) m.z = -6;
    if (m.z < -6) m.z = 6;
    if (m.ev >= 0) {
      m.evT += dt * p.eventSpeed;
      if (m.evT > 3.2) { m.evT = 0; m.ev = (m.ev + 1) % 3; }
    }
  },
  onAction(a, m) {
    if (a === 'enter') { audio.whoosh(); progress.experiment(); return { mode: 1 }; }
    if (a === 'building') { audio.whoosh(); progress.completeMission('m-era'); return { mode: 2 }; }
    if (a === 'play') { m.ev = 0; m.evT = 0; audio.chime(); }
    if (a === 'return') { audio.whoosh(); return { mode: 0 }; }
    return undefined;
  },
  draw(ctx, m, p, e) {
    const era = ERAS[clamp(Math.round(p.travel), 0, ERAS.length - 1)];
    if (m.last !== Math.round(p.travel)) { if (m.last >= 0) audio.whoosh(); m.last = Math.round(p.travel); }
    bg(ctx, e, era.accent, era.sky);
    m.hits = [];
    const mode = Math.round(p.mode);

    if (mode === 0) {
      // portal tunnel
      const cx = e.w / 2 + e.cam.panX, cy = e.h / 2 + e.cam.panY;
      const tilt = e.cam.yaw * 0.35;
      const squash = clamp(0.62 * Math.cos(e.cam.pitch) + 0.12, 0.12, 0.95);
      const zoom = e.cam.zoom;
      for (let i = ERAS.length - 1; i >= 0; i--) {
        const rel = i - p.travel;
        const depth = 1 + rel * 0.55;
        if (depth < 0.15) continue;
        const R = (Math.min(e.w, e.h) * 0.42 * zoom) / depth;
        const on = i === Math.round(p.travel);
        ctx.strokeStyle = rgba(ERAS[i].accent, on ? 0.95 : clamp(0.5 / depth, 0.05, 0.4));
        ctx.lineWidth = on ? 3 : 1.2;
        ctx.beginPath(); ctx.ellipse(cx, cy, R, R * squash, tilt, 0, TAU); ctx.stroke();
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * TAU + e.t * 0.15 * (i % 2 ? 1 : -1);
          const rx = Math.cos(a) * R, ry = Math.sin(a) * R * squash;
          dot(ctx, cx + rx * Math.cos(tilt) - ry * Math.sin(tilt), cy + rx * Math.sin(tilt) + ry * Math.cos(tilt), on ? 2.6 : 1.4, rgba(ERAS[i].accent, on ? 0.9 : 0.3), on ? 8 : 0);
        }
        if (on || Math.abs(rel) < 2.2) {
          txt(ctx, ERAS[i].name, cx, cy - R * squash - 10, on ? 14 : 10, ERAS[i].accent, 'center', on ? 1 : 0.5);
          if (on) txt(ctx, ERAS[i].span, cx, cy + R * squash + 20, 11, C.ivory, 'center', 0.7);
        }
        m.hits.push({ x: cx, y: cy - R * squash, id: `era:${i}`, r: 44 });
      }
      // travel streaks
      for (let i = 0; i < 60; i++) {
        const a = hash(i) * TAU, r0 = ((e.t * 0.5 + hash(i + 3)) % 1) * Math.min(e.w, e.h) * 0.6;
        seg(ctx, cx + Math.cos(a + tilt) * r0, cy + Math.sin(a + tilt) * r0 * squash, cx + Math.cos(a + tilt) * (r0 + 18), cy + Math.sin(a + tilt) * (r0 + 18) * squash, rgba(C.ivory, 0.18), 1);
      }
      txt(ctx, era.desc, 20, e.h - 44, 10.5, C.ivory, 'left', 0.75);
      if (p.certainty) txt(ctx, era.certainty.toUpperCase(), 20, 26, 10, era.certainty === 'speculative' ? C.coral : era.certainty === 'documented' ? C.acid : C.amber, 'left', 0.95);
      return;
    }

    if (mode === 3) {
      const other = ERAS[clamp(Math.round(p.compare), 0, ERAS.length - 1)];
      const keys: [keyof Era['stats'], string, string][] = [['pop', 'Population', 'M'], ['tech', 'Technology', 'index'], ['energy', 'Energy use', 'index'], ['travel', 'Travel reach', 'index'], ['life', 'Life expectancy', 'yr']];
      keys.forEach(([k, label, unit], i) => {
        const Y = 60 + i * ((e.h - 120) / 5);
        const a = era.stats[k], b = other.stats[k];
        const mx = k === 'pop' ? 10000 : k === 'life' ? 90 : 100;
        txt(ctx, label, e.w / 2, Y - 8, 10.5, C.ivory, 'center', 0.7);
        const wa = (a / mx) * (e.w * 0.36), wb = (b / mx) * (e.w * 0.36);
        ctx.fillStyle = rgba(era.accent, 0.7); ctx.fillRect(e.w / 2 - 10 - wa, Y, wa, 14);
        ctx.fillStyle = rgba(other.accent, 0.7); ctx.fillRect(e.w / 2 + 10, Y, wb, 14);
        txt(ctx, `${a}${unit === 'M' ? 'M' : ''}`, e.w / 2 - 16 - wa, Y + 12, 10, era.accent, 'right', 0.9);
        txt(ctx, `${b}${unit === 'M' ? 'M' : ''}`, e.w / 2 + 16 + wb, Y + 12, 10, other.accent, 'left', 0.9);
      });
      txt(ctx, era.name, e.w * 0.22, 34, 14, era.accent, 'center', 1);
      txt(ctx, other.name, e.w * 0.78, 34, 14, other.accent, 'center', 1);
      {
        const q = clamp(e.q, 0.5, 1.0);
        const items: Placed[] = [
          { mesh: artifact(ERA_ART[era.id] ?? 'vessel', q, era.accent), pos: [-1.55, -1.15, 0], scale: 0.62, rotY: e.t * 0.3 },
          { mesh: artifact(ERA_ART[other.id] ?? 'vessel', q, other.accent), pos: [1.55, -1.15, 0], scale: 0.62, rotY: -e.t * 0.3 },
        ];
        const ccam = { ...e.cam, pitch: 0.18 + e.cam.pitch * 0.3, zoom: e.cam.zoom * 0.85 };
        renderMeshes(ctx, items, { cam: ccam, w: e.w, h: e.h, maxTris: 8000 });
        [[-1.55, era, 'cmpA'], [1.55, other, 'cmpB']].forEach(([x, er, id]) => {
          const pt = projectPoint(ccam, e.w, e.h, [x as number, -1.0, 0]);
          m.hits.push({ x: pt.x, y: pt.y, id: id as string, r: 60 });
          txt(ctx, (er as Era).name, pt.x, pt.y + 74, 10, (er as Era).accent, 'center', 0.85);
        });
      }
      txt(ctx, 'Indices are illustrative composites; population and lifespan are scholarly estimates.', 14, e.h - 14, 9.5, C.lav, 'left', 0.6);
      return;
    }

    if (mode === 2) {
      const q = clamp(e.q, 0.5, 1.1);
      const items: Placed[] = [];
      const wall = shadeK(era.ground, 0.75);
      items.push({ mesh: boxMesh(5.2, 0.12, 4.2, shadeK(era.ground, 1.05)), pos: [0, -1.05, 0] });
      items.push({ mesh: boxMesh(5.2, 2.6, 0.14, wall), pos: [0, 0.2, -2.0] });
      items.push({ mesh: boxMesh(0.14, 2.6, 4.2, shadeK(era.ground, 0.6)), pos: [-2.5, 0.2, 0] });
      items.push({ mesh: boxMesh(0.14, 2.6, 4.2, shadeK(era.ground, 0.6)), pos: [2.5, 0.2, 0] });
      for (let i = 0; i < 4; i++) {
        const x = -1.7 + i * 1.13;
        items.push({ mesh: lathe([[0.15, -1], [0.13, 0.9], [0.19, 1.0]], Math.max(8, Math.round(14 * q)), shadeK(era.ground, 1.2), { spec: 0.45 }), pos: [x, 0, -1.6] });
        items.push({ mesh: boxMesh(0.42, 0.1, 0.42, shadeK(era.ground, 1.35)), pos: [x, 1.05, -1.6] });
      }
      // hearth
      const flick = 0.75 + Math.sin(e.t * 9) * 0.2;
      items.push({ mesh: ellipsoid(0.22, 0.14, 0.22, 10, 7, '#FF704F', { emissive: flick }), pos: [0, -0.9, 0.7] });
      items.push({ mesh: torusMesh(0.3, 0.06, Math.max(8, Math.round(14 * q)), 5, '#4A4438'), pos: [0, -0.96, 0.7] });
      // three inspectable artefacts on plinths
      const kinds = [ERA_ART[era.id] ?? 'vessel', 'tablet', 'tool'];
      era.artifacts.forEach((art, i) => {
        const x = (i - 1) * 1.25;
        items.push({ mesh: boxMesh(0.55, 0.5, 0.55, shadeK(era.ground, 0.9), { spec: 0.4 }), pos: [x, -0.75, 0.1] });
        items.push({ mesh: artifact(kinds[i] ?? 'vessel', q, era.accent), pos: [x, -0.18, 0.1], scale: 0.78, rotY: e.t * 0.25 + i });
        const pt = projectPoint(e.cam, e.w, e.h, [x, 0.1, 0.1]);
        m.hits.push({ x: pt.x, y: pt.y, id: `art:${i}`, r: 40 });
        if (p.labels) txt(ctx, art.n, pt.x, pt.y + 62, 9.5, era.accent, 'center', 0.85);
      });
      renderMeshes(ctx, items, { cam: e.cam, w: e.w, h: e.h, maxTris: 16000 });
      txt(ctx, `Interior — ${era.name}. Click an object to inspect it.`, 14, 26, 10.5, C.ivory, 'left', 0.75);
      txt(ctx, era.certainty.toUpperCase(), 14, 42, 9.5, era.certainty === 'speculative' ? C.coral : C.acid, 'left', 0.9);
      return;
    }

    // ---- era world ----
    if (p.grid) grid3d(ctx, e, 8, 3.2, era.accent, 0.06);
    const gz = m.z;
    const sun = p.light;
    dot(ctx, e.w * (0.15 + sun * 0.7), e.h * (0.3 - Math.sin(sun * Math.PI) * 0.18), 20, rgba(sun > 0.5 ? C.amber : C.lav, 0.8), 50);

    const structures: { x: number; z: number; kind: string; s: number }[] = [];
    /* The year scrub is a construction / decay clock: early in an era only a
       few structures exist, at its peak the settlement is dense, and late in
       a ruined era buildings shrink back. */
    const phase = clamp(p.year, 0, 1);
    const rise = Math.sin(Math.PI * Math.pow(phase, 0.75));
    const N = Math.max(2, Math.round((6 + p.detail * 8) * (0.35 + rise * 0.65)));
    for (let i = 0; i < N; i++) {
      const maturity = clamp((phase * 1.6 - hash(i + 70) * 0.6), 0.12, 1);
      structures.push({ x: (hash(i) - 0.5) * 5.2, z: (hash(i + 20) - 0.5) * 7 + gz, kind: era.build, s: (0.5 + hash(i + 40) * 0.8) * maturity });
    }
    structures.sort((a, b) => b.z - a.z);
    structures.forEach((st, i) => {
      const col = era.ground;
      let h = 0.5 * st.s;
      if (st.kind === 'pyramid') {
        h = 0.9 * st.s;
        const base = [proj(e.cam, e.w, e.h, st.x - h, -1, st.z - h), proj(e.cam, e.w, e.h, st.x + h, -1, st.z - h), proj(e.cam, e.w, e.h, st.x + h, -1, st.z + h), proj(e.cam, e.w, e.h, st.x - h, -1, st.z + h)];
        const apex = proj(e.cam, e.w, e.h, st.x, -1 + h * 1.4, st.z);
        [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b], k) => poly(ctx, [base[a], base[b], apex], shadeK('#C9A46A', 0.6 + k * 0.18), rgba('#000', 0.2)));
        m.hits.push({ x: apex.x, y: apex.y + 20, id: `b:${i}`, r: 34 });
      } else if (st.kind === 'temple') {
        for (let c = 0; c < 5; c++) box3(ctx, e, st.x - 0.4 + c * 0.2, -1, st.z, 0.05, 0.7 * st.s, 0.05, '#E8E2D4');
        box3(ctx, e, st.x, -1 + 0.7 * st.s, st.z, 0.55, 0.12, 0.28, '#D8D0BE');
        m.hits.push({ x: proj(e.cam, e.w, e.h, st.x, -0.4, st.z).x, y: proj(e.cam, e.w, e.h, st.x, -0.4, st.z).y, id: `b:${i}`, r: 34 });
      } else if (st.kind === 'aqueduct') {
        for (let c = 0; c < 4; c++) {
          box3(ctx, e, st.x - 0.6 + c * 0.4, -1, st.z, 0.07, 0.8 * st.s, 0.12, '#B8A48C');
          if (c < 3) box3(ctx, e, st.x - 0.4 + c * 0.4, -0.35, st.z, 0.14, 0.1, 0.12, '#A89478');
        }
        box3(ctx, e, st.x, -1 + 0.85 * st.s, st.z, 0.75, 0.09, 0.14, '#C8B49C');
      } else if (st.kind === 'castle') {
        box3(ctx, e, st.x, -1, st.z, 0.3 * st.s, 0.8 * st.s, 0.3 * st.s, col);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dz]) => box3(ctx, e, st.x + dx * 0.3 * st.s, -1, st.z + dz * 0.3 * st.s, 0.08, 1.05 * st.s, 0.08, shadeK(col, 1.15)));
        m.hits.push({ x: proj(e.cam, e.w, e.h, st.x, -0.5, st.z).x, y: proj(e.cam, e.w, e.h, st.x, -0.5, st.z).y, id: `b:${i}`, r: 34 });
      } else if (st.kind === 'dome') {
        box3(ctx, e, st.x, -1, st.z, 0.34 * st.s, 0.5 * st.s, 0.34 * st.s, '#C8B49C');
        const q = proj(e.cam, e.w, e.h, st.x, -1 + 0.5 * st.s, st.z);
        ctx.fillStyle = shadeK('#B5654A', 1.05);
        ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.36 * st.s * 120 * q.f * 0.4, 0.3 * st.s * 120 * q.f * 0.4, 0, Math.PI, TAU); ctx.fill();
        m.hits.push({ x: q.x, y: q.y, id: `b:${i}`, r: 32 });
      } else if (st.kind === 'factory') {
        box3(ctx, e, st.x, -1, st.z, 0.42 * st.s, 0.4 * st.s, 0.3 * st.s, '#4a4038');
        box3(ctx, e, st.x + 0.2 * st.s, -1, st.z, 0.07, 1.2 * st.s, 0.07, '#5a4a3e');
        for (let k = 0; k < 5; k++) {
          const t = (e.t * 0.25 + k / 5) % 1;
          const q = proj(e.cam, e.w, e.h, st.x + 0.2 * st.s, -1 + 1.2 * st.s + t * 0.9, st.z);
          dot(ctx, q.x, q.y, 6 + t * 20, rgba('#6b6258', 0.35 * (1 - t)), 0);
        }
        m.hits.push({ x: proj(e.cam, e.w, e.h, st.x, -0.7, st.z).x, y: proj(e.cam, e.w, e.h, st.x, -0.7, st.z).y, id: `b:${i}`, r: 32 });
      } else if (st.kind === 'tower' || st.kind === 'arcology') {
        h = (st.kind === 'arcology' ? 2.2 : 1.6) * st.s;
        box3(ctx, e, st.x, -1, st.z, 0.18 * st.s, h, 0.18 * st.s, st.kind === 'arcology' ? '#3a3450' : '#3e3e38');
        const q = proj(e.cam, e.w, e.h, st.x, -1 + h, st.z);
        for (let k = 0; k < Math.round(h * 8); k++) {
          const w = proj(e.cam, e.w, e.h, st.x, -1 + k * 0.12, st.z + 0.19 * st.s);
          dot(ctx, w.x, w.y, 1.6, rgba(st.kind === 'arcology' ? C.orchid : C.amber, hash(k + i) > 0.4 ? 0.8 : 0.15), 3);
        }
        if (st.kind === 'arcology') dot(ctx, q.x, q.y, 4, C.acid, 12);
        m.hits.push({ x: q.x, y: q.y + 30, id: `b:${i}`, r: 30 });
      } else if (st.kind === 'grid') {
        box3(ctx, e, st.x, -1, st.z, 0.3 * st.s, 0.28 * st.s, 0.3 * st.s, '#8a7256');
        seg(ctx, proj(e.cam, e.w, e.h, st.x - 0.5, -0.99, st.z).x, proj(e.cam, e.w, e.h, st.x - 0.5, -0.99, st.z).y, proj(e.cam, e.w, e.h, st.x + 0.5, -0.99, st.z).x, proj(e.cam, e.w, e.h, st.x + 0.5, -0.99, st.z).y, rgba(C.ivory, 0.15), 3);
      } else if (st.kind === 'wall') {
        box3(ctx, e, st.x, -1, st.z, 0.7, 0.35 * st.s, 0.1, '#7a6a54');
        box3(ctx, e, st.x + 0.5, -1, st.z, 0.12, 0.6 * st.s, 0.12, '#8a7a64');
      } else if (st.kind === 'cave') {
        poly(ctx, [proj(e.cam, e.w, e.h, st.x - 0.6 * st.s, -1, st.z), proj(e.cam, e.w, e.h, st.x, -1 + 0.8 * st.s, st.z), proj(e.cam, e.w, e.h, st.x + 0.6 * st.s, -1, st.z)], shadeK(col, 0.9), rgba('#000', 0.3));
        const fq = proj(e.cam, e.w, e.h, st.x, -0.95, st.z + 0.4);
        dot(ctx, fq.x, fq.y, 5 + Math.sin(e.t * 8 + i) * 1.6, rgba(C.coral, 0.9), 22);
      } else {
        for (let k = 0; k < 5; k++) {
          const q1 = proj(e.cam, e.w, e.h, st.x - 1, -1 + k * 0.16, st.z), q2 = proj(e.cam, e.w, e.h, st.x + 1, -1 + k * 0.16, st.z);
          seg(ctx, q1.x, q1.y, q2.x, q2.y, rgba(['#8a5a3a', '#6a6a5a', '#9a7a4a'][k % 3], 0.7), 6);
        }
      }
    });
    // inhabitants
    if (p.people && era.stats.pop > 0) {
      for (let i = 0; i < Math.round(p.crowd * 24 * (0.3 + rise * 0.7)); i++) {
        const x = (hash(i + 60) - 0.5) * 5, z = (hash(i + 90) - 0.5) * 6 + gz;
        const q = proj(e.cam, e.w, e.h, x + Math.sin(e.t * 0.5 + i) * 0.15, -1, z);
        seg(ctx, q.x, q.y, q.x, q.y - 14 * q.f, rgba(era.accent, 0.75), 2.4);
        dot(ctx, q.x, q.y - 17 * q.f, 3 * q.f, rgba(era.accent, 0.9), 0);
      }
    }
    // event playback
    if (m.ev >= 0) {
      const ev = era.events[m.ev];
      void p.eventSpeed;
      ctx.fillStyle = rgba('#0d0d0b', 0.8);
      ctx.fillRect(e.w * 0.1, e.h - 92, e.w * 0.8, 52);
      ctx.strokeStyle = rgba(era.accent, 0.6); ctx.lineWidth = 1; ctx.strokeRect(e.w * 0.1, e.h - 92, e.w * 0.8, 52);
      txt(ctx, ev.y, e.w * 0.13, e.h - 70, 14, era.accent, 'left', 1);
      txt(ctx, ev.t, e.w * 0.13, e.h - 52, 11.5, C.ivory, 'left', 0.9);
      ctx.fillStyle = rgba(era.accent, 0.5);
      ctx.fillRect(e.w * 0.1, e.h - 42, e.w * 0.8 * clamp(m.evT / 3.2, 0, 1), 2);
    }
    if (p.labels) txt(ctx, `${era.name} · ${era.span}`, 14, 26, 12, era.accent, 'left', 0.95);
    if (p.certainty) txt(ctx, era.certainty.toUpperCase(), 14, 42, 9.5, era.certainty === 'speculative' ? C.coral : era.certainty === 'documented' ? C.acid : C.amber, 'left', 0.9);
    txt(ctx, `${era.transport} · ${era.tools}`, 14, e.h - 14, 10, C.ivory, 'left', 0.55);
    txt(ctx, `${Math.round(phase * 100)}% through the era · ${N} structures standing`, 14, e.h - 30, 9.5, era.accent, 'left', 0.6);
  },
  hit: (m, _p, _e, x, y) => {
    let best: string | null = null, bd = 1e9;
    (m.hits as { x: number; y: number; id: string; r: number }[]).forEach((h) => {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < h.r && d < bd) { bd = d; best = h.id; }
    });
    return best;
  },
  info: (id, _m, p) => {
    const era = ERAS[clamp(Math.round(p.travel), 0, 11)];
    if (id.startsWith('era:')) {
      const e2 = ERAS[+id.split(':')[1]];
      return { title: e2.name, body: `${e2.span}\n\n${e2.desc}\n\nPeople: ${e2.people}\nTransport: ${e2.transport}\nTools: ${e2.tools}`, facts: [e2.certainty.toUpperCase(), `Time scale: ${e2.scale}`, 'Use ENTER THIS ERA to travel'] };
    }
    if (id === 'cmpA' || id === 'cmpB') {
      const er = id === 'cmpA' ? ERAS[clamp(Math.round(p.travel), 0, 11)] : ERAS[clamp(Math.round(p.compare), 0, 11)];
      return { title: `${er.name} — representative artefact`, body: `${er.desc}\n\nTools: ${er.tools}\nTransport: ${er.transport}`, facts: [er.span, er.certainty.toUpperCase(), 'Procedurally reconstructed 3D model'] };
    }
    if (id.startsWith('art:')) {
      const a = era.artifacts[+id.split(':')[1]] ?? era.artifacts[0];
      return { title: a.n, body: a.d, facts: [`Era: ${era.name}`, era.certainty.toUpperCase(), 'Reconstructed from archaeological evidence'] };
    }
    return { title: `${era.name} — structure`, body: `A ${era.build} reconstruction built from documented forms of the period. ${era.desc}`, facts: [`Certainty: ${era.certainty}`, 'Use ENTER THE BUILDING to step inside', era.tools] };
  },
  readouts: (m, p) => {
    const era = ERAS[clamp(Math.round(p.travel), 0, 11)];
    const yr = Math.round(lerp(era.from, era.to, p.year));
    return [
      { label: 'Era', value: era.name, tone: era.accent },
      { label: 'Year', value: yr < 0 ? `${Math.abs(yr).toLocaleString()} BCE` : `${yr.toLocaleString()} CE` },
      { label: 'Time scale', value: era.scale },
      { label: 'Population est.', value: era.stats.pop ? `${era.stats.pop} M` : 'no humans' },
      { label: 'Life expectancy', value: era.stats.life ? `~${era.stats.life} yr` : '—' },
      { label: 'Evidence', value: era.certainty, tone: era.certainty === 'speculative' ? C.coral : C.acid },
      { label: 'Position', value: `${m.z.toFixed(1)} m walked` },
      { label: 'Event', value: m.ev >= 0 ? era.events[m.ev].y : 'idle' },
    ];
  },
  series: (m, p) => {
    const era = ERAS[clamp(Math.round(p.travel), 0, 11)];
    return [{ label: 'Technology', color: era.accent, v: era.stats.tech, max: 100 }, { label: 'Energy', color: C.amber, v: era.stats.energy, max: 100 }, { label: 'Depth walked', color: C.lav, v: Math.abs(m.z), max: 6 }];
  },
  explain: (m, p) => {
    const era = ERAS[clamp(Math.round(p.travel), 0, 11)];
    const mode = Math.round(p.mode);
    if (m.ev >= 0) return `${era.events[m.ev].y} — ${era.events[m.ev].t}`;
    if (mode === 0) return `${era.name} (${era.span}). ${era.desc} Drag the portal-position slider or click a ring to select, then press ENTER THIS ERA.`;
    if (mode === 2) return `Inside a ${era.name} structure. Objects are reconstructed from surviving examples; click one to read what it was and how it was made.`;
    if (mode === 3) return `Comparing ${era.name} with ${ERAS[clamp(Math.round(p.compare), 0, 11)].name}. Energy use and travel reach are the two indices that change most dramatically across history.`;
    return `${era.desc} ${era.certainty === 'speculative' ? 'This is a scenario, not a prediction.' : era.certainty === 'reconstructed' ? 'Details are inferred from archaeology and marked as reconstruction.' : 'Contemporary records document this period directly.'}`;
  },
};
