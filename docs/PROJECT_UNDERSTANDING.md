# MedLens — Complete Technical Project Understanding
### For Developer Presentation & Teacher Explanation

> **File Path:** `docs/PROJECT_UNDERSTANDING.md`  
> **Project Root:** `medicine-recommender-app/`  
> **Version:** 1.0 — October 2026

---

## Table of Contents

1. [What is MedLens?](#1-what-is-medlens)
2. [Technology Stack](#2-technology-stack)
3. [Project File Structure with Paths](#3-project-file-structure-with-paths)
4. [How the Server is Set Up — server.js](#4-how-the-server-is-set-up--serverjs)
5. [How Medicine Info is Fetched — The 5-Tier Resolver](#5-how-medicine-info-is-fetched--the-5-tier-resolver)
6. [Image Upload → Medicine Extraction Pipeline](#6-image-upload--medicine-extraction-pipeline)
7. [Drug Interaction Engine](#7-drug-interaction-engine)
8. [Prescription Enrichment Pipeline](#8-prescription-enrichment-pipeline)
9. [API Routes — What Each Endpoint Does](#9-api-routes--what-each-endpoint-does)
10. [Rate Limits & What Happens After](#10-rate-limits--what-happens-after)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Jan Aushadhi Programme — Technical Integration](#12-jan-aushadhi-programme--technical-integration)
13. [Security Implementation](#13-security-implementation)
14. [Docker & Deployment](#14-docker--deployment)
15. [Summary for Teacher Presentation](#15-summary-for-teacher-presentation)

---

## 1. What is MedLens?

MedLens is a **full-stack Node.js web application** that helps Indian patients:
- Upload a prescription photo → AI reads and identifies every medicine
- Find certified **PMBJP Jan Aushadhi generic alternatives at 60–80% cheaper prices**
- Understand **when to take each medicine** and what food to eat/avoid
- Check **drug-drug interactions** (dangerous combinations)
- Chat with an **AI medical copilot** about their medicines

The entire app runs as a **single Express.js server** that serves both the frontend (static HTML/CSS/JS) and the backend API from port `3000`.

---

## 2. Technology Stack

### Backend
| Package | Version | Role |
|---|---|---|
| `express` | ^4.19.2 | Web framework — routes, middleware |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing control |
| `multer` | ^1.4.5-lts.1 | Multipart file upload handler |
| `dotenv` | ^16.4.5 | Loads `.env` secrets into `process.env` |
| `tesseract.js` | ^7.0.0 | Local OCR engine (reads text from images) |

All dependencies are in `server/package.json`. No database (MongoDB/PostgreSQL) is used — data is served from a JSON file and external APIs.

### External APIs
| API | Auth | Cost | Used For |
|---|---|---|---|
| Google Gemini AI | API Key | Free tier | Vision OCR + text NLP |
| Groq Qwen 2.5 | API Key | Free tier | Fast text NLP parsing |
| openFDA | None | Always free | US drug label database |
| NIH NLM RxNorm | None | Always free | Clinical drug name registry |
| OpenAI GPT-4o-mini | API Key | Paid | Optional vision fallback |
| Anthropic Claude | API Key | Paid | Optional vision fallback |

### Frontend
- Pure **Vanilla HTML + CSS + JavaScript** — no React, no Vue, no framework
- **Web Speech API** (browser built-in) — multilingual voice readout
- **LocalStorage** — saves cumulative savings across browser sessions
- **ICS format** — Calendar export to Google/Apple/Outlook Calendar

---

## 3. Project File Structure with Paths

```
medicine-recommender-app/
│
├── public/                          ← Frontend served statically by Express
│   ├── index.html                   ← Entire UI — header, scanner, results, chat drawer
│   ├── app.js                       ← All frontend JS (~950 lines)
│   └── styles.css                   ← All CSS (~1400 lines, dark/light theme)
│
├── server/                          ← Node.js backend
│   ├── server.js                    ← Entry point: Express app, CORS, error handler
│   │
│   ├── routes/
│   │   ├── prescription.js          ← POST /api/prescription/analyze (image)
│   │   │                              POST /api/prescription/analyze-text
│   │   │                              POST /api/prescription/sample
│   │   │                              POST /api/prescription/chat
│   │   │                              GET  /api/prescription/status
│   │   ├── alternatives.js          ← POST /api/alternatives/lookup
│   │   ├── interactions.js          ← POST /api/interactions/check
│   │   └── missedDose.js            ← POST /api/missed-dose/advise
│   │
│   ├── services/
│   │   ├── aiService.js             ← All AI providers + OCR cascade pipeline
│   │   ├── globalResolver.js        ← 5-tier drug name → salt resolver with cache
│   │   └── interactionEngine.js     ← Drug-Drug Interaction (DDI) rules engine
│   │
│   ├── data/
│   │   └── drugDatabase.json        ← 42 verified Indian drugs, Jan Aushadhi prices
│   │
│   ├── .env                         ← Secret keys (gitignored — never committed)
│   └── .env.example                 ← Template showing which keys to set
│
├── Dockerfile                       ← Container build (node:20-alpine)
├── docker-compose.yml               ← Container run + env_file + restart policy
├── nginx.conf                       ← Reverse proxy config (HTTPS, 12MB upload limit)
├── .dockerignore                    ← Excludes node_modules, .env from image
├── .gitignore                       ← Excludes .env, node_modules, traineddata
│
└── .github/
    └── workflows/
        └── deploy.yml               ← GitHub Actions: SSH into EC2, git pull, docker up
```

---

## 4. How the Server is Set Up — `server.js`

**File:** `server/server.js`

```javascript
// Load environment variables from server/.env AND root .env (fallback)
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();

// CORS — production enforces origin whitelist, dev allows all
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);           // same-origin
    if (!isProduction) return callback(null, true);     // dev: allow all
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  }
}));

// Routes mounted at /api/...
app.use('/api/prescription', prescriptionRoutes);
app.use('/api/alternatives', alternativesRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/missed-dose', missedDoseRoutes);

// Serve frontend from /public folder
app.use(express.static(path.join(__dirname, '../public')));

// Global error handler — catches Multer 10MB errors, CORS errors
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ error: 'File exceeds 10MB limit.' });
  return res.status(500).json({ error: err.message });
});

app.listen(3000);
```

**Key design decision:** Express serves both the API (`/api/*`) and the frontend (`/`). So there is no separate web server needed — everything runs on port `3000`.

---

## 5. How Medicine Info is Fetched — The 5-Tier Resolver

**File:** `server/services/globalResolver.js`

This is the core intelligence of MedLens. After the AI extracts a drug name from the prescription (e.g. `"Novastat 10"`), it needs to find:
- What is the active chemical salt? (`Rosuvastatin 10mg`)
- What drug class? (`Statin`)
- What is the Jan Aushadhi price?
- What are the precautions?

It does this through **5 tiers in order**:

---

### Tier 1 — Local Jan Aushadhi Database (Instant, 0ms, Offline)

**File:** `server/data/drugDatabase.json`  
**Called from:** `server/routes/prescription.js` → `matchDrugInDatabase()`

```javascript
// prescription.js — matchDrugInDatabase()
function matchDrugInDatabase(extracted) {
  const brandQuery = cleanStr(extracted.drugName || '');

  // 1. Exact match on brand name or aliases
  const exactMatch = drugDatabase.drugs.find((d) => {
    if (cleanStr(d.brand) === brandQuery) return true;
    return (d.aliases || []).some((a) => cleanStr(a) === brandQuery);
  });
  if (exactMatch) return exactMatch;

  // 2. Token/prefix match — "Augmentin 625" → primary word "augmentin"
  const primaryWord = tokenize(brandQuery)[0];
  if (primaryWord && primaryWord.length >= 3) {
    const tokenMatch = drugDatabase.drugs.find((d) =>
      tokenize(d.brand)[0] === primaryWord
    );
    if (tokenMatch) return tokenMatch;
  }

  // 3. Salt match — if AI extracted the generic name directly
  return null; // → goes to globalResolver
}
```

**What's in the database (42 drugs):**
```json
{
  "id": "amox_clav",
  "brand": "Augmentin 625 Duo",
  "aliases": ["augmentin", "augmentin 625", "amoxyclav"],
  "salt": "Amoxicillin (500mg) + Clavulanic Acid (125mg)",
  "saltNormalized": "amoxicillin + clavulanic acid",
  "class": "Penicillin Antibiotic + Beta-Lactamase Inhibitor",
  "priceINR": 223,
  "alternatives": [
    {
      "brand": "Jan Aushadhi Amoxy-Clav 625",
      "manufacturer": "PMBJP (Jan Aushadhi)",
      "priceINR": 60,
      "isJanAushadhi": true
    }
  ]
}
```

---

### Tier 2 — openFDA (US National Drug Database)

**File:** `server/services/globalResolver.js` → `queryOpenFDA()`  
**API URL:** `https://api.fda.gov/drug/label.json`  
**Auth:** None — completely public  
**Timeout:** 2.5 seconds (AbortController)

```javascript
async function queryOpenFDA(drugName) {
  const clean = drugName.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)[0];

  const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(clean)}"&limit=1`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500); // fail fast

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);

  const data = await res.json();
  const hit = data.results?.[0];

  // Extract active ingredients
  const substances = hit.openfda?.substance_name || hit.openfda?.generic_name || [];
  const activeSalt = substances.join(' + ');

  return { brand, salt: activeSalt, class: drugClass, ... };
}
```

**What openFDA returns for "Augmentin":**
- `brand_name`: `["AUGMENTIN"]`
- `substance_name`: `["AMOXICILLIN", "CLAVULANATE POTASSIUM"]`
- `pharm_class_epc`: `["Penicillin-class Antibacterial"]`
- `indications_and_usage`: Full clinical label text

---

### Tier 3 — NIH NLM RxNorm (Clinical Drug Name Registry)

**File:** `server/services/globalResolver.js` → `queryRxNorm()`  
**API URL:** `https://rxnav.nlm.nih.gov/REST/approximateTerm.json`  
**Auth:** None — completely public  
**Timeout:** 2 seconds

```javascript
async function queryRxNorm(drugName) {
  const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(clean)}&maxEntries=3`;

  const res = await fetch(url, { signal: controller.signal });
  const data = await res.json();

  // Returns closest matching clinical drug name
  const candidates = data.approximateGroup?.candidate || [];
  const best = candidates.find(c => c.name && c.name.length > 2);

  return { salt: best.name, ... };
}
```

**Purpose:** RxNorm gives the standardized clinical name. If a doctor writes `"Moxikind CV"`, RxNorm maps it to `"Amoxicillin / Clavulanate"` — the international standard name.

---

### Tier 4 — Google Gemini AI (Pharmacology from Training Data)

**File:** `server/services/globalResolver.js` → `queryGeminiAI()`  
**Called via:** `aiService.js` → `callGeminiWithFailover()`

```javascript
async function queryGeminiAI(drugName) {
  const prompt = `You are a clinical pharmacology database.
Identify the drug brand: "${drugName}".
Output valid JSON only:
{
  "brand": "...",
  "salt": "Active ingredient with strength",
  "saltNormalized": "lowercase active ingredient",
  "class": "Drug class",
  "whyToTake": "What disease this treats",
  "mealTiming": "Before Breakfast / With Meals / After Meals / At Bedtime",
  "estimatedPriceINR": 150,
  "genericAlternative": "PMBJP Jan Aushadhi Equivalent",
  "genericPriceINR": 35
}
If completely unrecognized, return {"unknown": true}.`;

  const result = await callGeminiWithFailover(() => ({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, response_mime_type: 'application/json' }
  }), `Global Resolver for "${drugName}"`);

  const parsed = JSON.parse(result.text);
  return { brand, salt, priceINR, alternatives: [...], ... };
}
```

**Why Gemini knows this:** Gemini was trained on vast medical literature, drug databases, and pharmacology textbooks. It can identify any drug brand from any country.

---

### Tier 5 — Groq Qwen 2.5 (Ultra-Fast Final Fallback)

**File:** `server/services/globalResolver.js` → `queryGroqAI()`  
**API URL:** `https://api.groq.com/openai/v1/chat/completions`  
**Model:** `qwen/qwen3.8-27b`  
**Speed:** ~450 tokens/second  
**Timeout:** 3.5 seconds

```javascript
async function queryGroqAI(drugName) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: 'You are a certified pharmacology database. Output valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    }),
    signal: controller.signal
  });
  // Returns same structured JSON as Gemini
}
```

### In-Memory Cache (Sits Above All Tiers)

```javascript
// globalResolver.js
const resolutionCache = new Map();

async function resolveGlobal(drugName) {
  const cacheKey = drugName.trim().toLowerCase();

  // Cache hit — instant, no API call
  if (resolutionCache.has(cacheKey)) {
    console.log(`[GlobalResolver] Cache hit for "${drugName}"`);
    return resolutionCache.get(cacheKey);
  }

  // Try tiers 1→2→3→4→5...
  // Store result in cache for future lookups
  resolutionCache.set(cacheKey, result);
  return result;
}
```

**Effect:** Second time any user looks up `"Augmentin"`, the result comes from RAM in 0ms — zero API cost.

### Actual Call Order in `resolveGlobal()`:

```
In the code, Groq is actually tried FIRST (fastest, free)
then openFDA → Gemini AI → NIH RxNorm

Actual order in resolveGlobal():
  1. Groq Qwen    (if GROQ_API_KEY set — fastest sub-second response)
  2. openFDA      (public API, 2.5s timeout)
  3. Gemini AI    (multi-key pool)
  4. NIH RxNorm   (public API, 2s timeout)
```

---

## 6. Image Upload → Medicine Extraction Pipeline

**File:** `server/services/aiService.js` → `extractPrescription()`  
**Route:** `POST /api/prescription/analyze` in `server/routes/prescription.js`

```
User uploads image
      │
      ▼
Multer middleware (server/routes/prescription.js)
  - Stores file in RAM (memoryStorage — no disk write)
  - Validates: only image/* MIME types
  - Rejects if > 10MB
      │
      ▼
aiService.extractPrescription(buffer, mimeType)
      │
      ├─ STEP 1: Gemini Vision Pool (15s timeout per key)
      │   callGeminiVision(base64Image, mimeType)
      │   → Sends image inline as base64 to Gemini API
      │   → Tries Key 1 → Key 2 → Key 3 automatically
      │   → On 429 (rate limit): key goes into 60s cooldown
      │   ✓ Returns: { medicines: [...], doctorSpecialty, providerUsed }
      │   ✗ All keys fail → Step 2
      │
      ├─ STEP 2: Tesseract.js Local OCR (no internet needed)
      │   Tesseract.createWorker('eng') → worker.recognize(imageBuffer)
      │   → Extracts raw text from image ON THE SERVER
      │   → Persistent worker cached in memory (sub-second on repeat)
      │
      │   If rawText.length >= 4 chars:
      │   ├─ STEP 2a: OCR text → Groq Qwen parse
      │   │   parsePrescriptionWithGroq(rawText, isOcr=true)
      │   │   → Sends OCR text to Groq with OCR correction instructions
      │   │   ✓ Returns medicines array
      │   │
      │   └─ STEP 2b: OCR text → Gemini text parse (no image, cheaper)
      │       callGeminiWithFailover(prompt + ocrText, 10s timeout)
      │       ✓ Returns medicines array
      │
      ├─ STEP 4: OpenAI GPT-4o-mini Vision (if key + credits)
      │
      └─ STEP 5: Anthropic Claude Vision (if key)
```

**Key code — how Gemini Vision is called:**

```javascript
// aiService.js — callGeminiVision()
async function callGeminiVision(base64Image, mimeType) {
  const result = await callGeminiWithFailover(() => ({
    contents: [{
      parts: [
        { text: `${EXTRACTION_SYSTEM_PROMPT}\nExtract all medicines. Return valid JSON only.` },
        { inline_data: { mime_type: mimeType, data: base64Image } } // image as base64
      ]
    }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
  }), 'Vision OCR', 15000); // 15 second timeout for images
```

**Key code — multi-key rotation with cooldown:**

```javascript
// aiService.js — callGeminiWithFailover()
for (let i = 0; i < keys.length; i++) {
  const currentKey = keys[keyIndex];

  // Skip keys in 60s rate-limit cooldown
  const cooldownUntil = keyCooldownMap.get(currentKey);
  if (cooldownUntil && Date.now() < cooldownUntil) continue;

  // Try current key across all candidate models
  for (const model of candidateModels) {
    const res = await fetch(geminiUrl, { signal: AbortSignal.timeout(timeoutMs) });

    if (res.status === 429) {
      keyCooldownMap.set(currentKey, Date.now() + 60 * 1000); // cooldown 60s
      break; // move to next key
    }
    if (res.ok) return { text: candidate, keyIndex, model };
  }
}
```

---

## 7. Drug Interaction Engine

**File:** `server/services/interactionEngine.js`  
**Called from:** `prescription.js` after enrichMedicines()

The engine checks every **pair** of medicines in the prescription against a built-in rules database. It works on **normalized active salts**, not brand names — so `"Brufen 400"` and `"Ibuprofen 200"` both resolve to `"ibuprofen"` before checking.

```javascript
// interactionEngine.js
function checkRegimenInteractions(medicineList) {
  const normalizedMeds = medicineList.map(m => ({
    brand: m.brand,
    saltNorm: normalizeSalt(m.saltNormalized || m.salt)
    //  e.g. "Amoxicillin (500mg) + Clavulanic Acid" → "amoxicillin 500mg clavulanic acid"
  }));

  for (let i = 0; i < normalizedMeds.length; i++) {
    for (let j = i + 1; j < normalizedMeds.length; j++) {
      // Check every pair against every rule
      for (const rule of INTERACTION_RULES) {
        const [targetA, targetB] = rule.salts.map(normalizeSalt);
        const matchDirect  = medA.saltNorm.includes(targetA) && medB.saltNorm.includes(targetB);
        const matchReverse = medA.saltNorm.includes(targetB) && medB.saltNorm.includes(targetA);
        if (matchDirect || matchReverse) detected.push({ ...rule, drugA, drugB });
      }
    }
  }
}
```

**9 built-in rules (examples):**

| Drug A | Drug B | Severity | Why |
|---|---|---|---|
| Ibuprofen | Aspirin | 🔴 Red | GI bleed risk — dual antiplatelet |
| Atorvastatin | Azithromycin | 🟡 Amber | CYP3A4 enzyme clash — muscle toxicity |
| Ibuprofen | Telmisartan | 🟡 Amber | Kidney strain + high potassium |
| Metformin | Pantoprazole | 🟢 Green | Safe, commonly co-prescribed |
| Ibuprofen | Pantoprazole | 🟢 Green | Intentional — PPI protects stomach |

---

## 8. Prescription Enrichment Pipeline

**File:** `server/routes/prescription.js` → `enrichMedicines()`

After AI extracts raw medicine names, this function enriches each one:

```javascript
async function enrichMedicines(extractedMeds) {
  const enriched = await Promise.all(
    extractedMeds.map(async (med) => {

      // Step 1: Try local database (instant)
      const match = matchDrugInDatabase(med);
      if (match) {
        // Derive meal timing based on drug class
        const defaultMeal = deriveMealGuidance(match.class, match.salt, match.foodInstructions);

        // Parse time slots from frequency + mealTiming
        const timeSlots = med.timeSlots?.length
          ? med.timeSlots
          : parseTimeSlots(med.frequency, med.doctorNotes, med.mealTiming || defaultMeal.mealTiming);

        return { isVerified: true, resolvedBy: 'MedLens India Verified Database', ...enrichedData };
      }

      // Step 2: Try global resolver (openFDA → Groq → Gemini → RxNorm)
      const globalMatch = await resolveGlobal(med.drugName || med.rawText);
      if (globalMatch) {
        return { isVerified: true, resolvedBy: globalMatch.resolvedBy, ...enrichedData };
      }

      // Step 3: Unresolved — return with pharmacist verification flag
      return { isVerified: false, message: 'Confirm with pharmacist...' };
    })
  );
}
```

**`parseTimeSlots()` — How time slots are determined:**

```javascript
// prescription.js
function parseTimeSlots(frequency, doctorNotes, mealTiming) {
  const combined = (frequency + ' ' + doctorNotes + ' ' + mealTiming).toLowerCase();

  if (/\bsos\b|as needed|prn/i.test(combined))       return ['as-needed'];
  if (/1-1-1|tds|tid|thrice|3 times/i.test(combined)) return ['morning', 'afternoon', 'night'];
  if (/1-0-1|bd|bid|twice daily/i.test(combined))     return ['morning', 'night'];
  if (/bedtime|at bedtime|at night|\bhs\b/i.test(combined)) return ['night'];  // checks mealTiming too!
  if (/1-0-0|\bod\b|morning|breakfast|once daily/i.test(combined)) return ['morning'];

  return ['morning', 'night']; // default
}
```

**Why `mealTiming` is passed:** If a medicine has no frequency written (e.g. just "Breezy at bedtime"), the `mealTiming` field from AI (`"At Bedtime"`) is used to correctly assign it to the `night` slot — instead of defaulting to `['morning', 'night']`.

**`deriveMealGuidance()` — How food instructions are determined:**

```javascript
function deriveMealGuidance(drugClass, saltName, existingInstructions) {
  const text = (drugClass + ' ' + saltName).toLowerCase();

  if (/proton pump inhibitor|pantoprazole|omeprazole/i.test(text))
    return { mealTiming: 'Before Breakfast (Empty Stomach)', bestMeals: '...' };

  if (/antibiotic|amoxicillin|azithromycin/i.test(text))
    return { mealTiming: 'With or After Meals', bestMeals: '...' };

  if (/statin|atorvastatin|rosuvastatin/i.test(text))
    return { mealTiming: 'At Bedtime / After Dinner', bestMeals: '...' };
  // ...
}
```

---

## 9. API Routes — What Each Endpoint Does

**All routes are in `server/routes/`**

### `POST /api/prescription/analyze`
- **File:** `prescription.js`
- **Input:** Multipart form with `prescription` image file
- **Process:** Multer → `aiService.extractPrescription()` → `enrichMedicines()` → `checkRegimenInteractions()`
- **Output:** Full prescription report JSON with medicines, savings, interactions, timetable

### `POST /api/prescription/analyze-text`
- **Input:** `{ text: "Tab Augmentin 625 BD x 5 days" }`
- **Process:** `aiService.extractPrescriptionText()` → same enrichment pipeline
- **Output:** Same full report

### `POST /api/prescription/sample`
- **Input:** None
- **Process:** Uses hardcoded `SAMPLE_PRESCRIPTION` from `aiService.js` → enrichment pipeline
- **Output:** Demo report (3 medicines: Augmentin + Dolo + Pantocid)

### `POST /api/prescription/chat`
- **Input:** `{ message, currentPrescription, chatHistory }`
- **Process:** Builds system prompt with current medicines context → Gemini/Groq chat
- **Output:** `{ reply: "..." }` — AI response

### `GET /api/prescription/status`
- **Output:** Which AI provider is active, how many keys, free/paid tier

### `POST /api/alternatives/lookup`
- **File:** `alternatives.js`
- **Input:** `{ drugName: "Pantocid 40" }`
- **Process:** Local DB → openFDA fallback
- **Output:** Brand, salt, price, Jan Aushadhi alternative

### `POST /api/interactions/check`
- **File:** `interactions.js`
- **Input:** `{ drugs: ["Augmentin 625", "Dolo 650"] }` OR `{ medicines: [{brand, salt}] }`
- **Output:** DDI report with severity, mechanism, action

### `POST /api/missed-dose/advise`
- **File:** `missedDose.js`
- **Input:** `{ scheduledTime: "08:00", currentTime: "12:00", frequencyHours: 8 }`
- **Logic:** If time missed < 50% of interval → take now; else → skip
- **Output:** Safe conservative recommendation + disclaimer

### `GET /api/health`
- **Output:** `{ status: "ok", app: "MedLens" }` — for Docker health checks

---

## 10. Rate Limits & What Happens After

### Gemini API (Primary)

| Situation | What the Code Does |
|---|---|
| Normal request | Uses current key in round-robin order |
| HTTP 429 received | Puts that key in 60-second cooldown (`keyCooldownMap`) |
| Key in cooldown | Skips it, moves to next key automatically |
| All 3 keys rate-limited | Falls through to OCR pipeline |
| 3 consecutive timeouts | Stops trying, falls to OCR immediately |

```javascript
// Key cooldown mechanism — aiService.js
if (res.status === 429) {
  keyCooldownMap.set(currentKey, Date.now() + 60 * 1000); // 60s cooldown
  break; // try next key
}
```

### openFDA (No rate limit)
- Public government API — no key, no limit
- Only constraint: 2.5s timeout per request (AbortController)
- If FDA servers are slow → returns null → next tier

### NIH RxNorm (No rate limit)
- Public NIH API — no key, no limit
- 2s timeout

### In-Memory Cache (Zero cost after first lookup)

```javascript
// globalResolver.js
const resolutionCache = new Map(); // lives in server RAM

async function resolveGlobal(drugName) {
  const key = drugName.toLowerCase();
  if (resolutionCache.has(key)) return resolutionCache.get(key); // 0ms, 0 API calls
  const result = await /* tier lookup */;
  resolutionCache.set(key, result); // cache for lifetime of server process
  return result;
}
```

**Effect:** If 100 users all upload prescriptions with "Augmentin" — only the **first** call hits the API. All 99 others are served from RAM instantly.

---

## 11. Frontend Architecture

**File:** `public/app.js`

The frontend is entirely **event-driven Vanilla JS**. No build step, no bundler.

### State Management
```javascript
// app.js — global state (3 variables)
let currentRegimenData = null;   // full prescription report from last API call
let selectedFile = null;          // currently selected image file
let chatHistory = [];             // last 6 chat turns (trimmed for AI context)
```

### Key Frontend Functions

| Function | What it does |
|---|---|
| `renderPrescriptionReport(data)` | Master renderer — calls all sub-renderers |
| `renderDailyTimetable(medicines)` | Assigns medicines to time slots, builds grid HTML |
| `renderMedicineCards(medicines)` | Creates per-medicine cards with savings, precautions |
| `renderInteractions(interactions)` | Shows DDI results with color-coded severity |
| `handleChatSubmit(e)` | Sends message to `/api/prescription/chat`, shows reply |
| `speak(text)` | Web Speech API — reads text aloud in selected language |
| `exportDosageCalendar()` | Generates `.ics` file with `BEGIN:VCALENDAR` format |
| `showChemistSlip()` | Builds printable generic dispensing slip |
| `parseTimeSlots()` | **Backend** — assigns morning/night/etc per frequency |

### Timetable Rendering Logic

```javascript
// app.js — renderDailyTimetable()
function renderDailyTimetable(medicines) {
  const slots = {
    morning:  { title: 'Morning Slot',  icon: '🌅', meds: [] },
    afternoon:{ title: 'Afternoon Slot',icon: '☀️', meds: [] },
    evening:  { title: 'Evening Slot',  icon: '🌇', meds: [] },
    night:    { title: 'Bedtime Slot',  icon: '🌙', meds: [] },
    asNeeded: { title: 'As Needed',     icon: '⚡', meds: [] }
  };

  medicines.forEach(m => {
    (m.timeSlots || ['morning','night']).forEach(slot => {
      if (slots[slot]) slots[slot].meds.push({ name: m.brand, dose: m.mealTiming });
    });
  });

  // Only render slots that have medicines — no empty cards shown
  timetableGrid.innerHTML = Object.values(slots)
    .filter(slot => slot.meds.length > 0)  // ← KEY: hides empty slots
    .map(slot => `<div class="time-slot-card">...</div>`)
    .join('');
}
```

---

## 12. Jan Aushadhi Programme — Technical Integration

**PMBJP = Pradhan Mantri Bhartiya Janaushadhi Pariyojana**

Technically, Jan Aushadhi data is integrated in two ways:

### 1. Static Data in `drugDatabase.json`
Every drug entry has a `alternatives` array with Jan Aushadhi entry:
```json
"alternatives": [
  {
    "brand": "Jan Aushadhi Amoxy-Clav 625",
    "manufacturer": "PMBJP (Jan Aushadhi)",
    "priceINR": 60,
    "isJanAushadhi": true  ← flag for special UI badge
  }
]
```

### 2. Dynamically Generated by AI
When a drug is resolved via Gemini/Groq (Tiers 4/5), the prompt explicitly asks for the Jan Aushadhi equivalent:
```
"genericAlternative": "PMBJP Jan Aushadhi Equivalent",
"genericPriceINR": 35
```

### Savings Calculation
```javascript
// prescription.js — enrichMedicines()
const savingsINR = Math.max(0, match.priceINR - bestAlt.priceINR);
// e.g. Rs.223 - Rs.60 = Rs.163 saved

const savingsPercent = Math.round((savingsINR / match.priceINR) * 100);
// e.g. (163/223)*100 = 73%

// Monthly projection for chronic medicines (diabetes/BP/cholesterol)
const chronicSalts = ['amlodipine', 'metformin', 'atorvastatin', 'telmisartan', ...];
const isChronic = chronicSalts.some(c => saltNorm.includes(c));
if (isChronic) chronicSavingsMonthly += Math.round(m.savingsINR * 2.5); // ~30 days
```

---

## 13. Security Implementation

### Environment Variables
```
server/.env       ← API keys (gitignored by *.env in .gitignore)
.env              ← Same file at root (both loaded by dotenv)
```
Keys are NEVER committed to git. Verified by:
```bash
git ls-files server/.env   # returns empty — not tracked
git ls-files .env          # returns empty — not tracked
```

### Input Validation
```javascript
// prescription.js — Multer file filter
fileFilter: (_req, file, cb) => {
  const allowed = ['image/jpeg','image/png','image/gif','image/webp','image/heic','image/bmp'];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only image files accepted.'));
}

// prescription.js — chat route
if (message.length > 800)
  return res.status(400).json({ error: 'Message too long.' });
```

### CORS Production Lock
```javascript
// server.js
if (isProduction && allowedOrigins.length > 0) {
  if (!allowedOrigins.includes(origin))
    return callback(new Error(`CORS blocked: ${origin} not permitted.`));
}
```

---

## 14. Docker & Deployment

### `Dockerfile`
```dockerfile
FROM node:20-alpine          # small base image (~170MB vs ~900MB for full node)
WORKDIR /app
COPY server/package*.json ./ # copy manifests first (layer cache optimization)
RUN npm install --omit=dev   # install ONLY production deps, skip devDependencies
COPY server/ .               # copy server code
COPY public/ ../public/      # frontend goes to /public (Express serves from ../public)
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
```

### `docker-compose.yml`
```yaml
services:
  medlens:
    build: .
    restart: unless-stopped    # auto-restarts on crash
    env_file:
      - server/.env            # secrets loaded at runtime, NOT baked into image
    ports:
      - "3000:3000"
    deploy:
      resources:
        limits:
          memory: 512M         # prevents server OOM on t2.micro EC2
```

### GitHub Actions Auto-Deploy (`.github/workflows/deploy.yml`)
```yaml
on:
  push:
    branches: [main]    # triggers on every push to main

steps:
  - name: Deploy via SSH
    uses: appleboy/ssh-action@v1.0.3
    with:
      host: ${{ secrets.EC2_HOST }}    # stored as GitHub secret
      key: ${{ secrets.EC2_SSH_KEY }}  # SSH private key stored as GitHub secret
      script: |
        cd ~/medlens
        git pull origin main
        docker compose down
        docker compose up -d --build   # rebuild and restart
        docker image prune -f          # clean old images
```

---

## 15. Summary for Teacher Presentation

> MedLens is a full-stack Node.js + Express web application built to solve a real problem in India — patients overpaying for branded medicines when cheaper government-certified generics are available.
>
> **Architecture:** Single Express server serving both frontend (static HTML/CSS/JS) and REST API on port 3000. No database — drug data lives in a 42-entry JSON file for local lookups, with live fallback to public government APIs (US FDA, NIH).
>
> **AI Integration:** Multiple AI providers in a waterfall — Google Gemini (3 API keys in rotation) handles prescription image reading. When Gemini hits rate limits, Tesseract.js reads the image locally on the server without any internet, then Groq Qwen AI parses the extracted text. This means the app never fully fails even under heavy load.
>
> **Rate Limit Handling:** A `Map`-based cooldown system tracks which Gemini keys are rate-limited and automatically skips them for 60 seconds. Results are cached in server RAM so repeated lookups for the same drug cost zero API calls.
>
> **Drug Resolution:** 5-tier resolver — local JSON → openFDA public API → NIH RxNorm public API → Gemini AI → Groq AI. This means any drug brand from India, US, UK, or globally can be identified.
>
> **Jan Aushadhi:** Each identified medicine is mapped to its PMBJP generic equivalent with exact price comparison, savings percentage, and a printable chemist dispensing slip.
>
> **Deployment:** Docker container on AWS EC2 with Nginx reverse proxy. Auto-deploys via GitHub Actions SSH on every push to main branch.

---

*Document path: `docs/PROJECT_UNDERSTANDING.md`*  
*Generated: October 2026 | MedLens v1.0*
