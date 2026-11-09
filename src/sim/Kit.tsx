import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { C, rgba, useSimulation, type Spec, type Scenario } from './engine';
import { ASSET_MANIFEST } from './threeEngine';
import { Icon } from '../components/ui';
import { audio } from '../lib/audio';
import { progress, useProgress } from '../lib/progress';
import { cn } from '../utils/cn';

/* ---------------- control atoms ---------------- */

function Slider({ label, value, min, max, step, unit, accent, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; accent: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block group">
      <span className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] tracking-[0.16em] uppercase text-ivory/50 group-hover:text-ivory/80 transition-colors">{label}</span>
        <span className="text-[11px] tabular-nums font-medium" style={{ color: accent }}>
          {step >= 1 ? value.toFixed(0) : value.toFixed(step >= 0.1 ? 1 : 2)}{unit ? <span className="text-ivory/35 ml-0.5">{unit}</span> : null}
        </span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => { onChange(+e.target.value); audio.tick(520 + (+e.target.value - min) / (max - min) * 420); }}
        className="w-full" aria-label={label}
        style={{ accentColor: accent }}
      />
    </label>
  );
}

function Toggle({ label, on, accent, onClick }: { label: string; on: boolean; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={() => { onClick(); audio.tick(on ? 420 : 720); }}
      aria-pressed={on}
      className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] tracking-[0.12em] uppercase transition-all duration-200',
        on ? 'text-obsidian font-semibold border-transparent' : 'border-ivory/15 text-ivory/45 hover:text-ivory/80')}
      style={on ? { background: accent } : undefined}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', on ? 'bg-obsidian' : 'bg-ivory/30')} />
      {label}
    </button>
  );
}

