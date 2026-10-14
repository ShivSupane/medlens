// Multi-provider AI service with Multi-Key Failover Pool for Google Gemini, Groq Qwen, Claude, and OpenAI.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Tesseract = require('tesseract.js');

// Persistent OCR worker cache for sub-second recognition
let ocrWorkerPromise = null;
async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = Tesseract.createWorker('eng', 1, {
      logger: () => {}
    });
  }
  return ocrWorkerPromise;
}

// In-memory cooldown cache for rate-limited keys
const keyCooldownMap = new Map();

const EXTRACTION_SYSTEM_PROMPT = `You are MedLens Clinical AI, a specialized medical prescription recognition and pharmacology engine.
Analyze this medical prescription (photo OCR or text) and identify every prescribed medicine with strict clinical accuracy.

CRITICAL CLINICAL RULES:
1. Extract the EXACT medicine name written on the prescription (brand or generic). Never replace or invent drugs.
2. For each drug, accurately determine its active generic chemical ingredient (salt) (e.g. "Telma" -> "Telmisartan", "Pan" or "Pantocid" -> "Pantoprazole", "Dolo" -> "Paracetamol", "Augmentin" -> "Amoxicillin + Clavulanic Acid", "Glycomet" -> "Metformin").
3. Extract exact dosage strength (e.g. "500mg", "625mg", "40mg", "10mg", "5mg") and dosage form ("Tablet", "Capsule", "Syrup", "Ointment", "Drops", "Injection").
4. Filter out non-medicine elements: patient name, age, gender, doctor's name, clinic contact/address, date, vital signs (e.g. "BP: 130/80", "Pulse: 72"), complaints (e.g. "fever x 3 days"), or laboratory tests (e.g. "CBC", "Lipid profile", "LFT", "HbA1c"). These are NOT medicines.
5. Provide patient-friendly, clinically sound explanation ("whyToTake"), meal timing instructions ("mealTiming": "Before Breakfast (Empty Stomach)" | "With Meals" | "After Meals" | "At Bedtime"), recommended dietary food/drink pairs ("bestMeals"), and foods/drinks to strictly avoid ("foodsToAvoid").
6. Output MUST be valid JSON only.

Expected JSON schema:
{
  "medicines": [
    {
      "rawText": "Exact text from prescription e.g. Tab. Augmentin 625 1-0-1 x 5d after food",
      "drugName": "Augmentin 625 Duo",
      "salt": "Amoxicillin (500mg) + Clavulanic Acid (125mg)",
      "strength": "625mg",
      "dosageForm": "Tablet",
      "frequency": "Twice daily after food (1-0-1)",
      "timeSlots": ["morning", "night"],
      "duration": "5 days",
      "whyToTake": "Prescribed to treat acute bacterial infections of the chest, respiratory tract, throat, or sinuses.",
      "mealTiming": "After Meals",
      "bestMeals": "Take with light food or yogurt/curd to protect gut flora. Drink a full glass of water.",
      "foodsToAvoid": "Strictly avoid alcohol. Limit heavy spicy/oily food.",
      "confidence": "high",
      "doctorNotes": "Complete full 5-day course"
    }
  ],
  "doctorSpecialty": "General Medicine" or null,
  "prescriptionNotes": "Specialist clinical notes" or null
}`;

