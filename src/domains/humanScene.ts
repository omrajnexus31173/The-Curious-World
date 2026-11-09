import { C, TAU, clamp, dot, lerp, rgba, seg, txt, type Env, type Params } from '../sim/engine';
import { bake, ellipsoid, projectPoint, renderMeshes, surface, type Mesh as PDBMesh, type Placed, type V3 } from '../sim/mesh3d';
import * as A from '../sim/anatomy';
import type { PBREngine } from '../sim/threeEngine';

/* ------------------------------------------------------------------ */
/*  BODY REGIONS — quick-focus framing targets in model units.         */
/*  `p` is the pivot the camera orbits; `r` sizes the framing radius.  */
/* ------------------------------------------------------------------ */
export interface BodyRegion { k: string; label: string; p: [number, number, number]; r: number; sys?: string }
export const BODY_REGIONS: BodyRegion[] = [
  { k: 'full', label: 'Full Body', p: [0, 0.20, 0], r: 1.86 },
  { k: 'head', label: 'Head', p: [0, 1.60, 0.01], r: 0.24 },
  { k: 'face', label: 'Face', p: [0, 1.585, 0.10], r: 0.15 },
  { k: 'brain', label: 'Brain', p: [0, 1.60, 0.01], r: 0.17, sys: 'nervous' },
  { k: 'neck', label: 'Neck', p: [0, 1.40, 0.01], r: 0.16 },
  { k: 'shoulders', label: 'Shoulders', p: [0, 1.29, 0.005], r: 0.42 },
  { k: 'chest', label: 'Chest', p: [0, 1.04, 0.03], r: 0.36 },
  { k: 'heart', label: 'Heart', p: [-0.04, 0.90, 0.06], r: 0.19, sys: 'cardio' },
  { k: 'lungs', label: 'Lungs', p: [0, 0.94, 0], r: 0.32, sys: 'resp' },
  { k: 'abdomen', label: 'Abdomen', p: [0, 0.50, 0.05], r: 0.32 },
  { k: 'stomach', label: 'Stomach', p: [-0.15, 0.58, 0.05], r: 0.17, sys: 'digest' },
  { k: 'liver', label: 'Liver', p: [0.21, 0.60, 0.05], r: 0.24, sys: 'digest' },
  { k: 'kidneys', label: 'Kidneys', p: [0, 0.48, -0.11], r: 0.26, sys: 'urinary' },
  { k: 'hands', label: 'Hands', p: [0, 0.30, 0.06], r: 0.50 },
  { k: 'arms', label: 'Arms', p: [0, 0.86, 0.02], r: 0.44 },
  { k: 'pelvis', label: 'Pelvis', p: [0, 0.17, -0.01], r: 0.28, sys: 'skeleton' },
  { k: 'legs', label: 'Legs', p: [0, -0.50, 0.01], r: 0.52 },
  { k: 'knees', label: 'Knees', p: [0, -0.51, 0.03], r: 0.24, sys: 'skeleton' },
  { k: 'feet', label: 'Feet & toes', p: [0, -1.20, 0.03], r: 0.30 },
];
export const regionById = (k: string) => BODY_REGIONS.find((r) => r.k === k) ?? BODY_REGIONS[0];

/* ================================================================== */
/*  WEBGL LAB SCENE                                                    */
/*  One coherent body. Every organ is normalised against its own        */
/*  anatomical radius so 3D and the 2D schematic can never disagree,    */
/*  systems explode into ordered layers, and labels belong to the       */
/*  geometry they name.                                                  */
/* ================================================================== */

