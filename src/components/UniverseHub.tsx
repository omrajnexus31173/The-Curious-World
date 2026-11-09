import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DOMAIN_META, GROUPS, loadSpec } from '../domains/registry';
import type { Spec } from '../sim/engine';
import { Icon, Reveal, SectionHead, StatRing } from './ui';
import { BADGES, MISSIONS, levelOf, progress, useProgress } from '../lib/progress';
import { parseHash, pushRouteHash, dismissRouteHash, useHashChange } from '../lib/route';
import { audio } from '../lib/audio';
import { cn } from '../utils/cn';

const SimShell = lazy(() => import('../sim/Kit'));
const HumanLab = lazy(() => import('../components/HumanLab'));

/* ---------------- error boundary ---------------- */
class DomainBoundary extends Component<{ children: ReactNode; onExit: () => void; accent: string }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) { return { err: e.message || 'This environment could not start.' }; }
  render() {
    if (this.state.err) {
      return (
        <div className="h-full grid place-items-center p-8 text-center">
          <div className="max-w-md">
            <span className="w-12 h-12 mx-auto grid place-items-center rounded-full border" style={{ borderColor: this.props.accent, color: this.props.accent }}>
              <Icon name="spark" />
            </span>
            <h3 className="font-display text-2xl mt-4 text-ivory">This environment hit a problem</h3>
            <p className="mt-2 text-sm text-ivory/55">{this.state.err}</p>
            <div className="mt-6 flex gap-3 justify-center">
              <button onClick={() => this.setState({ err: null })} className="px-5 py-2.5 rounded-full text-[11px] tracking-[0.2em] uppercase font-semibold text-obsidian" style={{ background: this.props.accent }}>Retry</button>
              <button onClick={this.props.onExit} className="px-5 py-2.5 rounded-full border border-ivory/25 text-[11px] tracking-[0.2em] uppercase text-ivory/80">Back to worlds</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------------- card glyph ---------------- */
function CardGlyph({ accent, glyph, seed }: { accent: string; glyph: string; seed: number }) {
  return (
    <div className="relative h-24 overflow-hidden" style={{ background: `radial-gradient(ellipse 80% 90% at 50% 100%, ${accent}18, transparent 70%)` }}>
      <svg viewBox="0 0 200 96" className="absolute inset-0 w-full h-full opacity-40" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} cx={100} cy={96} r={22 + i * 17} fill="none" stroke={accent} strokeWidth="0.6"
            strokeDasharray={i % 2 ? '3 6' : undefined} opacity={0.5 - i * 0.07}
            style={{ transformOrigin: '100px 96px', animation: `spin-slow ${30 + i * 14 + seed}s linear infinite ${i % 2 ? 'reverse' : ''}` }} />
        ))}
      </svg>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-xl border backdrop-blur-sm transition-transform duration-500 group-hover:scale-110"
        style={{ borderColor: `${accent}55`, color: accent, background: `${accent}12` }}>
        <Icon name={glyph} />
      </span>
    </div>
  );
}

