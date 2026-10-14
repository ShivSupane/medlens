const express = require('express');
const multer = require('multer');
const aiService = require('../services/aiService');
const { checkRegimenInteractions } = require('../services/interactionEngine');
const { resolveGlobal } = require('../services/globalResolver');
const drugDatabase = require('../data/drugDatabase.json');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/bmp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, GIF, BMP) are accepted.'));
    }
  }
});

// Helper for tokenized, clinically accurate string matching
function cleanStr(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s) {
  return cleanStr(s).split(' ').filter(w => w.length > 1 && !['tab', 'cap', 'syr', 'inj', 'tablets', 'capsule', 'capsules'].includes(w));
}

/**
 * Match an extracted medicine against our verified drug database with strict precision.
 * Prevents false substring matches (e.g. 'Cip' matching 'Glyciphage' or 'Cet' matching 'Sinarest').
 */
function matchDrugInDatabase(extracted) {
  const brandQuery = cleanStr(extracted.drugName || '');
  const rawQuery = cleanStr(extracted.rawText || '');
  const saltQuery = cleanStr(extracted.salt || '');

  const queryCandidates = [brandQuery, rawQuery].filter(q => q && q.length >= 3);

  // 1. Exact match on brand or alias
  for (const q of queryCandidates) {
    const exactMatch = drugDatabase.drugs.find((d) => {
      if (cleanStr(d.brand) === q) return true;
      return (d.aliases || []).some((a) => cleanStr(a) === q);
    });
    if (exactMatch) return exactMatch;
  }

  // 2. Token / word-boundary prefix match on brand or aliases (e.g. 'telma 40' or 'augmentin 625')
  const brandTokens = tokenize(brandQuery.length > 2 ? brandQuery : rawQuery);
  const primaryWord = brandTokens[0]; // e.g. 'augmentin', 'telma', 'ciplox', 'pan'

  if (primaryWord && primaryWord.length >= 3) {
    const tokenMatch = drugDatabase.drugs.find((d) => {
      const dBrandTokens = tokenize(d.brand);
      if (dBrandTokens[0] === primaryWord) return true;
      return (d.aliases || []).some((a) => {
        const aTokens = tokenize(a);
        return aTokens[0] === primaryWord;
      });
    });
    if (tokenMatch) return tokenMatch;
  }

  // 3. Salt match: match only if the primary active salt matches exactly
  if (saltQuery && saltQuery.length >= 4) {
    const saltTokens = tokenize(saltQuery);
    const primarySalt = saltTokens[0];
    if (primarySalt && primarySalt.length >= 4) {
      const saltMatch = drugDatabase.drugs.find((d) => {
        const dSaltTokens = tokenize(d.saltNormalized || d.salt);
        // Only match if the primary salt matches AND both are either single-salt or multi-salt
        if (dSaltTokens[0] === primarySalt) {
          // If query is a single active salt, don't match a 4-ingredient complex combo
          if (saltTokens.length === 1 && dSaltTokens.length > 2) return false;
          return true;
        }
        return false;
      });
      if (saltMatch) return saltMatch;
    }
  }

  return null;
}

/**
 * Determine daily dosage time slots from frequency text
 */
function parseTimeSlots(frequency, doctorNotes) {
  const combined = ((frequency || '') + ' ' + (doctorNotes || '')).toLowerCase();
  if (/1-1-1|tds|tid|thrice|3 times/i.test(combined)) {
    return ['morning', 'afternoon', 'night'];
  }
  if (/1-0-1|bd|bid|twice daily|morning and night|morning & night/i.test(combined)) {
    return ['morning', 'night'];
  }
  if (/0-0-1|hs|bedtime|at night|before sleep|night only/i.test(combined)) {
    return ['night'];
  }
  if (/1-0-0|od ac|od|morning|breakfast|once daily/i.test(combined)) {
    return ['morning'];
  }
  if (/0-1-0|lunch|afternoon/i.test(combined)) {
    return ['afternoon'];
  }
  if (/sos|as needed|prn/i.test(combined)) {
    return ['as-needed'];
  }
  return ['morning', 'night'];
}

/**
 * Generate clinically accurate patient meal & food guidance
 */
