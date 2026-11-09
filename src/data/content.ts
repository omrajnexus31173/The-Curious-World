/* ------------------------------------------------------------------ */
/*  THE CURIOUS WORLD — knowledge data layer                           */
/* ------------------------------------------------------------------ */
import { DOMAIN_META } from '../domains/registry';

export type ShapeKind =
  | 'icosahedron' | 'torus' | 'sphere' | 'helix' | 'box'
  | 'octahedron' | 'knot' | 'atom' | 'cone';

export interface Topic { name: string; blurb: string; }
export interface World {
  id: string; num: string; name: string; tagline: string;
  accent: string; icon: string; desc: string; topics: Topic[];
}
export type LocCat = 'Science' | 'Nature' | 'Civilization' | 'Technology' | 'Earth';
export interface Loc {
  id: string; name: string; lat: number; lon: number; cat: LocCat; fact: string;
}
export interface Exhibit {
  id: string; room: string; title: string; kind: ShapeKind | 'heart';
  accent: string; desc: string; facts: string[];
}
export interface QuizQ { q: string; options: string[]; a: number; why: string; }
export interface LearnPath { id: string; title: string; accent: string; desc: string; steps: string[]; }
export interface Fact { text: string; tag: string; }

export const WORLD_ACCENT: Record<string, string> = {
  Technology: '#D7FF45', Space: '#B59AFF', Body: '#FF704F', Nature: '#7ED9A7',
  History: '#E4C580', Science: '#FFD24A', Future: '#F3EBDD', Math: '#E88BF0',
};

