import type { Spec } from '../sim/engine';
import { withScene } from '../sim/scenes';

export interface DomainMeta {
  id: string; name: string; tag: string; accent: string; glyph: string; group: string; blurb: string;
}

/* Lightweight metadata — the simulation modules themselves are imported
   on demand so only the opened domain is ever evaluated or mounted. */
export const DOMAIN_META: DomainMeta[] = [
  { id: 'human', name: 'Human Body', tag: 'Anatomy & physiology', accent: '#FF704F', glyph: 'heart', group: 'Life', blurb: 'Two models, eleven systems, fifteen organs, coupled physiology and vessel occlusion.' },
  { id: 'timemachine', name: 'Time Machine', tag: '4.5 billion years', accent: '#B59AFF', glyph: 'orbit', group: 'Time', blurb: 'A portal through twelve eras — walk them, enter buildings, inspect artefacts.' },
  { id: 'space', name: 'Space & Cosmology', tag: 'Universe simulator', accent: '#B59AFF', glyph: 'orbit', group: 'Physical', blurb: 'Kepler orrery plus stellar evolution, supernovae and gravitational lensing.' },
  { id: 'earth', name: 'Earth & Geology', tag: 'Deep-time planet', accent: '#FF704F', glyph: 'globe', group: 'Physical', blurb: 'Plate boundaries, seismic waves, uplift and erosion across 250 million years.' },
  { id: 'ocean', name: 'Ocean & Marine Life', tag: 'Submarine descent', accent: '#7ED9A7', glyph: 'leaf', group: 'Life', blurb: 'Pressure, light and temperature computed live from the surface to the hadal zone.' },
  { id: 'physics', name: 'Physics Laboratory', tag: 'Mechanics & waves', accent: '#D7FF45', glyph: 'atom', group: 'Physical', blurb: 'Five benches: projectiles, collisions, pendulums, interference and refraction.' },
  { id: 'chemistry', name: 'Chemistry Laboratory', tag: 'Atoms to reactions', accent: '#FFD24A', glyph: 'flask', group: 'Physical', blurb: 'Electron shells, molecular geometry, Arrhenius kinetics and titration.' },
  { id: 'math', name: 'Mathematics & Logic', tag: 'Abstract made visible', accent: '#E88BF0', glyph: 'sigma', group: 'Formal', blurb: 'Mandelbrot zoom, 3D surfaces, Galton board, Riemann sums and Euler paths.' },
  { id: 'genetics', name: 'Genetics & DNA', tag: 'Information flow', accent: '#E88BF0', glyph: 'helix', group: 'Life', blurb: 'Replication, transcription and translation using the real standard codon table.' },
  { id: 'evolution', name: 'Evolution & Cells', tag: 'Selection in real time', accent: '#7ED9A7', glyph: 'leaf', group: 'Life', blurb: 'A population under predation, mutating and adapting generation by generation.' },
  { id: 'animals', name: 'Animal Kingdom', tag: 'Locomotion & flight', accent: '#E4C580', glyph: 'compass', group: 'Life', blurb: 'Froude-number gait transitions, wing loading and lift-to-weight balance.' },
  { id: 'plants', name: 'Plant World', tag: 'Seed to seed', accent: '#7ED9A7', glyph: 'leaf', group: 'Life', blurb: 'Logistic growth limited by Liebig’s law, with a transpiration stream.' },
  { id: 'weather', name: 'Weather & Climate', tag: 'Atmosphere control', accent: '#8FD8E8', glyph: 'spark', group: 'Physical', blurb: 'Coriolis rotation, cyclone intensity and CO₂ radiative forcing.' },
  { id: 'micro', name: 'Microbiology & Immunity', tag: 'Host–pathogen', accent: '#D7FF45', glyph: 'target', group: 'Life', blurb: 'Agent immune response coupled to a real SIR epidemic model.' },
  { id: 'engineering', name: 'Engineering & Machines', tag: 'Mechanisms under load', accent: '#D7FF45', glyph: 'chip', group: 'Built', blurb: 'Gear ratios, four-bar linkages, Pascal’s press and truss force paths.' },
  { id: 'electronics', name: 'Electronics & Circuits', tag: 'Live circuit bench', accent: '#FFD24A', glyph: 'chip', group: 'Built', blurb: 'Ohm’s law, RC charging, rectifiers and a working logic-gate truth table.' },
  { id: 'computers', name: 'Computer Science', tag: 'Execution made visible', accent: '#8FD8E8', glyph: 'chip', group: 'Formal', blurb: 'A real eight-opcode CPU you can single-step, plus sorting and encapsulation.' },
  { id: 'ai', name: 'AI & Robotics', tag: 'Learning you can watch', accent: '#E88BF0', glyph: 'atom', group: 'Formal', blurb: 'Backpropagation on XOR, inverse kinematics and a Q-learning maze agent.' },
  { id: 'architecture', name: 'Architecture & Structure', tag: 'Build, load, disassemble', accent: '#E4C580', glyph: 'column', group: 'Built', blurb: 'Raise a tower, choose its material, load it with wind and read the stress.' },
  { id: 'aviation', name: 'Aviation & Flight', tag: 'Aerodynamics bench', accent: '#8FD8E8', glyph: 'rocket', group: 'Built', blurb: 'Lift and drag polar, stall separation, flaps and the four forces.' },
  { id: 'autos', name: 'Automobiles & Transport', tag: 'Powertrain to pavement', accent: '#FF704F', glyph: 'rocket', group: 'Built', blurb: 'Four-stroke timing, EV energy path and braking distance from v²/2µg.' },
  { id: 'energy', name: 'Energy & Power', tag: 'Grid balance', accent: '#FFD24A', glyph: 'spark', group: 'Built', blurb: 'Run a national grid through a day — storage, surplus and load shedding.' },
  { id: 'agriculture', name: 'Agriculture & Food', tag: 'Virtual farm', accent: '#7ED9A7', glyph: 'leaf', group: 'Life', blurb: 'Six plots, soil water, NPK limits and pollinator-dependent yield.' },
  { id: 'psychology', name: 'Psychology & Senses', tag: 'Measure your mind', accent: '#B59AFF', glyph: 'target', group: 'Life', blurb: 'Real reaction-time, Stroop and digit-span tests that produce your own data.' },
  { id: 'forensics', name: 'Forensics & Evidence', tag: 'Analysis, not guesswork', accent: '#E4C580', glyph: 'search', group: 'Formal', blurb: 'Ridge comparison, STR random-match probability and case reconstruction.' },
  { id: 'future', name: 'Future World', tag: 'Speculation with physics', accent: '#E88BF0', glyph: 'rocket', group: 'Time', blurb: 'City scenarios and a rotating habitat where a = ω²r is exact and society is not.' },
];