function deriveMealGuidance(drugClass, saltName, existingInstructions) {
  const text = ((drugClass || '') + ' ' + (saltName || '') + ' ' + (existingInstructions || '')).toLowerCase();

  if (/proton pump inhibitor|ppi|antacid|pantoprazole|omeprazole|rabeprazole|esomeprazole/i.test(text)) {
    return {
      mealTiming: 'Before Breakfast (Empty Stomach)',
      bestMeals: 'Take with plain water 30–45 minutes before morning tea or breakfast.',
      foodsToAvoid: 'Avoid sour citrus, black coffee, sodas, and excessive chili on an empty stomach.'
    };
  }
  if (/antibiotic|penicillin|amoxicillin|azithromycin|cefixime|ciprofloxacin|doxycycline/i.test(text)) {
    return {
      mealTiming: 'With or After Meals',
      bestMeals: 'Light khichdi, porridge, or probiotic curd/yogurt to protect intestinal flora. Drink 250ml water.',
      foodsToAvoid: 'Strictly avoid alcohol. If taking fluoroquinolones/tetracyclines, avoid milk/calcium within 2 hours of dose.'
    };
  }
  if (/analgesic|antipyretic|nsaid|paracetamol|dolo|ibuprofen|diclofenac|aceclofenac/i.test(text)) {
    return {
      mealTiming: 'Always After Food',
      bestMeals: 'Take after a solid meal (roti, rice, or oatmeal) to shield gastric mucosa.',
      foodsToAvoid: 'Strictly avoid alcohol (severe risk of liver stress and gastric bleeding).'
    };
  }
  if (/antidiabetic|metformin|glimepiride|insulin|vildagliptin/i.test(text)) {
    return {
      mealTiming: 'With Major Meals',
      bestMeals: 'High-fiber grains, whole wheat, pulses, vegetables. Never skip or delay meals.',
      foodsToAvoid: 'Avoid sugary drinks, processed sweets, and prolonged fasting while taking medication.'
    };
  }
  if (/antihypertensive|amlodipine|telmisartan|losartan|atenolol/i.test(text)) {
    return {
      mealTiming: 'Morning After Breakfast',
      bestMeals: 'Low-sodium meals, fresh vegetables, potassium-rich foods (bananas), and coconut water.',
      foodsToAvoid: 'Strictly avoid grapefruit juice (alters drug breakdown). Limit high-sodium papad/pickles.'
    };
  }
  if (/statin|atorvastatin|rosuvastatin/i.test(text)) {
    return {
      mealTiming: 'At Bedtime / After Dinner',
      bestMeals: 'Light dinner, salads, high-fiber vegetables, plenty of water.',
      foodsToAvoid: 'Strictly avoid grapefruit and deep-fried fatty trans fats.'
    };
  }
  if (/antihistamine|cetirizine|levocetirizine|montelukast/i.test(text)) {
    return {
      mealTiming: 'At Bedtime (Night)',
      bestMeals: 'Regular balanced dinner with warm water.',
      foodsToAvoid: 'Avoid alcohol and sedatives; may cause drowsiness.'
    };
  }

  return {
    mealTiming: 'After Meals',
    bestMeals: 'Take with a regular balanced meal and drink at least 1 full glass of water.',
    foodsToAvoid: 'Avoid alcohol and discuss with physician if taking health supplements.'
  };
}

/**
 * Enrich extracted medicine array with verified database details.
 * Uses a 3-tier global fallback:
 *   Tier 1 — Local Jan Aushadhi + India Verified DB (instant)
 *   Tier 2 — openFDA Live US Drug Database
 *   Tier 3 — Gemini AI Global Salt Resolver (any brand, any country)
 */