export const WORLDS: World[] = [
  {
    id: 'technology', num: '01', name: 'Technology', tagline: 'Machines that think, talk and see.',
    accent: '#D7FF45', icon: 'chip',
    desc: 'The world we built out of math and copper — from the first transistors to the models that now dream in text and images.',
    topics: [
      { name: 'Artificial Intelligence', blurb: 'Systems that learn patterns from examples instead of following hand-written rules — from image recognisers to language models.' },
      { name: 'The Internet', blurb: 'About 400,000 km of submarine fibre cables connect every continent, carrying 95% of all international data.' },
      { name: 'Robotics', blurb: 'Mechanical bodies guided by sensors and control loops — from factory arms to self-folding origami robots.' },
      { name: 'Computing', blurb: 'Everything a computer does is switching: roughly 100 billion transistor states decided every second in your pocket.' },
      { name: 'Cybersecurity', blurb: 'An arms race of cryptography. Modern encryption is designed so that only a supernova of computing could crack it.' },
    ],
  },
  {
    id: 'space', num: '02', name: 'Space & Universe', tagline: 'A 13.8-billion-year story, still being written.',
    accent: '#B59AFF', icon: 'orbit',
    desc: 'From the light we can see to the horizons we cannot — the largest subject there is, with the most unknowns.',
    topics: [
      { name: 'Galaxies', blurb: 'Island universes of a hundred billion stars. The Milky Way and Andromeda are closing in at 110 km/s.' },
      { name: 'Planets', blurb: 'More than 5,500 exoplanets confirmed — worlds that rain molten glass and diamonds alike.' },
      { name: 'Black Holes', blurb: 'Regions where gravity wins completely. The first image of one was released in 2019 — a shadow 43 billion km across.' },
      { name: 'Stars', blurb: 'Nuclear furnaces that forge the atoms inside you. Every breath you take was made in a star.' },
      { name: 'Space Exploration', blurb: 'Voyager 1, launched in 1977, is now over 24 billion km away — the farthest human-made object in history.' },
    ],
  },
  {
    id: 'body', num: '03', name: 'Human Body', tagline: 'The most complex machine you own.',
    accent: '#FF704F', icon: 'heart',
    desc: '37 trillion cells, one brain, a century of life — an ecosystem that builds and repairs itself constantly.',
    topics: [
      { name: 'The Brain', blurb: '86 billion neurons firing in choreographed waves — more connections than stars in the Milky Way.' },
      { name: 'The Heart', blurb: 'A fist-sized pump that beats ~100,000 times a day, delivering about 7,500 litres of blood.' },
      { name: 'Nervous System', blurb: 'Signals travel up to 120 m/s — fast enough that your arm moves before you consciously decide it does.' },
      { name: 'DNA', blurb: 'A 2-metre instruction book folded into a cell nucleus 100,000 times smaller than a millimetre.' },
      { name: 'Human Biology', blurb: 'You are 10% you: roughly half of the cells in your body are bacteria living alongside you.' },
    ],
  },
  {
    id: 'nature', num: '04', name: 'Nature & Earth', tagline: 'A planet in constant, slow motion.',
    accent: '#7ED9A7', icon: 'leaf',
    desc: 'Plates drift, seasons turn, ecosystems negotiate. Earth is a system of systems, four and a half billion years in.',
    topics: [
      { name: 'Oceans', blurb: 'Covers 71% of the planet and holds 97% of its water. We have mapped more of Mars than of the seafloor.' },
      { name: 'Wildlife', blurb: 'Around 8.7 million species are estimated to exist — we have formally described about 1.4 million.' },
      { name: 'Climate', blurb: 'A heat engine run by sunlight. A 1°C shift reorganises weather systems across the entire planet.' },
      { name: 'Volcanoes', blurb: 'Pressure valves on a molten planet. The last supervolcano — Yellowstone — erupted 631,000 years ago.' },
      { name: 'Ecosystems', blurb: 'Forests talk through fungal underground networks, trading nutrients between trees like a shared bloodstream.' },
    ],
  },
  {
    id: 'history', num: '05', name: 'History & Civilizations', tagline: 'Everything humanity figured out, twice.',
    accent: '#E4C580', icon: 'column',
    desc: 'The long chain of people who noticed something, wrote it down, and made the next person smarter.',
    topics: [
      { name: 'Ancient Civilizations', blurb: 'Sumer, Egypt, the Indus Valley, Mesoamerica — wheels, writing and cities appeared on four continents independently.' },
      { name: 'Inventions', blurb: 'From the printing press to the transistor: each great invention is usually built from a dozen forgotten small ones.' },
      { name: 'Historical Discoveries', blurb: 'Some discoveries are accidents — penicillin, X-rays, the microwave oven, all lucky mistakes.' },
      { name: 'Human Evolution', blurb: 'We share 99% of our DNA with chimpanzees; a handful of gene changes redrew the map of the brain.' },
    ],
  },
  {
    id: 'science', num: '06', name: 'Science & Physics', tagline: 'The operating rules of reality.',
    accent: '#FFD24A', icon: 'atom',
    desc: 'The small set of laws that turns clouds of gas into galaxies, atoms into bodies, and bodies into scientists.',
    topics: [
      { name: 'Electricity', blurb: 'The same force that pulls electrons to atoms also pulls your hair up. Lightning and sparks are cousins.' },
      { name: 'Magnetism', blurb: 'Aligned electron spins create invisible fields that power everything from compasses to MRI machines.' },
      { name: 'Quantum Physics', blurb: 'At tiny scales, particles exist in probabilities until measured — and can be entangled across continents.' },
      { name: 'Energy', blurb: 'It is never created or destroyed, only transformed. The entire observable universe is one energy ledger.' },
      { name: 'Atoms', blurb: '99.9999999% empty space. A solid table is mostly structured emptiness held up by electromagnetic force.' },
    ],
  },
  {
    id: 'future', num: '07', name: 'Future World', tagline: 'Drafts of what we are about to build.',
    accent: '#F3EBDD', icon: 'rocket',
    desc: 'Speculative engineering with real physics behind it — the decade where prototypes stop being prototypes.',
    topics: [
      { name: 'Smart Cities', blurb: 'Sensors, traffic AI and district heating could cut city energy use by a third — if the data stays private.' },
      { name: 'Future Transportation', blurb: 'From maglev trains crossing continents in hours to electric planes that make the 1,000 km commute a flight.' },
      { name: 'Advanced Robotics', blurb: 'General-purpose machines that fold laundry, stack shelves and recover from the unexpected.' },
      { name: 'Space Colonization', blurb: 'Mars rovers are step one. A permanent presence there requires water, power and closed-loop life support.' },
      { name: 'Biotech', blurb: 'Gene editing turns cells into factories. Medicine is moving from treating symptoms to rewriting causes.' },
    ],
  },
  {
    id: 'math', num: '08', name: 'Mathematics & Logic', tagline: 'The language reality is written in.',
    accent: '#E88BF0', icon: 'sigma',
    desc: 'A subject with no experiments and no lab — just rules and consequences that turn out to describe everything.',
    topics: [
      { name: 'Geometry', blurb: 'Euclid built all of geometry from five assumptions in 300 BC. Two thousand years later, they still hold.' },
      { name: 'Patterns', blurb: 'Fibonacci spirals appear in sunflowers, hurricanes and galaxies because growth from small units prefers them.' },
      { name: 'Mathematical Mysteries', blurb: 'Riemann’s hypothesis — about the pattern of prime numbers — has stayed unproven for 160 years and carries a million-dollar prize.' },
      { name: 'Interactive Puzzles', blurb: 'Puzzles train the exact skill math rewards: seeing structure inside chaos.' },
      { name: 'Logic & Algorithms', blurb: 'The ancient art of guaranteed reasoning became the engine of every program you have ever run.' },
    ],
  },
];

