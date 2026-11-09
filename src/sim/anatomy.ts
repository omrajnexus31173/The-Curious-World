import { bake, blob, boxMesh, ellipsoid, lathe, merge, plate, spline, surface, torusMesh, tube, type Mesh, type V3 } from './mesh3d';

/* ================================================================== */
/*  ANATOMY — procedural anatomical meshes.                            */
/*  No primitive stands in for an organ: every structure is a shaped   */
/*  surface built from anatomical proportions. Educational geometry,   */
/*  not a diagnostic model. Built once per (structure, LOD, sex).      */
/* ================================================================== */

export const TISSUE = {
  myocardium: '#B4453A', myocardiumDark: '#8E3229', oxy: '#D9483C', deoxy: '#7C6BB0',
  valve: '#EFE3CF', artery: '#D8483A', vein: '#6E63A8 capillary', capillary: '#E07A6A',
  lung: '#D98C8C', lungDeep: '#C07070', airway: '#E8DCC8',
  brain: '#E4B7A8', cerebellum: '#D9A396', stem: '#D6B49E',
  liver: '#8E4A34', gall: '#7E9B4A', stomach: '#D89A72', gut: '#D9A277', colon: '#C9905F',
  pancreas: '#E0B563', kidney: '#A9503F', pelvis: '#E8D9A8', bladder: '#D9C77E',
  thyroid: '#C4577E', adrenal: '#E3C46A', spleen: '#8E4A6B', node: '#9FD8A8',
  bone: '#EDE6D6', boneDark: '#CFC5AF', cartilage: '#DCE8E4', muscle: '#B04A3C', muscleDeep: '#8E3A30',
  skin: '#E8B89A', fat: '#F0D9A8', nerve: '#E4E86A', uterus: '#C97A8E', ovary: '#D79AA8', testis: '#D9A88E', prostate: '#C9A06A',
};
const VEIN = '#6E63A8';
const CAP = '#E07A6A';

const cache = new Map<string, Mesh>();
function memo(key: string, build: () => Mesh): Mesh {
  const hit = cache.get(key);
  if (hit) return hit;
  const m = build();
  cache.set(key, m);
  return m;
}
export function anatomyCacheSize() { return cache.size; }
export function clearAnatomyCache() { cache.clear(); }

const seg = (q: number, n: number) => Math.max(5, Math.round(n * q));

/* ------------------------------------------------------------------ */
/*  HEART — ventricular mass with interventricular groove, atria with  */
/*  auricles, four valves, aortic arch, pulmonary trunk, venae cavae,  */
/*  pulmonary veins and the coronary tree.                             */
/* ------------------------------------------------------------------ */

export interface HeartParts {
  wall: Mesh; rv: Mesh; la: Mesh; ra: Mesh; lvChamber: Mesh; rvChamber: Mesh;
  valves: Mesh[]; aorta: Mesh; pulmTrunk: Mesh; cavae: Mesh; pulmVeins: Mesh; coronaries: Mesh;
}

export function heart(q: number): HeartParts {
  const S = seg(q, 18), R = seg(q, 13);
  const wall = memo(`h-wall${q}`, () => {
    // Left-ventricular dominant cone: base at y=+0.07, apex at (-0.075,-0.155,0.035)
    const m = surface((u, v) => {
      const th = u * Math.PI * 2;
      const t = v;                                   // 0 base → 1 apex
      const r = 0.105 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.1)), 0.52) * (0.82 + 0.28 * Math.sin(Math.PI * (1 - t) * 0.85));
      // interventricular sulcus on the anterior surface (th ≈ π/2)
      const front = Math.exp(-Math.pow((th - Math.PI / 2) / 0.42, 2));
      const back = Math.exp(-Math.pow((th - Math.PI * 1.5) / 0.5, 2));
      const rr = r * (1 - 0.15 * front - 0.08 * back);
      const cxx = -0.075 * Math.pow(t, 1.5);
      const czz = 0.035 * Math.pow(t, 1.3);
      return [cxx + Math.cos(th) * rr, 0.07 - t * 0.225, czz + Math.sin(th) * rr * 0.8];
    }, S, R, TISSUE.myocardium, { closeU: true, spec: 0.42, rim: 0.5 });
    return m;
  });
  // Right ventricle: crescent wrapped on the anterior-right of the mass
  const rv = memo(`h-rv${q}`, () => surface((u, v) => {
    const th = -0.5 + u * 2.5;
    const t = v;
    const r = 0.098 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.9)), 0.5);
    const cxx = -0.06 * Math.pow(t, 1.5);
    return [cxx + Math.cos(th) * (r + 0.016), 0.055 - t * 0.195, 0.03 + Math.sin(th) * (r + 0.02) * 0.82];
  }, seg(q, 14), seg(q, 11), TISSUE.myocardiumDark, { spec: 0.4, rim: 0.5, doubleSided: true }));

  const la = memo(`h-la${q}`, () => {
    const body = blob((th, phi) => {
      const r = 0.052 * (1 + 0.1 * Math.sin(th * 3));
      return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 0.85, Math.sin(phi) * Math.sin(th) * r * 0.9];
    }, seg(q, 14), seg(q, 10), TISSUE.myocardiumDark, { spec: 0.35 });
    const auricle = blob((th, phi) => {
      const r = 0.026 * (1 + 0.28 * Math.sin(th * 4));
      return [Math.sin(phi) * Math.cos(th) * r * 1.3, Math.cos(phi) * r * 0.6, Math.sin(phi) * Math.sin(th) * r];
    }, seg(q, 12), seg(q, 8), TISSUE.myocardium, { spec: 0.35 });
    return merge([bake(body, { pos: [-0.045, 0.095, -0.055] }), bake(auricle, { pos: [-0.085, 0.075, 0.012], rotZ: 0.4 })], TISSUE.myocardiumDark);
  });
  const ra = memo(`h-ra${q}`, () => {
    const body = blob((th, phi) => {
      const r = 0.056 * (1 + 0.08 * Math.sin(th * 2));
      return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 0.92, Math.sin(phi) * Math.sin(th) * r * 0.85];
    }, seg(q, 14), seg(q, 10), TISSUE.deoxy, { spec: 0.32 });
    const auricle = blob((th, phi) => {
      const r = 0.03 * (1 + 0.3 * Math.sin(th * 5));
      return [Math.sin(phi) * Math.cos(th) * r * 1.25, Math.cos(phi) * r * 0.55, Math.sin(phi) * Math.sin(th) * r];
    }, seg(q, 12), seg(q, 8), TISSUE.deoxy, { spec: 0.32 });
    return merge([bake(body, { pos: [0.062, 0.088, -0.03] }), bake(auricle, { pos: [0.03, 0.082, 0.05], rotZ: -0.35 })], TISSUE.deoxy);
  });

  const lvChamber = memo(`h-lvc${q}`, () => surface((u, v) => {
    const th = u * Math.PI * 2, t = v;
    const r = 0.062 * Math.pow(Math.max(0, 1 - Math.pow(t, 2)), 0.55);
    return [-0.07 * Math.pow(t, 1.5) + Math.cos(th) * r, 0.045 - t * 0.185, 0.03 + Math.sin(th) * r * 0.78];
  }, seg(q, 14), seg(q, 10), TISSUE.oxy, { closeU: true, emissive: 0.12, spec: 0.5 }));
  const rvChamber = memo(`h-rvc${q}`, () => surface((u, v) => {
    const th = -0.4 + u * 2.3, t = v;
    const r = 0.055 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.8)), 0.5);
    return [-0.05 * Math.pow(t, 1.5) + Math.cos(th) * r, 0.035 - t * 0.16, 0.035 + Math.sin(th) * r * 0.8];
  }, seg(q, 12), seg(q, 9), TISSUE.deoxy, { emissive: 0.12, doubleSided: true }));

  const valves = [0, 1, 2, 3].map((i) => memo(`h-v${i}-${q}`, () => {
    const cfg = [
      { p: [-0.032, 0.045, 0.012] as V3, r: 0.031 },  // mitral
      { p: [0.036, 0.04, 0.03] as V3, r: 0.034 },     // tricuspid
      { p: [-0.004, 0.072, -0.004] as V3, r: 0.024 }, // aortic
      { p: [0.026, 0.078, 0.028] as V3, r: 0.025 },   // pulmonary
    ][i];
    const ring = torusMesh(cfg.r, 0.0055, seg(q, 16), seg(q, 6), TISSUE.valve, { spec: 0.6 });
    const leaflets = [0, 1, 2].map((k) => bake(
      ellipsoid(cfg.r * 0.55, 0.004, cfg.r * 0.4, seg(q, 8), seg(q, 5), TISSUE.valve, { spec: 0.55, doubleSided: true }),
      { pos: [Math.cos(k * 2.094) * cfg.r * 0.42, -0.006, Math.sin(k * 2.094) * cfg.r * 0.42], rotY: k * 2.094, rotX: 0.5 },
    ));
    return bake(merge([ring, ...leaflets], TISSUE.valve), { pos: cfg.p, rotX: 0.12 });
  }));

  const aorta = memo(`h-ao${q}`, () => {
    const asc = spline([[0.0, 0.062, -0.006], [-0.004, 0.12, -0.014], [-0.018, 0.168, -0.03], [-0.05, 0.178, -0.052], [-0.072, 0.15, -0.07], [-0.076, 0.09, -0.078], [-0.074, 0.02, -0.08]], seg(q, 26));
    const arch = tube(asc, (t) => 0.027 - t * 0.007, seg(q, 12), TISSUE.artery, { spec: 0.5, rim: 0.45 });
    const branches = [
      [[-0.016, 0.172, -0.036], [-0.006, 0.225, -0.04], [0.004, 0.26, -0.042]],
      [[-0.034, 0.178, -0.044], [-0.036, 0.228, -0.05], [-0.038, 0.262, -0.052]],
      [[-0.052, 0.174, -0.056], [-0.066, 0.222, -0.062], [-0.078, 0.252, -0.066]],
    ].map((p, i) => tube(spline(p as V3[], seg(q, 9)), (t) => 0.0095 - i * 0.0012 - t * 0.002, seg(q, 7), TISSUE.artery, { spec: 0.5 }));
    return merge([arch, ...branches], TISSUE.artery);
  });
  const pulmTrunk = memo(`h-pt${q}`, () => {
    const main = tube(spline([[0.03, 0.06, 0.036], [0.018, 0.115, 0.028], [-0.004, 0.15, 0.006]], seg(q, 12)), () => 0.025, seg(q, 11), VEIN, { spec: 0.45 });
    const l = tube(spline([[-0.004, 0.15, 0.006], [-0.05, 0.152, -0.012], [-0.098, 0.14, -0.03]], seg(q, 10)), (t) => 0.019 - t * 0.004, seg(q, 9), VEIN, { spec: 0.45 });
    const r = tube(spline([[-0.004, 0.15, 0.006], [0.045, 0.148, -0.016], [0.098, 0.136, -0.034]], seg(q, 10)), (t) => 0.019 - t * 0.004, seg(q, 9), VEIN, { spec: 0.45 });
    return merge([main, l, r], VEIN);
  });
  const cavae = memo(`h-vc${q}`, () => {
    const svc = tube(spline([[0.072, 0.265, -0.05], [0.07, 0.19, -0.045], [0.064, 0.12, -0.036]], seg(q, 11)), () => 0.023, seg(q, 10), VEIN, { spec: 0.4 });
    const ivc = tube(spline([[0.07, -0.075, -0.062], [0.068, -0.01, -0.055], [0.064, 0.05, -0.04]], seg(q, 10)), () => 0.025, seg(q, 10), VEIN, { spec: 0.4 });
    return merge([svc, ivc], VEIN);
  });
  const pulmVeins = memo(`h-pv${q}`, () => merge([
    [[-0.11, 0.13, -0.075], [-0.075, 0.115, -0.07]],
    [[-0.108, 0.086, -0.08], [-0.072, 0.09, -0.072]],
    [[0.028, 0.132, -0.088], [-0.012, 0.116, -0.078]],
    [[0.03, 0.088, -0.09], [-0.01, 0.092, -0.078]],
  ].map((p) => tube(spline(p as V3[], seg(q, 7)), () => 0.011, seg(q, 7), TISSUE.artery, { spec: 0.4 })), TISSUE.artery));

  const coronaries = memo(`h-cor${q}`, () => {
    const lad = tube(spline([[-0.004, 0.062, 0.052], [-0.018, 0.0, 0.07], [-0.04, -0.07, 0.062], [-0.062, -0.13, 0.045]], seg(q, 16)), (t) => 0.0062 - t * 0.0034, seg(q, 6), '#E8604C', { spec: 0.6, emissive: 0.06 });
    const cx = tube(spline([[-0.008, 0.06, 0.05], [-0.055, 0.05, 0.03], [-0.082, 0.03, -0.012], [-0.07, 0.005, -0.05]], seg(q, 14)), (t) => 0.0055 - t * 0.0026, seg(q, 6), '#E8604C', { spec: 0.6 });
    const rca = tube(spline([[0.012, 0.062, 0.045], [0.062, 0.05, 0.038], [0.088, 0.02, 0.0], [0.07, -0.01, -0.045], [0.03, -0.04, -0.055]], seg(q, 18)), (t) => 0.0058 - t * 0.0026, seg(q, 6), '#E8604C', { spec: 0.6 });
    const branches = [
      [[-0.02, -0.01, 0.068], [-0.052, -0.03, 0.062]],
      [[-0.036, -0.06, 0.062], [-0.07, -0.075, 0.04]],
      [[0.075, 0.03, 0.02], [0.055, -0.03, 0.04]],
    ].map((p) => tube(spline(p as V3[], seg(q, 6)), () => 0.0028, seg(q, 5), '#E8604C', { spec: 0.6 }));
    return merge([lad, cx, rca, ...branches], '#E8604C');
  });

  return { wall, rv, la, ra, lvChamber, rvChamber, valves, aorta, pulmTrunk, cavae, pulmVeins, coronaries };
}

