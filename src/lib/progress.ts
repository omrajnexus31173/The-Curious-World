import { useSyncExternalStore } from 'react';

export interface Visit { id: string; label: string; kind: string; at: number }
export interface Bookmark { id: string; label: string; kind: string }

export interface Progress {
  quizBest: number;
  quizTaken: number;
  exhibits: string[];
  places: string[];
  steps: string[];
  discoveries: number;
  xp: number;
  badges: string[];
  domains: string[];
  bookmarks: Bookmark[];
  history: Visit[];
  missions: string[];
  experiments: number;
}

const KEY = 'curious-world-progress-v1';
const DEFAULTS: Progress = {
  quizBest: 0, quizTaken: 0, exhibits: [], places: [], steps: [], discoveries: 0,
  xp: 0, badges: [], domains: [], bookmarks: [], history: [], missions: [], experiments: 0,
};

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Progress>) };
      p.exhibits ??= []; p.places ??= []; p.steps ??= []; p.badges ??= [];
      p.domains ??= []; p.bookmarks ??= []; p.history ??= []; p.missions ??= [];
      return p;
    }
  } catch { /* private mode */ }
  return { ...DEFAULTS, exhibits: [], places: [], steps: [], badges: [], domains: [], bookmarks: [], history: [], missions: [] };
}

let cache: Progress = load();
const subs = new Set<() => void>();

function commit(next: Progress) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

function set(mut: (p: Progress) => void) {
  const next: Progress = {
    ...cache,
    exhibits: [...cache.exhibits], places: [...cache.places], steps: [...cache.steps],
    badges: [...cache.badges], domains: [...cache.domains],
    bookmarks: [...cache.bookmarks], history: [...cache.history], missions: [...cache.missions],
  };
  mut(next);
  commit(next);
}

/* ---- levels & badges ---- */
export const LEVELS = [0, 120, 320, 640, 1100, 1750, 2600, 3700, 5200, 7200, 10000];
export const RANKS = ['Observer', 'Apprentice', 'Explorer', 'Naturalist', 'Analyst', 'Experimentalist', 'Researcher', 'Cartographer', 'Polymath', 'Architect of Ideas', 'Curator of Everything'];

export function levelOf(xp: number) {
  let l = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) l = i;
  const cur = LEVELS[l], next = LEVELS[Math.min(l + 1, LEVELS.length - 1)];
  return { level: l + 1, rank: RANKS[l], cur, next, pct: next > cur ? (xp - cur) / (next - cur) : 1 };
}

export interface BadgeDef { id: string; name: string; desc: string; icon: string; test: (p: Progress) => boolean }
export const BADGES: BadgeDef[] = [
  { id: 'first-contact', name: 'First Contact', desc: 'Open your first simulation domain', icon: 'spark', test: (p) => p.domains.length >= 1 },
  { id: 'cartographer', name: 'Cartographer', desc: 'Chart 5 sites on the globe', icon: 'globe', test: (p) => p.places.length >= 5 },
  { id: 'curator', name: 'Curator', desc: 'Visit 8 museum installations', icon: 'book', test: (p) => p.exhibits.length >= 8 },
  { id: 'anatomist', name: 'Anatomist', desc: 'Enter the Human Body simulator', icon: 'heart', test: (p) => p.domains.includes('human') },
  { id: 'chrononaut', name: 'Chrononaut', desc: 'Travel through the Time Machine', icon: 'orbit', test: (p) => p.domains.includes('timemachine') },
  { id: 'experimenter', name: 'Experimenter', desc: 'Run 10 simulation experiments', icon: 'flask', test: (p) => p.experiments >= 10 },
  { id: 'polymath', name: 'Polymath', desc: 'Open 10 different domains', icon: 'atom', test: (p) => p.domains.length >= 10 },
  { id: 'completionist', name: 'The Whole Universe', desc: 'Open all 26 domains', icon: 'target', test: (p) => p.domains.length >= 26 },
  { id: 'scholar', name: 'Scholar', desc: 'Score 75%+ on the knowledge check', icon: 'check', test: (p) => p.quizBest >= 75 },
  { id: 'collector', name: 'Collector', desc: 'Bookmark 5 discoveries', icon: 'plus', test: (p) => p.bookmarks.length >= 5 },
];