export const CAT_ACCENT: Record<LocCat, string> = {
  Science: '#FFD24A', Nature: '#7ED9A7', Civilization: '#E4C580',
  Technology: '#D7FF45', Earth: '#B59AFF',
};

export const LOCATIONS: Loc[] = [
  { id: 'everest', name: 'Mount Everest', lat: 27.99, lon: 86.93, cat: 'Earth', fact: '8,848.86 m tall, and still growing ~4 mm a year as the Indian plate pushes into the Asian one.' },
  { id: 'galapagos', name: 'Galápagos', lat: -0.95, lon: -90.97, cat: 'Nature', fact: 'Darwin spent 28 days here in 1835. The finches he sketched helped him build the theory of evolution.' },
  { id: 'giza', name: 'Giza Plateau', lat: 29.98, lon: 31.13, cat: 'Civilization', fact: 'The Great Pyramid stood as the world’s tallest structure for 3,800 years, aligned to true north within 0.05°.' },
  { id: 'cern', name: 'CERN', lat: 46.23, lon: 6.05, cat: 'Science', fact: 'Its 27 km ring accelerates protons to 99.9999991% the speed of light — 11,000 laps of Earth per day.' },
  { id: 'mariana', name: 'Mariana Trench', lat: 11.35, lon: 142.2, cat: 'Earth', fact: 'Challenger Deep is ~10,935 m down — deeper than Everest is tall. Life has been found there.' },
  { id: 'maunakea', name: 'Mauna Kea', lat: 19.82, lon: -155.47, cat: 'Science', fact: 'Home to 13 observatories above 40% of the atmosphere — the best ground-based view of space.' },
  { id: 'olduvai', name: 'Olduvai Gorge', lat: -2.99, lon: 35.35, cat: 'Civilization', fact: 'The “Cradle of Mankind.” Stone tools found here are 1.9 million years old — older than our own genus.' },
  { id: 'amazon', name: 'Amazon Basin', lat: -3.46, lon: -62.21, cat: 'Nature', fact: 'Holds about 10% of all known species and stores ~150 billion tonnes of carbon. It partly makes its own rain.' },
  { id: 'yellowstone', name: 'Yellowstone', lat: 44.43, lon: -110.59, cat: 'Earth', fact: 'Sits on a supervolcano whose last mega-eruption, 631,000 years ago, blanketed North America in ash.' },
  { id: 'chichen', name: 'Chichén Itzá', lat: 20.68, lon: -88.57, cat: 'Civilization', fact: 'At equinox, shadows climb El Castillo in a serpent shape — a calendar built into a pyramid.' },
  { id: 'machu', name: 'Machu Picchu', lat: -13.16, lon: -72.54, cat: 'Civilization', fact: 'An Inca citadel at 2,430 m, built with stones so precisely cut that no mortar was needed. Abandoned ~1572.' },
  { id: 'stonehenge', name: 'Stonehenge', lat: 51.18, lon: -1.83, cat: 'Civilization', fact: 'Its axis lines up with the summer solstice sunrise — an observatory built around 3000 BC.' },
  { id: 'atacama', name: 'Atacama Desert', lat: -24.63, lon: -70.4, cat: 'Science', fact: 'The driest place on Earth. So dry, some labs grow Martian rock analogues from its soil.' },
  { id: 'parkes', name: 'Parkes (The Dish)', lat: -32.99, lon: 148.26, cat: 'Technology', fact: 'This 64 m radio dish transmitted the Arecibo message to space in 1974 — a 1,679-bit introduction to humanity.' },
  { id: 'reykjavik', name: 'Reykjavík', lat: 64.14, lon: -21.94, cat: 'Technology', fact: 'About 90% of its buildings are heated by tap water from the Earth’s crust — geothermal energy.' },
  { id: 'southpole', name: 'South Pole', lat: -90, lon: 0, cat: 'Earth', fact: 'Ice cores drilled here preserve 800,000 years of trapped atmosphere — an archive of every era’s climate.' },
  { id: 'chernobyl', name: 'Chernobyl', lat: 51.39, lon: 30.1, cat: 'Technology', fact: 'The 1986 accident became the most studied disaster in nuclear history — and a laboratory of natural recovery.' },
  { id: 'uyuni', name: 'Salar de Uyuni', lat: -20.13, lon: -66.84, cat: 'Earth', fact: 'The world’s largest salt flat: 10,582 km² of mirror at 3,656 m, with the planet’s largest lithium deposit beneath.' },
  { id: 'serengeti', name: 'Serengeti', lat: -2.33, lon: 34.83, cat: 'Nature', fact: 'The Great Migration moves ~1.5 million wildebeest in a loop — the largest herd movement on land.' },
  { id: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.69, cat: 'Technology', fact: 'The shinkansen ran for 24 years with no passenger fatalities — and still reaches passengers to the second.' },
];

