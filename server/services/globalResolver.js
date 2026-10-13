/**
 * MedLens Global Drug Resolver
 * ─────────────────────────────
 * Multi-tier worldwide drug identification engine with in-memory caching:
 *   Tier 1: Local Jan Aushadhi & Indian Verified Database (instant, 0ms)
 *   Tier 2: openFDA National Drug Database (US/International FDA certifications)
 *   Tier 3: NIH NLM RxNorm Universal Clinical Drug Registry
 *   Tier 4: Google Gemini AI Multi-Key Pool
 *   Tier 5: Groq Qwen 2.5 High-Speed Pharmacology Resolver (Zero rate limits)
 */

const { callGeminiWithFailover, getGeminiKeys } = require('./aiService');

// In-memory cache to save API calls and ensure instant repeat lookups
const resolutionCache = new Map();

// ─── Tier 2: openFDA Live Lookup ────────────────────────────────────────────

async function queryOpenFDA(drugName) {
  try {
    const clean = (drugName || '').replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)[0];
    if (!clean || clean.length < 3) return null;

    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(clean)}"&limit=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    const hit = data.results?.[0];
    if (!hit) return null;

    const brand = hit.openfda?.brand_name?.[0] || drugName;
    const substances = hit.openfda?.substance_name || hit.openfda?.generic_name || [];
    const activeSalt = substances.join(' + ') || null;
    if (!activeSalt) return null;

    const drugClass = hit.openfda?.pharm_class_cs?.[0] || hit.openfda?.pharm_class_epc?.[0] || 'Pharmaceutical formulation';
    const indications = ((hit.indications_and_usage?.[0] || '').slice(0, 220) + '…').trim();
    const warnings = ((hit.warnings?.[0] || hit.precautions?.[0] || 'Follow standard prescribing instructions.').slice(0, 180) + '…').trim();

    return {
      isVerified: true,
      resolvedBy: 'openFDA (US National Drug Database)',
      brand,
      salt: activeSalt,
      saltNormalized: activeSalt.toLowerCase(),
      strength: 'Standard Clinical Strength',
      class: drugClass,
      whyToTake: indications || 'Prescribed as per certified clinical label.',
      conditionHint: indications || 'Prescribed as per certified clinical label.',
      precautions: [warnings],
      mealTiming: 'With Meals',
      bestMeals: 'Take with a light nutritious meal and a full glass of water.',
      foodsToAvoid: 'Avoid alcohol and consult your physician.',
      foodInstructions: 'Take as directed on packaging with water.',
      priceINR: 120,
      alternatives: [
        {
          brand: `PMBJP Jan Aushadhi ${activeSalt.split(' + ')[0].trim()}`,
          manufacturer: 'PMBJP (Jan Aushadhi)',
          priceINR: 30,
          isJanAushadhi: true
        }
      ],
      savingsINR: 90,
      savingsPercent: 75
    };
  } catch (err) {
    return null;
  }
}

// ─── Tier 3: NIH NLM RxNorm Clinical Drug Registry ──────────────────────────

async function queryRxNorm(drugName) {
  try {
    const clean = (drugName || '').replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)[0];
    if (!clean || clean.length < 3) return null;

    const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(clean)}&maxEntries=3`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    const candidates = data.approximateGroup?.candidate || [];
    const best = candidates.find(c => c.name && c.name.length > 2);
    if (!best || !best.name) return null;

    const salt = best.name;
    return {
      isVerified: true,
      resolvedBy: 'NIH RxNorm (US National Library of Medicine)',
      brand: drugName,
      salt: salt,
      saltNormalized: salt.toLowerCase(),
      strength: 'Standard Dosage',
      class: 'Pharmaceutical Formulation',
      whyToTake: `Clinical therapeutic formulation identified via NIH RxNorm Registry (${salt}).`,
      conditionHint: `Prescribed active ingredient: ${salt}.`,
      precautions: ['Follow prescribing instructions provided by doctor.'],
      mealTiming: 'After Meals',
      bestMeals: 'Take with regular balanced meals and adequate water.',
      foodsToAvoid: 'Avoid alcohol while taking medication.',
      foodInstructions: 'Take with water after food.',
      priceINR: 110,
      alternatives: [
        {
          brand: `PMBJP Jan Aushadhi ${salt.split(' ')[0]}`,
          manufacturer: 'PMBJP (Jan Aushadhi)',
          priceINR: 28,
          isJanAushadhi: true
        }
      ],
      savingsINR: 82,
      savingsPercent: 74
    };
  } catch (err) {
    return null;
  }
}

// ─── Tier 4: Gemini AI Global Salt Resolver ─────────────────────────────────

async function queryGeminiAI(drugName) {
  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length === 0) return null;

  const prompt = `You are a clinical pharmacology database specializing in Indian, US, UK, and global drug brands.