/* ------------------------------------------------------------------ */
/*  LUNGS — lobed, cardiac notch, hilum, bronchial tree                 */
/* ------------------------------------------------------------------ */

export function lung(q: number, side: 'L' | 'R'): { lobes: Mesh[]; bronchi: Mesh } {
  const s = side === 'L' ? -1 : 1;   // +x = patient right
  const lobeCount = side === 'L' ? 2 : 3;
  const lobes = Array.from({ length: lobeCount }, (_, i) => memo(`lung-${side}${i}-${q}`, () => {
    const top = 0.20 - i * (0.40 / lobeCount);
    const bot = 0.20 - (i + 1) * (0.40 / lobeCount);
    return surface((u, v) => {
      const th = u * Math.PI * 2;
      const y = top + (bot - top) * v;
      const ny = (y + 0.20) / 0.40;                       // 0 base → 1 apex
      // lung silhouette: narrow apex, broad concave base
      let rx = 0.115 * Math.sin(Math.PI * Math.pow(ny, 0.72)) + 0.028;
      let rz = 0.085 * Math.sin(Math.PI * Math.pow(ny, 0.8)) + 0.022;
      // mediastinal flattening on the medial side
      const medial = Math.cos(th) * s < 0 ? 1 : 0;
      if (medial) rx *= 0.72;
      // cardiac notch (left lung, anterior-inferior)
      if (side === 'L' && ny < 0.45 && Math.sin(th) > 0.2) rx *= 0.6;
      const taper = v < 0.06 || v > 0.94 ? 0.9 : 1;       // fissure bevels
      const fiss = 1 - 0.12 * Math.exp(-Math.pow((v - 0.5) / 0.06, 2));
      return [Math.cos(th) * rx * taper * fiss, y, Math.sin(th) * rz * taper * fiss];
    }, seg(q, 20), seg(q, 12), i % 2 ? TISSUE.lungDeep : TISSUE.lung, { closeU: true, spec: 0.22, rim: 0.6 });
  }));
  const bronchi = memo(`bronch-${side}-${q}`, () => {
    const parts: Mesh[] = [];
    const main = tube(spline([[0, 0.235, 0], [-s * 0.03, 0.19, -0.005], [-s * 0.06, 0.14, -0.01]], seg(q, 10)), (t) => 0.016 - t * 0.004, seg(q, 8), TISSUE.airway, { spec: 0.4 });
    parts.push(main);
    for (let i = 0; i < lobeCount; i++) {
      const y = 0.14 - i * 0.09;
      const lobar = tube(spline([[-s * 0.06, 0.14, -0.01], [-s * 0.05, y + 0.02, 0.01], [-s * 0.03, y, 0.02]], seg(q, 8)), (t) => 0.010 - t * 0.003, seg(q, 7), TISSUE.airway, { spec: 0.4 });
      parts.push(lobar);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * 2 - 1;
        parts.push(tube(spline([[-s * 0.03, y, 0.02], [-s * 0.055 + a * 0.02, y - 0.03, 0.02 + a * 0.03], [-s * 0.075 + a * 0.03, y - 0.055, 0.015 + a * 0.05]], seg(q, 7)), (t) => 0.005 - t * 0.0028, seg(q, 5), TISSUE.airway, { spec: 0.4 }));
      }
    }
    return merge(parts, TISSUE.airway);
  });
  return { lobes, bronchi };
}

export function trachea(q: number): Mesh {
  return memo(`trachea${q}`, () => {
    const t = tube(spline([[0, 0.40, 0.005], [0, 0.32, 0], [0, 0.245, -0.004]], seg(q, 12)), () => 0.019, seg(q, 10), TISSUE.airway, { spec: 0.45 });
    const rings: Mesh[] = [];
    for (let i = 0; i < 9; i++) rings.push(bake(torusMesh(0.0205, 0.0032, seg(q, 12), seg(q, 5), '#D8C8AE', { spec: 0.5 }), { pos: [0, 0.395 - i * 0.017, 0.002], rotX: Math.PI / 2 }));
    return merge([t, ...rings], TISSUE.airway);
  });
}

/* ------------------------------------------------------------------ */
/*  BRAIN — gyri, hemispheres, lobes, cerebellar folia, brainstem       */
/* ------------------------------------------------------------------ */

