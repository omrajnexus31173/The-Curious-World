import { C, TAU, bg, clamp, dot, hash, lerp, rgba, seg, txt, type Spec } from '../sim/engine';
import { audio } from '../lib/audio';
import { progress } from '../lib/progress';
import { drawAnatomy } from './humanScene';
import { blob, ellipsoid, projectPoint, renderMeshes, torusMesh, tube, type Placed } from '../sim/mesh3d';
import { renderStats } from '../sim/mesh3d';


/* ------------------------------------------------------------------ */
/*  Anatomy data — positions are in body units (height ≈ 3.2)          */
/* ------------------------------------------------------------------ */
export type SysKey = 'skin' | 'muscle' | 'skeleton' | 'cardio' | 'resp' | 'digest' | 'urinary' | 'nervous' | 'endo' | 'lymph' | 'repro';
export const SYSTEMS: { k: SysKey; label: string; color: string; layer: number }[] = [
  { k: 'skin', label: 'Integumentary', color: '#E8B89A', layer: 5 },
  { k: 'muscle', label: 'Muscular', color: '#C4553F', layer: 4 },
  { k: 'lymph', label: 'Lymphatic', color: '#9FD8A8', layer: 3 },
  { k: 'cardio', label: 'Cardiovascular', color: '#FF704F', layer: 2 },
  { k: 'resp', label: 'Respiratory', color: '#8FD8E8', layer: 2 },
  { k: 'digest', label: 'Digestive', color: '#E4C580', layer: 1 },
  { k: 'urinary', label: 'Urinary', color: '#FFD24A', layer: 1 },
  { k: 'endo', label: 'Endocrine', color: '#E88BF0', layer: 1 },
  { k: 'nervous', label: 'Nervous', color: '#D7FF45', layer: 0 },
  { k: 'repro', label: 'Reproductive', color: '#B59AFF', layer: 1 },
  { k: 'skeleton', label: 'Skeletal', color: '#F3EBDD', layer: -1 },
];