async function enrichMedicines(extractedMeds) {
  let totalBrandedCost = 0;
  let totalGenericCost = 0;

  const enriched = await Promise.all(
    extractedMeds.map(async (med) => {
      // ─── Tier 1: Local DB ───────────────────────────────────────────────
      const match = matchDrugInDatabase(med);

      if (match) {
        // Sort alternatives by price
        const alts = [...(match.alternatives || [])].sort((a, b) => a.priceINR - b.priceINR);
        const bestAlt = alts[0] || null;
        const savingsINR = bestAlt ? Math.max(0, match.priceINR - bestAlt.priceINR) : 0;
        const savingsPercent = bestAlt && match.priceINR > 0 ? Math.round((savingsINR / match.priceINR) * 100) : 0;

        totalBrandedCost += match.priceINR;
        totalGenericCost += bestAlt ? bestAlt.priceINR : match.priceINR;

        const defaultMeal = deriveMealGuidance(match.class, match.salt, match.foodInstructions);
        const timeSlots = med.timeSlots && med.timeSlots.length ? med.timeSlots : parseTimeSlots(med.frequency, med.doctorNotes);

        return {
          isVerified: true,
          resolvedBy: 'MedLens India Verified Database',
          rawText: med.rawText,
          drugName: med.drugName || match.brand,
          brand: med.drugName || match.brand,
          salt: med.salt || match.salt,
          saltNormalized: match.saltNormalized,
          strength: med.strength || match.strength,
          dosageForm: med.dosageForm || 'Tablet',
          frequency: med.frequency || 'Take as advised by doctor',
          timeSlots,
          duration: med.duration || 'Complete prescribed course',
          confidence: med.confidence || 'high',
          doctorNotes: med.doctorNotes || '',
          class: match.class,
          whyToTake: med.whyToTake || match.conditionHint,
          conditionHint: match.conditionHint,
          precautions: match.precautions || [],
          mealTiming: med.mealTiming || defaultMeal.mealTiming,
          bestMeals: med.bestMeals || defaultMeal.bestMeals,
          foodsToAvoid: med.foodsToAvoid || defaultMeal.foodsToAvoid,
          foodInstructions: match.foodInstructions || 'Take with water.',
          packSize: match.packSize || '10 units',
          priceINR: match.priceINR,
          alternatives: alts,
          bestAlternative: bestAlt,
          savingsINR,
          savingsPercent
        };
      }

      // ─── Tiers 2 & 3: Global Resolver ──────────────────────────────────
      const drugNameForLookup = med.drugName || med.rawText || '';
      const globalMatch = await resolveGlobal(drugNameForLookup);

      if (globalMatch) {
        const alts = [...(globalMatch.alternatives || [])].sort((a, b) => a.priceINR - b.priceINR);
        const bestAlt = alts[0] || null;
        const savingsINR = globalMatch.savingsINR || (bestAlt ? Math.max(0, globalMatch.priceINR - bestAlt.priceINR) : 0);
        const savingsPercent = globalMatch.savingsPercent || 0;

        totalBrandedCost += globalMatch.priceINR || 0;
        totalGenericCost += bestAlt ? bestAlt.priceINR : (globalMatch.priceINR || 0);

        const defaultMeal = deriveMealGuidance(globalMatch.class, globalMatch.salt, globalMatch.foodInstructions);
        const timeSlots = med.timeSlots && med.timeSlots.length ? med.timeSlots : parseTimeSlots(med.frequency, med.doctorNotes);

        return {
          isVerified: true,
          resolvedBy: globalMatch.resolvedBy || 'Global Drug Database',
          rawText: med.rawText,
          drugName: med.drugName || globalMatch.brand,
          brand: globalMatch.brand,
          salt: globalMatch.salt,
          saltNormalized: globalMatch.saltNormalized,
          strength: med.strength || globalMatch.strength,
          dosageForm: med.dosageForm || 'Tablet',
          frequency: med.frequency || 'Take as advised by doctor',
          timeSlots,
          duration: med.duration || 'Complete prescribed course',
          confidence: med.confidence || 'medium',
          doctorNotes: med.doctorNotes || '',
          class: globalMatch.class,
          whyToTake: med.whyToTake || globalMatch.whyToTake || globalMatch.conditionHint,
          conditionHint: globalMatch.conditionHint,
          precautions: globalMatch.precautions || [],
          mealTiming: med.mealTiming || globalMatch.mealTiming || defaultMeal.mealTiming,
          bestMeals: med.bestMeals || globalMatch.bestMeals || defaultMeal.bestMeals,
          foodsToAvoid: med.foodsToAvoid || globalMatch.foodsToAvoid || defaultMeal.foodsToAvoid,
          foodInstructions: globalMatch.foodInstructions || 'Take as directed.',
          packSize: globalMatch.packSize || 'Standard Pack',
          priceINR: globalMatch.priceINR || 0,
          alternatives: alts,
          bestAlternative: bestAlt,
          savingsINR,
          savingsPercent
        };
      }

      // ─── All tiers failed — truly unrecognized ──────────────────────────
      return {
        isVerified: false,
        resolvedBy: 'Unresolved',
        rawText: med.rawText,
        drugName: med.drugName || med.rawText,
        strength: med.strength || 'N/A',
        frequency: med.frequency || 'As advised by doctor',
        timeSlots: parseTimeSlots(med.frequency, med.doctorNotes),
        duration: med.duration || 'Full course',
        confidence: med.confidence || 'low',
        doctorNotes: med.doctorNotes || '',
        whyToTake: med.whyToTake || 'Consult with your physician or pharmacist regarding this medication.',
        mealTiming: med.mealTiming || 'As advised by doctor',
        bestMeals: med.bestMeals || 'Take with water after a light meal.',
        foodsToAvoid: med.foodsToAvoid || 'Avoid alcohol.',
        message: `"${med.drugName || med.rawText}" requires clinical pharmacist verification. Please confirm the active salt with your dispensing pharmacist.`
      };
    })
  );

  const totalSavings = Math.max(0, totalBrandedCost - totalGenericCost);
  const overallSavingsPercent = totalBrandedCost > 0 ? Math.round((totalSavings / totalBrandedCost) * 100) : 0;

  return {
    medicines: enriched,
    totalBrandedCost,
    totalGenericCost,
    totalSavings,
    overallSavingsPercent
  };
}