export const GROUPS = ['All', 'Life', 'Physical', 'Formal', 'Built', 'Time'];

const cache = new Map<string, Spec>();

export async function loadSpec(id: string): Promise<Spec> {
  const hit = cache.get(id);
  if (hit) return hit;
  let spec: Spec;
  switch (id) {
    case 'human': spec = (await import('./Human')).human; break;
    case 'timemachine': spec = (await import('./TimeMachine')).timemachine; break;
    case 'space': case 'earth': case 'ocean': case 'physics': case 'chemistry': case 'math': {
      const m = await import('./specsA');
      spec = ({ space: m.space, earth: m.earth, ocean: m.ocean, physics: m.physics, chemistry: m.chemistry, math: m.math } as Record<string, Spec>)[id];
      break;
    }
    case 'genetics': case 'evolution': case 'animals': case 'plants': case 'weather': case 'micro': {
      const m = await import('./specsB');
      spec = ({ genetics: m.genetics, evolution: m.evolution, animals: m.animals, plants: m.plants, weather: m.weather, micro: m.micro } as Record<string, Spec>)[id];
      break;
    }
    case 'engineering': case 'electronics': case 'computers': case 'ai': case 'architecture': case 'aviation': case 'autos': {
      const m = await import('./specsC');
      spec = ({ engineering: m.engineering, electronics: m.electronics, computers: m.computers, ai: m.ai, architecture: m.architecture, aviation: m.aviation, autos: m.autos } as Record<string, Spec>)[id];
      break;
    }
    default: {
      const m = await import('./specsD');
      spec = ({ energy: m.energy, agriculture: m.agriculture, psychology: m.psychology, forensics: m.forensics, future: m.future } as Record<string, Spec>)[id];
    }
  }
  if (!spec) throw new Error(`Unknown domain: ${id}`);
  /* Every domain gets a real lit 3D environment in front of its
     original instrument diagram, which stays available on a toggle. */
  const decorated = withScene(spec);
  cache.set(id, decorated);
  return decorated;
}