interface Organ {
  id: string; name: string; sys: SysKey; p: [number, number, number]; r: number; color: string;
  fn: string; blood: string; nerve: string; process: string; normal: string; disorders: string; symptoms: string; care: string;
}
export const ORGANS: Organ[] = [
  { id: 'heart', name: 'Heart', sys: 'cardio', p: [-0.04, 0.90, 0.06], r: 0.13, color: '#FF704F',
    fn: 'Four-chambered pump driving pulmonary and systemic circuits. The right side sends blood to the lungs, the left side to the body.',
    blood: 'Coronary arteries branch from the aortic root; the coronary sinus returns venous blood to the right atrium.',
    nerve: 'Sympathetic (T1–T5) accelerates rate and contractility; the vagus nerve slows it. The SA node sets its own rhythm.',
    process: 'Systole ejects ~70 mL per beat; valves enforce one-way flow; the conduction system sequences atria before ventricles.',
    normal: '60–100 bpm at rest, cardiac output ≈ 5 L/min, ejection fraction 55–70%.',
    disorders: 'Coronary artery disease, arrhythmia, heart failure, valve disease.',
    symptoms: 'Chest pressure, breathlessness on exertion, palpitations, ankle swelling.',
    care: 'General concepts: risk-factor control, rhythm management, restoring perfusion, supporting pump function.' },
  { id: 'lungL', name: 'Left lung', sys: 'resp', p: [-0.24, 0.95, 0], r: 0.17, color: '#8FD8E8',
    fn: 'Gas exchange across ~300 million alveoli. The left lung has two lobes, making room for the heart.',
    blood: 'Pulmonary arteries deliver deoxygenated blood; pulmonary veins return oxygenated blood to the left atrium.',
    nerve: 'Vagus nerve controls bronchial smooth muscle tone; phrenic nerve (C3–C5) drives the diaphragm.',
    process: 'Diaphragm contraction lowers thoracic pressure, air flows in; O₂ and CO₂ diffuse across a 0.5 µm membrane.',
    normal: '12–20 breaths/min at rest, ~500 mL tidal volume, SpO₂ 95–100%.',
    disorders: 'Asthma, pneumonia, bronchitis, COPD.',
    symptoms: 'Wheeze, cough, breathlessness, reduced exercise tolerance.',
    care: 'General concepts: relieving airway narrowing, treating infection, supporting oxygenation.' },
  { id: 'lungR', name: 'Right lung', sys: 'resp', p: [0.24, 0.95, 0], r: 0.19, color: '#8FD8E8',
    fn: 'Three lobes and slightly larger than the left. Together the lungs hold about 6 litres of air at full inflation.',
    blood: 'Receives the entire cardiac output through the pulmonary circulation.',
    nerve: 'Autonomic control of airway calibre; stretch receptors trigger the Hering–Breuer reflex.',
    process: 'Surfactant reduces alveolar surface tension so tiny air sacs do not collapse between breaths.',
    normal: 'Total lung capacity ≈ 6 L; residual volume ≈ 1.2 L never leaves.',
    disorders: 'Pneumonia, pleural effusion, pulmonary embolism.',
    symptoms: 'Sharp pleuritic pain, fever, productive cough.',
    care: 'General concepts: treating the cause, draining collections, restoring ventilation.' },
  { id: 'brain', name: 'Brain', sys: 'nervous', p: [0, 1.60, 0.01], r: 0.2, color: '#D7FF45',
    fn: '86 billion neurons integrating sensation, movement, language and thought. Uses ~20% of the body’s energy at 2% of its mass.',
    blood: 'Two internal carotid and two vertebral arteries form the circle of Willis — a redundant supply ring.',
    nerve: 'Is the nervous system; twelve cranial nerve pairs connect it directly to head and viscera.',
    process: 'Action potentials travel up to 120 m/s; synapses convert electrical signals into chemical ones and back.',
    normal: 'Cerebral blood flow ≈ 750 mL/min, tightly autoregulated.',
    disorders: 'Stroke, epilepsy, migraine, Parkinson’s disease.',
    symptoms: 'Sudden weakness or speech loss, seizures, aura and throbbing pain, tremor and slowness.',
    care: 'General concepts: restoring blood flow fast, stabilising electrical activity, replacing lost signalling.' },
  { id: 'liver', name: 'Liver', sys: 'digest', p: [0.21, 0.60, 0.05], r: 0.17, color: '#C98A4B',
    fn: 'Metabolic hub: detoxification, bile production, glycogen storage and synthesis of most plasma proteins.',
    blood: 'Dual supply — hepatic artery (oxygen) and portal vein (nutrients straight from the gut).',
    nerve: 'Hepatic plexus from the coeliac ganglion; largely autonomic.',
    process: 'Filters ~1.4 L of blood per minute; converts ammonia to urea; stores glucose as glycogen.',
    normal: 'Can regenerate from as little as 25% of its mass.',
    disorders: 'Fatty liver, hepatitis, cirrhosis.',
    symptoms: 'Often silent early; later jaundice, fatigue, abdominal swelling.',
    care: 'General concepts: removing the cause, supporting metabolism, monitoring function.' },
  { id: 'stomach', name: 'Stomach', sys: 'digest', p: [-0.15, 0.58, 0.05], r: 0.13, color: '#E4C580',
    fn: 'Acid bath and mechanical churn that begins protein digestion and sterilises food.',
    blood: 'Left and right gastric arteries along the curvatures.',
    nerve: 'Vagus stimulates acid and motility; the enteric nervous system runs local reflexes.',
    process: 'Parietal cells secrete HCl to pH 1.5–3.5; a mucus-bicarbonate layer protects the lining.',
    normal: 'Empties a mixed meal over 2–4 hours.',
    disorders: 'Acid reflux, gastritis, peptic ulcer, food poisoning.',
    symptoms: 'Burning pain, nausea, bloating, early fullness.',
    care: 'General concepts: reducing acid, protecting mucosa, treating H. pylori where present.' },
  { id: 'gut', name: 'Intestines', sys: 'digest', p: [0, 0.30, 0.06], r: 0.2, color: '#D8A86A',
    fn: 'Small intestine absorbs nutrients across a villus-amplified surface; large intestine reclaims water and hosts the microbiome.',
    blood: 'Superior and inferior mesenteric arteries; all venous blood routes through the liver first.',
    nerve: 'Enteric nervous system — 500 million neurons, capable of operating independently.',
    process: 'Peristalsis propels chyme; brush-border enzymes finish digestion; transporters move nutrients into blood.',
    normal: 'Small intestine ≈ 6 m, large ≈ 1.5 m; transit 24–72 hours.',
    disorders: 'Diarrhoea, constipation, inflammatory bowel disease, malabsorption.',
    symptoms: 'Cramping, altered stool pattern, weight change.',
    care: 'General concepts: rehydration, restoring motility, reducing inflammation.' },
  { id: 'kidneyL', name: 'Left kidney', sys: 'urinary', p: [-0.20, 0.50, -0.11], r: 0.1, color: '#FFD24A',
    fn: 'Filters blood, balances fluid and electrolytes, regulates blood pressure and activates vitamin D.',
    blood: 'Renal artery takes ~20% of cardiac output; glomeruli filter at ~125 mL/min.',
    nerve: 'Renal sympathetic nerves modulate renin release and sodium retention.',
    process: 'One million nephrons filter, reabsorb 99% of the filtrate, and secrete what must go.',
    normal: 'GFR 90–120 mL/min; produces 1–2 L urine per day.',
    disorders: 'Chronic kidney disease, stones, infection.',
    symptoms: 'Often silent early; later swelling, fatigue, changes in urination.',
    care: 'General concepts: protecting perfusion, controlling pressure and glucose, replacing function when lost.' },
  { id: 'kidneyR', name: 'Right kidney', sys: 'urinary', p: [0.20, 0.46, -0.11], r: 0.1, color: '#FFD24A',
    fn: 'Sits slightly lower than the left, displaced by the liver. Same filtration and hormone roles.',
    blood: 'Shorter renal artery; renal vein drains to the inferior vena cava.',
    nerve: 'Sympathetic T10–L1; pain refers to the flank and groin.',
    process: 'Erythropoietin release tells the marrow to make red cells when oxygen delivery falls.',
    normal: 'Each kidney holds about one million nephrons.',
    disorders: 'Stones, pyelonephritis, renovascular hypertension.',
    symptoms: 'Flank pain, fever, blood in urine.',
    care: 'General concepts: relieving obstruction, treating infection, preserving nephrons.' },
  { id: 'bladder', name: 'Bladder', sys: 'urinary', p: [0, 0.10, 0.07], r: 0.09, color: '#E8D06A',
    fn: 'Compliant reservoir with a two-valve outlet under both voluntary and reflex control.',
    blood: 'Superior and inferior vesical arteries from the internal iliac.',
    nerve: 'Pelvic parasympathetics contract the detrusor; pudendal nerve controls the external sphincter.',
    process: 'Stretch receptors signal fullness from ~200 mL; capacity 400–600 mL.',
    normal: 'Empties 4–8 times daily.',
    disorders: 'Urinary tract infection, retention, incontinence.',
    symptoms: 'Frequency, urgency, burning, incomplete emptying.',
    care: 'General concepts: treating infection, relieving obstruction, retraining control.' },
  { id: 'pancreas', name: 'Pancreas', sys: 'endo', p: [0.02, 0.53, -0.03], r: 0.1, color: '#E88BF0',
    fn: 'Dual gland: digestive enzymes into the gut, insulin and glucagon into the blood.',
    blood: 'Splenic and pancreaticoduodenal arteries.',
    nerve: 'Vagal input stimulates enzyme secretion.',
    process: 'Beta cells sense glucose and release insulin; alpha cells release glucagon when it falls.',
    normal: 'Fasting glucose 70–99 mg/dL held within a narrow band.',
    disorders: 'Type 1 and type 2 diabetes, pancreatitis, insulin resistance.',
    symptoms: 'Thirst, frequent urination, fatigue; severe upper-abdominal pain in pancreatitis.',
    care: 'General concepts: supporting or replacing insulin, reducing metabolic load, resting the gland.' },
  { id: 'thyroid', name: 'Thyroid', sys: 'endo', p: [0, 1.26, 0.075], r: 0.07, color: '#E88BF0',
    fn: 'Sets basal metabolic rate for every cell through T3 and T4.',
    blood: 'One of the most richly perfused organs per gram.',
    nerve: 'Sympathetic fibres from the cervical ganglia; controlled hormonally by pituitary TSH.',
    process: 'Iodine is trapped and built into thyroglobulin; feedback loops hold hormone levels steady.',
    normal: 'TSH 0.4–4.0 mIU/L in most labs.',
    disorders: 'Hypothyroidism, hyperthyroidism, nodules.',
    symptoms: 'Fatigue and cold intolerance, or heat intolerance, tremor and weight loss.',
    care: 'General concepts: replacing or suppressing hormone output, monitoring feedback.' },
  { id: 'spleen', name: 'Spleen', sys: 'lymph', p: [-0.27, 0.58, -0.04], r: 0.09, color: '#9FD8A8',
    fn: 'Blood filter and immune staging post; recycles aged red cells and mounts responses to blood-borne pathogens.',
    blood: 'Splenic artery from the coeliac trunk.',
    nerve: 'Sympathetic splenic plexus.',
    process: 'White pulp surveys antigens; red pulp removes worn erythrocytes and salvages iron.',
    normal: 'Holds about 250 mL of blood, some released under stress.',
    disorders: 'Splenomegaly, rupture after trauma.',
    symptoms: 'Left upper abdominal fullness, referred shoulder pain.',
    care: 'General concepts: protecting from trauma, vaccination against encapsulated bacteria if removed.' },
  { id: 'gonads', name: 'Reproductive organs', sys: 'repro', p: [0, 0.02, 0.09], r: 0.1, color: '#B59AFF',
    fn: 'Produce gametes and sex hormones. Ovaries cycle monthly; testes produce continuously. Both feed back on the pituitary.',
    blood: 'Gonadal arteries arise directly from the abdominal aorta.',
    nerve: 'Autonomic gonadal plexuses; pelvic somatic nerves for surrounding structures.',
    process: 'Hypothalamic GnRH pulses drive LH and FSH, which drive gamete maturation and steroid output.',
    normal: 'Hormone levels vary across the lifespan and, in females, across the cycle.',
    disorders: 'Polycystic ovary syndrome, endometriosis, infertility, testicular torsion.',
    symptoms: 'Cycle irregularity, pelvic pain, sudden severe scrotal pain (a surgical emergency).',
    care: 'General concepts: hormonal regulation, fertility support, urgent care for torsion.' },
];