function Choice({ label, options, value, accent, onChange }: { label: string; options: string[]; value: number; accent: string; onChange: (i: number) => void }) {
  return (
    <div>
      <span className="text-[10px] tracking-[0.16em] uppercase text-ivory/50 block mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => { onChange(i); audio.tick(600 + i * 40); }}
            aria-pressed={value === i}
            className={cn('px-2.5 py-1 rounded-md border text-[10.5px] transition-all duration-200',
              value === i ? 'text-obsidian font-semibold border-transparent' : 'border-ivory/12 text-ivory/50 hover:border-ivory/35 hover:text-ivory')}
            style={value === i ? { background: accent } : undefined}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Tool({ icon, label, onClick, tone }: { icon: string; label: string; onClick: () => void; tone?: string }) {
  return (
    <button
      onClick={() => { onClick(); audio.tick(700); }}
      title={label}
      className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-ivory/12 text-[9.5px] tracking-[0.14em] uppercase text-ivory/55 hover:text-ivory hover:border-ivory/35 transition-colors"
      style={tone ? { color: tone, borderColor: rgba(tone, 0.35) } : undefined}
    >
      <Icon name={icon} className="w-3.5 h-3.5" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

/* ---------------- shell ---------------- */

export default function SimShell({ spec, onClose }: { spec: Spec; onClose?: () => void }) {
  const sim = useSimulation(spec);
  const prog = useProgress();
  const [tab, setTab] = useState<'controls' | 'learn'>('controls');
  const bookmarked = prog.bookmarks.some((b) => b.id === `domain:${spec.id}`);

  useEffect(() => {
    progress.openDomain(spec.id);
    progress.visit(spec.id, spec.name, 'domain');
  }, [spec.id, spec.name]);

  const scenarioChips = spec.scenarios ?? [];

  return (
    <div className="flex flex-col h-full min-h-0 bg-obsidian">
      {/* header */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-ivory/10" style={{ background: `linear-gradient(90deg, ${rgba(spec.accent, 0.1)}, transparent 60%)` }}>
        <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg border" style={{ borderColor: rgba(spec.accent, 0.45), color: spec.accent, background: rgba(spec.accent, 0.08) }}>
          <Icon name={spec.glyph} className="w-4.5 h-4.5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg sm:text-2xl leading-tight text-ivory truncate">{spec.name}</h2>
          <p className="text-[10px] tracking-[0.2em] uppercase truncate" style={{ color: spec.accent }}>{spec.tag}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { progress.toggleBookmark(`domain:${spec.id}`, spec.name, 'domain'); audio.chime(); }}
            className={cn('w-9 h-9 grid place-items-center rounded-full border transition-colors', bookmarked ? 'border-acid text-acid' : 'border-ivory/15 text-ivory/50 hover:text-ivory')}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark this domain'}
            aria-label="Bookmark domain"
          >
            <Icon name={bookmarked ? 'check' : 'plus'} className="w-4 h-4" />
          </button>
          {onClose && (
            <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full border border-ivory/15 text-ivory/70 hover:text-coral hover:border-coral transition-colors" aria-label="Close domain" title="Back to all worlds">
              <Icon name="close" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_320px] overflow-y-auto lg:overflow-hidden content-start lg:content-stretch">
        {/* stage + telemetry */}
        <div className="flex flex-col min-h-0 overflow-y-auto sim-scroll">
          <div className="relative shrink-0 h-[46vh] min-h-[300px] sm:h-[52vh] border-b border-ivory/10">
            <canvas
              ref={sim.canvasRef}
              className="w-full h-full block touch-none select-none"
              {...sim.bind}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`${spec.name} interactive simulation stage`}
            />
            {/* The human domain renders through its dedicated WebGL lab. */}
            {/* HUD */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              <span className="px-2 py-1 rounded bg-obsidian/70 backdrop-blur text-[9px] tracking-[0.2em] uppercase" style={{ color: spec.accent }}>
                {sim.running ? 'Live' : 'Paused'} · t {sim.elapsed.toFixed(1)}s
              </span>
              <span className="hidden sm:block px-2 py-1 rounded bg-obsidian/70 backdrop-blur text-[9px] tracking-[0.16em] uppercase text-ivory/40">{sim.scenario}</span>
            </div>
            {spec.orbit !== false && (
              <div className="absolute top-3 right-3 flex gap-1">
                {(['front', 'side', 'back', 'top'] as const).map((v) => (
                  <button key={v} onClick={() => { sim.view(v); audio.tick(560); }}
                    className="px-2 py-1 rounded bg-obsidian/70 backdrop-blur border border-ivory/10 text-[9px] tracking-[0.14em] uppercase text-ivory/55 hover:text-ivory transition-colors">
                    {v}
                  </button>
                ))}
                <button onClick={() => { sim.resetView(); audio.tick(480); }} title="Reset camera"
                  className="px-2 py-1 rounded bg-obsidian/70 backdrop-blur border border-ivory/10 text-[9px] tracking-[0.14em] uppercase text-ivory/55 hover:text-acid transition-colors">
                  ⟲
                </button>
              </div>
            )}
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 pointer-events-none">
              <span className="text-[9px] tracking-[0.16em] uppercase text-ivory/30">
                {spec.orbit !== false ? 'Drag orbit · shift-drag pan · wheel zoom' : 'Drag to pan · wheel zoom'}{spec.hit ? ' · click objects' : ''}
              </span>
              {sim.sel && (
                <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="px-2.5 py-1 rounded-full text-[10px] tracking-[0.14em] uppercase pointer-events-auto"
                  style={{ background: rgba(spec.accent, 0.15), color: spec.accent, border: `1px solid ${rgba(spec.accent, 0.4)}` }}>
                  {sim.info?.title ?? sim.sel}
                </motion.span>
              )}
            </div>
          </div>

          {/* transport */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-ivory/10 bg-coal/50">
            <button onClick={() => { sim.setRunning(!sim.running); audio.tick(sim.running ? 380 : 760); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-semibold tracking-[0.2em] uppercase text-obsidian"
              style={{ background: spec.accent }}>
              <Icon name={sim.running ? 'pause' : 'play'} className="w-3.5 h-3.5" />
              {sim.running ? 'Pause' : 'Run'}
            </button>
            <button onClick={() => { sim.stepOnce(); audio.tick(820); }}
              className="px-3 py-2 rounded-full border border-ivory/15 text-[10px] tracking-[0.18em] uppercase text-ivory/60 hover:text-ivory transition-colors">
              Step
            </button>
            <div className="flex items-center gap-2 min-w-[130px] flex-1 max-w-[220px]">
              <span className="text-[9px] tracking-[0.16em] uppercase text-ivory/40 whitespace-nowrap">Time ×{sim.speed.toFixed(1)}</span>
              <input type="range" min={0.1} max={8} step={0.1} value={sim.speed}
                onChange={(e) => sim.setSpeed(+e.target.value)} className="flex-1" aria-label="Simulation speed" style={{ accentColor: spec.accent }} />
            </div>
            <div className="ml-auto grid grid-cols-3 gap-1.5">
              <Tool icon="target" label="Reset" onClick={() => { sim.reset(); progress.experiment(); }} />
              <Tool icon="spark" label="Random" onClick={() => { sim.randomize(); progress.experiment(); audio.whoosh(); }} />
              <Tool icon="arrow" label="Export" onClick={sim.exportPNG} />
            </div>
          </div>

          {/* readouts */}
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-px bg-ivory/8">
            {sim.readouts.slice(0, 8).map((r) => (
              <div key={r.label} className="bg-obsidian px-3 py-2.5">
                <div className="text-[9px] tracking-[0.16em] uppercase text-ivory/35 truncate">{r.label}</div>
                <div className="text-sm font-semibold tabular-nums mt-0.5 truncate" style={{ color: r.tone ?? C.ivory }}>{r.value}</div>
              </div>
            ))}
          </div>

          {/* graph + explanation */}
          <div className="shrink-0 grid sm:grid-cols-[1fr_1fr] gap-px bg-ivory/8 border-t border-ivory/8">
            <div className="bg-obsidian p-3">
              <div className="text-[9px] tracking-[0.2em] uppercase text-ivory/35 mb-1.5">Live telemetry</div>
              <canvas ref={sim.graphRef} className="w-full h-[86px] block" aria-label="Live simulation graph" />
            </div>
            <div className="bg-obsidian p-3">
              <div className="text-[9px] tracking-[0.2em] uppercase text-ivory/35 mb-1.5">What you are seeing</div>
              <p className="text-[12px] leading-relaxed text-ivory/65">{sim.explain}</p>
            </div>
          </div>

          {/* selection dossier */}
          {sim.info && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="shrink-0 m-3 p-4 rounded-xl border" style={{ borderColor: rgba(spec.accent, 0.3), background: rgba(spec.accent, 0.05) }}>
              <div className="flex items-start gap-3">
                <div className="min-w-0">
                  <h4 className="font-display text-lg text-ivory">{sim.info.title}</h4>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ivory/65">{sim.info.body}</p>
                  {sim.info.facts && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {sim.info.facts.map((f) => (
                        <span key={f} className="px-2 py-1 rounded border border-ivory/12 text-[10.5px] text-ivory/55">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => sim.setSel(null)} className="ml-auto shrink-0 text-ivory/40 hover:text-ivory" aria-label="Dismiss">
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* permanently visible control rail */}
        <aside className="border-t lg:border-t-0 lg:border-l border-ivory/10 bg-coal/40 flex flex-col min-h-0 max-h-[78vh] lg:max-h-none lg:overflow-hidden">
          <div className="shrink-0 flex gap-1 p-2 border-b border-ivory/10">
            {(['controls', 'learn'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 py-1.5 rounded-lg text-[10px] tracking-[0.2em] uppercase transition-colors',
                  tab === t ? 'text-obsidian font-semibold' : 'text-ivory/45 hover:text-ivory')}
                style={tab === t ? { background: spec.accent } : undefined}>
                {t === 'controls' ? 'Instruments' : 'Field notes'}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 sim-scroll">
            {tab === 'controls' ? (
              <>
                {spec.actions && spec.actions.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5">
                    {spec.actions.map((a) => (
                      <button key={a.id}
                        onClick={() => { sim.act(a.id); progress.experiment(); audio.tick(540); }}
                        className="w-full py-2.5 rounded-lg text-[10px] font-semibold tracking-[0.2em] uppercase border transition-all hover:brightness-125"
                        style={{ borderColor: rgba(a.tone ?? spec.accent, 0.5), color: a.tone ?? spec.accent, background: rgba(a.tone ?? spec.accent, 0.08) }}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                {spec.choices?.map((c) => (
                  <Choice key={c.k} label={c.label} options={c.options} value={sim.params[c.k]} accent={spec.accent} onChange={(i) => sim.set(c.k, i)} />
                ))}
                {spec.ctrls.map((c) => (
                  <Slider key={c.k} label={c.label} value={sim.params[c.k]} min={c.min} max={c.max} step={c.step} unit={c.unit} accent={spec.accent}
                    onChange={(v) => { sim.set(c.k, v); }} />
                ))}
                {spec.toggles && spec.toggles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {spec.toggles.map((t) => (
                      <Toggle key={t.k} label={t.label} on={!!sim.params[t.k]} accent={spec.accent} onClick={() => sim.set(t.k, sim.params[t.k] ? 0 : 1)} />
                    ))}
                  </div>
                )}
                {scenarioChips.length > 0 && (
                  <div className="pt-2 border-t border-ivory/10">
                    <span className="text-[10px] tracking-[0.16em] uppercase text-ivory/50 block mb-2">Scenarios</span>
                    <div className="space-y-1.5">
                      {scenarioChips.map((s: Scenario) => (
                        <button key={s.name}
                          onClick={() => { sim.applyScenario(s); progress.experiment(); audio.whoosh(); }}
                          className={cn('w-full text-left px-3 py-2 rounded-lg border transition-colors',
                            sim.scenario === s.name ? 'border-ivory/35 bg-ivory/5' : 'border-ivory/10 hover:border-ivory/25')}>
                          <span className="block text-[11.5px] text-ivory/85">{s.name}</span>
                          <span className="block text-[10.5px] text-ivory/40 leading-snug mt-0.5">{s.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-[12.5px] leading-relaxed text-ivory/70">{spec.blurb}</p>
                <div className="p-3 rounded-lg border border-ivory/12 bg-obsidian/60">
                  <div className="text-[9px] tracking-[0.2em] uppercase mb-1.5" style={{ color: spec.accent }}>Model fidelity</div>
                  <p className="text-[11.5px] leading-relaxed text-ivory/55">{spec.method}</p>
                </div>
                <div className="p-3 rounded-lg border border-ivory/10 bg-obsidian/40">
                  <div className="text-[9px] tracking-[0.2em] uppercase text-ivory/35 mb-1.5">Asset provenance</div>
                  <ul className="space-y-1">
                    {ASSET_MANIFEST.filter((a) => a.name.toLowerCase().includes(spec.id) || a.path === 'runtime').slice(0, 3).map((a) => (
                      <li key={a.name} className="text-[10.5px] leading-relaxed text-ivory/45">
                        <span className="text-ivory/70">{a.name}</span> — {a.source}. {a.licence !== 'procedural' ? `Licence: ${a.licence}.` : 'Generated in-engine.'}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.2em] uppercase text-ivory/40 mb-2">Grounded facts</div>
                  <ul className="space-y-2">
                    {spec.facts.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[12px] leading-relaxed text-ivory/60">
                        <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: spec.accent }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