// Sample fallback prescription data for demo testing
const SAMPLE_PRESCRIPTION = {
  medicines: [
    {
      rawText: "Tab. Augmentin 625mg 1 tab BD x 5 days",
      drugName: "Augmentin 625 Duo",
      salt: "Amoxicillin (500mg) + Clavulanic Acid (125mg)",
      strength: "625mg",
      dosageForm: "Tablet",
      frequency: "1 tablet Twice Daily (Morning & Night) after food",
      timeSlots: ["morning", "night"],
      duration: "5 days",
      whyToTake: "Prescribed to eradicate bacterial infection in the respiratory tract, throat, or chest.",
      mealTiming: "After Meals",
      bestMeals: "Light warm meals, khichdi, dalia, or probiotic curd. Drink 250-300ml water.",
      foodsToAvoid: "Alcohol, heavy oily foods, and skip skipping meals.",
      confidence: "high",
      doctorNotes: "Must complete full 5-day course."
    },
    {
      rawText: "Tab. Dolo 650 1 tab TDS SOS",
      drugName: "Dolo 650",
      salt: "Paracetamol (650mg)",
      strength: "650mg",
      dosageForm: "Tablet",
      frequency: "1 tablet Thrice Daily as needed (SOS for fever > 100°F)",
      timeSlots: ["morning", "afternoon", "night"],
      duration: "3 days",
      whyToTake: "Rapidly relieves high fever, headache, body aches, and general inflammation.",
      mealTiming: "After Meals",
      bestMeals: "Take after a meal or snack (biscuits, toast, or rice) to avoid mild gastric irritation.",
      foodsToAvoid: "Strictly avoid alcohol (risk of liver toxicity) and other paracetamol-containing cold syrups.",
      confidence: "high",
      doctorNotes: "Maintain at least 6 hours between tablets."
    },
    {
      rawText: "Cap. Pantocid 40 1 cap OD AC x 7 days",
      drugName: "Pantocid 40",
      salt: "Pantoprazole (40mg)",
      strength: "40mg",
      dosageForm: "Tablet",
      frequency: "1 tablet Once Daily 30 mins before breakfast (OD AC)",
      timeSlots: ["morning"],
      duration: "7 days",
      whyToTake: "Reduces stomach acid and shields gastric lining from irritation caused by antibiotics/painkillers.",
      mealTiming: "Before Breakfast (Empty Stomach)",
      bestMeals: "Take with plain water 30-45 minutes before morning tea or breakfast.",
      foodsToAvoid: "Avoid strong coffee, sour citrus juices, and carbonated sodas on an empty stomach.",
      confidence: "high",
      doctorNotes: "Take empty stomach before morning tea/food."
    }
  ],
  doctorSpecialty: "General Medicine / Internal Physician",
  prescriptionNotes: "Prescribed for acute upper respiratory tract infection and fever."
};

/**
 * Retrieve all configured Google Gemini API keys.
 * Supports GEMINI_API_KEYS (comma separated) as well as GEMINI_API_KEY, GEMINI_API_KEY_2, etc.
 */
function getGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEYS) {
    const list = process.env.GEMINI_API_KEYS.split(',').map((k) => k.trim()).filter(Boolean);
    keys.push(...list);
  }
  ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4'].forEach((varName) => {
    const val = (process.env[varName] || '').trim();
    if (val && !keys.includes(val)) {
      keys.push(val);
    }
  });
  return keys;
}

let keyRoundRobinIdx = 0;

/**
 * Detect which provider is configured.
 */
function getActiveProvider() {
  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length > 0) {
    return {
      provider: 'gemini',
      keyCount: geminiKeys.length,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      isFreeTier: true
    };
  }
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    return {
      provider: 'groq',
      key: process.env.GROQ_API_KEY.trim(),
      model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
      isFreeTier: true
    };
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    return {
      provider: 'openai',
      key: process.env.OPENAI_API_KEY.trim(),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      isFreeTier: false
    };
  }
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '') {
    return {
      provider: 'anthropic',
      key: process.env.ANTHROPIC_API_KEY.trim(),
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      isFreeTier: false
    };
  }
  return {
    provider: 'demo',
    isFreeTier: true
  };
}

/**
 * Execute a Gemini request with automatic multi-key and multi-model failover rotation.
 * Features fast 6.5s timeout and automatic 5-minute cooldown on 429 quota exhaustion.
 */