export const VESSELS: { id: string; name: string; path: [number, number, number][]; feeds: string[]; color: string }[] = [
  { id: 'aorta', name: 'Aorta', path: [[-0.05, 0.9, 0.08], [0, 1.02, 0.02], [0.02, 0.7, -0.04], [0.02, 0.3, -0.04], [0.02, 0.08, -0.02]], feeds: ['liver', 'gut', 'kidneyL', 'kidneyR', 'bladder'], color: '#FF704F' },
  { id: 'carotid', name: 'Carotid artery', path: [[-0.02, 0.98, 0.04], [-0.04, 1.2, 0.06], [-0.03, 1.45, 0.04]], feeds: ['brain'], color: '#FF8A6B' },
  { id: 'pulmonary', name: 'Pulmonary artery', path: [[-0.05, 0.92, 0.08], [-0.2, 0.95, 0.02], [0.2, 0.95, 0.02]], feeds: ['lungL', 'lungR'], color: '#B59AFF' },
  { id: 'femoral', name: 'Femoral artery', path: [[0.02, 0.08, -0.02], [0.17, -0.3, 0], [0.19, -0.9, 0.02]], feeds: [], color: '#FF704F' },
  { id: 'renal', name: 'Renal artery', path: [[0.02, 0.44, -0.04], [-0.2, 0.44, -0.12], [0.2, 0.42, -0.12]], feeds: ['kidneyL', 'kidneyR'], color: '#FFD24A' },
];