export function brain(q: number): { hemis: Mesh[]; cerebellum: Mesh; stem: Mesh; regions: Mesh[] } {
  const hemis = [-1, 1].map((s) => memo(`brain-h${s}-${q}`, () => blob((th, phi) => {
    // convoluted cortical surface: superimposed folding frequencies
    const fold = 1
      + 0.055 * Math.sin(th * 7 + Math.cos(phi * 5) * 2)
      + 0.045 * Math.sin(phi * 11 + Math.sin(th * 4) * 1.6)
      + 0.028 * Math.sin(th * 13 + phi * 9);
    const rx = 0.088 * fold, ry = 0.078 * fold, rz = 0.115 * fold;
    let x = Math.sin(phi) * Math.cos(th) * rx;
    const y = Math.cos(phi) * ry;
    let z = Math.sin(phi) * Math.sin(th) * rz;
    // flatten the medial wall to form the longitudinal fissure
    if (x * s < 0) x *= 0.24;
    // temporal lobe overhang
    if (y < -0.01 && Math.abs(z) < 0.06) z *= 1.1;
    return [x + s * 0.026, y, z];
  }, seg(q, 34), seg(q, 24), TISSUE.brain, { spec: 0.3, rim: 0.55 })));

  const cerebellum = memo(`cereb${q}`, () => blob((th, phi) => {
    const folia = 1 + 0.05 * Math.sin(phi * 26);
    const r = 0.055 * folia;
    let x = Math.sin(phi) * Math.cos(th) * r * 1.5;
    if (Math.abs(x) < 0.008) x *= 0.4;
    return [x, Math.cos(phi) * r * 0.72, Math.sin(phi) * Math.sin(th) * r];
  }, seg(q, 26), seg(q, 18), TISSUE.cerebellum, { spec: 0.28, rim: 0.5 }));

  const stem = memo(`stem${q}`, () => {
    const pons = ellipsoid(0.026, 0.022, 0.024, seg(q, 12), seg(q, 9), TISSUE.stem, { spec: 0.3 });
    const medulla = tube(spline([[0, -0.02, 0.005], [0, -0.055, 0.0], [0, -0.095, -0.006]], seg(q, 10)), (t) => 0.017 - t * 0.005, seg(q, 9), TISSUE.stem, { spec: 0.3 });
    return merge([bake(pons, { pos: [0, 0.005, 0.012] }), medulla], TISSUE.stem);
  });

  // lobe overlays used when regional colouring is on
  const regions = [
    { n: 'Frontal', c: '#E8A08C', p: [0, 0.012, 0.085] as V3, s: [0.085, 0.062, 0.045] as V3 },
    { n: 'Parietal', c: '#E8C08C', p: [0, 0.05, -0.01] as V3, s: [0.082, 0.045, 0.06] as V3 },
    { n: 'Occipital', c: '#C8A0E0', p: [0, 0.005, -0.098] as V3, s: [0.062, 0.05, 0.032] as V3 },
    { n: 'Temporal', c: '#8FD8C8', p: [0, -0.045, 0.02] as V3, s: [0.095, 0.032, 0.06] as V3 },
  ].map((r, i) => memo(`brain-r${i}-${q}`, () => bake(
    blob((th, phi) => {
      const fold = 1 + 0.05 * Math.sin(th * 8 + phi * 6);
      return [Math.sin(phi) * Math.cos(th) * r.s[0] * fold, Math.cos(phi) * r.s[1] * fold, Math.sin(phi) * Math.sin(th) * r.s[2] * fold];
    }, seg(q, 18), seg(q, 12), r.c, { spec: 0.3 }), { pos: r.p })));

  return { hemis, cerebellum, stem, regions };
}

/* ------------------------------------------------------------------ */
/*  ABDOMINAL ORGANS                                                   */
/* ------------------------------------------------------------------ */

export function liver(q: number): Mesh {
  return memo(`liver${q}`, () => {
    const main = surface((u, v) => {
      const th = u * Math.PI * 2, t = v;
      // wedge: thick right lobe tapering to a thin left blade
      const span = 1 - t;
      const rx = 0.155 * (0.35 + 0.65 * Math.sin(Math.PI * Math.pow(t, 0.7)));
      const rz = 0.085 * (0.4 + 0.6 * Math.sin(Math.PI * Math.pow(t, 0.8)));
      const x = Math.cos(th) * rx;
      const y = 0.055 - t * 0.11 + Math.sin(th) * 0.03 * span;
      const z = Math.sin(th) * rz * (x > 0 ? 1 : 0.62);
      return [x, y, z];
    }, seg(q, 24), seg(q, 14), TISSUE.liver, { closeU: true, spec: 0.42, rim: 0.5 });
    const gall = bake(ellipsoid(0.018, 0.032, 0.018, seg(q, 10), seg(q, 8), TISSUE.gall, { spec: 0.5 }), { pos: [0.045, -0.045, 0.055], rotZ: 0.3 });
    const falciform = bake(boxMesh(0.004, 0.075, 0.07, '#D8C8B0'), { pos: [-0.028, 0.02, 0.01] });
    return merge([main, gall, falciform], TISSUE.liver);
  });
}

export function kidney(q: number, side: 'L' | 'R'): Mesh {
  const s = side === 'L' ? -1 : 1;
  return memo(`kidney${side}${q}`, () => {
    const bean = blob((th, phi) => {
      // hilum concavity on the medial border
      const medial = Math.cos(th) * s < 0;
      const notch = medial ? 1 - 0.42 * Math.exp(-Math.pow((phi - Math.PI / 2) / 0.55, 2)) : 1;
      const r = 0.055 * notch;
      return [Math.sin(phi) * Math.cos(th) * r * 0.62, Math.cos(phi) * r * 1.35, Math.sin(phi) * Math.sin(th) * r * 0.72];
    }, seg(q, 20), seg(q, 16), TISSUE.kidney, { spec: 0.45, rim: 0.5 });
    const pelvis = bake(ellipsoid(0.016, 0.024, 0.012, seg(q, 9), seg(q, 7), TISSUE.pelvis, { spec: 0.4 }), { pos: [-s * 0.022, 0, 0] });
    const ureter = tube(spline([[-s * 0.026, -0.01, 0], [-s * 0.02, -0.09, 0.01], [-s * 0.006, -0.17, 0.02]], seg(q, 10)), () => 0.005, seg(q, 6), TISSUE.pelvis, { spec: 0.4 });
    const adrenal = bake(ellipsoid(0.024, 0.012, 0.016, seg(q, 9), seg(q, 6), TISSUE.adrenal, { spec: 0.4 }), { pos: [0, 0.078, 0] });
    return merge([bean, pelvis, ureter, adrenal], TISSUE.kidney);
  });
}

export function stomach(q: number): Mesh {
  return memo(`stomach${q}`, () => {
    const path = spline([[-0.01, 0.085, 0], [-0.045, 0.055, 0.006], [-0.062, 0.01, 0.012], [-0.045, -0.035, 0.014], [0.0, -0.05, 0.01], [0.035, -0.028, 0.004], [0.05, -0.005, 0]], seg(q, 22));
    const body = tube(path, (t) => 0.014 + 0.036 * Math.sin(Math.PI * Math.pow(t, 0.72)) * (1 - t * 0.35), seg(q, 16), TISSUE.stomach, { spec: 0.4, rim: 0.5 });
    const rugae = tube(path, (t) => (0.014 + 0.036 * Math.sin(Math.PI * Math.pow(t, 0.72)) * (1 - t * 0.35)) * 0.82, seg(q, 12), '#C4886A', { spec: 0.3 });
    const oeso = tube(spline([[-0.008, 0.14, -0.004], [-0.01, 0.09, 0]], seg(q, 7)), () => 0.012, seg(q, 8), TISSUE.stomach, { spec: 0.4 });
    return merge([body, rugae, oeso], TISSUE.stomach);
  });
}

export function intestines(q: number): { small: Mesh; large: Mesh } {
  const small = memo(`small${q}`, () => {
    const pts: V3[] = [];
    const coils = 7;
    for (let i = 0; i <= coils * 8; i++) {
      const t = i / (coils * 8);
      const row = Math.floor(t * coils);
      const u = (t * coils) % 1;
      const dir = row % 2 ? 1 - u : u;
      pts.push([
        (dir - 0.5) * 0.19 * (1 - Math.abs(row / coils - 0.5) * 0.35),
        0.055 - row * 0.019 - Math.sin(u * Math.PI) * 0.008,
        0.02 + Math.sin(t * 22) * 0.022,
      ]);
    }
    return tube(spline(pts, seg(q, 56)), (t) => 0.0165 + Math.sin(t * 40) * 0.0012, seg(q, 6), TISSUE.gut, { spec: 0.35, rim: 0.5 });
  });
  const large = memo(`large${q}`, () => {
    const path = spline([
      [0.098, -0.075, 0.015], [0.10, -0.02, 0.02], [0.10, 0.055, 0.02],
      [0.05, 0.082, 0.03], [-0.03, 0.086, 0.03], [-0.095, 0.06, 0.02],
      [-0.10, -0.01, 0.018], [-0.095, -0.062, 0.015], [-0.055, -0.092, 0.012],
      [-0.012, -0.098, 0.008], [0, -0.135, 0.004],
    ], seg(q, 34));
    const colon = tube(path, (t) => 0.026 * (1 + 0.16 * Math.sin(t * 34)) * (1 - t * 0.22), seg(q, 8), TISSUE.colon, { spec: 0.35, rim: 0.5 });
    const caecum = bake(ellipsoid(0.03, 0.028, 0.028, seg(q, 12), seg(q, 9), TISSUE.colon, { spec: 0.35 }), { pos: [0.098, -0.085, 0.015] });
    const appendix = tube(spline([[0.098, -0.105, 0.02], [0.088, -0.13, 0.03], [0.076, -0.14, 0.02]], seg(q, 8)), () => 0.005, seg(q, 6), TISSUE.colon, { spec: 0.35 });
    return merge([colon, caecum, appendix], TISSUE.colon);
  });
  return { small, large };
}