/** Target anatomical size per organ, as a fraction of body height.       */
const ANAT: Record<string, { w: number; h: number; tex: string; fit: number }> = {
  brain: { w: 0.30, h: 0.40, tex: 'cortex', fit: 1.0 },
  heart: { w: 0.24, h: 0.28, tex: 'myocardium', fit: 1.0 },
  lungL: { w: 0.34, h: 0.50, tex: 'alveolar', fit: 1.0 },
  lungR: { w: 0.36, h: 0.52, tex: 'alveolar', fit: 1.0 },
  liver: { w: 0.44, h: 0.24, tex: 'organ', fit: 1.0 },
  stomach: { w: 0.26, h: 0.30, tex: 'organ', fit: 1.0 },
  gut: { w: 0.46, h: 0.40, tex: 'organ', fit: 1.0 },
  kidneyL: { w: 0.14, h: 0.20, tex: 'organ', fit: 1.0 },
  kidneyR: { w: 0.14, h: 0.20, tex: 'organ', fit: 1.0 },
  prostate: { w: 0.13, h: 0.10, tex: 'organ', fit: 1.0 },
  bladder: { w: 0.17, h: 0.16, tex: 'organ', fit: 1.0 },
  pancreas: { w: 0.28, h: 0.10, tex: 'organ', fit: 1.0 },
  thyroid: { w: 0.13, h: 0.08, tex: 'organ', fit: 1.0 },
  spleen: { w: 0.17, h: 0.20, tex: 'organ', fit: 1.0 },
  gonads: { w: 0.16, h: 0.16, tex: 'organ', fit: 1.0 },
};

/** Ordered anterior→posterior layers for the exploded view. */
const LAYER_Z: Record<string, number> = {
  skin: 2.55, muscle: 1.7, cardio: 0.85, resp: 0.35, digest: -0.2,
  urinary: -0.7, endo: -1.1, lymph: -1.45, nervous: -1.8, repro: -2.15, skeleton: -2.7,
};

/** Largest horizontal extent of a mesh group, in local units. */
function extent(list: PDBMesh[]): { x: number; y: number; z: number } {
  let mx = 0, my = 0, mz = 0;
  for (const m of list) {
    let ax = 0, ay = 0, az = 0;
    for (let i = 0; i < m.v.length; i += 3) {
      ax = Math.max(ax, Math.abs(m.v[i])); ay = Math.max(ay, Math.abs(m.v[i + 1])); az = Math.max(az, Math.abs(m.v[i + 2]));
    }
    mx = Math.max(mx, ax); my = Math.max(my, ay); mz = Math.max(mz, az);
  }
  return { x: mx, y: my, z: mz };
}