interface Condition {
  id: string; name: string; organ: string; kind: 'airway' | 'artery' | 'neuron' | 'cell' | 'acid';
  mech: string; symptoms: string; risk: string; care: string; narrow: number;
}
export const CONDITIONS: Condition[] = [
  { id: 'normal', name: 'Healthy baseline', organ: '', kind: 'airway', mech: 'All systems within normal operating ranges.', symptoms: '—', risk: '—', care: '—', narrow: 0 },
  { id: 'asthma', name: 'Asthma', organ: 'lungL', kind: 'airway', narrow: 0.62, mech: 'Airway smooth muscle tightens, the lining swells and mucus increases — three changes that narrow the same tube.', symptoms: 'Wheeze, chest tightness, night cough, breathlessness.', risk: 'Allergens, cold air, exercise, respiratory infection.', care: 'Reliever bronchodilators open muscle; preventer steroids reduce inflammation.' },
  { id: 'cold', name: 'Common cold', organ: 'lungR', kind: 'airway', narrow: 0.25, mech: 'Viral infection of the upper airway increases mucus and mild swelling without deep lung involvement.', symptoms: 'Runny nose, sore throat, sneezing, mild cough.', risk: 'Close contact, season, hand-to-face transfer.', care: 'Rest, fluids, symptom relief; antibiotics do not act on viruses.' },
  { id: 'bronchitis', name: 'Bronchitis', organ: 'lungR', kind: 'airway', narrow: 0.45, mech: 'Bronchial walls inflame and produce excess mucus, narrowing the mid-size airways.', symptoms: 'Persistent productive cough, fatigue, mild breathlessness.', risk: 'Smoking, irritants, preceding viral illness.', care: 'Removing irritants, fluids, sometimes bronchodilators.' },
  { id: 'pneumonia', name: 'Pneumonia', organ: 'lungR', kind: 'airway', narrow: 0.55, mech: 'Alveoli fill with inflammatory fluid, so the exchange surface is flooded rather than narrowed.', symptoms: 'Fever, productive cough, sharp chest pain, breathlessness.', risk: 'Age, smoking, immune suppression, aspiration.', care: 'Treating the cause, oxygen support, hydration.' },
  { id: 'rhinitis', name: 'Allergic rhinitis', organ: 'lungL', kind: 'airway', narrow: 0.3, mech: 'IgE-mediated histamine release swells nasal mucosa and drives watery secretion.', symptoms: 'Sneezing, itching, clear discharge, blocked nose.', risk: 'Pollen, dust mite, animal dander.', care: 'Allergen avoidance, antihistamines, nasal steroids.' },
  { id: 'hypertension', name: 'Hypertension', organ: 'heart', kind: 'artery', narrow: 0.3, mech: 'Sustained high pressure thickens arterial walls and forces the heart to work against a higher load.', symptoms: 'Usually none — it is found by measurement.', risk: 'Salt intake, weight, inactivity, genetics, age.', care: 'Lifestyle change and pressure-lowering medication; monitoring end-organ damage.' },
  { id: 'athero', name: 'Atherosclerosis', organ: 'heart', kind: 'artery', narrow: 0.6, mech: 'Lipid-rich plaque builds inside the artery wall, narrowing the lumen and stiffening the vessel.', symptoms: 'Angina on exertion, leg pain on walking, or none until an event.', risk: 'LDL cholesterol, smoking, diabetes, hypertension.', care: 'Lipid lowering, risk-factor control, restoring flow where needed.' },
  { id: 'mi', name: 'Heart attack', organ: 'heart', kind: 'artery', narrow: 0.92, mech: 'A plaque ruptures and a clot occludes a coronary artery; the muscle it supplies begins to die within minutes.', symptoms: 'Crushing chest pain, sweating, nausea, breathlessness.', risk: 'All atherosclerosis risks plus acute triggers.', care: 'Emergency reperfusion — time is muscle. Call emergency services.' },
  { id: 'arrhythmia', name: 'Arrhythmia', organ: 'heart', kind: 'neuron', narrow: 0.4, mech: 'The electrical conduction sequence becomes irregular or re-entrant, so chambers contract out of order.', symptoms: 'Palpitations, dizziness, fainting.', risk: 'Structural heart disease, electrolytes, stimulants.', care: 'Rhythm or rate control, anticoagulation where indicated.' },
  { id: 'reflux', name: 'Acid reflux', organ: 'stomach', kind: 'acid', narrow: 0.5, mech: 'The lower oesophageal sphincter relaxes at the wrong time and acid climbs into a tube with no protective mucus.', symptoms: 'Heartburn, sour taste, night cough.', risk: 'Large meals, lying flat after eating, hiatus hernia.', care: 'Meal timing, acid suppression, weight management.' },
  { id: 'gastritis', name: 'Gastritis', organ: 'stomach', kind: 'acid', narrow: 0.35, mech: 'The protective mucus layer is breached and acid irritates the stomach lining itself.', symptoms: 'Gnawing upper-abdominal pain, nausea.', risk: 'H. pylori, NSAIDs, alcohol.', care: 'Treating H. pylori, removing irritants, acid reduction.' },
  { id: 'diabetes', name: 'Diabetes', organ: 'pancreas', kind: 'cell', narrow: 0.7, mech: 'Either insulin is absent (type 1) or cells respond poorly to it (type 2), so glucose stays in the blood.', symptoms: 'Thirst, frequent urination, fatigue, slow healing.', risk: 'Genetics, weight, inactivity, age.', care: 'Glucose monitoring, insulin or sensitising agents, diet and activity.' },
  { id: 'stroke', name: 'Stroke', organ: 'brain', kind: 'artery', narrow: 0.88, mech: 'A cerebral artery is blocked or bursts; the territory it supplies loses oxygen within seconds.', symptoms: 'Face droop, arm weakness, speech difficulty — time critical.', risk: 'Hypertension, atrial fibrillation, smoking.', care: 'Emergency imaging and reperfusion. Every minute matters.' },
  { id: 'migraine', name: 'Migraine', organ: 'brain', kind: 'neuron', narrow: 0.45, mech: 'A wave of altered cortical excitability followed by trigeminal vascular signalling produces pain and sensitivity.', symptoms: 'Throbbing one-sided pain, light and sound sensitivity, aura.', risk: 'Sleep disruption, stress, certain foods, hormones.', care: 'Trigger management, acute and preventive medication.' },
  { id: 'parkinsons', name: "Parkinson's disease", organ: 'brain', kind: 'neuron', narrow: 0.6, mech: 'Dopamine-producing neurons in the substantia nigra are progressively lost, disrupting movement circuits.', symptoms: 'Resting tremor, slowness, rigidity, postural change.', risk: 'Age, genetics, some environmental exposures.', care: 'Dopamine replacement, physiotherapy, deep brain stimulation in selected cases.' },
];

const HMODES = ['Anatomy', 'Physiology', 'Conditions'];