async function callGeminiWithFailover(payloadBuilder, actionName = 'request') {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error('No Google Gemini API keys configured.');

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const candidateModels = [
    primaryModel,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].filter((v, i, a) => a.indexOf(v) === i);

  const errors = [];
  const startIndex = keyRoundRobinIdx % keys.length;
  const now = Date.now();

  let consecutiveTimeouts = 0;

  for (let i = 0; i < keys.length; i++) {
    const keyIndex = (startIndex + i) % keys.length;
    const currentKey = keys[keyIndex];

    // Check if key is currently in cooldown from 429
    const cooldownUntil = keyCooldownMap.get(currentKey);
    if (cooldownUntil && now < cooldownUntil) {
      console.log(`[GeminiPool] Skipping Key #${keyIndex + 1} (in cooldown for ${Math.round((cooldownUntil - now)/1000)}s)`);
      continue;
    }

    for (const model of candidateModels) {
      try {
        console.log(`[GeminiPool] Attempting ${actionName} with Key #${keyIndex + 1} (${model})…`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;
        const payload = payloadBuilder();

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(7000)
        });

        const data = await res.json();

        if (!res.ok) {
          const msg = data.error?.message || JSON.stringify(data);
          console.warn(`[GeminiPool] Key #${keyIndex + 1} (${model}) rejected (${res.status}): ${msg}`);
          errors.push(`Key #${keyIndex + 1} (${model}): ${msg}`);

          if (res.status === 429) {
            // Key rate-limited, set 60s cooldown and move to next key
            keyCooldownMap.set(currentKey, Date.now() + 60 * 1000);
            break;
          }
          if (res.status === 503 || res.status === 404 || res.status === 400) {
            // High demand or deprecated model, immediately try next candidate model on this same key
            continue;
          }
          break;
        }

        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidate) {
          errors.push(`Key #${keyIndex + 1} (${model}) returned empty candidate`);
          continue;
        }

        keyRoundRobinIdx = (keyIndex + 1) % keys.length;
        console.log(`[GeminiPool] ✓ Key #${keyIndex + 1} succeeded with ${model} for ${actionName}`);

        return {
          text: candidate,
          keyIndex: keyIndex + 1,
          totalKeys: keys.length,
          model
        };
      } catch (err) {
        console.warn(`[GeminiPool] Network/timeout on Key #${keyIndex + 1} (${model}): ${err.message}`);
        errors.push(`Key #${keyIndex + 1} (${model}): ${err.message}`);

        if (err.name === 'TimeoutError' || /timeout|aborted/i.test(err.message)) {
          consecutiveTimeouts++;
          keyCooldownMap.set(currentKey, Date.now() + 30 * 1000);
          break;
        }
      }
    }

    if (consecutiveTimeouts >= 3) {
      console.warn('[GeminiPool] Consecutive network timeouts across keys, falling back to secondary providers.');
      break;
    }
  }

  const combinedErr = new Error(`All ${keys.length} Gemini API keys exhausted or rate-limited. Details: ${errors.join(' | ')}`);
  combinedErr.isRateLimit = true;
  throw combinedErr;
}

/**
 * Extract prescription from image buffer using Gemini Vision.
 */
async function callGeminiVision(base64Image, mimeType) {
  const result = await callGeminiWithFailover(() => ({
    contents: [{
      parts: [
        { text: `${EXTRACTION_SYSTEM_PROMPT}\nExtract all medicines from this prescription photo. Return valid JSON only.` },
        { inline_data: { mime_type: mimeType, data: base64Image } }
      ]
    }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
  }), 'Vision OCR');

  const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);
  parsed.providerUsed = `Google Gemini Vision (Key #${result.keyIndex}/${result.totalKeys} - ${result.model})`;
  return parsed;
}

/**
 * Parse raw prescription text into verified JSON schema using Groq Qwen.
 */