/**
 * Generate human-friendly synergy description of why these were prescribed together.
 */
function generatePrescriptionSynergy(medicines) {
  const classes = medicines.filter((m) => m.isVerified).map((m) => m.class || '');
  const notes = [];

  const hasAntibiotic = classes.some((c) => /antibiotic|penicillin|macrolide|cephalosporin/i.test(c));
  const hasPainkiller = classes.some((c) => /analgesic|antipyretic|nsaid/i.test(c));
  const hasAntacid = classes.some((c) => /proton pump inhibitor|ppi|antacid/i.test(c));
  const hasBP = classes.some((c) => /antihypertensive|calcium channel blocker|arb/i.test(c));
  const hasDiabetes = classes.some((c) => /antidiabetic|biguanide/i.test(c));

  if (hasAntibiotic && hasAntacid) {
    notes.push('Antibiotics frequently cause stomach irritation, hyperacidity, or nausea. An antacid (PPI) was prescribed to protect your stomach lining and enhance comfort.');
  }
  if (hasPainkiller && hasAntacid) {
    notes.push('NSAID painkillers can irritate the gastric mucosa. The antacid shields your stomach from ulcers and acid reflux.');
  }
  if (hasAntibiotic && hasPainkiller) {
    notes.push('The antibiotic targets the bacterial infection at its root, while the analgesic relieves the associated fever, pain, and inflammation.');
  }
  if (hasBP && hasDiabetes) {
    notes.push('Co-management regimen: blood pressure and diabetes medicines work together to protect long-term kidney microvasculature and heart health.');
  }

  if (notes.length === 0) {
    return 'Your doctor has prescribed a targeted regimen. Make sure to adhere to the designated meal timings and finish all antibiotic courses completely.';
  }
  return notes.join(' ');
}

// -------------------------------------------------------------
// POST /api/prescription/analyze
// Unified pipeline: Vision OCR -> Verified Salt Match -> DDI Check -> Savings
// -------------------------------------------------------------
router.post('/analyze', upload.single('prescription'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No prescription file uploaded. Please upload a clear photo of your prescription (JPEG, PNG, WebP).'
      });
    }

    const extracted = await aiService.extractPrescription(
      req.file.buffer,
      req.file.mimetype || 'image/jpeg'
    );

    const rawMeds = extracted.medicines || [];
    if (rawMeds.length === 0) {
      return res.status(400).json({
        error: 'No medicines were detected in this image. Please ensure the prescription photo is well-lit, in focus, and oriented upright, or type the prescription into the "Analyze Text" tab.'
      });
    }

    // Step 2: Enrich with verified database (3-tier global resolver)
    const enrichment = await enrichMedicines(rawMeds);

    // Step 3: Check Drug-Drug Interactions
    const verifiedMeds = enrichment.medicines.filter((m) => m.isVerified);
    const interactionReport = checkRegimenInteractions(verifiedMeds);

    // Step 4: Synergy explanation
    const clinicalSynergy = generatePrescriptionSynergy(enrichment.medicines);

    res.json({
      success: true,
      providerUsed: extracted.providerUsed,
      doctorSpecialty: extracted.doctorSpecialty || 'General Practitioner',
      prescriptionNotes: extracted.prescriptionNotes || null,
      medicines: enrichment.medicines,
      metrics: {
        totalMedicines: enrichment.medicines.length,
        verifiedCount: verifiedMeds.length,
        totalBrandedCost: enrichment.totalBrandedCost,
        totalGenericCost: enrichment.totalGenericCost,
        prescriptionSavingsINR: enrichment.totalSavings,
        savingsPercent: enrichment.overallSavingsPercent
      },
      interactions: interactionReport,
      clinicalSynergy
    });
  } catch (err) {
    console.error('Error during prescription analysis:', err);
    res.status(500).json({
      error: err.message || 'Prescription analysis failed.',
      hint: 'If you are using Gemini, confirm GEMINI_API_KEY in server/.env is valid.'
    });
  }
});