export const human: Spec = {
  id: 'human', name: 'Human Body Simulator', tag: 'Organ-level anatomy & live physiology', accent: C.coral, glyph: 'heart', orbit: true,
  blurb: 'Two anatomical models, eleven body systems, fifteen selectable organs and a coupled physiological engine. Separate the systems, isolate an organ, interrupt a vessel and watch oxygen delivery fall downstream.',
  method: 'Anatomy is generated procedurally as lit triangle meshes — no organ is a sphere or a box. The heart carries a ventricular mass with an interventricular sulcus, two atria with auricles, four valve rings with leaflets, the aortic arch and its three branches, pulmonary trunk, venae cavae, pulmonary veins and a coronary tree. Lungs are lobed with a cardiac notch and a branching bronchial tree; the brain has folded gyri, cerebellar folia and a brainstem. Geometry is anatomically proportioned but simplified for teaching, not a patient scan. Physiology uses cardiac output = HR × stroke volume and oxygen delivery = CO × arterial O₂ content, with first-order thermoregulation and filtration. It predicts nothing about an individual.',
  facts: ['Cardiac output = heart rate × stroke volume — roughly 5 L/min at rest.', 'The heart’s own supply comes from the coronary arteries, not the blood inside it.', 'Kidneys receive ~20% of cardiac output despite being 0.5% of body mass.', 'Adult skeletons have 206 bones; newborns start with about 270 that fuse.'],
  ctrls: [
    { k: 'hr', label: 'Heart rate', min: 40, max: 190, step: 1, def: 72, unit: ' bpm' },
    { k: 'rr', label: 'Breathing rate', min: 6, max: 45, step: 1, def: 14, unit: ' /min' },
    { k: 'ex', label: 'Exercise intensity', min: 0, max: 1, step: 0.02, def: 0 },
    { k: 'o2', label: 'Oxygen availability', min: 0.4, max: 1, step: 0.01, def: 1 },
    { k: 'bp', label: 'Baseline pressure', min: 80, max: 180, step: 1, def: 118, unit: ' mmHg' },
    { k: 'temp', label: 'Ambient temperature', min: 5, max: 42, step: 0.5, def: 22, unit: ' °C' },
    { k: 'hyd', label: 'Hydration', min: 0.4, max: 1, step: 0.02, def: 0.95 },
    { k: 'explode', label: 'System separation', min: 0, max: 1, step: 0.02, def: 0 },
    { k: 'alpha', label: 'Layer transparency', min: 0.05, max: 1, step: 0.05, def: 0.55 },
    { k: 'isolate', label: 'Pull selected organ out', min: 0, max: 1, step: 0.02, def: 0 },
    { k: 'detail', label: 'Mesh detail (LOD)', min: 0.45, max: 1.3, step: 0.05, def: 0.8 },
  ],
  toggles: [
    { k: 'skin', label: 'Skin', def: true }, { k: 'muscle', label: 'Muscle', def: false },
    { k: 'skeleton', label: 'Skeleton', def: true }, { k: 'cardio', label: 'Cardiovascular', def: true },
    { k: 'resp', label: 'Respiratory', def: true }, { k: 'digest', label: 'Digestive', def: true },
    { k: 'urinary', label: 'Urinary', def: true }, { k: 'nervous', label: 'Nervous', def: true },
    { k: 'endo', label: 'Endocrine', def: false }, { k: 'lymph', label: 'Lymphatic', def: false },
    { k: 'repro', label: 'Reproductive', def: false }, { k: 'labels', label: 'Labels', def: true },
    { k: 'flow', label: 'Blood flow', def: true }, { k: 'compare', label: 'Compare normal', def: true },
    { k: 'caps', label: 'Capillary beds', def: false }, { k: 'regions', label: 'Brain regions', def: false },
  ],
  choices: [
    { k: 'mode', label: 'Workspace', options: HMODES, def: 0 },
    { k: 'sex', label: 'Anatomical model', options: ['Male', 'Female'], def: 0 },
    { k: 'cond', label: 'Condition', options: CONDITIONS.map((c) => c.name), def: 0 },
    { k: 'vessel', label: 'Vessel for experiment', options: VESSELS.map((v) => v.name), def: 0 },
  ],
  actions: [
    { id: 'explode', label: 'Exploded view — separate all body systems', tone: C.coral },
    { id: 'restore', label: 'Restore original arrangement', tone: C.acid },
    { id: 'stop', label: 'Stop flow in selected vessel', tone: '#FF4F4F' },
    { id: 'resume', label: 'Restore circulation', tone: C.acid },
  ],
  scenarios: [
    { name: 'Resting adult', note: 'Baseline physiology, all systems visible', set: { mode: 1, hr: 72, rr: 14, ex: 0, o2: 1, hyd: 0.95 } },
    { name: 'Hard exercise', note: 'Watch HR, ventilation and temperature couple', set: { mode: 1, ex: 0.85, hr: 90, rr: 18 } },
    { name: 'Coronary occlusion', note: 'Stop the aorta and watch delivery collapse', set: { mode: 1, vessel: 0 } },
    { name: 'Asthma attack', note: 'Normal vs narrowed airway, side by side', set: { mode: 2, cond: 1, compare: 1 } },
    { name: 'Exploded anatomy', note: 'All eleven systems separated', set: { mode: 0, explode: 1, alpha: 0.8 } },
  ],
  make: () => ({ beat: 0, breath: 0, co: 5, spo2: 98, coreT: 37, gfr: 110, blocked: null as string | null, o2del: 1000, tissue: {} as Record<string, number>, lastBeat: 0, glucose: 90, hits: [] as { x: number; y: number; id: string; r: number }[] }),
  step(m, p, dt) {
    const cond = CONDITIONS[Math.round(p.cond)];
    const active = Math.round(p.mode) === 2 ? cond : CONDITIONS[0];
    const respPenalty = active.kind === 'airway' ? active.narrow * 0.5 : 0;
    const cardioPenalty = active.id === 'mi' ? 0.45 : active.id === 'arrhythmia' ? 0.25 : active.kind === 'artery' ? active.narrow * 0.2 : 0;

    const hrTarget = clamp(p.hr + p.ex * 95 + (p.temp - 22) * 0.6 + (1 - p.hyd) * 40 + (active.id === 'arrhythmia' ? Math.sin(performance.now() / 180) * 28 : 0), 35, 200);
    m.hrNow = lerp(m.hrNow ?? hrTarget, hrTarget, clamp(dt * 1.2, 0, 1));
    const prevBeat = m.beat;
    m.beat += dt * (m.hrNow / 60);
    if (Math.floor(m.beat) > Math.floor(prevBeat)) audio.beat(0.5 + p.ex * 0.5);

    const rrTarget = clamp(p.rr + p.ex * 22 + respPenalty * 14, 6, 60);
    m.rrNow = lerp(m.rrNow ?? rrTarget, rrTarget, clamp(dt, 0, 1));
    m.breath += dt * (m.rrNow / 60);

    const sv = 70 * (1 - cardioPenalty) * (0.7 + p.hyd * 0.3) * (1 - Math.max(0, m.hrNow - 150) / 160);
    m.co = (m.hrNow * sv) / 1000;
    m.spo2 = clamp(98 - (1 - p.o2) * 45 - respPenalty * 22 - (m.blocked === 'pulmonary' ? 25 : 0), 45, 100);
    const occlPenalty = m.blocked ? (m.blocked === 'aorta' ? 0.55 : m.blocked === 'carotid' ? 0.3 : m.blocked === 'renal' ? 0.2 : 0.15) : 0;
    m.o2del = m.co * (m.spo2 / 100) * 1.34 * 15 * 10 * (1 - occlPenalty);

    const heat = p.ex * 0.09 + (p.temp - 22) * 0.0016;
    const cool = (m.coreT - 36.8) * (0.05 + p.hyd * 0.09);
    m.coreT = clamp(m.coreT + (heat - cool) * dt, 35, 41.5);
    m.gfr = clamp(110 * (p.bp / 118) * p.hyd * (m.blocked === 'renal' ? 0.25 : 1) * (active.id === 'diabetes' ? 0.7 : 1), 5, 180);
    m.glucose = lerp(m.glucose, active.id === 'diabetes' ? 210 : 90 + p.ex * -15, clamp(dt * 0.4, 0, 1));

    const affected = m.blocked ? VESSELS.find((v) => v.id === m.blocked)?.feeds ?? [] : [];
    ORGANS.forEach((o) => {
      const target = affected.includes(o.id) ? 0.12 : 1;
      m.tissue[o.id] = lerp(m.tissue[o.id] ?? 1, target, clamp(dt * 0.7, 0, 1));
    });
    if (m.hrNow > 140) progress.completeMission('m-heart');
    /* Keep simulation values flowing to the PBR stage annotation */
  },
  onAction(a, m, p) {
    if (a === 'explode') { audio.whoosh(); return { explode: 1, alpha: 0.85 }; }
    if (a === 'restore') { m.blocked = null; audio.chime(); return { explode: 0, isolate: 0, alpha: 0.55 }; }
    if (a === 'stop') { m.blocked = VESSELS[Math.round(p.vessel)].id; progress.completeMission('m-occlude'); progress.experiment(); audio.thud(); }
    if (a === 'resume') { m.blocked = null; audio.chime(); }
    return undefined;
  },
  draw(ctx, m, p, e) {
    bg(ctx, e, C.coral, '#141210');
    const mode = Math.round(p.mode);
    if (mode === 2) { drawCondition(ctx, m, p, e); return; }
    const female = Math.round(p.sex) === 1;
    m.hits = drawAnatomy(ctx, m, p, e, ORGANS as never, SYSTEMS as never, VESSELS as never);
    m.tris = renderStats.tris;
    // physiological HUD
    if (mode === 1) {
      const bx = 14, by = 20;
      const bars: [string, number, number, string][] = [
        ['O₂ delivery', m.o2del, 1600, C.coral], ['SpO₂', m.spo2, 100, C.sky],
        ['Cardiac output', m.co, 25, C.acid], ['Core temp', m.coreT - 35, 6, C.amber],
        ['GFR', m.gfr, 160, C.lav], ['Glucose', m.glucose, 250, C.orchid],
      ];
      bars.forEach(([nm, v, mx, col], i) => {
        const Y = by + i * 20;
        ctx.fillStyle = rgba(C.ivory, 0.08); ctx.fillRect(bx, Y, 90, 5);
        ctx.fillStyle = col as string; ctx.fillRect(bx, Y, 90 * clamp((v as number) / (mx as number), 0, 1), 5);
        txt(ctx, nm as string, bx, Y - 3, 8.5, C.ivory, 'left', 0.5);
      });
    }
    txt(ctx, `${female ? 'Female' : 'Male'} model · ${Math.round(m.hrNow ?? p.hr)} bpm · ${Math.round(m.rrNow ?? p.rr)} breaths/min${m.blocked ? ' · VESSEL OCCLUDED' : ''}`, 14, e.h - 14, 10.5, m.blocked ? '#FF4F4F' : C.coral, 'left', 0.9);
  },
  hit: (m, _p, _e, x, y) => {
    let best: string | null = null, bd = 1e9;
    (m.hits as { x: number; y: number; id: string; r: number }[]).forEach((h) => {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < h.r && d < bd) { bd = d; best = h.id; }
    });
    return best;
  },
  info: (id, m, p) => {
    if (id === 'cond-normal' || id === 'cond-affected') {
      const c = CONDITIONS[Math.round(p.cond)];
      const affected = id === 'cond-affected';
      return {
        title: affected ? `${c.name} — affected structure` : 'Normal structure',
        body: affected
          ? `${c.mech}\n\nSymptoms: ${c.symptoms}\nRisk factors: ${c.risk}\nCare concepts: ${c.care}`
          : 'Healthy baseline for comparison: full lumen, thin wall, unobstructed flow. Every measurement on this side is the reference the affected side is judged against.',
        facts: [affected ? `Flow ≈ ${Math.round((1 - c.narrow) * 100)}% of normal` : 'Flow 100%', `Target organ: ${ORGANS.find((o) => o.id === c.organ)?.name ?? 'systemic'}`, 'Educational visualisation — not a diagnosis'],
      };
    }
    if (id === 'skeleton') return { title: 'Skeleton', body: 'The adult skeleton has 206 bones: 24 vertebrae with cervical, thoracic and lumbar curves, 12 pairs of ribs, the shoulder girdle, the pelvic ring and the long bones of the limbs. Bone is a living composite of collagen and hydroxyapatite that remodels continuously.', facts: ['206 bones in an adult', 'About 270 at birth, fusing with growth', 'Click an organ to inspect it individually'] };
    const o = ORGANS.find((q) => q.id === id);
    if (!o) return null;
    const perf = Math.round((m.tissue[o.id] ?? 1) * 100);
    return {
      title: o.name,
      body: `${o.fn}\n\nFUNCTION · ${o.process}\nBLOOD SUPPLY · ${o.blood}\nINNERVATION · ${o.nerve}\nNORMAL RANGE · ${o.normal}\nCOMMON DISORDERS · ${o.disorders}\nSYMPTOMS · ${o.symptoms}\nCARE CONCEPTS · ${o.care}`,
      facts: [`System: ${SYSTEMS.find((s) => s.k === o.sys)?.label}`, `Perfusion in this simulation: ${perf}%`, 'Educational model — not medical advice'],
    };
  },
  readouts: (m, p) => {
    const cond = CONDITIONS[Math.round(p.cond)];
    return [
      { label: 'Heart rate', value: `${Math.round(m.hrNow ?? p.hr)} bpm`, tone: C.coral },
      { label: 'Cardiac output', value: `${m.co.toFixed(1)} L/min` },
      { label: 'SpO₂', value: `${m.spo2.toFixed(1)}%`, tone: m.spo2 < 92 ? '#FF4F4F' : C.acid },
      { label: 'O₂ delivery', value: `${m.o2del.toFixed(0)} mL/min`, tone: m.o2del < 700 ? '#FF4F4F' : C.ivory },
      { label: 'Core temperature', value: `${m.coreT.toFixed(2)} °C`, tone: m.coreT > 38.5 ? C.coral : C.ivory },
      { label: 'Kidney filtration', value: `${m.gfr.toFixed(0)} mL/min` },
      { label: 'Blood glucose', value: `${m.glucose.toFixed(0)} mg/dL`, tone: m.glucose > 180 ? C.coral : C.ivory },
      { label: 'Condition', value: Math.round(p.mode) === 2 ? cond.name : 'baseline' },
      { label: 'Anatomy mesh', value: `${(m.tris ?? 0).toLocaleString()} triangles`, tone: C.lav },
    ];
  },
  series: (m) => [
    { label: 'O₂ delivery', color: C.coral, v: m.o2del, max: 1600 },
    { label: 'SpO₂ %', color: C.sky, v: m.spo2, max: 100 },
    { label: 'HR', color: C.acid, v: m.hrNow ?? 70, max: 200 },
  ],
  explain: (m, p) => {
    const cond = CONDITIONS[Math.round(p.cond)];
    if (Math.round(p.mode) === 2 && cond.id !== 'normal') return `${cond.name}: ${cond.mech} Symptoms: ${cond.symptoms} Risk factors: ${cond.risk} Care concepts: ${cond.care} This is an educational visualisation, not a diagnosis.`;
    if (m.blocked) {
      const v = VESSELS.find((q) => q.id === m.blocked)!;
      return `Flow in the ${v.name} is stopped. Everything downstream loses perfusion — the shaded organs are ischaemic. Oxygen delivery has fallen to ${m.o2del.toFixed(0)} mL/min. Real tissue tolerates this for minutes (brain, heart) to hours (skin, muscle) before irreversible injury. Restore circulation to reverse it.`;
    }
    if (p.ex > 0.5) return `Exercise at ${(p.ex * 100).toFixed(0)}%: heart rate ${Math.round(m.hrNow)} bpm and ventilation ${Math.round(m.rrNow)}/min rise together because oxygen demand and CO₂ production rise together. Cardiac output is ${m.co.toFixed(1)} L/min and core temperature is climbing toward ${m.coreT.toFixed(1)} °C.`;
    if (p.explode > 0.3) return `Exploded view: each system is displaced along its own axis so the layers can be read separately — skin outward, skeleton inward, with vessels and nerves between. Click any organ to isolate it, then use the pull-out slider to examine it alone.`;
    return `At rest the body delivers about ${m.o2del.toFixed(0)} mL of oxygen per minute. Click an organ for its dossier, raise exercise to see the systems couple, or select a vessel and stop its flow.`;
  },
};