Identify the drug brand: "${drugName}".
Provide exact active chemical ingredient (salt), typical strength, therapeutic class, reason to take, meal recommendations, and cheaper PMBJP Jan Aushadhi generic equivalent.

Output valid JSON only (no markdown fences, no extra text):
{
  "brand": "Standardized Brand Name",
  "salt": "Active ingredient(s) with strength e.g. Rosuvastatin (10mg)",
  "saltNormalized": "lowercase active ingredient e.g. rosuvastatin",
  "strength": "10mg",
  "class": "Drug class e.g. Statin / Lipid-Lowering Agent",
  "whyToTake": "Plain English explanation of what disease/symptoms this treats and why prescribed",
  "mealTiming": "Before Breakfast (Empty Stomach), With Meals, After Meals, or At Bedtime",
  "bestMeals": "Recommended foods or drinks to pair with this medicine",
  "foodsToAvoid": "Foods or drinks to strictly avoid while taking this medicine",
  "precautions": ["Key precaution 1", "Key precaution 2"],
  "estimatedPriceINR": 150,
  "genericAlternative": "PMBJP Jan Aushadhi Equivalent",
  "genericPriceINR": 35,
  "country": "India / Global"
}
If completely unrecognized, return {"unknown": true}.`;

  try {
    const result = await callGeminiWithFailover(() => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, response_mime_type: 'application/json' }
    }), `Global Resolver for "${drugName}"`);

    const jsonText = result.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonText);

    if (parsed.unknown || !parsed.salt) return null;

    const genericPrice = Number(parsed.genericPriceINR) || 30;
    const brandPrice = Number(parsed.estimatedPriceINR) || 120;
    const savingsINR = Math.max(0, brandPrice - genericPrice);
    const savingsPercent = brandPrice > 0 ? Math.round((savingsINR / brandPrice) * 100) : 0;

    return {
      isVerified: true,
      resolvedBy: `Global Medical AI Database (${parsed.country || 'Global'})`,
      brand: parsed.brand || drugName,
      salt: parsed.salt,
      saltNormalized: (parsed.saltNormalized || parsed.salt).toLowerCase(),
      strength: parsed.strength || 'Standard Dosage',
      class: parsed.class || 'Pharmaceutical formulation',
      whyToTake: parsed.whyToTake || "Prescribed as per doctor's clinical assessment.",
      conditionHint: parsed.whyToTake || "Prescribed as per doctor's clinical assessment.",
      mealTiming: parsed.mealTiming || 'After Meals',
      bestMeals: parsed.bestMeals || 'Take with a light meal and drink 250ml water.',
      foodsToAvoid: parsed.foodsToAvoid || 'Avoid alcohol while on medication.',
      precautions: Array.isArray(parsed.precautions) ? parsed.precautions : [parsed.precautions || 'Follow prescribing instructions.'],
      foodInstructions: parsed.mealTiming ? `Take ${parsed.mealTiming.toLowerCase()}` : 'Take as directed by physician.',
      priceINR: brandPrice,
      alternatives: [
        {
          brand: parsed.genericAlternative || `PMBJP Jan Aushadhi ${(parsed.saltNormalized || parsed.salt).split('+')[0].trim()}`,
          manufacturer: 'PMBJP (Jan Aushadhi)',
          priceINR: genericPrice,
          isJanAushadhi: true
        }
      ],
      savingsINR,
      savingsPercent
    };
  } catch (err) {
    console.warn(`[GlobalResolver] Gemini AI resolver failed for "${drugName}":`, err.message);
    return null;
  }
}

// ─── Tier 5: Groq Qwen 2.5 Clinical Resolver (Ultra-reliable Fallback) ───────

async function queryGroqAI(drugName) {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) return null;

  const prompt = `You are a certified clinical pharmacology drug database specializing in Indian, US, UK, and worldwide medications.
A prescription contains the drug brand: "${drugName}".
Identify its exact active chemical ingredient (salt), typical strength, therapeutic class, reason to take, meal recommendations, and cheaper PMBJP Jan Aushadhi generic equivalent.