async function parsePrescriptionWithGroq(prescriptionText, isOcr = false) {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) throw new Error('No Groq API key configured');

  const userPrompt = isOcr
    ? `The following text was extracted by an OCR scanner from a doctor's prescription and may contain minor OCR typos, missing characters, or handwriting artifacts (e.g. '1ab' or 'Tob' instead of 'Tab', 'Pantocd' for 'Pantocid', 'Augmentn' for 'Augmentin', 'Dolo650' for 'Dolo 650', 'OD/BD/TDS' variations). Please carefully examine the text, correct any OCR misreadings, identify all intended medicines and active chemical salts, and return the complete JSON:\n\n${prescriptionText}`
    : `Extract all medicines from this prescription text and output JSON:\n\n${prescriptionText}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Groq error: ${data.error?.message || JSON.stringify(data)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned empty response');

  const cleanContent = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed = JSON.parse(cleanContent);
  if (!Array.isArray(parsed.medicines)) {
    if (Array.isArray(parsed.drugs)) parsed.medicines = parsed.drugs;
    else if (Array.isArray(parsed.prescriptions)) parsed.medicines = parsed.prescriptions;
    else if (Array.isArray(parsed)) parsed = { medicines: parsed };
    else parsed.medicines = [];
  }
  parsed.providerUsed = 'Groq Qwen 2.5 (Fast Clinical NLP)';
  return parsed;
}

/**
 * Extract prescription from raw text (pasted by user or typed) using Gemini or Groq fallback.
 */
async function extractPrescriptionText(prescriptionText) {
  const keys = getGeminiKeys();
  if (keys.length > 0) {
    try {
      const result = await callGeminiWithFailover(() => ({
        contents: [{
          parts: [
            { text: `${EXTRACTION_SYSTEM_PROMPT}\nAnalyze this prescription text and extract all medicines. Return valid JSON only.\n\nPrescription Text:\n${prescriptionText}` }
          ]
        }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
      }), 'Text Extraction');

      const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      parsed.providerUsed = `Google Gemini Text (Key #${result.keyIndex}/${result.totalKeys})`;
      return parsed;
    } catch (err) {
      console.warn('[TextExtract] Gemini failover failed, trying Groq fallback:', err.message);
    }
  }

  // Fallback to Groq Qwen for text analysis
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    try {
      console.log('[TextExtract] Trying Groq Qwen fallback…');
      return await parsePrescriptionWithGroq(prescriptionText);
    } catch (err) {
      console.warn('[TextExtract] Groq fallback failed:', err.message);
    }
  }

  throw new Error('Unable to parse prescription text. Please check your API keys.');
}

/**
 * Call OpenAI GPT-4o-mini with vision for prescription extraction.
 */