export function pancreas(q: number): Mesh {
  return memo(`panc${q}`, () => {
    const path = spline([[0.075, -0.012, -0.01], [0.05, 0.0, -0.012], [0.01, 0.008, -0.014], [-0.03, 0.014, -0.016], [-0.062, 0.024, -0.018]], seg(q, 20));
    const body = tube(path, (t) => 0.026 * (1 - t * 0.62) * (1 + 0.12 * Math.sin(t * 18)), seg(q, 10), TISSUE.pancreas, { spec: 0.4, flatten: 0.7 });
    const duct = tube(path, () => 0.0035, seg(q, 6), '#F0E0B0', { spec: 0.5 });
    return merge([body, duct], TISSUE.pancreas);
  });
}

export function spleen(q: number): Mesh {
  return memo(`spleen${q}`, () => blob((th, phi) => {
    const r = 0.045 * (1 + 0.12 * Math.sin(th * 2));
    return [Math.sin(phi) * Math.cos(th) * r * 0.65, Math.cos(phi) * r * 1.15, Math.sin(phi) * Math.sin(th) * r * 0.85];
  }, seg(q, 16), seg(q, 12), TISSUE.spleen, { spec: 0.4, rim: 0.5 }));
}

export function bladder(q: number): Mesh {
  return memo(`bladder${q}`, () => {
    const b = blob((th, phi) => {
      const r = 0.042 * (1 - 0.2 * Math.cos(phi));
      return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 0.9, Math.sin(phi) * Math.sin(th) * r * 0.85];
    }, seg(q, 16), seg(q, 12), TISSUE.bladder, { spec: 0.45 });
    const urethra = tube(spline([[0, -0.038, 0.005], [0, -0.07, 0.012]], seg(q, 5)), () => 0.006, seg(q, 6), TISSUE.bladder);
    return merge([b, urethra], TISSUE.bladder);
  });
}

export function thyroid(q: number): Mesh {
  return memo(`thyroid${q}`, () => {
    const lobes = [-1, 1].map((s) => bake(ellipsoid(0.014, 0.026, 0.012, seg(q, 10), seg(q, 8), TISSUE.thyroid, { spec: 0.45 }), { pos: [s * 0.019, 0, 0], rotZ: s * 0.18 }));
    const isthmus = bake(boxMesh(0.024, 0.010, 0.010, TISSUE.thyroid), { pos: [0, -0.006, 0.004] });
    return merge([...lobes, isthmus], TISSUE.thyroid);
  });
}

export function reproductive(q: number, sex: 'M' | 'F'): Mesh {
  return memo(`repro${sex}${q}`, () => {
    if (sex === 'F') {
      const uterus = blob((th, phi) => {
        const r = 0.032 * (1 - 0.32 * Math.cos(phi));
        return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 1.25, Math.sin(phi) * Math.sin(th) * r * 0.62];
      }, seg(q, 16), seg(q, 12), TISSUE.uterus, { spec: 0.4 });
      const tubes = [-1, 1].map((s) => tube(spline([[s * 0.026, 0.03, 0], [s * 0.058, 0.038, 0.004], [s * 0.078, 0.022, 0.008]], seg(q, 9)), () => 0.005, seg(q, 6), TISSUE.uterus));
      const ovaries = [-1, 1].map((s) => bake(ellipsoid(0.014, 0.009, 0.009, seg(q, 10), seg(q, 7), TISSUE.ovary, { spec: 0.45 }), { pos: [s * 0.082, 0.014, 0.01] }));
      return merge([uterus, ...tubes, ...ovaries], TISSUE.uterus);
    }
    const prostate = bake(ellipsoid(0.021, 0.017, 0.019, seg(q, 12), seg(q, 9), TISSUE.prostate, { spec: 0.4 }), { pos: [0, 0.028, 0.004] });
    const vesicles = [-1, 1].map((s) => bake(ellipsoid(0.011, 0.019, 0.009, seg(q, 9), seg(q, 7), TISSUE.prostate, { spec: 0.4 }), { pos: [s * 0.024, 0.05, -0.012], rotZ: s * 0.3 }));
    const testes = [-1, 1].map((s) => bake(ellipsoid(0.017, 0.022, 0.017, seg(q, 12), seg(q, 9), TISSUE.testis, { spec: 0.4 }), { pos: [s * 0.026, -0.062, 0.012] }));
    const cords = [-1, 1].map((s) => tube(spline([[s * 0.02, 0.02, 0], [s * 0.024, -0.02, 0.008], [s * 0.026, -0.045, 0.012]], seg(q, 8)), () => 0.005, seg(q, 6), TISSUE.testis));
    return merge([prostate, ...vesicles, ...testes, ...cords], TISSUE.prostate);
  });
}

/* ------------------------------------------------------------------ */
/*  SKELETON                                                           */
/* ------------------------------------------------------------------ */

function longBone(a: V3, b: V3, r: number, q: number, knobs = 1): Mesh {
  const path = spline([a, mixv(a, b, 0.35), mixv(a, b, 0.68), b], seg(q, 7));
  return tube(path, (t) => r * (1 + knobs * (0.85 * Math.exp(-Math.pow(t / 0.1, 2)) + 0.85 * Math.exp(-Math.pow((1 - t) / 0.1, 2)))), seg(q, 6), TISSUE.bone, { spec: 0.4, rim: 0.45 });
}
const mixv = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function skeleton(q: number, sex: 'M' | 'F'): Mesh {
  return memo(`skel${sex}${q}`, () => {
    const parts: Mesh[] = [];
    const fem = sex === 'F';
    const shoulder = fem ? 0.36 : 0.42, hip = fem ? 0.20 : 0.175;

    // cranium, facial bones, mandible and dentition
    parts.push(bake(skull(q, sex), { pos: [0, 1.596, 0.008] }));

    // vertebral column with cervical/thoracic/lumbar curves
    const spinePts: V3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const y = 1.44 - t * 1.24;
      const z = -0.02 - 0.055 * Math.sin(t * Math.PI * 1.35) + (t > 0.72 ? 0.03 * (t - 0.72) * 3 : 0);
      spinePts.push([0, y, z]);
    }
    for (let i = 0; i < 24; i++) {
      const t = i / 24;
      const r = 0.019 + t * 0.014;
      const p = spinePts[i];
      parts.push(bake(lathe([[r, -0.013], [r * 1.06, 0.013]], seg(q, 5), TISSUE.bone, { spec: 0.35 }), { pos: p }));
      parts.push(bake(boxMesh(0.010, 0.012, 0.032, TISSUE.boneDark), { pos: [p[0], p[1], p[2] - 0.026] }));
    }

    // ribcage — 12 pairs sweeping from spine to sternum
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const y = 1.30 - i * 0.062;
      const spread = shoulder * (0.52 + 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.15)));
      const floating = i >= 10;
      [-1, 1].forEach((s) => {
        const pts: V3[] = [
          [s * 0.022, y, -0.075],
          [s * spread * 0.82, y - 0.012, -0.045],
          [s * spread, y - 0.05, 0.028],
          [s * spread * 0.62, y - 0.085, 0.082],
        ];
        if (!floating) pts.push([s * 0.028, y - 0.098, 0.095]);
        parts.push(tube(spline(pts, seg(q, 7)), (u) => 0.0085 - u * 0.002, seg(q, 3), TISSUE.bone, { spec: 0.35, flatten: 0.55 }));
      });
    }
    parts.push(bake(boxMesh(0.045, 0.20, 0.014, TISSUE.bone), { pos: [0, 1.16, 0.098] }));

    // shoulder girdle
    [-1, 1].forEach((s) => {
      parts.push(tube(spline([[0, 1.335, 0.085], [s * shoulder * 0.5, 1.35, 0.06], [s * shoulder * 0.92, 1.315, 0.012]], seg(q, 10)), () => 0.0095, seg(q, 6), TISSUE.bone, { spec: 0.4 }));
      parts.push(plate(spline([[s * shoulder * 0.42, 1.30, -0.075], [s * shoulder * 0.86, 1.24, -0.07], [s * shoulder * 0.76, 1.14, -0.06]], seg(q, 8)), () => 0.045, 0.16, seg(q, 5), TISSUE.boneDark, { spec: 0.35 }));
    });

    // pelvis
    [-1, 1].forEach((s) => {
      parts.push(plate(spline([
        [s * 0.03, 0.24, -0.06], [s * hip * 0.95, 0.30, -0.03],
        [s * hip * 1.05, 0.20, 0.03], [s * hip * 0.72, 0.10, 0.055], [s * 0.045, 0.075, 0.05],
      ], seg(q, 16)), (t) => 0.05 * (1 - 0.35 * t), 0.2, seg(q, 6), TISSUE.bone, { spec: 0.35 }));
    });
    parts.push(bake(boxMesh(0.055, 0.10, 0.035, TISSUE.boneDark), { pos: [0, 0.20, -0.055] }));

    // limbs
    [-1, 1].forEach((s) => {
      const sh: V3 = [s * shoulder, 1.30, 0.005];
      const el: V3 = [s * (shoulder + 0.035), 0.86, 0.012];
      const wr: V3 = [s * (shoulder + 0.05), 0.44, 0.022];
      parts.push(longBone(sh, el, 0.017, q));
      parts.push(longBone([el[0] + s * 0.012, el[1], el[2]], [wr[0] + s * 0.014, wr[1], wr[2]], 0.011, q, 0.7));
      parts.push(longBone([el[0] - s * 0.012, el[1], el[2] - 0.006], [wr[0] - s * 0.012, wr[1], wr[2] - 0.006], 0.010, q, 0.7));
      parts.push(bake(hand(q, s as 1 | -1, 'bone'), { pos: [wr[0], wr[1] - 0.035, wr[2] + 0.002] }));
      const hp: V3 = [s * hip * 0.82, 0.16, 0.01];
      const kn: V3 = [s * (hip * 0.86), -0.50, 0.02];
      const an: V3 = [s * (hip * 0.88), -1.16, 0.0];
      parts.push(longBone(hp, kn, 0.024, q));
      parts.push(bake(ellipsoid(0.022, 0.018, 0.012, seg(q, 10), seg(q, 7), TISSUE.cartilage, { spec: 0.55 }), { pos: [kn[0], kn[1] + 0.012, kn[2] + 0.038] }));
      parts.push(longBone([kn[0], kn[1] - 0.02, kn[2]], an, 0.018, q, 0.8));
      parts.push(longBone([kn[0] + s * 0.028, kn[1] - 0.03, kn[2] - 0.01], [an[0] + s * 0.024, an[1], an[2] - 0.01], 0.008, q, 0.6));
      parts.push(bake(foot(q, s as 1 | -1, 'bone'), { pos: [an[0], -1.206, -0.016] }));
      parts.push(bake(ellipsoid(0.016, 0.014, 0.012, 7, 5, TISSUE.boneDark), { pos: [an[0], -1.196, -0.048] }));
    });
    return merge(parts, TISSUE.bone);
  });
}