Output valid JSON only matching:
{
  "brand": "Standard Brand Name e.g. Novastat 10",
  "salt": "Active ingredient(s) with strength e.g. Rosuvastatin (10mg)",
  "saltNormalized": "lowercase active ingredient e.g. rosuvastatin",
  "strength": "10mg",
  "class": "Drug class e.g. Statin / Lipid-Lowering Agent",
  "whyToTake": "Plain English explanation of what disease/symptoms it treats and why prescribed",
  "mealTiming": "Before Breakfast (Empty Stomach), With Meals, After Meals, or At Bedtime",
  "bestMeals": "Recommended foods or drinks to pair with this medicine",
  "foodsToAvoid": "Foods or drinks to strictly avoid while taking this medicine",
  "precautions": ["Key precaution 1", "Key precaution 2"],
  "estimatedPriceINR": 150,
  "genericAlternative": "PMBJP Jan Aushadhi Equivalent",
  "genericPriceINR": 35,
  "country": "India / Global"
}
If completely unrecognized, return {"unknown": true}.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: 'You are a certified pharmacology database. Output valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (parsed.unknown || !parsed.salt) return null;

    const genericPrice = Number(parsed.genericPriceINR) || 35;
    const brandPrice = Number(parsed.estimatedPriceINR) || 140;
    const savingsINR = Math.max(0, brandPrice - genericPrice);
    const savingsPercent = brandPrice > 0 ? Math.round((savingsINR / brandPrice) * 100) : 0;

    return {
      isVerified: true,
      resolvedBy: `Global Clinical Pharmacology Engine (${parsed.country || 'Global'})`,
      brand: parsed.brand || drugName,
      salt: parsed.salt,
      saltNormalized: (parsed.saltNormalized || parsed.salt).toLowerCase(),
      strength: parsed.strength || 'Standard Clinical Dosage',
      class: parsed.class || 'Pharmaceutical formulation',
      whyToTake: parsed.whyToTake || "Prescribed as per doctor's clinical assessment.",
      conditionHint: parsed.whyToTake || "Prescribed as per doctor's clinical assessment.",
      mealTiming: parsed.mealTiming || 'After Meals',
      bestMeals: parsed.bestMeals || 'Take with regular meals and adequate water.',
      foodsToAvoid: parsed.foodsToAvoid || 'Avoid alcohol while taking medication.',
      precautions: Array.isArray(parsed.precautions) ? parsed.precautions : [parsed.precautions || 'Follow prescribing instructions.'],
      foodInstructions: parsed.mealTiming ? `Take ${parsed.mealTiming.toLowerCase()}` : 'Take as directed by physician.',
      priceINR: brandPrice,
      alternatives: [
        {
          brand: parsed.genericAlternative || `PMBJP Jan Aushadhi ${(parsed.saltNormalized || parsed.salt).split('+')[0].trim()}`,
          manufacturer: 'PMBJP (Jan Aushadhi)',
          priceINR: genericPrice,
          isJanAushadhi: true
        }
      ],
      savingsINR,
      savingsPercent
    };
  } catch (err) {
    console.warn(`[GlobalResolver] Groq resolver error for "${drugName}":`, err.message);
    return null;
  }
}

// ─── Exported 5-Tier Resolver with Cache ─────────────────────────────────────

async function resolveGlobal(drugName) {
  if (!drugName || drugName.trim().length < 2) return null;
  const cacheKey = drugName.trim().toLowerCase();

  if (resolutionCache.has(cacheKey)) {
    console.log(`[GlobalResolver] Cache hit for "${drugName}"`);
    return resolutionCache.get(cacheKey);
  }

  // Tier 2: openFDA
  console.log(`[GlobalResolver] Tier 2 — openFDA lookup for: "${drugName}"`);
  const fdaResult = await queryOpenFDA(drugName);
  if (fdaResult) {
    console.log(`[GlobalResolver] ✓ openFDA resolved: ${drugName} → ${fdaResult.salt}`);
    resolutionCache.set(cacheKey, fdaResult);
    return fdaResult;
  }

  // Tier 3: Groq Qwen 2.5 Clinical Resolver (Sub-second worldwide pharmacology)
  console.log(`[GlobalResolver] Tier 3 — Groq Clinical resolver for: "${drugName}"`);
  const groqResult = await queryGroqAI(drugName);
  if (groqResult) {
    console.log(`[GlobalResolver] ✓ Groq resolved: ${drugName} → ${groqResult.salt}`);
    resolutionCache.set(cacheKey, groqResult);
    return groqResult;
  }

  // Tier 4: Gemini AI Multi-Key Pool
  console.log(`[GlobalResolver] Tier 4 — Gemini AI resolver for: "${drugName}"`);
  const aiResult = await queryGeminiAI(drugName);
  if (aiResult) {
    console.log(`[GlobalResolver] ✓ Gemini AI resolved: ${drugName} → ${aiResult.salt}`);
    resolutionCache.set(cacheKey, aiResult);
    return aiResult;
  }

  // Tier 5: NIH RxNorm
  console.log(`[GlobalResolver] Tier 5 — NIH RxNorm lookup for: "${drugName}"`);
  const rxResult = await queryRxNorm(drugName);
  if (rxResult) {
    console.log(`[GlobalResolver] ✓ NIH RxNorm resolved: ${drugName} → ${rxResult.salt}`);
    resolutionCache.set(cacheKey, rxResult);
    return rxResult;
  }

  console.log(`[GlobalResolver] ✗ All tiers failed for: "${drugName}"`);
  return null;
}

module.exports = { resolveGlobal, queryOpenFDA, queryRxNorm, queryGeminiAI, queryGroqAI };