/* ---------------- workspace ---------------- */
function Workspace({ id, onClose }: { id: string; onClose: () => void }) {
  const meta = DOMAIN_META.find((d) => d.id === id)!;
  const [spec, setSpec] = useState<Spec | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSpec(null); setErr(null);
    loadSpec(id).then((s) => { if (alive) setSpec(s); }).catch((e) => { if (alive) setErr(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-[85] bg-obsidian flex flex-col"
      initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.99 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} role="dialog" aria-modal="true" aria-label={meta.name}>
      {err ? (
        <div className="h-full grid place-items-center p-8 text-center">
          <div>
            <h3 className="font-display text-2xl text-ivory">Could not load {meta.name}</h3>
            <p className="mt-2 text-sm text-ivory/50">{err}</p>
            <button onClick={onClose} className="mt-6 px-5 py-2.5 rounded-full text-[11px] tracking-[0.2em] uppercase font-semibold text-obsidian" style={{ background: meta.accent }}>Back to worlds</button>
          </div>
        </div>
      ) : !spec ? (
        <div className="h-full grid place-items-center">
          <div className="flex flex-col items-center gap-4">
            <span className="w-14 h-14 rounded-full border-2 border-ivory/10 animate-spin" style={{ borderTopColor: meta.accent }} />
            <span className="tick-label text-ivory/50">Initialising {meta.name}</span>
            <span className="text-[11px] text-ivory/30 max-w-xs text-center">{meta.blurb}</span>
          </div>
        </div>
      ) : (
        <DomainBoundary onExit={onClose} accent={meta.accent}>
          <Suspense fallback={<div className="h-full grid place-items-center tick-label text-ivory/40">Loading instruments…</div>}>
            {spec.id === 'human'
              ? <HumanLab spec={spec} onClose={onClose} />
              : <SimShell spec={spec} onClose={onClose} />}
          </Suspense>
        </DomainBoundary>
      )}
    </motion.div>
  );
}

/* ---------------- section ---------------- */
export default function UniverseHub() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const [open, setOpen] = useState<string | null>(() => {
    const r = parseHash(window.location.hash);
    return r.kind === 'domain' && DOMAIN_META.some((d) => d.id === r.id) ? r.id : null;
  });
  const prog = useProgress();
  const lvl = levelOf(prog.xp);

  const openDomain = useCallback((id: string) => {
    setOpen(id);
    pushRouteHash(`#/domain/${id}`);
    progress.openDomain(id);
    audio.unlock(); audio.whoosh();
  }, []);
  const closeDomain = useCallback(() => { setOpen(null); dismissRouteHash(); }, []);

  useHashChange(() => {
    const r = parseHash(window.location.hash);
    if (r.kind === 'domain' && DOMAIN_META.some((d) => d.id === r.id)) setOpen(r.id);
    else setOpen(null);
  });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return DOMAIN_META.filter((d) => (group === 'All' || d.group === group) &&
      (!s || d.name.toLowerCase().includes(s) || d.tag.toLowerCase().includes(s) || d.blurb.toLowerCase().includes(s)));
  }, [q, group]);

  return (
    <section id="domains" className="relative py-24 sm:py-32" aria-label="The Simulation Universe">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 70% 5%, rgba(232,139,240,0.06), transparent 60%), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(215,255,69,0.04), transparent 60%)' }} />
      <div className="relative max-w-[1500px] mx-auto px-6 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            index="EXP 06"
            label="The Simulation Universe"
            accent="#E88BF0"
            title={<>Twenty-six worlds you can <span className="italic" style={{ color: '#E88BF0' }}>operate</span></>}
            sub="Not articles — running models. Every domain has its own instruments, its own physics and its own visual language. Change a parameter and the world answers immediately."
          />
          <Reveal delay={0.2}>
            <div className="border border-ivory/12 rounded-2xl p-5 bg-coal/50 min-w-[260px]">
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl" style={{ color: '#D7FF45' }}>{lvl.level}</span>
                <div className="min-w-0">
                  <div className="text-[11px] tracking-[0.2em] uppercase text-ivory/70 truncate">{lvl.rank}</div>
                  <div className="text-[10px] text-ivory/40">{prog.xp} XP · {prog.domains.length}/{DOMAIN_META.length} worlds opened</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-ivory/10 overflow-hidden">
                <motion.div className="h-full rounded-full bg-acid" initial={{ width: 0 }} whileInView={{ width: `${lvl.pct * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <div className="mt-2 text-[10px] text-ivory/35">{Math.max(0, lvl.next - prog.xp)} XP to {lvl.level < 11 ? 'next rank' : 'mastery'}</div>
            </div>
          </Reveal>
        </div>

        {/* search + filters */}
        <Reveal delay={0.1}>
          <div className="mt-12 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon name="search" className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ivory/40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 26 simulations — heart, tectonics, backpropagation, aqueduct…"
                className="w-full bg-coal/60 border border-ivory/15 rounded-full pl-11 pr-4 py-3.5 text-sm text-ivory placeholder:text-ivory/30 focus:border-acid focus:outline-none transition-colors"
                aria-label="Search simulation domains" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {GROUPS.map((g) => (
                <button key={g} onClick={() => { setGroup(g); audio.tick(620); }}
                  className={cn('shrink-0 px-4 py-2 rounded-full border text-[10.5px] tracking-[0.18em] uppercase transition-all',
                    group === g ? 'bg-ivory text-obsidian border-transparent font-semibold' : 'border-ivory/15 text-ivory/50 hover:text-ivory')}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* domain grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((d, i) => (
            <Reveal key={d.id} delay={Math.min(i * 0.04, 0.4)}>
              <button onClick={() => openDomain(d.id)} data-cursor="add" data-accent={d.accent}
                className="group w-full text-left border border-ivory/12 rounded-2xl overflow-hidden bg-coal/40 hover:bg-coal transition-all duration-400 hover:-translate-y-1"
                style={{ boxShadow: prog.domains.includes(d.id) ? `inset 0 0 0 1px ${d.accent}33` : undefined }}>
                <CardGlyph accent={d.accent} glyph={d.glyph} seed={i} />
                <div className="p-4 border-t border-ivory/10">
                  <div className="flex items-start gap-2">
                    <h3 className="font-display text-lg leading-tight text-ivory">{d.name}</h3>
                    {prog.domains.includes(d.id) && <Icon name="check" className="w-3.5 h-3.5 ml-auto shrink-0 mt-1" style={{ color: d.accent }} />}
                  </div>
                  <p className="text-[10px] tracking-[0.18em] uppercase mt-1" style={{ color: d.accent }}>{d.tag}</p>
                  <p className="mt-2.5 text-[11.5px] leading-relaxed text-ivory/45 line-clamp-3">{d.blurb}</p>
                  <span className="mt-3 flex items-center gap-2 text-[10px] tracking-[0.22em] uppercase font-semibold" style={{ color: d.accent }}>
                    Open lab <Icon name="arrow" className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </button>
            </Reveal>
          ))}
          {list.length === 0 && <p className="col-span-full text-sm text-ivory/40 py-8">No simulation matches “{q}”. Try “heart”, “orbit” or “circuit”.</p>}
        </div>

        {/* learning layer */}
        <div className="mt-16 grid lg:grid-cols-3 gap-4">
          <Reveal>
            <div className="h-full border border-ivory/12 rounded-2xl bg-coal/40 p-6">
              <span className="tick-label text-acid">Discovery missions</span>
              <div className="mt-4 space-y-3">
                {MISSIONS.map((mi) => {
                  const done = prog.missions.includes(mi.id);
                  return (
                    <div key={mi.id} className={cn('flex gap-3 p-3 rounded-xl border transition-colors', done ? 'border-acid/40 bg-acid/5' : 'border-ivory/10')}>
                      <span className={cn('w-5 h-5 shrink-0 rounded-full border grid place-items-center mt-0.5', done ? 'border-acid bg-acid' : 'border-ivory/25')}>
                        {done && <Icon name="check" className="w-3 h-3 text-obsidian" />}
                      </span>
                      <div className="min-w-0">
                        <div className={cn('text-[12.5px] font-medium', done ? 'text-acid' : 'text-ivory/85')}>{mi.title}</div>
                        <div className="text-[11px] text-ivory/45 leading-snug mt-0.5">{mi.desc}</div>
                        <div className="text-[10px] text-ivory/30 mt-1">+{mi.xp} XP</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="h-full border border-ivory/12 rounded-2xl bg-coal/40 p-6">
              <span className="tick-label" style={{ color: '#E88BF0' }}>Achievements</span>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {BADGES.map((b) => {
                  const got = prog.badges.includes(b.id);
                  return (
                    <div key={b.id} title={b.desc}
                      className={cn('p-3 rounded-xl border text-center transition-all duration-500', got ? 'border-ivory/25 bg-ivory/5' : 'border-ivory/8 opacity-45')}>
                      <Icon name={b.icon} className={cn('w-5 h-5 mx-auto', got ? 'text-acid' : 'text-ivory/40')} />
                      <div className={cn('text-[10.5px] mt-1.5 leading-tight', got ? 'text-ivory/85' : 'text-ivory/45')}>{b.name}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <StatRing value={prog.domains.length / DOMAIN_META.length} size={58} stroke={4} color="#E88BF0" label="Worlds" />
                <StatRing value={prog.badges.length / BADGES.length} size={58} stroke={4} color="#D7FF45" label="Badges" />
                <StatRing value={prog.missions.length / MISSIONS.length} size={58} stroke={4} color="#FF704F" label="Missions" />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="h-full border border-ivory/12 rounded-2xl bg-coal/40 p-6 flex flex-col">
              <span className="tick-label" style={{ color: '#B59AFF' }}>Knowledge companion</span>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ivory/60">
                Every simulation states its own fidelity in the <span className="text-ivory/85">Field notes</span> tab — which equations are exact, which are simplified, and what the model cannot tell you. Read it before drawing conclusions.
              </p>
              <div className="mt-4">
                <div className="text-[10px] tracking-[0.2em] uppercase text-ivory/35 mb-2">Bookmarks</div>
                {prog.bookmarks.length === 0 ? (
                  <p className="text-[11.5px] text-ivory/35 italic">Nothing saved yet — use the + button inside any lab.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {prog.bookmarks.slice(0, 8).map((b) => (
                      <button key={b.id} onClick={() => openDomain(b.id.replace('domain:', ''))}
                        className="px-2.5 py-1 rounded-full border border-ivory/15 text-[10.5px] text-ivory/65 hover:text-ivory hover:border-ivory/40 transition-colors">
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex-1">
                <div className="text-[10px] tracking-[0.2em] uppercase text-ivory/35 mb-2">Exploration history</div>
                <div className="space-y-1 max-h-[150px] overflow-y-auto sim-scroll pr-1">
                  {prog.history.length === 0 && <p className="text-[11.5px] text-ivory/35 italic">Your trail will appear here.</p>}
                  {prog.history.slice(0, 10).map((h) => (
                    <button key={h.id + h.at} onClick={() => h.kind === 'domain' && openDomain(h.id)}
                      className="w-full text-left flex items-center gap-2 text-[11.5px] text-ivory/50 hover:text-ivory transition-colors py-0.5">
                      <span className="w-1 h-1 rounded-full bg-ivory/30" />
                      <span className="truncate">{h.label}</span>
                      <span className="ml-auto text-[9.5px] text-ivory/25 shrink-0">{h.kind}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <AnimatePresence>
        {open && <Workspace key={open} id={open} onClose={closeDomain} />}
      </AnimatePresence>
    </section>
  );
}