/* ------------------------------------------------------------------ */
/*  MUSCULATURE — named groups                                         */
/* ------------------------------------------------------------------ */

export function muscles(q: number, sex: 'M' | 'F'): Mesh {
  return memo(`musc${sex}${q}`, () => {
    const parts: Mesh[] = [];
    const shoulder = sex === 'F' ? 0.35 : 0.41, hip = sex === 'F' ? 0.20 : 0.18;
    const bulk = sex === 'F' ? 0.86 : 1;
    const spindle = (a: V3, b: V3, r: number, col: string) => tube(
      spline([a, mixv(a, b, 0.3), mixv(a, b, 0.7), b], seg(q, 8)),
      (t) => r * (0.35 + 0.85 * Math.sin(Math.PI * Math.pow(t, 0.85))), seg(q, 7), col, { spec: 0.34, rim: 0.55 },
    );
    [-1, 1].forEach((s) => {
      // pectoralis major (fan)
      parts.push(plate(spline([[s * 0.02, 1.24, 0.085], [s * shoulder * 0.5, 1.20, 0.082], [s * shoulder * 0.86, 1.16, 0.05]], seg(q, 10)), (t) => 0.055 * (1 - t * 0.35) * bulk, 0.32, seg(q, 7), TISSUE.muscle, { spec: 0.34 }));
      // deltoid cap
      parts.push(bake(ellipsoid(0.055 * bulk, 0.065 * bulk, 0.055 * bulk, seg(q, 12), seg(q, 9), TISSUE.muscle, { spec: 0.34 }), { pos: [s * shoulder, 1.26, 0.01] }));
      // biceps / triceps
      parts.push(spindle([s * shoulder, 1.22, 0.03], [s * (shoulder + 0.04), 0.88, 0.035], 0.032 * bulk, TISSUE.muscle));
      parts.push(spindle([s * shoulder, 1.22, -0.03], [s * (shoulder + 0.04), 0.88, -0.03], 0.030 * bulk, TISSUE.muscleDeep));
      // forearm flexors
      parts.push(spindle([s * (shoulder + 0.04), 0.85, 0.024], [s * (shoulder + 0.05), 0.47, 0.03], 0.026 * bulk, TISSUE.muscle));
      // obliques + lats
      parts.push(plate(spline([[s * shoulder * 0.78, 1.12, -0.03], [s * 0.16, 0.80, -0.05], [s * 0.13, 0.52, -0.02]], seg(q, 10)), (t) => 0.06 * (1 - t * 0.3), 0.3, seg(q, 6), TISSUE.muscleDeep, { spec: 0.3 }));
      // gluteus
      parts.push(bake(ellipsoid(0.07 * bulk, 0.075 * bulk, 0.055 * bulk, seg(q, 12), seg(q, 9), TISSUE.muscleDeep, { spec: 0.3 }), { pos: [s * hip * 0.72, 0.16, -0.07] }));
      // quadriceps (two visible heads) + hamstring
      parts.push(spindle([s * hip * 0.82, 0.10, 0.045], [s * hip * 0.86, -0.46, 0.05], 0.052 * bulk, TISSUE.muscle));
      parts.push(spindle([s * hip * 1.05, 0.08, 0.01], [s * hip * 0.98, -0.44, 0.02], 0.040 * bulk, TISSUE.muscle));
      parts.push(spindle([s * hip * 0.82, 0.08, -0.05], [s * hip * 0.86, -0.46, -0.04], 0.045 * bulk, TISSUE.muscleDeep));
      // gastrocnemius (two heads) + tibialis
      parts.push(spindle([s * hip * 0.86 - 0.018, -0.54, -0.03], [s * hip * 0.88, -1.02, -0.01], 0.036 * bulk, TISSUE.muscle));
      parts.push(spindle([s * hip * 0.86 + 0.018, -0.54, -0.03], [s * hip * 0.88, -1.02, -0.01], 0.032 * bulk, TISSUE.muscle));
      parts.push(spindle([s * hip * 0.86, -0.56, 0.035], [s * hip * 0.88, -1.05, 0.03], 0.024 * bulk, TISSUE.muscleDeep));
      // rectus abdominis segments
      for (let i = 0; i < 4; i++) {
        parts.push(bake(ellipsoid(0.030 * bulk, 0.030, 0.022, seg(q, 10), seg(q, 7), TISSUE.muscle, { spec: 0.34 }), { pos: [s * 0.036, 1.02 - i * 0.078, 0.082] }));
      }
      // trapezius
      parts.push(plate(spline([[s * 0.02, 1.40, -0.05], [s * shoulder * 0.55, 1.32, -0.06], [s * shoulder * 0.9, 1.27, -0.03]], seg(q, 9)), () => 0.045, 0.28, seg(q, 6), TISSUE.muscleDeep, { spec: 0.3 }));
      // sternocleidomastoid
      parts.push(spindle([s * 0.045, 1.50, -0.01], [s * 0.03, 1.33, 0.06], 0.012, TISSUE.muscle));
    });
    return merge([...parts, limbMuscles(q, sex)], TISSUE.muscle);
  });
}

/* ------------------------------------------------------------------ */
/*  SKIN / BODY SURFACE                                                */
/* ------------------------------------------------------------------ */

export function skin(q: number, sex: 'M' | 'F'): Mesh {
  return memo(`skin${sex}${q}`, () => {
    const f = sex === 'F';
    const shoulder = f ? 0.36 : 0.43, waist = f ? 0.20 : 0.25, hip = f ? 0.29 : 0.255;
    const parts: Mesh[] = [];
    // torso: shoulders → chest → waist → hips
    const torso = surface((u, v) => {
      const th = u * Math.PI * 2;
      const y = 1.40 - v * 1.28;
      let rx: number, rz: number;
      if (v < 0.10) { rx = shoulder * (0.62 + v * 3.8); rz = 0.115 + v * 0.4; }
      else if (v < 0.30) { rx = shoulder * (1 - (v - 0.10) * 0.35); rz = 0.155 - (v - 0.10) * 0.06; }
      else if (v < 0.55) { const t = (v - 0.30) / 0.25; rx = shoulder * 0.93 + (waist - shoulder * 0.93) * t; rz = 0.143 - t * 0.028; }
      else { const t = (v - 0.55) / 0.45; rx = waist + (hip - waist) * Math.sin(t * Math.PI * 0.6); rz = 0.115 + t * 0.03; }
      if (f && v > 0.14 && v < 0.28) rz += 0.045 * Math.sin((v - 0.14) / 0.14 * Math.PI) * Math.max(0, Math.sin(th));
      return [Math.cos(th) * rx, y, Math.sin(th) * rz];
    }, seg(q, 18), seg(q, 16), TISSUE.skin, { closeU: true, spec: 0.22, rim: 0.7 });
    parts.push(torso);
    // head, face and neck — sculpted rather than a scaled sphere
    parts.push(bake(head(q, sex), { pos: [0, 1.592, 0.010] }));
    // limbs
    [-1, 1].forEach((s) => {
      parts.push(tube(spline([[s * shoulder * 0.9, 1.32, 0.005], [s * (shoulder + 0.025), 1.05, 0.012], [s * (shoulder + 0.042), 0.86, 0.02], [s * (shoulder + 0.05), 0.46, 0.028], [s * (shoulder + 0.05), 0.34, 0.03]], seg(q, 11)),
        (t) => (0.062 - t * 0.026) * (f ? 0.9 : 1), seg(q, 9), TISSUE.skin, { spec: 0.22, rim: 0.7 }));
      parts.push(bake(hand(q, s as 1 | -1, 'skin'), { pos: [s * (shoulder + 0.05), 0.335, 0.030] }));
      parts.push(tube(spline([[s * hip * 0.55, 0.24, 0.005], [s * hip * 0.78, -0.2, 0.015], [s * hip * 0.84, -0.52, 0.02], [s * hip * 0.86, -0.9, 0.0], [s * hip * 0.88, -1.18, 0.0]], seg(q, 12)),
        (t) => (0.105 - t * 0.052) * (f ? 1.02 : 1), seg(q, 10), TISSUE.skin, { spec: 0.22, rim: 0.7 }));
      parts.push(bake(foot(q, s as 1 | -1, 'skin'), { pos: [s * hip * 0.88, -1.212, 0.012] }));
      // deltoid cap and gluteal contour keep the shoulder/hip silhouette human
      parts.push(bake(ellipsoid(0.062, 0.070, 0.060, Math.max(9, Math.round(q * 12)), Math.max(7, Math.round(q * 9)), TISSUE.skin), { pos: [s * (shoulder + 0.012), 1.286, 0.004] }));
      parts.push(bake(ellipsoid(0.075, 0.062, 0.052, 9, 7, TISSUE.skin), { pos: [s * hip * 0.66, 0.155, -0.062] }));
      if (f) [-1, 1].forEach((t) => parts.push(bake(ellipsoid(0.052, 0.046, 0.040, 9, 7, TISSUE.skin), { pos: [t * 0.072, 1.166, 0.126], rotX: 0.18 })));
      else [-1, 1].forEach((t) => parts.push(bake(ellipsoid(0.062, 0.040, 0.024, 9, 6, TISSUE.skin), { pos: [t * 0.070, 1.176, 0.120], rotZ: t * 0.12 })));
      [-1, 1].forEach((t) => parts.push(bake(ellipsoid(0.011, 0.009, 0.007, 6, 5, '#D89278'), { pos: [t * 0.072, f ? 1.148 : 1.168, 0.160] })));
    });
    return merge(parts, TISSUE.skin);
  });
}