export interface Room { id: string; name: string; accent: string; desc: string; }
export const ROOMS: Room[] = [
  { id: 'anatomy', name: 'The Anatomy Hall', accent: '#FF704F', desc: 'The machinery of a body — built from pumps, wiring and self-repairing tissue.' },
  { id: 'cosmos', name: 'The Cosmos Gallery', accent: '#B59AFF', desc: 'Heavy objects and impossible distances, scaled down to table size.' },
  { id: 'machine', name: 'The Machine Wing', accent: '#D7FF45', desc: 'Switches, fields and lattices — the hardware layer of the modern world.' },
  { id: 'nature', name: 'The Nature Atrium', accent: '#7ED9A7', desc: 'Slow forces: pressure, crystal, water and four billion years of selection.' },
];

export const EXHIBITS: Exhibit[] = [
  { id: 'ex-heart', room: 'anatomy', title: 'The Rhythm Engine', kind: 'heart', accent: '#FF704F', desc: 'A four-chamber pump that never rests. Watch it separate into atria and ventricles, then follow the blood as it loops through both lungs and body.', facts: ['Beats ~100,000 times per day', 'Pumps ~7,500 L of blood daily'] },
  { id: 'ex-brain', room: 'anatomy', title: 'The Quiet Storm', kind: 'sphere', accent: '#FF9AD5', desc: 'A folded 2-pound surface where 86 billion neurons hold a conversation in electrochemistry.', facts: ['Uses ~20% of the body’s energy', 'Signal speed up to 120 m/s'] },
  { id: 'ex-dna', room: 'anatomy', title: 'The Double Helix', kind: 'helix', accent: '#FFB38A', desc: 'The instruction ladder. Two strands, four bases, one sequence per individual on Earth.', facts: ['2 m long per cell', '3.2 billion base pairs in a diploid cell'] },
  { id: 'ex-bone', room: 'anatomy', title: 'The Load-Bearing Lattice', kind: 'octahedron', accent: '#E4C580', desc: 'Bone is a composite material: a mineral scaffold reinforced with protein, stronger per weight than steel.', facts: ['206 bones in an adult', 'Remodels ~10% every year'] },
  { id: 'ex-blackhole', room: 'cosmos', title: 'Event Horizon', kind: 'torus', accent: '#B59AFF', desc: 'A supermassive black hole’s accretion disc: matter spiralling in at relativistic speed, brightening until it vanishes.', facts: ['Imaged in 2019', 'Shadow 43 billion km across'] },
  { id: 'ex-galaxy', room: 'cosmos', title: 'Spiral Gravity Sculpture', kind: 'knot', accent: '#D3C7FF', desc: 'How a galaxy holds together: arms are density waves, not fixed arms — stars flow through them like water through a weir.', facts: ['~100–400 billion stars each', 'Arms rotate slower than stars'] },
  { id: 'ex-pulsar', room: 'cosmos', title: 'The Lighthouse', kind: 'icosahedron', accent: '#9F8CFF', desc: 'A city-sized neutron star spinning tens of times per second, sweeping beams of radiation across space.', facts: ['Fastest: 716 Hz (PSR J1748)', 'A teaspoon weighs ~6 billion tonnes'] },
  { id: 'ex-solar', room: 'cosmos', title: 'Solar System Model', kind: 'atom', accent: '#FFD24A', desc: 'One star, eight planets, one dominant force. Drag to orbit the whole system at your own speed.', facts: ['Sun = 99.86% of system mass', 'Neptune’s year: 165 Earth years'] },
  { id: 'ex-atom', room: 'machine', title: 'The Atom', kind: 'atom', accent: '#D7FF45', desc: 'An electron cloud orbiting a nucleus so small that, at this scale, the room would be it.', facts: ['99.9999999% empty space', 'Hydrogen: one proton, one electron'] },
  { id: 'ex-quantum', room: 'machine', title: 'Quantum Foam', kind: 'knot', accent: '#B9FF3B', desc: 'At the smallest scales, space itself may be a turbulent, knot-tangled thing. This sculpture is a visual metaphor for it.', facts: ['Quantum effects fade at macro scale', 'Entanglement spans any distance'] },
  { id: 'ex-core', room: 'machine', title: 'The Core', kind: 'icosahedron', accent: '#D7FF45', desc: 'A silicon die abstracted to geometry: billions of transistors stacked in a lattice, the atomic-scale plumbing of thought.', facts: ['Modern chips: 100+ billion transistors', 'Feature sizes below 5 nm'] },
  { id: 'ex-servo', room: 'machine', title: 'Servo Lattice', kind: 'box', accent: '#E9F7B0', desc: 'The skeleton of a robot arm: rigid links, precise joints, feedback at every corner.', facts: ['Industrial arms repeat to ±0.01 mm', 'Servos correct thousands of times per second'] },
  { id: 'ex-volcano', room: 'nature', title: 'Super Volcano', kind: 'cone', accent: '#FF8A5C', desc: 'A caldera system: a magma chamber, a conduit, and the pressure that decides when the planet exhales.', facts: ['Yellowstone: last mega-eruption 631 ka', 'Hawaii adds a new island every ~4,000 yr'] },
  { id: 'ex-coral', room: 'nature', title: 'Crystal Reef', kind: 'octahedron', accent: '#7ED9A7', desc: 'Reefs are animals building cities from calcium carbonate — one of nature’s most engineered materials.', facts: ['Cover <1% of the seafloor', 'Home to ~25% of marine species'] },
  { id: 'ex-marble', room: 'nature', title: 'The Blue Marble', kind: 'sphere', accent: '#A8E6C2', desc: 'Earth from 400,000 km: one thin line of atmosphere over a water sphere, photographed in 1972.', facts: ['Atmosphere averages ~11 km thick', 'Oldest known rock: 4.03 billion years'] },
  { id: 'ex-tide', room: 'nature', title: 'Tide Engine', kind: 'torus', accent: '#8FE0B8', desc: 'A loop of the most reliable clock on the planet — the moon pulling the oceans into a rhythm 4.5 billion years old.', facts: ['Tidal range up to 16 m (Bay of Fundy)', 'Tides slow Earth’s day by ~1.8 ms/century'] },
];