/* ---- condition comparison: real 3D airway / vessel / cell geometry ---- */
function drawCondition(ctx: CanvasRenderingContext2D, m: any, p: Record<string, number>, e: any) {
  const cond = CONDITIONS[Math.round(p.cond)];
  const compare = p.compare && cond.id !== 'normal';
  const q = clamp(e.q * (p.detail ?? 1), 0.45, 1.1);
  const groups = compare ? [{ x: -1.25, n: 0, label: 'NORMAL' }, { x: 1.25, n: cond.narrow, label: cond.name.toUpperCase() }]
    : [{ x: 0, n: cond.narrow, label: cond.name.toUpperCase() }];
  const items: Placed[] = [];
  const R = 0.62;

  groups.forEach((g) => {
    const lumen = R * (1 - g.n * 0.78);
    const wallCol = cond.kind === 'artery' ? '#C4553F' : cond.kind === 'neuron' ? '#D6B49E' : cond.kind === 'cell' ? '#E0B563' : '#D98C8C';
    // outer wall
    items.push({ mesh: tube([[-0.95, 0, 0], [0.95, 0, 0]], () => R, Math.max(10, Math.round(22 * q)), wallCol, { spec: 0.4, rim: 0.6, caps: false }), pos: [g.x, 0.15, 0], rotY: Math.PI / 2, alpha: 0.34 });
    // smooth muscle / thickened wall
    for (let i = 0; i < 5; i++) {
      items.push({
        mesh: torusMesh(R * 0.9, 0.035 + g.n * 0.075, Math.max(10, Math.round(20 * q)), Math.max(5, Math.round(7 * q)), cond.kind === 'artery' ? '#B4453A' : '#A8382C', { spec: 0.45 }),
        pos: [g.x, 0.15, -0.8 + i * 0.4], rotY: Math.PI / 2, alpha: 0.9,
      });
    }
    // lumen lining
    items.push({ mesh: tube([[-0.95, 0, 0], [0.95, 0, 0]], () => lumen, Math.max(10, Math.round(20 * q)), '#F0C8B8', { spec: 0.5, caps: false, doubleSided: true }), pos: [g.x, 0.15, 0], rotY: Math.PI / 2, alpha: 0.55 });
    // obstruction: mucus, plaque or receptor loss
    if (g.n > 0.05) {
      if (cond.kind === 'artery') {
        items.push({ mesh: blob((th, phi) => { const r = R * g.n * 0.95; return [Math.sin(phi) * Math.cos(th) * r * 1.6, Math.cos(phi) * r * 0.7, Math.sin(phi) * Math.sin(th) * r]; }, Math.max(10, Math.round(16 * q)), Math.max(7, Math.round(10 * q)), '#E4C580', { spec: 0.5 }), pos: [g.x, 0.15 - R * 0.55, 0], alpha: 0.95 });
      } else if (cond.kind === 'cell') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          items.push({ mesh: torusMesh(0.07, 0.022, 8, 5, '#E88BF0', { spec: 0.5 }), pos: [g.x + Math.cos(a) * lumen * 0.9, 0.15 + Math.sin(a) * lumen * 0.9, -0.6 + (i % 4) * 0.4], rotY: Math.PI / 2, alpha: 1 - g.n });
        }
      } else {
        for (let i = 0; i < Math.round(g.n * 12); i++) {
          const a = i * 2.399, rr = lumen * 0.55 * Math.sqrt((i + 1) / 12);
          items.push({ mesh: blob((th, phi) => { const r = 0.07 + 0.03 * Math.sin(th * 3); return [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(th) * r]; }, 8, 6, '#E4C580', { spec: 0.6 }), pos: [g.x + Math.cos(a) * rr, 0.15 + Math.sin(a) * rr, -0.7 + (i % 5) * 0.35], alpha: 0.85 });
        }
      }
    }
    // flow
    const rate = (1 - g.n) * (cond.kind === 'neuron' ? 0.7 : 1);
    for (let i = 0; i < 14; i++) {
      const u = ((e.t * (0.25 + rate * 0.8) + i / 14) % 1);
      const a = i * 2.399;
      const rr = lumen * 0.5;
      items.push({
        mesh: ellipsoid(0.05, 0.05, 0.05, 7, 5, cond.kind === 'neuron' ? '#D7FF45' : '#D9483C', { emissive: 0.35, spec: 0.6 }),
        pos: [g.x + Math.cos(a) * rr, 0.15 + Math.sin(a) * rr, -0.9 + u * 1.8], alpha: 0.95,
      });
    }
  });

  renderMeshes(ctx, items, { cam: e.cam, w: e.w, h: e.h, maxTris: 16000 });

  const S = Math.min(e.w, e.h) * 0.4 * e.cam.zoom;
  m.hits = [];
  groups.forEach((g) => {
    const pt = projectPoint(e.cam, e.w, e.h, [g.x, -0.75, 0]);
    const hid = g.n === 0 ? 'cond-normal' : 'cond-affected';
    m.hits.push({ x: pt.x, y: pt.y - S * 0.4, id: hid, r: Math.max(48, S * 0.5) });
    const rate = Math.round((1 - g.n) * 100);
    txt(ctx, g.label, pt.x, pt.y, 12, g.n === 0 ? C.acid : C.coral, 'center', 1);
    txt(ctx, `${rate}% of normal flow`, pt.x, pt.y + 17, 10, C.ivory, 'center', 0.7);
    const bw = Math.min(150, S * 0.7);
    ctx.fillStyle = rgba(C.ivory, 0.12); ctx.fillRect(pt.x - bw / 2, pt.y + 26, bw, 5);
    ctx.fillStyle = g.n === 0 ? C.acid : C.coral; ctx.fillRect(pt.x - bw / 2, pt.y + 26, bw * (1 - g.n), 5);
  });

  txt(ctx, cond.mech, 14, 26, 10.5, C.ivory, 'left', 0.8);
  if (cond.id !== 'normal') {
    txt(ctx, `Symptoms · ${cond.symptoms}`, 14, e.h - 44, 10, C.ivory, 'left', 0.6);
    txt(ctx, `Care concepts · ${cond.care}`, 14, e.h - 30, 10, C.ivory, 'left', 0.6);
  }
  txt(ctx, 'Educational visualisation — not a diagnosis or a prediction for any individual.', 14, e.h - 14, 9.5, C.lav, 'left', 0.7);
  void m; void dot; void hash; void lerp; void seg;
}