// -------------------------------------------------------------
// POST /api/prescription/analyze-text
// Direct Prescription Text Input
// -------------------------------------------------------------
router.post('/analyze-text', express.json(), async (req, res) => {
  try {
    const rawInput = req.body.text || req.body.prescriptionText;
    if (!rawInput || !rawInput.trim()) {
      return res.status(400).json({ error: 'Prescription text cannot be empty.' });
    }
    const text = rawInput.trim();

    const extracted = await aiService.extractPrescriptionText(text.trim());
    const rawMeds = extracted.medicines || [];

    if (rawMeds.length === 0) {
      return res.status(400).json({
        error: 'No recognizable medicines were found in the provided text. Please check the drug names and try again.'
      });
    }

    const enrichment = await enrichMedicines(rawMeds);
    const verifiedMeds = enrichment.medicines.filter((m) => m.isVerified);
    const interactionReport = checkRegimenInteractions(verifiedMeds);
    const clinicalSynergy = generatePrescriptionSynergy(enrichment.medicines);

    res.json({
      success: true,
      providerUsed: extracted.providerUsed,
      doctorSpecialty: extracted.doctorSpecialty || 'General Practitioner',
      prescriptionNotes: extracted.prescriptionNotes || null,
      medicines: enrichment.medicines,
      metrics: {
        totalMedicines: enrichment.medicines.length,
        verifiedCount: verifiedMeds.length,
        totalBrandedCost: enrichment.totalBrandedCost,
        totalGenericCost: enrichment.totalGenericCost,
        prescriptionSavingsINR: enrichment.totalSavings,
        savingsPercent: enrichment.overallSavingsPercent
      },
      interactions: interactionReport,
      clinicalSynergy
    });
  } catch (err) {
    console.error('Error during text prescription analysis:', err);
    res.status(500).json({
      error: err.message || 'Prescription text analysis failed.'
    });
  }
});

// -------------------------------------------------------------
// POST /api/prescription/sample
// 1-Click Instant Demo
// -------------------------------------------------------------
router.post('/sample', async (req, res) => {
  const sampleData = JSON.parse(JSON.stringify(aiService.SAMPLE_PRESCRIPTION));
  sampleData.providerUsed = 'MedLens Demo (Instant Sample)';

  const enrichment = await enrichMedicines(sampleData.medicines);
  const interactionReport = checkRegimenInteractions(enrichment.medicines.filter((m) => m.isVerified));
  const clinicalSynergy = generatePrescriptionSynergy(enrichment.medicines);

  res.json({
    success: true,
    providerUsed: sampleData.providerUsed,
    doctorSpecialty: sampleData.doctorSpecialty,
    prescriptionNotes: sampleData.prescriptionNotes,
    medicines: enrichment.medicines,
    metrics: {
      totalMedicines: enrichment.medicines.length,
      verifiedCount: enrichment.medicines.filter((m) => m.isVerified).length,
      totalBrandedCost: enrichment.totalBrandedCost,
      totalGenericCost: enrichment.totalGenericCost,
      prescriptionSavingsINR: enrichment.totalSavings,
      savingsPercent: enrichment.overallSavingsPercent
    },
    interactions: interactionReport,
    clinicalSynergy
  });
});

// -------------------------------------------------------------
// POST /api/prescription/chat
// Conversational AI Copilot
// -------------------------------------------------------------
router.post('/chat', async (req, res) => {
  try {
    const { message, currentPrescription, chatHistory } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }
    if (message.length > 800) {
      return res.status(400).json({ error: 'Message too long. Please keep questions under 800 characters.' });
    }
    // Limit chat history to last 6 turns to avoid bloating the AI prompt
    const trimmedHistory = Array.isArray(chatHistory) ? chatHistory.slice(-6) : [];

    const reply = await aiService.chatWithMedLens({
      message,
      currentPrescription,
      chatHistory: trimmedHistory
    });

    res.json({ reply });
  } catch (err) {
    console.error('Chatbot error:', err);
    res.status(500).json({ error: 'Chatbot could not process your question.' });
  }
});

// -------------------------------------------------------------
// GET /api/prescription/status
// Check active API provider configuration & key count
// -------------------------------------------------------------
router.get('/status', (req, res) => {
  const active = aiService.getActiveProvider();
  res.json({
    activeProvider: active.provider,
    keyCount: active.keyCount || 1,
    isFreeTier: active.isFreeTier,
    model: active.model || 'N/A',
    isConfigured: active.provider !== 'demo',
    instructions:
      active.provider === 'demo'
        ? 'Get a 100% free Gemini API key from https://aistudio.google.com/ and paste it in server/.env!'
        : `Active and ready. Multi-key pool loaded with ${active.keyCount || 1} Gemini keys.`
  });
});

module.exports = router;