export const QUIZ: QuizQ[] = [
  { q: 'How many chambers does the human heart have?', options: ['Two', 'Three', 'Four', 'Six'], a: 2, why: 'Two atria collect blood; two ventricles pump it — one circuit to the lungs, one to the body.' },
  { q: 'Which planet has the slowest day — a rotation longer than its year?', options: ['Jupiter', 'Venus', 'Mars', 'Mercury'], a: 1, why: 'Venus spins once every 243 Earth days, but orbits the Sun in just 225.' },
  { q: 'Which particle was confirmed at CERN in 2012?', options: ['Neutrino', 'Quark', 'Higgs boson', 'Graviton'], a: 2, why: 'The Higgs boson completes the Standard Model — it is how particles acquire mass.' },
  { q: 'The Great Pyramid was the tallest human structure for about…', options: ['800 years', '3,800 years', '1,200 years', '10,000 years'], a: 1, why: 'From ~2560 BC until Lincoln Cathedral in 1311 — roughly 3,800 years.' },
  { q: 'How fast does light travel in vacuum, approximately?', options: ['300,000 km/s', '30,000 km/s', '3,000 km/s', '3 million km/s'], a: 0, why: '299,792 km/s — the universal speed limit that physics keeps enforcing.' },
  { q: 'How many hearts does an octopus have?', options: ['One', 'Two', 'Three', 'Eight'], a: 2, why: 'Two branchial hearts pump blood through the gills; one systemic heart pumps it to the body.' },
  { q: 'Which element has atomic number 1?', options: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], a: 1, why: 'One proton, one electron — the most abundant element in the observable universe.' },
  { q: 'The first “computer bug” (1947) was…', options: ['A moth in a relay', 'A worn wire', 'A math error', 'A bad vacuum tube'], a: 0, why: 'Grace Hopper’s team taped the moth into the logbook of the Harvard Mark II. It caught on.' },
];