/* ------------------------------------------------------------------ */
/*  VASCULAR + NERVOUS + LYMPHATIC TREES                               */
/* ------------------------------------------------------------------ */

export function arteries(q: number): Mesh {
  return memo(`art${q}`, () => {
    const P: Mesh[] = [];
    const T = (pts: V3[], r0: number, r1: number, n = 14) => P.push(tube(spline(pts, seg(q, Math.round(n * 0.7))), (t) => r0 + (r1 - r0) * t, seg(q, 5), TISSUE.artery, { spec: 0.5, rim: 0.45 }));
    T([[0, 0.93, 0.05], [-0.01, 1.04, 0.0], [-0.03, 1.10, -0.04], [-0.05, 1.02, -0.06], [-0.04, 0.7, -0.05], [-0.02, 0.35, -0.04], [0, 0.16, -0.03]], 0.022, 0.014, 26);
    [-1, 1].forEach((s) => {
      T([[-0.02, 1.08, -0.045], [s * 0.05, 1.22, -0.03], [s * 0.045, 1.42, -0.01], [s * 0.035, 1.56, 0.01]], 0.011, 0.006);
      T([[-0.03, 1.09, -0.04], [s * 0.2, 1.28, -0.01], [s * 0.42, 1.24, 0.0], [s * 0.465, 0.88, 0.012], [s * 0.478, 0.46, 0.022]], 0.012, 0.005, 18);
      T([[0, 0.44, -0.04], [s * 0.1, 0.44, -0.08], [s * 0.19, 0.44, -0.11]], 0.008, 0.006, 8);
      T([[0, 0.18, -0.03], [s * 0.1, 0.08, -0.01], [s * 0.15, -0.3, 0.01], [s * 0.16, -0.75, 0.0], [s * 0.16, -1.15, 0.0]], 0.013, 0.005, 20);
    });
    T([[0, 0.62, -0.02], [0.04, 0.60, 0.03], [0.1, 0.57, 0.05]], 0.009, 0.006, 8);
    return merge(P, TISSUE.artery);
  });
}

export function veins(q: number): Mesh {
  return memo(`vein${q}`, () => {
    const P: Mesh[] = [];
    const T = (pts: V3[], r0: number, r1: number, n = 14) => P.push(tube(spline(pts, seg(q, Math.round(n * 0.7))), (t) => r0 + (r1 - r0) * t, seg(q, 5), VEIN, { spec: 0.42, rim: 0.5 }));
    T([[0.05, 1.30, -0.03], [0.055, 1.05, -0.035], [0.05, 0.95, -0.02]], 0.019, 0.021, 12);
    T([[0.045, 0.16, -0.05], [0.05, 0.5, -0.055], [0.05, 0.88, -0.04]], 0.020, 0.022, 16);
    [-1, 1].forEach((s) => {
      T([[s * 0.05, 1.58, -0.01], [s * 0.055, 1.4, -0.02], [s * 0.05, 1.28, -0.03]], 0.009, 0.012, 10);
      T([[s * 0.484, 0.46, -0.005], [s * 0.47, 0.9, -0.015], [s * 0.42, 1.26, -0.03], [s * 0.06, 1.30, -0.035]], 0.006, 0.013, 18);
      T([[s * 0.17, -1.15, -0.02], [s * 0.17, -0.6, -0.02], [s * 0.15, -0.1, -0.03], [s * 0.05, 0.16, -0.05]], 0.006, 0.014, 18);
    });
    T([[0.02, 0.5, 0.02], [0.06, 0.55, -0.01], [0.12, 0.57, 0.02]], 0.010, 0.012, 8);
    return merge(P, VEIN);
  });
}

export function capillaries(q: number): Mesh {
  return memo(`cap${q}`, () => {
    const P: Mesh[] = [];
    const beds: [V3, number, number][] = [[[0.24, 0.92, 0], 0.13, 34], [[-0.24, 0.92, 0], 0.12, 34], [[0.2, 0.56, 0.05], 0.11, 20], [[0, 0.3, 0.06], 0.12, 22], [[0.21, 0.44, -0.1], 0.05, 12], [[-0.21, 0.44, -0.1], 0.05, 12]];
    beds.forEach(([c, r, n], bi) => {
      const count = Math.round(n * q);
      for (let i = 0; i < count; i++) {
        const a = (i * 2.399), rad = r * Math.sqrt((i + 0.5) / count);
        const p0: V3 = [c[0] + Math.cos(a) * rad, c[1] + Math.sin(a * 1.7) * r * 0.8, c[2] + Math.sin(a) * rad * 0.7];
        const p1: V3 = [p0[0] + Math.cos(a * 3 + bi) * 0.022, p0[1] + Math.sin(a * 2) * 0.018, p0[2] + Math.sin(a * 3) * 0.02];
        P.push(tube(spline([p0, p1], 3), () => 0.0016, 3, CAP, { emissive: 0.2 }));
      }
    });
    return merge(P, CAP);
  });
}

export function nerves(q: number): Mesh {
  return memo(`nerve${q}`, () => {
    const P: Mesh[] = [];
    P.push(tube(spline([[0, 1.50, -0.01], [0, 1.3, -0.055], [0, 1.0, -0.075], [0, 0.6, -0.06], [0, 0.24, -0.05]], seg(q, 20)), (t) => 0.014 - t * 0.006, seg(q, 8), TISSUE.nerve, { emissive: 0.18, spec: 0.4 }));
    for (let i = 0; i < 9; i++) {
      const y = 1.30 - i * 0.115;
      [-1, 1].forEach((s) => {
        P.push(tube(spline([[0, y, -0.06], [s * 0.14, y - 0.03, -0.03], [s * (0.26 + i * 0.012), y - 0.07, 0.02]], seg(q, 5)), (t) => 0.005 - t * 0.0028, seg(q, 3), TISSUE.nerve, { emissive: 0.18 }));
      });
    }
    [-1, 1].forEach((s) => {
      P.push(tube(spline([[s * 0.4, 1.26, -0.02], [s * 0.462, 0.9, 0.005], [s * 0.474, 0.4, 0.02]], seg(q, 14)), (t) => 0.008 - t * 0.004, seg(q, 6), TISSUE.nerve, { emissive: 0.18 }));
      P.push(tube(spline([[s * 0.12, 0.2, -0.04], [s * 0.16, -0.4, -0.01], [s * 0.17, -1.1, 0.0]], seg(q, 16)), (t) => 0.011 - t * 0.006, seg(q, 6), TISSUE.nerve, { emissive: 0.18 }));
    });
    return merge(P, TISSUE.nerve);
  });
}

export function lymphatics(q: number): Mesh {
  return memo(`lymph${q}`, () => {
    const P: Mesh[] = [];
    const nodes: V3[] = [];
    [-1, 1].forEach((s) => {
      for (let i = 0; i < 4; i++) nodes.push([s * (0.05 + i * 0.006), 1.46 - i * 0.045, 0.01]);
      for (let i = 0; i < 5; i++) nodes.push([s * (0.34 + i * 0.02), 1.24 - i * 0.03, -0.01]);
      for (let i = 0; i < 4; i++) nodes.push([s * (0.13 + i * 0.012), 0.16 - i * 0.035, 0.03]);
    });
    nodes.forEach((p, i) => P.push(bake(ellipsoid(0.011, 0.008, 0.008, seg(q, 8), seg(q, 6), TISSUE.node, { spec: 0.4, emissive: 0.08 }), { pos: p, rotZ: i * 0.4 })));
    P.push(tube(spline([[0.02, 0.2, -0.04], [0.01, 0.7, -0.05], [-0.01, 1.15, -0.045], [-0.05, 1.28, -0.03]], seg(q, 16)), () => 0.006, seg(q, 6), TISSUE.node, { emissive: 0.08 }));
    return merge(P, TISSUE.node);
  });
}


/** Diaphragm — the dome separating thorax and abdomen. */
export function diaphragm(q: number): Mesh {
  return memo(`diaph${q}`, () => surface((u, v) => {
    const th = u * Math.PI * 2;
    const rr = 0.24 * v;
    const dome = 0.09 * (1 - v * v);
    const side = Math.cos(th) < 0 ? 0.78 : 1;   // heart hollows the left dome
    return [Math.cos(th) * rr, dome, Math.sin(th) * rr * 0.66 * side];
  }, seg(q, 22), seg(q, 8), '#C4553F', { closeU: true, doubleSided: true, spec: 0.35 }));
}
export function pituitary(q: number): Mesh {
  return memo(`pit${q}`, () => bake(ellipsoid(0.011, 0.009, 0.011, seg(q, 9), seg(q, 7), TISSUE.thyroid, { spec: 0.5, emissive: 0.1 }), { pos: [0, 1.545, 0.01] }));
}