export interface Mission { id: string; title: string; desc: string; xp: number; test: (p: Progress) => boolean }
export const MISSIONS: Mission[] = [
  { id: 'm-heart', title: 'Raise the heart rate', desc: 'Push the body simulator past 140 bpm with exercise intensity.', xp: 60, test: (p) => p.missions.includes('m-heart') },
  { id: 'm-occlude', title: 'Interrupt a vessel', desc: 'Use STOP FLOW on a blood vessel and observe downstream oxygen delivery.', xp: 80, test: (p) => p.missions.includes('m-occlude') },
  { id: 'm-era', title: 'Walk an ancient city', desc: 'Enter a reconstructed building in the Time Machine.', xp: 80, test: (p) => p.missions.includes('m-era') },
  { id: 'm-circuit', title: 'Charge a capacitor', desc: 'Watch an RC circuit reach 63% of supply voltage in Electronics.', xp: 60, test: (p) => p.domains.includes('electronics') },
  { id: 'm-train', title: 'Teach a network', desc: 'Train the XOR network below 0.05 loss in AI & Robotics.', xp: 100, test: (p) => p.missions.includes('m-train') },
  { id: 'm-reaction', title: 'Measure yourself', desc: 'Complete a reaction-time trial in Psychology.', xp: 60, test: (p) => p.missions.includes('m-reaction') },
];

function checkBadges(p: Progress) {
  for (const b of BADGES) if (!p.badges.includes(b.id) && b.test(p)) p.badges.push(b.id);
}

export const progress = {
  get: () => cache,
  sub(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  markExhibit(id: string) { set((p) => { if (!p.exhibits.includes(id)) { p.exhibits.push(id); p.xp += 15; } checkBadges(p); }); },
  markPlace(id: string) { set((p) => { if (!p.places.includes(id)) { p.places.push(id); p.xp += 12; } checkBadges(p); }); },
  toggleStep(key: string) { set((p) => { p.steps = p.steps.includes(key) ? p.steps.filter((s) => s !== key) : [...p.steps, key]; p.xp = Math.max(0, p.xp + (p.steps.includes(key) ? 20 : -20)); }); },
  recordQuiz(score: number, total: number) { set((p) => { p.quizTaken += 1; p.quizBest = Math.max(p.quizBest, Math.round((score / total) * 100)); p.xp += score * 12; checkBadges(p); }); },
  bumpDiscovery() { set((p) => { p.discoveries += 1; p.xp += 4; }); },
  openDomain(id: string) {
    set((p) => {
      if (!p.domains.includes(id)) { p.domains.push(id); p.xp += 40; }
      checkBadges(p);
    });
  },
  experiment() { set((p) => { p.experiments += 1; p.xp += 6; checkBadges(p); }); },
  completeMission(id: string) {
    if (cache.missions.includes(id)) return;
    const m = MISSIONS.find((x) => x.id === id);
    set((p) => { if (!p.missions.includes(id)) { p.missions.push(id); p.xp += m?.xp ?? 40; } checkBadges(p); });
  },
  visit(id: string, label: string, kind: string) {
    set((p) => {
      p.history = [{ id, label, kind, at: Date.now() }, ...p.history.filter((h) => h.id !== id)].slice(0, 24);
    });
  },
  toggleBookmark(id: string, label: string, kind: string) {
    set((p) => {
      p.bookmarks = p.bookmarks.some((b) => b.id === id)
        ? p.bookmarks.filter((b) => b.id !== id)
        : [{ id, label, kind }, ...p.bookmarks].slice(0, 40);
      checkBadges(p);
    });
  },
  reset() {
    commit({ ...DEFAULTS, exhibits: [], places: [], steps: [], badges: [], domains: [], bookmarks: [], history: [], missions: [] });
  },
};

export function useProgress(): Progress {
  return useSyncExternalStore(progress.sub, progress.get, progress.get);
}