export const PATHS: LearnPath[] = [
  { id: 'atom-to-star', title: 'From Atom to Star', accent: '#FFD24A', desc: 'Follow matter from a proton to a burning star, and back again.', steps: ['Atomic structure', 'Nuclear fusion', 'Stellar birth', 'Stellar death', 'Neutron stars & black holes'] },
  { id: 'inside-you', title: 'Inside You', accent: '#FF704F', desc: 'A tour of the body’s most dramatic systems, one organ at a time.', steps: ['The nervous system', 'Heart & circulation', 'Lungs & gas exchange', 'DNA & cells', 'The immune system'] },
  { id: 'human-story', title: 'The Human Story', accent: '#E4C580', desc: 'Five inventions that turned a small African species into a global one.', steps: ['Stone tools', 'Fire', 'Agriculture', 'Writing', 'The space age'] },
  { id: 'earth-systems', title: 'Earth Systems', accent: '#7ED9A7', desc: 'How a planet keeps its climate, its water and its life in balance.', steps: ['Plate tectonics', 'The water cycle', 'Climate dynamics', 'Biodiversity', 'Ecosystem networks'] },
];

export const FACTS: Fact[] = [
  { text: 'Honey never spoils. Sealed pots found in 3,000-year-old Egyptian tombs were still edible.', tag: 'History' },
  { text: 'Venus rotates so slowly that its day (243 Earth days) is longer than its year (225 Earth days).', tag: 'Space' },
  { text: 'The Sun holds 99.86% of the entire solar system’s mass. Everything else is leftovers.', tag: 'Space' },
  { text: 'Lightning strikes heat the air to ~30,000 K — roughly five times hotter than the Sun’s surface.', tag: 'Science' },
  { text: 'Octopuses have three hearts and copper-based blue blood.', tag: 'Nature' },
  { text: 'Your body contains roughly 37 trillion cells — and about half of those are bacteria.', tag: 'Body' },
  { text: 'Voyager 1 is over 24 billion km away — the first human-made object in interstellar space.', tag: 'Technology' },
  { text: 'Tardigrades survive the vacuum of space, extreme radiation, and temperatures from −272 °C to +150 °C.', tag: 'Nature' },
  { text: 'The number of possible chess games (Shannon number ~10¹²⁰) exceeds the number of atoms in the observable universe (~10⁸⁰).', tag: 'Math' },
  { text: 'Uncoil every cell’s DNA and it would reach Pluto and back hundreds of times.', tag: 'Body' },
  { text: 'The Mariana Trench (10,935 m) is deeper than Mount Everest (8,849 m) is tall.', tag: 'Earth' },
  { text: 'About half of the oxygen you breathe is made by marine phytoplankton, not by forests.', tag: 'Nature' },
  { text: 'CERN’s LHC pushes protons to 99.9999991% the speed of light — 11,000 laps of Earth per day.', tag: 'Science' },
  { text: 'A teaspoon of neutron-star matter would weigh about six billion tonnes on Earth.', tag: 'Space' },
  { text: 'Ants can carry roughly 50 times their own body weight.', tag: 'Nature' },
  { text: 'The Great Pyramid was aligned to true north within about 0.05 degrees — better than most modern surveying.', tag: 'History' },
  { text: 'Your body contains about 100,000 km of blood vessels — enough to wrap around Earth 2.5 times.', tag: 'Body' },
  { text: 'The Sahara is older than the pyramids — and older than Egypt existed as a civilization.', tag: 'History' },
  { text: 'Earth’s magnetic field flips, on average, every 200,000–300,000 years. The last flip was 780,000 years ago.', tag: 'Earth' },
  { text: 'Sound needs matter to travel — space is perfectly silent.', tag: 'Science' },
  { text: 'Sunlight reaching your eyes left the Sun 8 minutes and 20 seconds ago. You never see it now.', tag: 'Space' },
  { text: 'Fibonacci spirals appear in sunflowers, hurricanes and galaxies because growth from small units naturally produces them.', tag: 'Math' },
  { text: 'The Tokyo bullet train has not had a passenger fatality in over 50 years of operation.', tag: 'Technology' },
  { text: 'Ice cores from the South Pole trap air bubbles that preserve 800,000 years of Earth’s atmosphere.', tag: 'Earth' },
];