/* ================================================================== */
/*  DISTAL LIMB & HEAD DETAIL — added in the realism pass.             */
/*  Hands with separate metacarpals, phalanges and thenar mass; feet   */
/*  with tarsals, toes and an arch; a head with nose, ears, brow and   */
/*  jaw. Authored procedurally from anthropometric proportions.        */
/* ================================================================== */

const V = (x: number, y: number, z: number): V3 => [x, y, z];

/** Finger ray from a knuckle, gently flexed. */
function finger(q: number, base: V3, len: number, rad: number, col: string, bones: boolean) {
  const mid: V3 = [base[0], base[1] - len * 0.42, base[2] + 0.014];
  const tip: V3 = [base[0], base[1] - len, base[2] + 0.038];
  const seg1 = 0.0086, per = bones ? 4 : 7;
  if (bones) {
    return merge([
      tube([base, mid], () => seg1, per, col, { spec: 0.42 }),
      tube([mid, [tip[0], tip[1] + len * 0.34, tip[2] - 0.012]], () => seg1 * 0.86, per, col, { spec: 0.42 }),
      tube([[tip[0], tip[1] + len * 0.34, tip[2] - 0.012], tip], () => seg1 * 0.7, per, col, { spec: 0.42 }),
    ], col);
  }
  return tube(spline([base, mid, tip], Math.max(4, Math.round(q * 5))), (t) => rad * (1 - t * 0.34), 4, col, { spec: 0.22, rim: 0.6 });
}

/** Palmar block with the correct wedge silhouette. */
function palm(q: number, col: string, soft: boolean): Mesh {
  return surface((u, v) => {
    const th = u * Math.PI * 2;
    const t = v;
    const w = (0.030 + 0.006 * Math.sin(Math.PI * t)) * (1 - t * 0.16);
    const d = (0.016 - t * 0.004) * (soft ? 1 : 0.8);
    return [Math.cos(th) * w * 1.55, -t * 0.098, Math.sin(th) * d];
  }, Math.max(8, Math.round(q * 11)), Math.max(3, Math.round(q * 5)), col, { closeU: true, spec: 0.22, rim: 0.55 });
}

/** Whole hand: palm, four fingers, thumb, knuckles. Origin = wrist. */
export function hand(q: number, side: 1 | -1, kind: 'skin' | 'bone' | 'muscle'): Mesh {
  return memo(`hand-${kind}${side}${q.toFixed(2)}`, () => {
    const col = kind === 'skin' ? TISSUE.skin : kind === 'bone' ? TISSUE.bone : TISSUE.muscle;
    const parts: Mesh[] = [palm(q, col, kind !== 'bone')];
    const len = [0.070, 0.082, 0.078, 0.064];
    for (let i = 0; i < 4; i++) {
      const bx = (-0.027 + i * 0.018) * 1;
      parts.push(bake(finger(q, V(bx, -0.098, 0.004), len[i] * (kind === 'bone' ? 1.02 : 1), kind === 'bone' ? 0.009 : 0.0105, col, kind === 'bone'), { }));
    }
    const thumbBase = V(side * 0.030, -0.042, 0.016);
    const thumbMid = V(side * 0.052, -0.078, 0.030);
    const thumbTip = V(side * 0.058, -0.108, 0.046);
    if (kind === 'bone') {
      parts.push(tube([V(side * 0.036, -0.02, 0.010), thumbBase], () => 0.0095, 4, col, { spec: 0.4 }));
      parts.push(tube([thumbBase, thumbMid], () => 0.009, 4, col, { spec: 0.4 }));
      parts.push(tube([thumbMid, thumbTip], () => 0.0075, 4, col, { spec: 0.4 }));
      for (let i = 0; i < 5; i++) parts.push(bake(ellipsoid(0.0075, 0.009, 0.006, 6, 5, col), { pos: V(-0.030 + i * 0.015, -0.010, 0.002) }));
    } else {
      parts.push(tube(spline([V(side * 0.026, -0.012, 0.012), thumbBase, thumbMid, thumbTip], Math.max(5, Math.round(q * 7))), (t) => 0.0132 - t * 0.004, 4, col, { spec: 0.22, rim: 0.55 }));
      if (kind === 'muscle') {
        parts.push(bake(ellipsoid(0.017, 0.028, 0.011, 8, 6, TISSUE.muscle), { pos: V(side * 0.026, -0.052, 0.017), rotZ: -side * 0.3 }));
        parts.push(bake(ellipsoid(0.014, 0.026, 0.010, 8, 6, TISSUE.muscleDeep), { pos: V(-side * 0.028, -0.050, 0.012), rotZ: side * 0.25 }));
      }
    }
    return bake(merge(parts, col), { pos: [0, 0, 0], scale: [side, 1, 1], rotY: side > 0 ? 0 : Math.PI });
  });
}

/** Foot: sole wedge, heel, arch, five toes. Origin = ankle joint. */
export function foot(q: number, side: 1 | -1, kind: 'skin' | 'bone' | 'muscle'): Mesh {
  return memo(`foot-${kind}${side}${q.toFixed(2)}`, () => {
    const col = kind === 'skin' ? TISSUE.skin : kind === 'bone' ? TISSUE.bone : TISSUE.muscle;
    const parts: Mesh[] = [];
    if (kind === 'bone') {
      parts.push(bake(ellipsoid(0.026, 0.024, 0.026, 8, 6, col), { pos: V(0, -0.012, -0.030) }));          // calcaneus
      parts.push(bake(ellipsoid(0.018, 0.016, 0.016, 7, 5, col), { pos: V(0, 0.006, 0.006) }));            // talus
      for (let i = 0; i < 4; i++) parts.push(bake(ellipsoid(0.010, 0.009, 0.010, 6, 5, col), { pos: V(-0.020 + i * 0.014, 0.002, -0.006 - (i % 2) * 0.006) }));
      for (let i = 0; i < 5; i++) parts.push(tube([V(-0.024 + i * 0.0125, -0.002, 0.006), V(-0.023 + i * 0.0125, -0.004, 0.062)], () => 0.0055, 4, col, { spec: 0.4 }));
      const tl = [0.030, 0.023, 0.020, 0.017, 0.015];
      for (let i = 0; i < 5; i++) {
        const bx = -0.026 + i * 0.013;
        parts.push(tube([V(bx, -0.006, 0.064), V(bx, -0.008, 0.064 + tl[i])], () => 0.005, 4, col, { spec: 0.4 }));
      }
      return bake(merge(parts, col), { scale: [side, 1, 1] });
    }
    parts.push(surface((u, v) => {
      const th = u * Math.PI * 2, t = v;
      const w = (0.030 + 0.004 * Math.sin(Math.PI * t)) * (1 - t * 0.14);
      const d = 0.019 - t * 0.003;
      return [Math.cos(th) * w * 1.45, -0.004 + Math.sin(th) * d * (t < 0.35 ? 1.35 : 0.75), t * 0.108 - 0.052];
    }, Math.max(10, Math.round(q * 16)), Math.max(5, Math.round(q * 8)), col, { closeU: true, spec: 0.22, rim: 0.5 }));
    parts.push(bake(ellipsoid(0.027, 0.023, 0.022, 9, 7, col), { pos: V(0, -0.014, -0.046) }));            // heel
    const tl = [0.0155, 0.0125, 0.011, 0.0095, 0.0085];
    for (let i = 0; i < 5; i++) {
      parts.push(bake(ellipsoid(tl[i] * 1.05, tl[i] * 0.82, tl[i], 8, 6, col), { pos: V(-0.026 + i * 0.0132, -0.008 - tl[i] * 0.15, 0.062 + tl[i] * 0.9), rotY: (i - 2) * 0.05 }));
    }
    return bake(merge(parts, col), { scale: [side, 1, 1] });
  });
}