export function buildHumanBodyPBR(eng: PBREngine, organs: OrganRef[], sex: 'M' | 'F', q: number) {
  for (const o of organs) {
    const spec3d = ANAT[o.id];
    const pos: [number, number, number] = [o.p[0], o.p[1], o.p[2]];
    /* Organs fan laterally AND sit on their system's depth layer, so the
       exploded view reads as ordered anatomy rather than a scatter. */
    const layerZ = LAYER_Z[o.sys] ?? 0;
    const dir: [number, number, number] = [
      Math.sign(o.p[0]) * 0.30 + o.p[0] * 0.5,
      (o.p[1] - 0.72) * 0.16,
      layerZ * 0.6,
    ];

    const push = (mesh: PDBMesh, opts: { pos?: [number, number, number]; scale?: number; label?: string | null; tex?: string; opacity?: number } = {}) =>
      eng.add(mesh, {
        pos: opts.pos ?? pos, scale: opts.scale ?? 1, tex: opts.tex ?? spec3d?.tex ?? 'organ',
        id: o.id, tag: o.sys, label: opts.label ?? null, dir,
        opacity: opts.opacity ?? 1,
      });

    if (o.id === 'heart') {
      const H = A.heart(q);
      const parts = [H.wall, H.rv, H.la, H.ra, H.aorta, H.pulmTrunk, H.cavae, H.pulmVeins, H.coronaries, ...H.valves];
      const ext = extent(parts);
      const k = ((spec3d?.w ?? 0.24) / Math.max(0.001, ext.x * 2)) * (spec3d?.fit ?? 1);
      const hp: [number, number, number] = [pos[0], pos[1] - 0.02, pos[2]];
      eng.add(H.wall, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', label: 'Heart', dir });
      eng.add(H.rv, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', dir });
      eng.add(H.la, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', dir });
      eng.add(H.ra, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', dir });
      eng.add(H.lvChamber, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', opacity: 0.85, dir });
      eng.add(H.rvChamber, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', opacity: 0.85, dir });
      H.valves.forEach((v) => eng.add(v, { pos: hp, scale: k, tex: 'cartilage', id: 'heart', tag: 'cardio', dir }));
      eng.add(H.aorta, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', dir });
      eng.add(H.pulmTrunk, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', dir });
      eng.add(H.cavae, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', dir });
      eng.add(H.pulmVeins, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', dir });
      eng.add(H.coronaries, { pos: hp, scale: k, tex: 'organ', id: 'heart', tag: 'cardio', dir });
      continue;
    }
    if (o.id === 'lungL' || o.id === 'lungR') {
      const side = o.id === 'lungL' ? 'L' : 'R';
      const L = A.lung(q, side);
      const ext = extent([...L.lobes, L.bronchi]);
      const k = ((spec3d?.h ?? 0.5) / Math.max(0.001, ext.y * 2)) * (spec3d?.fit ?? 1);
      L.lobes.forEach((lm, i) => eng.add(lm, { pos, scale: k, tex: 'alveolar', id: o.id, tag: 'resp', label: i === 0 ? (side === 'R' ? 'Right lung · 3 lobes' : 'Left lung · 2 lobes') : null, dir }));
      eng.add(A.lungFissures(q, side), { pos, scale: k, tex: 'organ', id: o.id, tag: 'resp', dir });
      eng.add(L.bronchi, { pos, scale: k, tex: 'cartilage', id: o.id, tag: 'resp', dir: [dir[0] * 0.5, dir[1], dir[2]] });
      continue;
    }
    if (o.id === 'brain') {
      const B = A.brain(q);
      const ext = extent([...B.hemis, B.cerebellum, B.stem]);
      const k = ((spec3d?.h ?? 0.4) / Math.max(0.001, Math.max(ext.x, ext.y, ext.z) * 2)) * (spec3d?.fit ?? 1);
      B.hemis.forEach((h, i) => eng.add(h, { pos, scale: k, tex: 'organ', id: 'brain', tag: 'nervous', label: i === 0 ? 'Brain · cerebrum' : null, dir: [0, 0, 0] }));
      eng.add(B.cerebellum, { pos: [pos[0], pos[1] - 0.062, pos[2] - 0.075], scale: k, tex: 'organ', id: 'brain', tag: 'nervous', dir });
      eng.add(B.stem, { pos: [pos[0], pos[1] - 0.062, pos[2] - 0.02], scale: k, tex: 'nerve', id: 'brain', tag: 'nervous', dir });
      eng.add(A.brainSulci(q), { pos, scale: k, tex: 'cortex', id: 'brain', tag: 'nervous', dir, opacity: 0.9 });
      continue;
    }
    if (o.id === 'gut') {
      const G = A.intestines(q);
      const ext = extent([G.small, G.large]);
      const k = ((spec3d?.w ?? 0.46) / Math.max(0.001, ext.x * 2)) * (spec3d?.fit ?? 1);
      eng.add(G.small, { pos, scale: k, tex: 'organ', id: 'gut', tag: 'digest', label: 'Small intestine', dir });
      eng.add(G.large, { pos, scale: k, tex: 'organ', id: 'gut', tag: 'digest', dir });
      continue;
    }
    const mesh = o.id === 'liver' ? A.liver(q) : o.id === 'stomach' ? A.stomach(q)
      : o.id === 'kidneyL' ? A.kidney(q, 'L') : o.id === 'kidneyR' ? A.kidney(q, 'R')
        : o.id === 'bladder' ? A.bladder(q) : o.id === 'pancreas' ? A.pancreas(q)
          : o.id === 'thyroid' ? A.thyroid(q) : o.id === 'spleen' ? A.spleen(q) : A.reproductive(q, sex);
    const ext = extent([mesh]);
    const k = ((spec3d?.w ?? o.r * 2) / Math.max(0.001, ext.x * 2)) * (spec3d?.fit ?? 1);
    push(mesh, { scale: k, label: o.name });
  }

  /* ---- envelope systems: authored in absolute body units, scale 1 ---- */
  const sys = (tag: string, id: string, label: string | null, dirZ: number, extra: { tex?: string; opacity?: number; pickable?: boolean } = {}) => {
    const mesh = tag === 'skin' ? A.skin(q, sex) : tag === 'muscle' ? A.muscles(q, sex) : tag === 'skeleton' ? A.skeleton(q, sex)
      : id === 'arteries' ? A.arteries(q) : id === 'veins' ? A.veins(q) : id === 'nerves' ? A.nerves(q)
        : id === 'lymph' ? A.lymphatics(q) : id === 'pituitary' ? A.pituitary(q)
          : id === 'trachea' ? A.trachea(q) : A.diaphragm(q);
    eng.add(mesh, {
      pos: [0, 0, 0], scale: 1,
      tex: extra.tex ?? (tag === 'skin' ? 'skin' : tag === 'skeleton' ? 'bone' : tag === 'muscle' ? 'muscle' : tag === 'nervous' ? 'nerve' : 'organ'),
      id: extra.pickable === false ? null : id, tag, label, dir: [0, 0, dirZ],
      opacity: extra.opacity ?? 1,
      pickable: tag !== 'skin' && tag !== 'muscle',
    });
  };
  sys('skin', 'skin', 'Skin & body surface', LAYER_Z.skin, { opacity: 0.42, pickable: false });
  sys('muscle', 'muscle', 'Musculature', LAYER_Z.muscle, { pickable: false });
  sys('skeleton', 'skeleton', 'Skeleton', LAYER_Z.skeleton, { tex: 'cortical' });
  sys('cardio', 'arteries', null, LAYER_Z.cardio, { tex: 'organ' });
  sys('cardio', 'veins', 'Vascular network', LAYER_Z.cardio - 0.12);
  sys('nervous', 'nerves', 'Peripheral nerves', LAYER_Z.nervous, { tex: 'nerve' });
  sys('lymph', 'lymph', 'Lymphatic chain', LAYER_Z.lymph);
  sys('endo', 'pituitary', 'Pituitary gland', LAYER_Z.endo);
  sys('resp', 'trachea', 'Trachea & bronchi', LAYER_Z.resp, { tex: 'cartilage' });
  sys('resp', 'diaphragm', 'Diaphragm', LAYER_Z.resp - 0.1, { tex: 'muscle' });

  eng.fit(1200, 700, 0.76);
  const ground = -1.62;
  eng.addStage(ground, 1.35);
  eng.guidesFor(eng.organs.filter((o) => o.id && o.id in ANAT));
}

/** Per-frame anatomy animation driven by the live physiology model. */
export function animateHumanPBR(eng: PBREngine, st: { beat: number; breath: number }) {
  const systole = Math.max(0, Math.sin((st.beat % 1) * Math.PI * 2));
  const inhale = Math.sin((st.breath % 1) * Math.PI * 2);
  for (const o of eng.organs) {
    if (!o.mesh.visible) continue;
    const s = o.baseScale;
    if (o.id === 'heart') o.mesh.scale.setScalar(s * (1 + systole * 0.055));
    else if (o.tag === 'resp') o.mesh.scale.setScalar(s * (1 + Math.max(0, inhale) * 0.05));
  }
}

export interface OrganRef { id: string; name: string; sys: string; p: V3; r: number; color: string }
export interface SysRef { k: string; label: string; color: string; layer: number }
export interface VesselRef { id: string; name: string; path: V3[]; feeds: string[]; color: string }

const FIT: Record<string, number> = {
  heart: 0.92, lungL: 1, lungR: 1, brain: 1, liver: 0.86, stomach: 1, gut: 1,
  kidneyL: 1, kidneyR: 1, bladder: 1, pancreas: 1, thyroid: 1, spleen: 1, gonads: 1,
};

const pulse = (x: number, a: number, b: number) => {
  if (x < a || x > b) return 0;
  return Math.sin(((x - a) / (b - a)) * Math.PI);
};

/** Full anatomical scene. Returns screen-space hit targets for picking. */
export function drawAnatomy(
  ctx: CanvasRenderingContext2D, m: any, p: Params, e: Env,
  ORGANS: OrganRef[], SYSTEMS: SysRef[], VESSELS: VesselRef[],
): { x: number; y: number; id: string; r: number }[] {
  const sex: 'M' | 'F' = Math.round(p.sex) === 1 ? 'F' : 'M';
  /* Distance-aware LOD: the overview stays cheap, close inspection gets
     full geometry. Zooming in genuinely increases mesh resolution. */
  const zoomBoost = e.cam.zoom > 1.35 ? 1 + (e.cam.zoom - 1.35) * 0.55 : 1;
  const q = clamp(e.q * (p.detail ?? 0.8) * zoomBoost, 0.42, 1.4);
  const layerX = (sys: string) => {
    const L = SYSTEMS.find((s) => s.k === sys);
    return p.explode * ((L?.layer ?? 0) - 2) * 0.62;
  };
  const sel = e.sel;
  const iso = sel ? p.isolate : 0;
  const items: Placed[] = [];
  const off = (sys: string, id?: string): V3 => {
    const pull = id && id === sel ? iso : 0;
    return [layerX(sys) + pull * 1.35, pull * 0.12, pull * 0.85];
  };
  const dim = (id?: string) => (sel && iso > 0.25 && id !== sel ? 0.22 : 1);
  const alpha = p.alpha;

  /* ---- envelope: skin, muscle, skeleton ---- */
  if (p.skin) items.push({ mesh: A.skin(q, sex), pos: off('skin'), alpha: alpha * 0.42 * (p.explode > 0.05 ? 1 : 1), id: 'skin' });
  if (p.muscle) items.push({ mesh: A.muscles(q, sex), pos: off('muscle'), alpha: alpha * 0.9, id: 'muscle' });
  if (p.skeleton) items.push({ mesh: A.skeleton(q, sex), pos: off('skeleton'), alpha: alpha, id: 'skeleton' });

  /* ---- nervous / lymphatic ---- */
  if (p.nervous) items.push({ mesh: A.nerves(q), pos: off('nervous'), alpha: alpha * 0.95, id: 'nervous' });
  if (p.lymph) items.push({ mesh: A.lymphatics(q), pos: off('lymph'), alpha: alpha * 0.95, id: 'lymph' });

  /* ---- circulation ---- */
  if (p.cardio) {
    const o = off('cardio');
    items.push({ mesh: A.arteries(q), pos: o, alpha: alpha * 0.95 });
    items.push({ mesh: A.veins(q), pos: o, alpha: alpha * 0.9 });
    if (p.caps) items.push({ mesh: A.capillaries(q), pos: o, alpha: alpha * 0.8 });
  }

  /* ---- organs ---- */
  const phase = (m.beat ?? 0) % 1;
  const atrial = 1 - 0.16 * pulse(phase, 0.0, 0.20);
  const vent = 1 - 0.13 * pulse(phase, 0.22, 0.58);
  const breath = 1 + Math.sin((m.breath ?? 0) * TAU) * 0.075;
  const internal = alpha < 0.55 || sel === 'heart';

  for (const o of ORGANS) {
    if (!p[o.sys]) continue;
    const base = o.p;
    const o3 = off(o.sys, o.id);
    const pos: V3 = [base[0] + o3[0], base[1] + o3[1], base[2] + o3[2]];
    const perf = m.tissue?.[o.id] ?? 1;
    const tint = perf < 0.6 ? '#6E5750' : undefined;
    const a = alpha * dim(o.id) * (o.id === sel ? 1 : 1);
    const fit = FIT[o.id] ?? 1;

    if (o.id === 'heart') {
      const H = A.heart(q);
      const hp: V3 = [pos[0], pos[1] - 0.02, pos[2]];
      const wallA = a * (internal ? 0.42 : 1);
      items.push({ mesh: H.wall, pos: hp, scale: [fit * vent, fit * vent, fit * vent], alpha: wallA, tint, id: 'heart' });
      items.push({ mesh: H.rv, pos: hp, scale: [fit * vent, fit * vent, fit * vent], alpha: wallA, tint, id: 'heart' });
      items.push({ mesh: H.la, pos: hp, scale: fit * atrial, alpha: wallA, tint, id: 'heart' });
      items.push({ mesh: H.ra, pos: hp, scale: fit * atrial, alpha: wallA, tint, id: 'heart' });
      items.push({ mesh: H.lvChamber, pos: hp, scale: fit * (2 - vent) * 0.98, alpha: a * (internal ? 0.95 : 0.35), id: 'heart' });
      items.push({ mesh: H.rvChamber, pos: hp, scale: fit * (2 - vent) * 0.98, alpha: a * (internal ? 0.95 : 0.35), id: 'heart' });
      const avOpen = phase > 0.6 || phase < 0.18;
      const slOpen = phase > 0.22 && phase < 0.56;
      H.valves.forEach((v, i) => items.push({
        mesh: v, pos: hp, scale: fit * ((i < 2 ? avOpen : slOpen) ? 1.16 : 0.82),
        alpha: a * (internal ? 1 : 0.5), id: 'heart',
      }));
      items.push({ mesh: H.aorta, pos: hp, scale: fit, alpha: a, id: 'heart' });
      items.push({ mesh: H.pulmTrunk, pos: hp, scale: fit, alpha: a, id: 'heart' });
      items.push({ mesh: H.cavae, pos: hp, scale: fit, alpha: a, id: 'heart' });
      items.push({ mesh: H.pulmVeins, pos: hp, scale: fit, alpha: a, id: 'heart' });
      items.push({ mesh: H.coronaries, pos: hp, scale: fit * vent, alpha: a, id: 'heart' });
      continue;
    }
    if (o.id === 'lungL' || o.id === 'lungR') {
      const side = o.id === 'lungL' ? 'L' : 'R';
      const L = A.lung(q, side);
      L.lobes.forEach((lm, i) => items.push({
        mesh: lm, pos: [pos[0], pos[1] + (i - 1) * 0.004 * breath, pos[2]],
        scale: [fit * breath, fit * (1 + (breath - 1) * 1.4), fit * breath],
        alpha: a * (internal ? 0.5 : 0.92), tint, id: o.id,
      }));
      items.push({ mesh: L.bronchi, pos, scale: fit, alpha: a, id: o.id });
      continue;
    }
    if (o.id === 'brain') {
      const B = A.brain(q);
      B.hemis.forEach((hm) => items.push({ mesh: hm, pos, scale: fit, alpha: a * (p.regions ? 0.55 : 1), tint, id: 'brain' }));
      if (p.regions) B.regions.forEach((rg) => items.push({ mesh: rg, pos, scale: fit * 1.005, alpha: a * 0.85, id: 'brain' }));
      items.push({ mesh: B.cerebellum, pos: [pos[0], pos[1] - 0.062, pos[2] - 0.075], scale: fit, alpha: a, tint, id: 'brain' });
      items.push({ mesh: B.stem, pos: [pos[0], pos[1] - 0.062, pos[2] - 0.02], scale: fit, alpha: a, tint, id: 'brain' });
      continue;
    }
    if (o.id === 'gut') {
      const G = A.intestines(q);
      items.push({ mesh: G.small, pos, scale: fit, alpha: a, tint, id: o.id });
      items.push({ mesh: G.large, pos, scale: fit, alpha: a, tint, id: o.id });
      continue;
    }
    const mesh =
      o.id === 'liver' ? A.liver(q)
        : o.id === 'stomach' ? A.stomach(q)
          : o.id === 'kidneyL' ? A.kidney(q, 'L')
            : o.id === 'kidneyR' ? A.kidney(q, 'R')
              : o.id === 'bladder' ? A.bladder(q)
                : o.id === 'pancreas' ? A.pancreas(q)
                  : o.id === 'thyroid' ? A.thyroid(q)
                    : o.id === 'spleen' ? A.spleen(q)
                      : A.reproductive(q, sex);
    items.push({ mesh, pos, scale: fit, alpha: a, tint, id: o.id });
  }

  /* ---- airway + diaphragm belong to the respiratory system ---- */
  if (p.resp) {
    const o3 = off('resp');
    items.push({ mesh: A.trachea(q), pos: [o3[0], 0.9 + o3[1], o3[2]], alpha: alpha * dim('lungL') });
    const dome = 1 - (breath - 1) * 5;
    const dia = surface((u, v) => {
      const th = u * Math.PI * 2;
      const r = 0.26 * v;
      return [Math.cos(th) * r, 0.055 * dome * (1 - v * v) - 0.02, Math.sin(th) * r * 0.62];
    }, Math.max(8, Math.round(20 * q)), Math.max(3, Math.round(6 * q)), '#C4553F', { closeU: true, doubleSided: true, spec: 0.3 });
    items.push({ mesh: dia, pos: [o3[0], 0.70 + o3[1], o3[2]], alpha: alpha * 0.55 * dim('lungL') });
  }
  if (p.endo) items.push({ mesh: A.pituitary(q), pos: off('endo'), alpha: alpha * dim('thyroid') });

  /* ---- render ---- */
  renderMeshes(ctx, items, {
    cam: e.cam, w: e.w, h: e.h,
    maxTris: 90000,
    rig: { key: [-0.42, 0.72, -0.55], fill: [0.68, 0.2, 0.45], keyCol: '#FFF3E0', ambient: 0.22 },
  });

  /* ---- flowing blood cells over the vessel tree ---- */
  const hits: { x: number; y: number; id: string; r: number }[] = [];
  if (p.cardio && p.flow) {
    VESSELS.forEach((v) => {
      const blocked = m.blocked === v.id;
      const o3 = off('cardio');
      const pts = v.path.map((q2) => projectPoint(e.cam, e.w, e.h, [q2[0] + o3[0], q2[1] + o3[1], q2[2] + o3[2]]));
      const cells = v.id === 'aorta' ? 14 : 7;
      for (let i = 0; i < cells; i++) {
        const t = ((e.t * ((m.hrNow ?? 70) / 70) * 0.32 + i / cells) % 1);
        if (blocked && t > 0.34) continue;
        const s1 = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
        const lt = t * (pts.length - 1) - s1;
        const X = lerp(pts[s1].x, pts[s1 + 1].x, lt), Y = lerp(pts[s1].y, pts[s1 + 1].y, lt);
        dot(ctx, X, Y, 2.3 * pts[s1].f * e.cam.zoom, rgba(blocked ? '#8a5a50' : v.color, 0.95), 7);
      }
      if (blocked) {
        const mid = pts[Math.floor(pts.length / 2)];
        ctx.strokeStyle = '#FF4F4F'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(mid.x, mid.y, 12, 0, TAU); ctx.stroke();
        seg(ctx, mid.x - 8, mid.y - 8, mid.x + 8, mid.y + 8, '#FF4F4F', 2.2);
        txt(ctx, 'FLOW STOPPED', mid.x + 17, mid.y + 4, 9.5, '#FF4F4F', 'left', 0.95);
      }
    });
  }

  /* ---- labels + pick targets ---- */
  const scale = Math.min(e.w, e.h) * 0.4 * e.cam.zoom;
  const placedLabels: { x: number; y: number; w: number }[] = [];
  for (const o of ORGANS) {
    if (!p[o.sys]) continue;
    const o3 = off(o.sys, o.id);
    const pt = projectPoint(e.cam, e.w, e.h, [o.p[0] + o3[0], o.p[1] + o3[1], o.p[2] + o3[2]]);
    const r = Math.max(13, o.r * scale * pt.f * 1.15);
    hits.push({ x: pt.x, y: pt.y, id: o.id, r });
    const isSel = e.sel === o.id, isHov = e.hover === o.id;
    const perf = m.tissue?.[o.id] ?? 1;
    if (perf < 0.6) txt(ctx, 'ischaemic', pt.x, pt.y - r - 5, 8.5, '#FF4F4F', 'center', 0.95);
    if (p.labels || isSel || isHov) {
      let lx = pt.x + r + 8, ly = pt.y - r * 0.4;
      ctx.font = '600 10px "Space Grotesk", system-ui, sans-serif';
      const tw0 = ctx.measureText(o.name).width + 10;
      let guard = 0;
      while (placedLabels.some((L) => Math.abs(L.y - ly) < 15 && Math.abs(L.x - lx) < (L.w + tw0) / 2) && guard++ < 9) ly += 15;
      if (ly > e.h - 26) ly = e.h - 26;
      placedLabels.push({ x: lx + tw0 / 2, y: ly, w: tw0 });
      seg(ctx, pt.x + r * 0.7, pt.y - r * 0.3, lx - 4, ly, rgba(isSel ? C.acid : C.ivory, 0.45), 1);
      dot(ctx, lx - 4, ly, 2, isSel ? C.acid : C.ivory, 4);
      const tw = ctx.measureText(o.name).width;
      ctx.fillStyle = rgba('#171713', 0.82);
      ctx.fillRect(lx, ly - 9, tw + 10, 16);
      ctx.strokeStyle = rgba(isSel ? C.acid : o.color, 0.55); ctx.lineWidth = 1;
      ctx.strokeRect(lx, ly - 9, tw + 10, 16);
      txt(ctx, o.name, lx + 5, ly + 2.5, 10, isSel ? C.acid : C.ivory, 'left', 1);
    }
    if (isSel) {
      ctx.strokeStyle = rgba(C.acid, 0.55); ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r + 5, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // system pick targets so empty-space clicks on skin/skeleton still inform
  if (p.skeleton) { const pt = projectPoint(e.cam, e.w, e.h, [layerX('skeleton'), 1.6, 0]); hits.push({ x: pt.x, y: pt.y, id: 'skeleton', r: 26 }); }
  return hits;
}

/** Small standalone organ turntable used by the dossier preview. */
export function organPreview(id: string, q: number, sex: 'M' | 'F'): Placed[] {
  const mk = (mesh: any, pos: V3 = [0, 0, 0], scale = 1): Placed => ({ mesh, pos, scale, alpha: 1 });
  if (id === 'heart') {
    const H = A.heart(q);
    return [mk(H.wall), mk(H.rv), mk(H.la), mk(H.ra), mk(H.aorta), mk(H.pulmTrunk), mk(H.cavae), mk(H.pulmVeins), mk(H.coronaries), ...H.valves.map((v) => mk(v))];
  }
  if (id === 'lungL' || id === 'lungR') { const L = A.lung(q, id === 'lungL' ? 'L' : 'R'); return [...L.lobes.map((l) => mk(l, [0, 0, 0], 1)), mk(L.bronchi)]; }
  if (id === 'brain') { const B = A.brain(q); return [...B.hemis.map((h) => mk(h)), mk(B.cerebellum, [0, -0.062, -0.075]), mk(B.stem, [0, -0.062, -0.02])]; }
  if (id === 'gut') { const G = A.intestines(q); return [mk(G.small), mk(G.large)]; }
  if (id === 'skeleton') return [mk(A.skeleton(q, sex), [0, -0.2, 0], 0.42)];
  const mesh = id === 'liver' ? A.liver(q) : id === 'stomach' ? A.stomach(q)
    : id === 'kidneyL' ? A.kidney(q, 'L') : id === 'kidneyR' ? A.kidney(q, 'R')
      : id === 'bladder' ? A.bladder(q) : id === 'pancreas' ? A.pancreas(q)
        : id === 'thyroid' ? A.thyroid(q) : id === 'spleen' ? A.spleen(q) : A.reproductive(q, sex);
  return [mk(mesh, [0, 0, 0], 2.2)];
}

export const previewBackdrop = ellipsoid;
export const previewBake = bake;