export const STATS = {
  worlds: WORLDS.length,
  exhibits: EXHIBITS.length,
  places: LOCATIONS.length,
  labs: 5,
};

/* search corpus builder */
export interface SearchHit {
  id: string; title: string; group: string; accent: string; snippet: string;
  payload?: { worldId?: string; topicName?: string; locId?: string; exhibitId?: string; domainId?: string };
}

export function buildCorpus(): SearchHit[] {
  const out: SearchHit[] = [];
  for (const d of DOMAIN_META) {
    out.push({ id: `d-${d.id}`, title: d.name, group: `Simulation · ${d.group}`, accent: d.accent, snippet: d.blurb, payload: { domainId: d.id } });
  }
  for (const w of WORLDS) {
    for (const t of w.topics) {
      out.push({ id: `t-${w.id}-${t.name}`, title: t.name, group: `World · ${w.name}`, accent: w.accent, snippet: t.blurb, payload: { worldId: w.id, topicName: t.name } });
    }
  }
  for (const l of LOCATIONS) {
    out.push({ id: `l-${l.id}`, title: l.name, group: `Site · ${l.cat}`, accent: CAT_ACCENT[l.cat], snippet: l.fact, payload: { locId: l.id } });
  }
  for (const e of EXHIBITS) {
    out.push({ id: `e-${e.id}`, title: e.title, group: 'Museum exhibit', accent: e.accent, snippet: e.desc, payload: { exhibitId: e.id } });
  }
  for (const f of FACTS) {
    out.push({ id: `f-${f.text.slice(0, 24)}`, title: f.tag, group: 'Daily discovery', accent: '#D7FF45', snippet: f.text });
  }
  return out;
}

export function relatedTo(hit: SearchHit, corpus: SearchHit[]): SearchHit[] {
  const out: SearchHit[] = [];
  if (hit.payload?.worldId) {
    for (const c of corpus) if (c.payload?.worldId === hit.payload.worldId && c.id !== hit.id) out.push(c);
  } else if (hit.payload?.locId) {
    for (const c of corpus) {
      const src = LOCATIONS.find((l) => l.id === hit.payload!.locId);
      if (c.payload?.locId && c.id !== hit.id && LOCATIONS.find((l) => l.id === c.payload!.locId)?.cat === src?.cat) out.push(c);
    }
  }
  if (out.length < 3) {
    for (const c of corpus) if (!out.includes(c) && c.group === hit.group) out.push(c);
  }
  return out.slice(0, 5);
}
