// Clinical Drug-Drug Interaction (DDI) & Synergy Engine
// Checks pairs on NORMALIZED ACTIVE SALTS, not fragile brand names.

const INTERACTION_RULES = [
  {
    salts: ['ibuprofen', 'aspirin'],
    severity: 'Red',
    title: 'High Risk of Gastrointestinal Bleeding',
    mechanism: 'Dual Antiplatelet / NSAID effect',
    description: 'Combining Ibuprofen with Aspirin significantly heightens the danger of stomach ulceration, gastritis, and severe internal bleeding. It also blocks the cardioprotective effect of low-dose aspirin.',
    action: 'Do not combine without direct cardiologist consultation. If pain relief is urgently required, Paracetamol is typically the preferred safer alternative.'
  },
  {
    salts: ['atorvastatin', 'azithromycin'],
    severity: 'Amber',
    title: 'Increased Statin Exposure & Muscle Toxicity Risk',
    mechanism: 'CYP3A4 / P-gp hepatic enzyme interaction',
    description: 'Macrolides like Azithromycin can inhibit the breakdown of Atorvastatin, raising statin concentrations in the blood. This increases the rare risk of severe muscle pain or rhabdomyolysis.',
    action: 'Monitor for unexplained muscle cramps, dark urine, or unusual fatigue. Doctors may temporarily pause the statin during a short 3-5 day antibiotic course.'
  },
  {
    salts: ['ibuprofen', 'amlodipine'],
    severity: 'Yellow',
    title: 'Reduced Blood Pressure Control & Kidney Stress',
    mechanism: 'Prostaglandin inhibition vs Vasodilation',
    description: 'NSAIDs like Ibuprofen cause fluid retention and constrict renal blood vessels, which counteracts the blood-pressure-lowering effect of Amlodipine.',
    action: 'Limit NSAID use to occasional single doses or short courses. Check blood pressure if taken for more than 48 hours.'
  },
  {
    salts: ['ibuprofen', 'telmisartan'],
    severity: 'Amber',
    title: 'Renal Strain & Hyperkalemia Hazard',
    mechanism: 'Afferent/Efferent arteriolar hemodynamics',
    description: 'Combining an NSAID with an ARB (Telmisartan) impairs kidney filtration pressure and can elevate blood potassium levels, especially in older adults.',
    action: 'Ensure adequate hydration. Avoid prolonged painkiller courses without physician supervision.'
  },
  {
    salts: ['calcium + vitamin d3', 'azithromycin'],
    severity: 'Yellow',
    title: 'Absorption Interference (Chelation Risk)',
    mechanism: 'Mineral cation binding',
    description: 'High doses of calcium or antacid minerals can bind to certain antibiotics in the gut, reducing their bioavailability and effectiveness.',
    action: 'Take your antibiotic and calcium supplement at least 2 to 3 hours apart.'
  },
  {
    salts: ['metformin', 'pantoprazole'],
    severity: 'Green',
    title: 'Common & Clinically Compatible',
    mechanism: 'Metabolic & Gastric harmony',
    description: 'Frequently prescribed together. However, prolonged multi-year PPI use may reduce vitamin B12 absorption; periodic routine B12 checks are advisable.',
    action: 'Take Pantoprazole in the morning on an empty stomach, and Metformin with or after meals.'
  },
  {
    salts: ['ibuprofen', 'pantoprazole'],
    severity: 'Green',
    title: 'Protective Prescription Synergy (Gastroprotection)',
    mechanism: 'Gastric acid suppression protects mucosal lining',
    description: 'Your doctor deliberately prescribed Pantoprazole (antacid) alongside Ibuprofen to shield your stomach lining from acid erosion and painkiller-induced ulcers.',
    action: 'Take Pantoprazole 30 minutes before food, and Ibuprofen strictly after meals.'
  },
  {
    salts: ['amoxicillin + clavulanic acid', 'pantoprazole'],
    severity: 'Green',
    title: 'Protective Gastric Support',
    mechanism: 'Preventing antibiotic-associated dyspepsia',
    description: 'Amoxicillin-Clavulanic acid commonly causes nausea and acidic reflux. Pantoprazole helps soothe and prevent stomach upset.',
    action: 'Follow prescribed meal timings.'
  },
  {
    salts: ['metformin', 'telmisartan'],
    severity: 'Green',
    title: 'Cardio-Renal Protective Synergy',
    mechanism: 'Complementary metabolic & vascular protection',
    description: 'Telmisartan and Metformin work synergistically in patients with metabolic syndrome to protect kidney microvasculature while regulating glycemic levels.',
    action: 'Maintain consistent daily dosing.'
  }
];

// Helper to normalize salt strings for matching
function normalizeSalt(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function checkRegimenInteractions(medicineList) {
  const normalizedMeds = medicineList.map((m) => ({
    brand: m.brand || m.drugName || 'Unknown',
    salt: m.salt || '',
    saltNorm: normalizeSalt(m.saltNormalized || m.salt || m.drugName)
  }));

  const detected = [];
  const checkedPairs = new Set();

  for (let i = 0; i < normalizedMeds.length; i++) {
    for (let j = i + 1; j < normalizedMeds.length; j++) {
      const medA = normalizedMeds[i];
      const medB = normalizedMeds[j];
      const pairKey = [medA.saltNorm, medB.saltNorm].sort().join('___');

      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      for (const rule of INTERACTION_RULES) {
        const [targetA, targetB] = rule.salts.map(normalizeSalt);

        const matchDirect = medA.saltNorm.includes(targetA) && medB.saltNorm.includes(targetB);
        const matchReverse = medA.saltNorm.includes(targetB) && medB.saltNorm.includes(targetA);

        if (matchDirect || matchReverse) {
          detected.push({
            drugA: medA.brand,
            drugB: medB.brand,
            saltA: medA.salt,
            saltB: medB.salt,
            severity: rule.severity,
            title: rule.title,
            mechanism: rule.mechanism,
            description: rule.description,
            action: rule.action
          });
        }
      }
    }
  }

  // Count by severity
  const counts = {
    red: detected.filter((d) => d.severity === 'Red').length,
    amber: detected.filter((d) => d.severity === 'Amber' || d.severity === 'Yellow').length,
    green: detected.filter((d) => d.severity === 'Green').length
  };

  return {
    interactionsFound: detected.length,
    summary: counts,
    hasHighRisk: counts.red > 0,
    results: detected,
    safetyNotice: counts.red > 0
      ? 'CRITICAL WARNING: A high-risk drug combination was flagged. Do not ingest both without pharmacist/physician confirmation.'
      : detected.length > 0
      ? 'Regimen reviewed. Notable interactions or co-prescribing synergies detected below.'
      : 'No high-risk pairwise interactions found in our verified database. Always verify with your dispensing pharmacist.'
  };
}

module.exports = {
  checkRegimenInteractions
};