async function callOpenAI(base64Image, mimeType) {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  if (!key) throw new Error('No OpenAI key configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract medicines from this prescription photo.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI error: ${data.error?.message || JSON.stringify(data)}`);

  const content = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  parsed.providerUsed = 'OpenAI GPT-4o-mini (Vision Fallback)';
  return parsed;
}

/**
 * Call Anthropic Claude with vision for prescription extraction.
 */
async function callAnthropic(base64Image, mimeType) {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) throw new Error('No Anthropic key configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
          { type: 'text', text: 'Extract medicines from this prescription photo in JSON.' }
        ]
      }]
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic error: ${data.error?.message || JSON.stringify(data)}`);

  const rawText = (data.content || [])
    .filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    .trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();

  const parsed = JSON.parse(rawText);
  parsed.providerUsed = 'Anthropic Claude (Vision Fallback)';
  return parsed;
}

/**
 * Extract medicines from prescription image buffer.
 * Cascade: Gemini Pool (all keys & models) → OpenAI → Anthropic → Local OCR (Tesseract.js) + Groq Qwen AI
 */
async function extractPrescription(imageBuffer, mimeType = 'image/jpeg') {
  const base64Image = imageBuffer.toString('base64');
  const errors = [];

  // ── 1. Google Gemini Pool with Failover (Key 1 -> Key 2 -> Key 3) ─────────
  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length > 0) {
    try {
      console.log(`[Vision] Starting extraction across pool of ${geminiKeys.length} Gemini keys…`);
      const result = await callGeminiVision(base64Image, mimeType);
      console.log(`[Vision] ✓ Gemini succeeded! Provider: ${result.providerUsed}`);
      return result;
    } catch (err) {
      errors.push(`Gemini Pool: ${err.message}`);
      console.warn('[Vision] Gemini vision failed:', err.message);
    }
  }

  // ── 2. OpenAI GPT-4o-mini — vision fallback ─────────────────────────────────
  if ((process.env.OPENAI_API_KEY || '').trim()) {
    try {
      console.log('[Vision] Trying OpenAI GPT-4o-mini fallback…');
      const result = await callOpenAI(base64Image, mimeType);
      console.log('[Vision] ✓ OpenAI succeeded');
      return result;
    } catch (err) {
      errors.push(`OpenAI: ${err.message}`);
      console.warn('[Vision] OpenAI failed:', err.message);
    }
  }

  // ── 3. Anthropic Claude — vision fallback ───────────────────────────────────
  if ((process.env.ANTHROPIC_API_KEY || '').trim()) {
    try {
      console.log('[Vision] Trying Anthropic Claude fallback…');
      const result = await callAnthropic(base64Image, mimeType);
      console.log('[Vision] ✓ Anthropic succeeded');
      return result;
    } catch (err) {
      errors.push(`Anthropic: ${err.message}`);
      console.warn('[Vision] Anthropic failed:', err.message);
    }
  }

  // ── 4. Local OCR Engine (Tesseract.js) + Groq Qwen Clinical AI ──────────────
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    try {
      console.log('[Vision] Trying Local OCR (Tesseract.js) + Groq Qwen fallback…');
      let rawText = '';
      try {
        const worker = await getOcrWorker();
        const ocrResult = await worker.recognize(imageBuffer);
        rawText = (ocrResult.data && ocrResult.data.text) ? ocrResult.data.text.trim() : '';
      } catch (workerErr) {
        console.warn('[Vision] Cached worker failed, running standalone OCR:', workerErr.message);
        const ocrResult = await Tesseract.recognize(imageBuffer, 'eng');
        rawText = (ocrResult.data && ocrResult.data.text) ? ocrResult.data.text.trim() : '';
      }

      console.log(`[Vision] OCR extracted ${rawText.length} characters of text.`);

      if (rawText && rawText.length >= 4) {
        const parsed = await parsePrescriptionWithGroq(rawText, true);
        if (parsed && Array.isArray(parsed.medicines) && parsed.medicines.length > 0) {
          parsed.providerUsed = 'MedLens OCR Engine + Groq Qwen AI (Local OCR)';
          parsed.ocrExtractedText = rawText;
          console.log(`[Vision] ✓ Local OCR + Groq succeeded with ${parsed.medicines.length} medicines!`);
          return parsed;
        } else {
          errors.push('OCR read text from the image, but could not detect specific medicines in it.');
        }
      } else {
        errors.push('Local OCR could not detect readable text on this image.');
      }
    } catch (ocrErr) {
      console.warn('[Vision] Local OCR + Groq fallback failed:', ocrErr.message);
      errors.push(`OCR + Groq: ${ocrErr.message}`);
    }
  }

  // ── 5. Do NOT return dummy sample data! Throw clear error ───────────────────
  console.error('[Vision] All AI vision and OCR providers exhausted. Errors:', errors.join(' | '));
  const combinedError = new Error(
    'Unable to extract medicines from the uploaded prescription image. ' +
    'The AI vision service quota is currently exhausted or the image text was unreadable. ' +
    'Please ensure the photo is well-lit and sharp, or switch to the "Analyze Text" tab to type or paste the prescription.'
  );
  combinedError.diagnosticErrors = errors;
  throw combinedError;
}

/**
 * Check if user input represents an acute emergency symptom.
 */
function detectEmergencySymptoms(message) {
  const emergencyKeywords = [
    'chest pain',
    'heart attack',
    'short of breath',
    'breathless',
    'difficulty breathing',
    'severe allergic',
    'anaphylaxis',
    'throat closing',
    'lips swelling',
    'coughing blood',
    'unconscious',
    'fainted',
    'severe bleeding',
    'convulsion',
    'seizure'
  ];
  const lower = (message || '').toLowerCase();
  return emergencyKeywords.some((k) => lower.includes(k));
}

/**
 * Conversational Medical Chatbot
 */
async function chatWithMedLens({ message, currentPrescription, chatHistory = [] }) {
  const isEmergency = detectEmergencySymptoms(message);

  let emergencyPrefix = '';
  if (isEmergency) {
    emergencyPrefix = `🚨 **CRITICAL MEDICAL ALERT:** These symptoms indicate a potential medical emergency. Please immediately call **108 / 112 (India)** or **911 (US)** or go to the nearest emergency hospital. Do NOT delay care for online chatbot advice.\n\n---\n\n`;
  }

  const medSummary = (currentPrescription?.medicines || [])
    .map(
      (m) =>
        `- ${m.brand || m.drugName}: ${m.salt || 'N/A'} (${m.strength || ''}) -> ${m.whyToTake || m.conditionHint || ''}. Timing: ${m.frequency || m.foodInstructions || 'N/A'}`
    )
    .join('\n');

  const systemPrompt = `You are MedLens AI, a specialized clinical assistant for prescription clarification.
