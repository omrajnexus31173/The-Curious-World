import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildCorpus, relatedTo, QUIZ, PATHS, FACTS, EXHIBITS, LOCATIONS, type SearchHit } from '../data/content';
import { Icon, Reveal, SectionHead, StatRing } from './ui';
import { useProgress, progress } from '../lib/progress';
import { cn } from '../utils/cn';

/* ---------------- search ---------------- */

function Search() {
  const corpus = useMemo(() => buildCorpus(), []);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<SearchHit | null>(null);
  const related = useMemo(() => (detail ? relatedTo(detail, corpus) : []), [detail, corpus]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    return corpus
      .filter((c) => c.title.toLowerCase().includes(query) || c.snippet.toLowerCase().includes(query) || c.group.toLowerCase().includes(query))
      .slice(0, 9);
  }, [q, corpus]);

  return (
    <div>
      <div className="relative">
        <Icon name="search" className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-ivory/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 8 worlds, 20 sites, 16 exhibits… try “black hole” or “valve”"
          className="w-full bg-coal/70 border border-ivory/15 rounded-2xl pl-14 pr-5 py-5 text-base sm:text-lg text-ivory placeholder:text-ivory/30 focus:border-acid focus:outline-none transition-colors"
          data-cursor="add"
          aria-label="Search the knowledge base"
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-ivory/40 hover:text-ivory" aria-label="Clear search">
            <Icon name="close" className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {q.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 border border-ivory/12 rounded-2xl bg-coal/50 divide-y divide-ivory/8">
              {results.length === 0 && (
                <p className="p-6 text-sm text-ivory/40">Nothing found for “{q}”. Try “neuron”, “pyramid” or “Higgs”.</p>
              )}
              {results.map((r, i) => (
                <motion.button
                  key={r.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  data-cursor="view"
                  onClick={() => {
                    if (r.payload?.domainId) { setQ(''); window.location.hash = `#/domain/${r.payload.domainId}`; }
                    else setDetail(r);
                  }}
                  className="w-full text-left px-5 py-3.5 flex items-center gap-3.5 hover:bg-ivory/4 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.accent }} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] text-ivory truncate">{r.title}</span>
                    <span className="block text-[11.5px] text-ivory/40 truncate">{r.snippet}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-[9.5px] tracking-[0.18em] uppercase text-ivory/35 hidden sm:block">{r.group}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div className="fixed inset-0 z-[75] flex items-center justify-center p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-obsidian/85 backdrop-blur-sm" onClick={() => setDetail(null)} />
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-xl bg-coal border border-ivory/15 rounded-2xl p-7 max-h-[80vh] overflow-y-auto"
              role="dialog"
              aria-label={detail.title}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="tick-label" style={{ color: detail.accent }}>{detail.group}</span>
                  <h3 className="font-display text-3xl mt-2 text-ivory">{detail.title}</h3>
                </div>
                <button data-cursor="add" onClick={() => setDetail(null)} className="w-10 h-10 shrink-0 grid place-items-center rounded-full border border-ivory/15 text-ivory/70 hover:text-acid hover:border-acid transition-colors" aria-label="Close">
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ivory/65">{detail.snippet}</p>
              {related.length > 0 && (
                <div className="mt-6">
                  <span className="tick-label text-ivory/40">Related threads</span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {related.map((r) => (
                      <button key={r.id} data-cursor="view" onClick={() => setDetail(r)} className="px-3.5 py-1.5 rounded-full border border-ivory/15 text-[11px] text-ivory/65 hover:text-ivory hover:border-ivory/40 transition-colors">
                        {r.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- daily discovery ---------------- */

function Daily() {
  const seed = useMemo(() => {
    const d = new Date();
    return (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % FACTS.length;
  }, []);
  const [n, setN] = useState(0);
  const [shown, setShown] = useState(0);
  const fact = FACTS[(seed + n) % FACTS.length];

  const next = () => { setShown((s) => s + 1); setN((v) => v + 1); progress.bumpDiscovery(); };

  return (
    <div className="h-full border border-ivory/12 rounded-2xl bg-coal/50 p-6 flex flex-col relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,112,79,0.12), transparent 70%)' }} />
      <div className="flex items-center justify-between">
        <span className="tick-label text-coral">Daily discovery</span>
        <span className="text-[10px] text-ivory/35 tabular-nums">#{String((seed + n) % FACTS.length + 1).padStart(2, '0')}/{FACTS.length}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.blockquote
          key={shown}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-xl sm:text-[1.55rem] leading-snug text-ivory/90 mt-6 flex-1"
        >
          “{fact.text}”
        </motion.blockquote>
      </AnimatePresence>
      <div className="flex items-center justify-between mt-6">
        <span className="text-[10px] tracking-[0.22em] uppercase text-ivory/40">Filed under · {fact.tag}</span>
        <button data-cursor="add" onClick={next} className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase font-semibold text-acid hover:gap-3 transition-all">
          Another <Icon name="arrow" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- quiz ---------------- */

function Quiz() {
  const [state, setState] = useState<'idle' | 'active' | 'done'>('idle');
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const prog = useProgress();

  const start = () => { setState('active'); setQi(0); setPicked(null); setScore(0); };
  const q = QUIZ[qi];

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.a) setScore((s) => s + 1);
  };
  const nextQ = () => {
    if (qi + 1 >= QUIZ.length) {
      progress.recordQuiz(score, QUIZ.length);
      setState('done');
    } else { setQi((i) => i + 1); setPicked(null); }
  };

  return (
    <div className="h-full border border-ivory/12 rounded-2xl bg-coal/50 p-6 flex flex-col relative overflow-hidden">
      <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(215,255,69,0.08), transparent 70%)' }} />
      <div className="flex items-center justify-between">
        <span className="tick-label text-acid">Knowledge check</span>
        <span className="text-[10px] tracking-[0.18em] uppercase text-ivory/40">Best · <span className="text-acid">{prog.quizBest}%</span></span>
      </div>

      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} className="flex-1 flex flex-col justify-center">
            <p className="font-display text-2xl text-ivory mt-4">Eight questions.<br />One honest score.</p>
            <p className="text-[13px] text-ivory/50 mt-2">Topics from every world — the museum, the globe and the lab all feed the same brain.</p>
            <button data-cursor="add" onClick={start} className="mt-6 self-start bg-acid text-obsidian px-6 py-3 rounded-full text-[11px] font-semibold tracking-[0.24em] uppercase hover:shadow-[0_0_30px_rgba(215,255,69,0.35)] transition-shadow">
              Begin quiz
            </button>
          </motion.div>
        )}

        {state === 'active' && (
          <motion.div key={`q${qi}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="flex-1 flex flex-col">
            <div className="flex items-center gap-1.5 mt-4">
              {QUIZ.map((_, i) => (
                <span key={i} className={cn('h-1 rounded-full transition-all duration-400', i < qi ? 'w-4 bg-ivory/30' : i === qi ? 'w-8 bg-acid' : 'w-4 bg-ivory/12')} />
              ))}
              <span className="ml-auto text-[10px] text-ivory/40 tabular-nums">{qi + 1}/{QUIZ.length}</span>
            </div>
            <p className="font-display text-xl text-ivory mt-4">{q.q}</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-2">
              {q.options.map((o, i) => {
                const isA = i === q.a;
                const isP = i === picked;
                return (
                  <button
                    key={o}
                    data-cursor="pick"
                    onClick={() => pick(i)}
                    disabled={picked !== null}
                    className={cn(
                      'text-left px-4 py-2.5 rounded-xl border text-[13px] transition-all duration-300',
                      picked === null && 'border-ivory/15 text-ivory/75 hover:border-acid hover:text-ivory hover:pl-5',
                      picked !== null && isA && 'border-acid bg-acid/10 text-acid',
                      picked !== null && isP && !isA && 'border-coral bg-coral/10 text-coral',
                      picked !== null && !isP && !isA && 'border-ivory/8 text-ivory/30'
                    )}
                  >
                    <span className="mr-2 text-[10px] opacity-60">{String.fromCharCode(65 + i)}</span>{o}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-[12px] leading-relaxed text-ivory/55 border-l-2 pl-3" style={{ borderColor: picked === q.a ? '#D7FF45' : '#FF704F' }}>
                {q.why}
              </motion.div>
            )}
            <div className="mt-auto pt-4">
              {picked !== null && (
                <button data-cursor="add" onClick={nextQ} className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase font-semibold text-acid">
                  {qi + 1 >= QUIZ.length ? 'See result' : 'Next question'} <Icon name="arrow" className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {state === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-start justify-center">
            <div className="font-display text-5xl mt-4" style={{ color: score >= 6 ? '#D7FF45' : score >= 4 ? '#F3EBDD' : '#FF704F' }}>
              {score}<span className="text-2xl text-ivory/40"> / {QUIZ.length}</span>
            </div>
            <p className="text-sm text-ivory/55 mt-3">
              {score === QUIZ.length ? 'Flawless. The universe files you under “extremely curious”.' :
               score >= 6 ? 'Strong signal. A few worlds still have your name in the fine print.' :
               'Good start — the museum and the lab will fill the gaps faster than you can scroll.'}
            </p>
            <button data-cursor="add" onClick={start} className="mt-6 border border-ivory/25 px-6 py-3 rounded-full text-[11px] tracking-[0.24em] uppercase text-ivory/80 hover:border-acid hover:text-acid transition-colors">
              Run it again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- paths ---------------- */

function Paths() {
  const prog = useProgress();
  const [open, setOpen] = useState<string | null>(PATHS[0].id);
  const totalSteps = PATHS.reduce((a, p) => a + p.steps.length, 0);

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {PATHS.map((p, pi) => {
        const done = p.steps.filter((_, i) => prog.steps.includes(`${p.id}:${i}`)).length;
        const isOpen = open === p.id;
        return (
          <Reveal key={p.id} delay={pi * 0.07}>
            <div className={cn('border rounded-2xl bg-coal/50 overflow-hidden transition-colors duration-300', isOpen ? 'border-ivory/25' : 'border-ivory/12')}>
              <button data-cursor="view" onClick={() => setOpen(isOpen ? null : p.id)} className="w-full text-left p-5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.accent }} />
                  <h4 className="font-display text-lg text-ivory">{p.title}</h4>
                  <Icon name="plus" className={cn('w-4 h-4 ml-auto text-ivory/40 transition-transform duration-400', isOpen && 'rotate-45')} />
                </div>
                <p className="mt-2 text-[12px] text-ivory/45 leading-relaxed">{p.desc}</p>
                <div className="mt-4 h-1 rounded-full bg-ivory/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(done / p.steps.length) * 100}%`, background: p.accent }} />
                </div>
                <span className="mt-2 block text-[10px] tracking-[0.2em] uppercase text-ivory/40">{done} / {p.steps.length} steps</span>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <div className="px-5 pb-5 space-y-1">
                      {p.steps.map((s, i) => {
                        const key = `${p.id}:${i}`;
                        const doneStep = prog.steps.includes(key);
                        return (
                          <button
                            key={key}
                            data-cursor="pick"
                            onClick={() => progress.toggleStep(key)}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-ivory/4 transition-colors text-left"
                          >
                            <span
                              className={cn('w-4.5 h-4.5 shrink-0 rounded border grid place-items-center transition-all duration-300')}
                              style={{ borderColor: doneStep ? p.accent : 'rgba(243,235,221,0.3)', background: doneStep ? p.accent : 'transparent' }}
                            >
                              {doneStep && <Icon name="check" className="w-3 h-3 text-obsidian" />}
                            </span>
                            <span className={cn('text-[12.5px] transition-colors', doneStep ? 'text-ivory/45 line-through' : 'text-ivory/75')}>{s}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        );
      })}
      <div className="sm:col-span-2 xl:col-span-4 flex items-center gap-3 text-[11px] text-ivory/40 mt-1">
        <span className="h-px flex-1 bg-ivory/8" />
        <span>{totalSteps - prog.steps.length} steps remain across all paths — tap any step to mark it.</span>
        <span className="h-px flex-1 bg-ivory/8" />
      </div>
    </div>
  );
}

/* ---------------- section ---------------- */

export default function Knowledge() {
  const prog = useProgress();
  const totalSteps = PATHS.reduce((a, p) => a + p.steps.length, 0);

  return (
    <section id="knowledge" className="relative py-24 sm:py-32" aria-label="Knowledge discovery">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 85% 90%, rgba(215,255,69,0.04), transparent 60%)' }} />
      <div className="relative max-w-[1500px] mx-auto px-6 sm:px-10">
        <SectionHead
          index="EXP 05"
          label="Knowledge Discovery"
          accent="#FF704F"
          title={<>The <span className="italic text-coral">index</span> of everything here</>}
          sub="Search the whole universe, test yourself, follow a learning path, and watch your own footprint of curiosity accumulate."
        />

        <Reveal delay={0.15} className="mt-12">
          <Search />
        </Reveal>

        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          <Reveal delay={0.1}><Daily /></Reveal>
          <Reveal delay={0.18}><Quiz /></Reveal>
        </div>

        <div className="mt-16">
          <Reveal>
            <div className="flex items-center gap-4 mb-6">
              <span className="tick-label text-ivory/50">Learning paths</span>
              <span className="h-px flex-1 bg-ivory/10" />
            </div>
          </Reveal>
          <Paths />
        </div>

        {/* progress */}
        <Reveal className="mt-16">
          <div className="border border-ivory/12 rounded-2xl bg-coal/50 p-7">
            <div className="flex items-center gap-4 mb-7">
              <span className="tick-label text-acid">Your footprint</span>
              <span className="h-px flex-1 bg-ivory/10" />
              <button data-cursor="add" onClick={() => progress.reset()} className="text-[10px] tracking-[0.2em] uppercase text-ivory/35 hover:text-coral transition-colors">
                Reset
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-7 items-center">
              <StatRing value={prog.quizBest / 100} color="#D7FF45" label="Quiz best" sub={`${prog.quizTaken} attempt${prog.quizTaken === 1 ? '' : 's'}`} />
              <StatRing value={prog.exhibits.length / EXHIBITS.length} color="#FF704F" label="Exhibits" sub={`${prog.exhibits.length} of ${EXHIBITS.length}`} />
              <StatRing value={prog.places.length / LOCATIONS.length} color="#B59AFF" label="Sites charted" sub={`${prog.places.length} of ${LOCATIONS.length}`} />
              <StatRing value={prog.steps.length / totalSteps} color="#7ED9A7" label="Path steps" sub={`${prog.steps.length} of ${totalSteps}`} />
              <div className="text-center">
                <div className="font-display text-4xl text-ivory">{prog.discoveries}</div>
                <div className="tick-label text-ivory/40 mt-1">Discoveries<br />surfaced</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