/** Head & face silhouette: cranium, brow, nose, lips, jaw, ears. Origin = head centre. */
export function head(q: number, sex: 'M' | 'F'): Mesh {
  return memo(`head${sex}${q.toFixed(2)}`, () => {
    const male = sex === 'M';
    const skull = blob((th, phi) => {
      const r = 0.106 * (1 + 0.045 * Math.cos(phi * 2));
      const front = Math.max(0, Math.sin(th)) * Math.max(0, -Math.cos(phi));
      return [
        Math.sin(phi) * Math.cos(th) * r * 0.84,
        Math.cos(phi) * r * 1.06,
        Math.sin(phi) * Math.sin(th) * r * (Math.sin(th) > 0 ? 1.0 : 0.95) + front * 0.010,
      ];
    }, Math.max(11, Math.round(q * 18)), Math.max(8, Math.round(q * 12)), TISSUE.skin, { spec: 0.24, rim: 0.68 });
    const jaw = surface((u, v) => {
      const th = -Math.PI * 0.62 + u * Math.PI * 1.24;
      const t = v;
      const rx = 0.070 - t * 0.030, rz = 0.072 - t * 0.020;
      return [Math.sin(th) * rx, -0.072 - t * 0.046, Math.cos(th) * -rz * -1];
    }, Math.max(9, Math.round(q * 13)), Math.max(4, Math.round(q * 6)), TISSUE.skin, { spec: 0.22, rim: 0.6, doubleSided: true });
    const nose = tube(spline([V(0, 0.004, 0.092), V(0, -0.020, 0.104), V(0, -0.034, 0.096), V(0, -0.040, 0.104)], Math.max(6, Math.round(q * 8))),
      (t) => 0.0075 + (1 - Math.abs(t - 0.55) * 1.4) * 0.0085, Math.max(5, Math.round(q * 7)), TISSUE.skin, { spec: 0.22 });
    const brow = bake(ellipsoid(0.062, 0.011, 0.026, 9, 5, TISSUE.skin), { pos: V(0, 0.030, 0.084), rotX: male ? 0.05 : 0.02 });
    const lips = bake(ellipsoid(0.019, 0.0075, 0.011, 8, 5, '#C97A6E'), { pos: V(0, -0.056, 0.093) });
    const chin = bake(ellipsoid(0.021, 0.016, 0.016, 8, 6, TISSUE.skin), { pos: V(0, -0.100, 0.068), scale: [male ? 1.1 : 0.94, 1, 1] });
    const ears = [-1, 1].map((s) => bake(
      surface((u, v) => {
        const th = u * Math.PI * 2, t = v;
        return [Math.cos(th) * 0.007, Math.sin(th) * 0.021 * (1 - t * 0.2), t * 0.012];
      }, Math.max(7, Math.round(q * 10)), Math.max(4, Math.round(q * 5)), TISSUE.skin, { closeU: true, spec: 0.22 }),
      { pos: V(s * 0.088, -0.004, -0.006), rotY: s * 0.45, rotZ: s * -0.12 }));
    const neck = tube(spline([V(0, -0.10, 0.004), V(0, -0.176, 0.000), V(0, -0.226, -0.010)], Math.max(6, Math.round(q * 8))),
      (t) => 0.048 - t * 0.010 + (t > 0.6 ? (t - 0.6) * 0.05 : 0), Math.max(8, Math.round(q * 12)), TISSUE.skin, { spec: 0.22, rim: 0.6 });
    return merge([skull, jaw, nose, brow, lips, chin, ...ears, neck], TISSUE.skin);
  });
}

/** Cranial bones + facial skeleton, replacing the earlier block face. */
export function skull(q: number, sex: 'M' | 'F'): Mesh {
  return memo(`skull2${sex}${q.toFixed(2)}`, () => {
    const calvaria = blob((th, phi) => {
      const r = 0.102;
      return [Math.sin(phi) * Math.cos(th) * r * 0.83, Math.cos(phi) * r * 1.0, Math.sin(phi) * Math.sin(th) * r * 0.98];
    }, Math.max(11, Math.round(q * 16)), Math.max(7, Math.round(q * 10)), TISSUE.bone, { spec: 0.42 });
    const face = bake(ellipsoid(0.062, 0.052, 0.030, 10, 7, TISSUE.boneDark), { pos: V(0, -0.036, 0.062) });
    const brow = bake(boxMesh(0.104, 0.012, 0.022, TISSUE.bone), { pos: V(0, 0.014, 0.070) });
    const nasal = bake(boxMesh(0.020, 0.030, 0.014, '#1A1A14'), { pos: V(0, -0.020, 0.080) });
    const zygo = [-1, 1].map((s) => tube(spline([V(s * 0.026, -0.012, 0.072), V(s * 0.058, -0.018, 0.050), V(s * 0.070, 0.004, 0.014)], Math.max(6, Math.round(q * 8))), () => 0.0075, Math.max(4, Math.round(q * 6)), TISSUE.bone, { spec: 0.4 }));
    const orbits = [-1, 1].map((s) => bake(torusMesh(0.020, 0.005, Math.max(8, Math.round(q * 12)), 5, TISSUE.boneDark), { pos: V(s * 0.030, 0.006, 0.070) }));
    const maxilla = bake(ellipsoid(0.040, 0.017, 0.024, 9, 6, TISSUE.bone), { pos: V(0, -0.052, 0.066) });
    const mandible = merge([
      tube(spline([V(-0.052, -0.028, 0.030), V(-0.056, -0.062, -0.004), V(-0.030, -0.080, -0.002)], Math.max(6, Math.round(q * 8))), () => 0.0085, Math.max(4, Math.round(q * 6)), TISSUE.bone, { spec: 0.4 }),
      tube(spline([V(0.052, -0.028, 0.030), V(0.056, -0.062, -0.004), V(0.030, -0.080, -0.002)], Math.max(6, Math.round(q * 8))), () => 0.0085, Math.max(4, Math.round(q * 6)), TISSUE.bone, { spec: 0.4 }),
      bake(ellipsoid(0.036, 0.013, 0.020, 9, 6, TISSUE.bone), { pos: V(0, -0.084, 0.030) }),
    ], TISSUE.bone);
    const teeth = bake(boxMesh(0.050, 0.008, 0.016, '#F6F2E6'), { pos: V(0, -0.066, 0.062) });
    const mastoid = [-1, 1].map((s) => bake(ellipsoid(0.013, 0.016, 0.013, 7, 5, TISSUE.boneDark), { pos: V(s * 0.072, -0.044, -0.014) }));
    return merge([calvaria, face, brow, nasal, ...zygo, ...orbits, maxilla, mandible, teeth, ...mastoid], TISSUE.bone);
  });
}

/** Muscles of the forearm, hand and lower leg that the earlier pass omitted. */
export function limbMuscles(q: number, sex: 'M' | 'F'): Mesh {
  return memo(`limbmusc${sex}${q.toFixed(2)}`, () => {
    const f = sex === 'F';
    const shoulder = f ? 0.36 : 0.43, hip = f ? 0.29 : 0.255;
    const bulk = f ? 0.88 : 1;
    const parts: Mesh[] = [];
    [-1, 1].forEach((s) => {
      const wx = s * (shoulder + 0.05);
      /* intrinsic hand muscle, placed at the wrist */
      parts.push(bake(hand(q, s as 1 | -1, 'muscle'), { pos: [wx, 0.335, 0.030] }));
      parts.push(bake(foot(q, s as 1 | -1, 'muscle'), { pos: [s * hip * 0.88, -1.212, 0.012] }));
      /* soleus under the gastrocnemius, and the shin muscle on the anterior crest */
      parts.push(tube(spline([V(s * hip * 0.86, -0.58, -0.036), V(s * hip * 0.87, -0.80, -0.030), V(s * hip * 0.87, -1.00, -0.012)], 6), (t) => 0.026 * bulk * (1 - t * 0.62), 5, TISSUE.muscleDeep, { spec: 0.3 }));
      parts.push(tube(spline([V(s * hip * 0.86 + 0.014, -0.56, 0.030), V(s * hip * 0.87, -0.86, 0.032)], 5), (t) => 0.016 * bulk * (1 - t * 0.4), 5, TISSUE.muscle, { spec: 0.3 }));
      /* brachioradialis ridge down the forearm */
      parts.push(tube(spline([V(s * (shoulder + 0.02), 1.06, 0.030), V(wx, 0.80, 0.030)], 5), (t) => 0.019 * bulk * (1 - t * 0.45), 5, TISSUE.muscle, { spec: 0.32 }));
    });
    return merge(parts, TISSUE.muscle);
  });
}

/** Fissures and sulci as inset grooves — surface detail on organs. */
export function lungFissures(q: number, side: 'L' | 'R'): Mesh {
  return memo(`fiss${side}${q.toFixed(2)}`, () => {
    const s = side === 'L' ? -1 : 1;
    const list = [0.055, -0.055];
    if (side === 'R') list.push(0.006);
    return merge(list.map((yy, i) => {
      const tilt = i === 0 ? 0.45 : -0.3;
      return tube(spline([V(s * 0.02, yy, -0.085), V(s * 0.12, yy + tilt * 0.06, 0.0), V(s * 0.155, yy + tilt * 0.11, 0.06)], Math.max(7, Math.round(q * 10))), () => 0.0052, Math.max(4, Math.round(q * 6)), '#8E4A44', { spec: 0.2 });
    }), '#8E4A44');
  });
}

/** Cerebral sulci: the primary fissures that make a brain read as a brain. */
export function brainSulci(q: number): Mesh {
  return memo(`sulci${q.toFixed(2)}`, () => {
    const parts: Mesh[] = [];
    [-1, 1].forEach((s) => {
      parts.push(tube(spline([V(s * 0.020, 0.075, -0.09), V(s * 0.070, 0.030, -0.01), V(s * 0.085, -0.02, 0.05)], Math.max(8, Math.round(q * 11))), (t) => 0.0055 - t * 0.002, Math.max(4, Math.round(q * 5)), '#B4847A', { spec: 0.24 }));
      parts.push(tube(spline([V(s * 0.022, 0.020, 0.09), V(s * 0.075, 0.010, 0.02), V(s * 0.080, -0.030, -0.04)], Math.max(8, Math.round(q * 11))), (t) => 0.005 - t * 0.0018, Math.max(4, Math.round(q * 5)), '#B4847A', { spec: 0.24 }));
      for (let i = 0; i < 5; i++) {
        const a = -0.7 + i * 0.36;
        parts.push(tube(spline([V(s * 0.030, 0.070, a * 0.09), V(s * 0.072, 0.052 - i * 0.008, a * 0.10)], Math.max(5, Math.round(q * 7))), () => 0.0032, 4, '#C09286', { spec: 0.22 }));
      }
    });
    return merge(parts, '#B4847A');
  });
}