CURRENT PRESCRIPTION REGIMEN:
${medSummary ? medSummary : 'No active prescription currently scanned.'}

Guidelines:
1. Explain meal timings, what conditions medicines treat, best foods to eat, foods to avoid, and potential side effects in simple patient-friendly language.
2. Explain synergy (e.g. why an antacid like Pantoprazole was co-prescribed with painkillers/antibiotics to shield the stomach).
3. If asked about missed doses, provide safe conservative rule-of-thumb advice (never take double doses).
4. Use formatting (bullet points, bold text) for readability. Keep answers focused, comforting, and concise.
5. Conclude with a reminder that this is educational advice and their pharmacist or doctor should confirm.`;

  // 1. Google Gemini Chat with failover pool
  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length > 0) {
    try {
      const result = await callGeminiWithFailover(() => ({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nPatient asks: ${message}` }] }
        ],
        generationConfig: { temperature: 0.3 }
      }), 'Chat Copilot');

      if (result.text) return emergencyPrefix + result.text;
    } catch (err) {
      console.warn('Gemini chat error across pool, falling back to Groq:', err.message);
    }
  }

  // 2. Groq Qwen Chat
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY.trim()}`
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatHistory.slice(-4),
            { role: 'user', content: message }
          ]
        })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) return emergencyPrefix + reply;
    } catch (err) {
      console.warn('Groq chat error:', err.message);
    }
  }

  // Fallback intelligent rules
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('pantocid') || lowerMsg.includes('acidity') || lowerMsg.includes('stomach')) {
    return emergencyPrefix + `**Why Pantocid 40 is in your prescription:**\n\n- **Protective Shield:** Pantocid (Pantoprazole) reduces stomach acid production.\n- **Synergy:** Antibiotics (like Augmentin) and painkillers frequently irritate the gastric lining. Doctors co-prescribe Pantocid to shield your stomach against gastritis and acid erosion.\n- **Optimal Timing:** Take it **30 to 45 minutes before breakfast** on an empty stomach with plain water.`;
  }
  if (lowerMsg.includes('timing') || lowerMsg.includes('when') || lowerMsg.includes('food')) {
    return emergencyPrefix + `**Recommended Medication Schedule:**\n\n1. **Morning (Empty Stomach):** Take **Pantocid 40** (30 mins before breakfast).\n2. **Morning (After Breakfast):** Take **Augmentin 625** (always with or right after food).\n3. **Afternoon / As needed:** Take **Dolo 650** only if you have fever or body aches (maintain a 6-hour gap).\n4. **Night (After Dinner):** Take **Augmentin 625**.\n\n*Drink 2 to 3 liters of water throughout the day.*`;
  }
  if (lowerMsg.includes('missed') || lowerMsg.includes('forgot')) {
    return emergencyPrefix + `**Missed Dose Guidance:**\n\n- If remembered within 2–3 hours, take the dose immediately.\n- If it is already close to your next scheduled dose, skip the missed dose and resume your regular schedule. **Never double up on pills.**`;
  }

  return emergencyPrefix + `**MedLens Guidance:**\n\nMake sure to complete your full antibiotic course even if you start feeling better early. Take painkillers and antibiotics with or after meals to prevent gastric upset. For any unusual or worsening symptoms, consult your prescribing physician.`;
}

module.exports = {
  extractPrescription,
  extractPrescriptionText,
  chatWithMedLens,
  getActiveProvider,
  getGeminiKeys,
  callGeminiWithFailover,
  SAMPLE_PRESCRIPTION
};
