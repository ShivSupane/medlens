<div align="center">

# 💊 MedLens
### AI-Powered Prescription Reader & Jan Aushadhi Generic Savings Assistant

**Upload a prescription → AI reads every medicine → Find the same drug 60–80% cheaper**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.19-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Gemini](https://img.shields.io/badge/Google_Gemini-AI_Vision-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)
[![Groq](https://img.shields.io/badge/Groq_Qwen-2.5_NLP-F55036?style=for-the-badge)](https://groq.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[Features](#-features) · [How It Works](#-how-it-works) · [Tech Stack](#-tech-stack) · [Quick Start](#-quick-start) · [API Reference](#-api-reference) · [Deploy](#-deployment)

---

<img src="https://img.shields.io/badge/PMBJP-Jan_Aushadhi_Programme-FF6B35?style=flat-square" />
<img src="https://img.shields.io/badge/Free_Tier-100%25_Free_APIs-22C55E?style=flat-square" />
<img src="https://img.shields.io/badge/OCR-Tesseract.js_v7-FF9500?style=flat-square" />
<img src="https://img.shields.io/badge/Multilingual-7_Indian_Languages-8B5CF6?style=flat-square" />

</div>

---

## 🎯 What is MedLens?

MedLens is a **full-stack Node.js web application** built specifically for India's healthcare system. Patients, caregivers, and doctors can upload any prescription photo — the AI reads every medicine name, identifies the active chemical ingredient (salt), and instantly finds the certified **PMBJP Jan Aushadhi** generic equivalent at a fraction of the branded price.

> **Real example:** Augmentin 625 (branded) costs ₹223. The Jan Aushadhi equivalent costs ₹60. MedLens finds this automatically — saving ₹163 (73%) per strip on a single antibiotic.

### The Problem It Solves

Most Indian patients pay 3–8x more for branded medicines without knowing that identical generic alternatives — certified by the government under the Jan Aushadhi scheme — are available at every PMBJP store. The challenge is patients don't know the active chemical name (salt), so they can't ask for the generic.

**MedLens solves this** — it reads the prescription, extracts the salt, and gives the patient a printable chemist slip with the exact generic name and target price.

---

## ✨ Features

### 📸 AI Prescription Scanner
- Upload any prescription photo (JPG, PNG, WebP, HEIC, BMP — up to 10MB)
- Google Gemini Vision AI reads handwritten and printed prescriptions
- Falls back to **Tesseract.js local OCR** if AI quota is exhausted — always works
- Alternatively, type or paste prescription text directly

### 💰 Jan Aushadhi Generic Savings
- Matches every medicine to its certified PMBJP generic equivalent
- Shows exact price comparison: branded vs. generic, per strip
- Calculates instant savings + **projected monthly savings** for chronic medications
- Running cumulative savings tracker across all sessions (stored in LocalStorage)
- One-click **Chemist Dispensing Slip** — printable/copyable for your pharmacist

### ⏰ Daily Dosage Timetable
- Auto-builds a visual schedule: Morning → Afternoon → Evening → Bedtime
- Reads doctor frequency codes: `BD`, `TDS`, `OD AC`, `1-0-1`, `HS`, `SOS`
- Smart fallback: if no frequency written, uses medicine's meal timing to assign the correct slot
- Exports to `.ics` calendar file (opens in Google Calendar, Apple Calendar, Outlook)

### 🔬 Drug-Drug Interaction (DDI) Check
- Checks every pair of medicines on the prescription
- Works on **normalized active salts** — not brand names (catches generic-to-generic interactions)
- Three severity levels: 🔴 Red (High Risk) · 🟡 Amber (Monitor) · 🟢 Green (Safe Synergy)
- Explains the pharmacological mechanism in plain language

### 🍽️ Clinical Meal & Food Guidance
- Per-medicine food instructions derived from drug class
- Best foods to eat with each medicine
- Foods and drinks to strictly avoid
- Automatically determined: PPIs taken empty stomach, NSAIDs after food, statins at bedtime

### 💬 AI Clinical Copilot
- Slide-out chat drawer aware of the current prescription
- Answers: "When should I take Augmentin?", "What foods to avoid with Pantocid?", "What if I miss a dose?"
- Emergency keyword detection — shows 108/112 alert for chest pain, breathlessness, etc.
- Powered by Gemini/Groq with fallback to built-in clinical rules

### 🔊 Multilingual Voice Readout
- Built-in Text-to-Speech using browser Web Speech API
- Reads dosage instructions aloud in: English, हिन्दी, தமிழ், मराठी, বাংলা, ગુજરાતી, Español

### 🌙 Dark / Light Theme
- Fully responsive dark and light mode
- Preference saved to LocalStorage

---

## 🏗️ How It Works

### Architecture Overview

```
Browser (public/)                     Server (server/)
─────────────────                     ────────────────────────────────────────
index.html  ──── GET /  ──────────►  Express static serve
app.js      ──── POST /api/... ───►  Routes ──► Services ──► AI APIs / DB
styles.css                                              │
                                                        ▼
                                             drugDatabase.json (42 drugs)
                                             openFDA API (unlimited)
                                             NIH RxNorm API (unlimited)
                                             Gemini AI (3-key pool)
                                             Groq Qwen AI (free tier)
```

Single Express server on port `3000` serves both the frontend (static files) and the REST API. No separate web server required.

---

### 🧠 Medicine Information — The 5-Tier Resolver

**File:** `server/services/globalResolver.js`

After the AI extracts a drug name from the prescription (e.g. `"Novastat 10"`), the system needs to find its active salt, drug class, Jan Aushadhi price, and precautions. It uses a **5-tier waterfall** with in-memory caching:

```
Drug name received (e.g. "Augmentin 625")
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  IN-MEMORY CACHE CHECK  (Map — instant, 0ms)        │
│  If seen before → return cached result immediately  │
└─────────────────────────────────────────────────────┘
          │ cache miss
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TIER 1 — Groq Qwen 2.5                                              │
│  Model: qwen/qwen3.8-27b  |  Speed: ~450 tokens/sec  |  Free tier  │
│  API: https://api.groq.com/openai/v1/chat/completions               │
│  Timeout: 3.5s  |  Requires: GROQ_API_KEY                          │
│  Returns: brand, salt, class, mealTiming, priceINR, Jan Aushadhi alt│
└──────────────────────────────────────────────────────────────────────┘
          │ fails / no key
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TIER 2 — openFDA  (US National Drug Database)                       │
│  API: https://api.fda.gov/drug/label.json                            │
│  Auth: NONE — completely public  |  Timeout: 2.5s                   │
│  Returns: brand_name, substance_name, pharm_class, indications       │
└──────────────────────────────────────────────────────────────────────┘
          │ not found
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TIER 3 — Google Gemini AI                                           │
│  3-key pool with auto-rotation  |  Free tier  |  Timeout: 7s        │
│  Prompt: structured JSON pharmacology query                          │
│  Returns: salt, class, whyToTake, mealTiming, genericAlternative     │
└──────────────────────────────────────────────────────────────────────┘
          │ all keys rate-limited
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TIER 4 — NIH NLM RxNorm  (US Library of Medicine)                  │
│  API: https://rxnav.nlm.nih.gov/REST/approximateTerm.json            │
│  Auth: NONE — completely public  |  Timeout: 2s                     │
│  Returns: standardized clinical drug name (INN)                      │
└──────────────────────────────────────────────────────────────────────┘
          │ not in registry
          ▼
    pharmacist verification flag
```

**In-memory cache effect:** 100 users scanning prescriptions with "Augmentin" — only the **first** call hits an API. All 99 others are served from server RAM in 0ms at zero cost.

---

### 📷 Image Upload Pipeline

**File:** `server/services/aiService.js` → `extractPrescription()`

```
User uploads image (JPEG/PNG/WebP/HEIC — max 10MB)
          │
          ▼
Multer middleware — RAM buffer, no disk write, MIME type validation
          │
          ▼
 STEP 1 ── Gemini Vision Pool (15s timeout)
           Sends image as base64 inline_data
           Tries Key 1 → Key 2 → Key 3 automatically
           On HTTP 429 → key enters 60s cooldown, next key used
           ✓ Returns structured medicines JSON
           ✗ All keys exhausted → Step 2
          │
          ▼
 STEP 2 ── Tesseract.js Local OCR  (no internet needed)
           Runs entirely on the server — offline capable
           Persistent worker cached in memory (fast on repeat)
           Extracts raw text from image
           │
           ├─ STEP 2a ── OCR text → Groq Qwen parse
           │             Sends OCR text with correction instructions
           │             Groq fixes OCR typos: "1ab" → "Tab", "Pantocd" → "Pantocid"
           │             ✓ Returns medicines array
           │
           └─ STEP 2b ── OCR text → Gemini text parse (no image, cheaper & faster)
                         Re-uses Gemini keys in text-only mode on OCR output
                         ✓ Returns medicines array
          │
          ▼
 STEP 4 ── OpenAI GPT-4o-mini Vision  (if key + credits configured)
 STEP 5 ── Anthropic Claude Vision    (if key configured)
          │
          ▼
    Descriptive error with actionable suggestions
```

---

### ⚠️ Rate Limits & Automatic Handling

| Provider | Limit | What Happens When Hit |
|---|---|---|
| Gemini Key 1 | ~1,500 req/day free | Enters 60s cooldown, Key 2 used |
| Gemini Key 2 | ~1,500 req/day free | Enters 60s cooldown, Key 3 used |
| Gemini Key 3 | ~1,500 req/day free | Falls to OCR+Groq pipeline |
| Groq Qwen | Very high free limits | Falls to Gemini text |
| openFDA | Unlimited | Only limited by 2.5s timeout |
| NIH RxNorm | Unlimited | Only limited by 2s timeout |

**3 Gemini keys = ~4,500 requests/day** before any fallback is needed. The cooldown system (`keyCooldownMap`) tracks each key's status in server RAM and rotates automatically.

---

## 🛠️ Tech Stack

### Backend

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.19.2 | HTTP server, routing, middleware |
| `multer` | ^1.4.5-lts.1 | Multipart image upload handler |
| `tesseract.js` | ^7.0.0 | Local OCR — reads text from images |
| `cors` | ^2.8.5 | Cross-origin request control |
| `dotenv` | ^16.4.5 | Environment variable loader |

### External APIs

| Service | Auth Required | Cost | Role |
|---|---|---|---|
| Google Gemini | API Key | **Free tier** | Vision OCR + text NLP |
| Groq Qwen 2.5 | API Key | **Free tier** | Fast text NLP parsing |
| openFDA | ❌ None | **Always free** | US drug label database |
| NIH NLM RxNorm | ❌ None | **Always free** | Clinical drug name registry |
| OpenAI GPT-4o-mini | API Key | Paid | Optional vision fallback |
| Anthropic Claude | API Key | Paid | Optional vision fallback |

### Frontend

- **Vanilla HTML5 + CSS3 + JavaScript** — zero frameworks, zero build step
- **Web Speech API** — browser-native multilingual TTS voice readout
- **LocalStorage** — cumulative savings persistence across sessions
- **ICS / iCalendar format** — dosage schedule export to any calendar app

### Infrastructure

| Tool | Purpose |
|---|---|
| Docker + node:20-alpine | Container build (~170MB image) |
| docker-compose | Container orchestration + env management |
| Nginx | Reverse proxy, HTTPS, 12MB upload limit |
| GitHub Actions | CI/CD — SSH deploy to EC2 on `git push main` |
| AWS EC2 | Production hosting |

---

## 📁 Project Structure

```
medicine-recommender-app/
│
├── public/                          ← Frontend (served statically by Express)
│   ├── index.html                   ← Full UI: header, scanner, results, chat drawer
│   ├── app.js                       ← All frontend logic (~950 lines, Vanilla JS)
│   └── styles.css                   ← Complete design system (~1,400 lines, dark+light)
│
├── server/                          ← Node.js + Express backend
│   ├── server.js                    ← App entry: CORS, routes, error handler, static serve
│   │
│   ├── routes/
│   │   ├── prescription.js          ← /analyze · /analyze-text · /sample · /chat · /status
│   │   ├── alternatives.js          ← /lookup — Jan Aushadhi generic finder
│   │   ├── interactions.js          ← /check — Drug-Drug Interaction engine
│   │   └── missedDose.js            ← /advise — Missed dose calculator
│   │
│   ├── services/
│   │   ├── aiService.js             ← AI provider cascade + Tesseract OCR pipeline
│   │   ├── globalResolver.js        ← 5-tier drug resolver with in-memory cache
│   │   └── interactionEngine.js     ← Salt-based DDI rules engine (9 interaction rules)
│   │
│   ├── data/
│   │   └── drugDatabase.json        ← 42 verified Indian drugs + Jan Aushadhi prices
│   │
│   ├── .env                         ← API keys (gitignored — never committed)
│   └── .env.example                 ← Key template for new deployments
│
├── docs/
│   ├── PROJECT_UNDERSTANDING.md     ← Full technical deep-dive documentation
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   └── SECURITY.md
│
├── Dockerfile                       ← node:20-alpine, prod deps only, healthcheck
├── docker-compose.yml               ← Build + run + env_file + restart policy
├── nginx.conf                       ← Reverse proxy template (replace YOUR_DOMAIN)
├── .gitignore                       ← Excludes .env, node_modules, *.traineddata
│
└── .github/workflows/
    └── deploy.yml                   ← GitHub Actions: push to main → SSH → docker up
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- A free Google Gemini API key (takes 2 minutes — no credit card)

### Step 1 — Get a Free Gemini API Key

1. Go to **[aistudio.google.com](https://aistudio.google.com/)**
2. Sign in with any Google account
3. Click **"Get API key"** → **"Create API key"**
4. Copy the key — it starts with `AIza...`

> Free tier: **1,500 requests/day, 15 requests/minute** — more than enough for personal use. You can add up to 3 keys for 4,500 req/day total.

### Step 2 — Clone & Configure

```bash
git clone https://github.com/your-username/medicine-recommender-app.git
cd medicine-recommender-app
```

Copy the environment template:
```bash
cp server/.env.example server/.env
```

Open `server/.env` and add your keys:
```env
# Required — Google Gemini (free)
GEMINI_API_KEY=AIzaSyYourKeyHere
GEMINI_MODEL=gemini-flash-lite-latest

# Optional — add multiple keys for higher quota
GEMINI_API_KEYS=AIzaSyKey1,AIzaSyKey2,AIzaSyKey3

# Optional — Groq (free, ultra-fast fallback)
GROQ_API_KEY=gsk_YourGroqKeyHere
GROQ_MODEL=qwen/qwen3.8-27b

# Server
PORT=3000
```

### Step 3 — Install & Run

```bash
cd server
npm install
npm start
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Step 4 — Try It Instantly

Click **⚡ Try Demo** in the header to load a sample 3-medicine prescription without uploading anything. This tests the full pipeline: enrichment → savings → timetable → DDI check → copilot.

---

## 🐳 Docker Setup

### Run with Docker Compose (Recommended for Production)

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

The `docker-compose.yml` automatically loads secrets from `server/.env` at runtime — keys are never baked into the Docker image.

### Docker Health Check

The container includes a built-in health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
```

Docker will automatically restart the container if the health check fails.

---

## 📡 API Reference

All endpoints return JSON. Base URL: `http://localhost:3000`

### `POST /api/prescription/analyze`
Upload a prescription image for AI analysis.

```bash
curl -X POST http://localhost:3000/api/prescription/analyze \
  -F "prescription=@/path/to/prescription.jpg"
```

**Response:**
```json
{
  "success": true,
  "providerUsed": "Google Gemini Vision (Key #1/3 - gemini-flash-lite-latest)",
  "medicines": [
    {
      "brand": "Augmentin 625 Duo",
      "salt": "Amoxicillin (500mg) + Clavulanic Acid (125mg)",
      "strength": "625mg",
      "frequency": "Twice daily after food",
      "timeSlots": ["morning", "night"],
      "mealTiming": "After Meals",
      "bestMeals": "Light khichdi or probiotic curd with 250ml water",
      "foodsToAvoid": "Strictly avoid alcohol",
      "priceINR": 223,
      "bestAlternative": {
        "brand": "Jan Aushadhi Amoxy-Clav 625",
        "manufacturer": "PMBJP (Jan Aushadhi)",
        "priceINR": 60
      },
      "savingsINR": 163,
      "savingsPercent": 73,
      "isVerified": true
    }
  ],
  "metrics": {
    "totalMedicines": 3,
    "verifiedCount": 3,
    "totalBrandedCost": 349,
    "totalGenericCost": 87,
    "prescriptionSavingsINR": 262,
    "savingsPercent": 75
  },
  "interactions": {
    "interactionsFound": 1,
    "hasHighRisk": false,
    "results": [...]
  },
  "clinicalSynergy": "Your doctor prescribed Pantoprazole to shield your stomach..."
}
```

---

### `POST /api/prescription/analyze-text`
Analyze a typed or pasted prescription.

```bash
curl -X POST http://localhost:3000/api/prescription/analyze-text \
  -H "Content-Type: application/json" \
  -d '{"text": "Tab Augmentin 625 BD x 5 days\nTab Dolo 650 TDS SOS\nCap Pantocid 40 OD AC"}'
```

---

### `POST /api/prescription/sample`
Load the built-in demo prescription instantly.

```bash
curl -X POST http://localhost:3000/api/prescription/sample
```

---

### `POST /api/prescription/chat`
Ask the AI copilot about medicines.

```bash
curl -X POST http://localhost:3000/api/prescription/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "When should I take Pantocid?", "chatHistory": []}'
```

**Response:** `{ "reply": "Pantocid (Pantoprazole) should be taken **30–45 minutes before breakfast** on an empty stomach..." }`

---

### `POST /api/alternatives/lookup`
Find the generic alternative for any drug.

```bash
curl -X POST http://localhost:3000/api/alternatives/lookup \
  -H "Content-Type: application/json" \
  -d '{"drugName": "Dolo 650"}'
```

---

### `POST /api/interactions/check`
Check interactions between two or more medicines.

```bash
curl -X POST http://localhost:3000/api/interactions/check \
  -H "Content-Type: application/json" \
  -d '{"drugs": ["Ibuprofen 400", "Aspirin 75"]}'
```

**Response includes severity:** `Red` · `Amber` · `Yellow` · `Green`

---

### `POST /api/missed-dose/advise`
Get safe missed-dose guidance.

```bash
curl -X POST http://localhost:3000/api/missed-dose/advise \
  -H "Content-Type: application/json" \
  -d '{"scheduledTime": "08:00", "currentTime": "12:00", "frequencyHours": 8}'
```

---

### `GET /api/health`
Server health check.

```bash
curl http://localhost:3000/api/health
# {"status": "ok", "app": "MedLens"}
```

---

## ☁️ Deployment

### AWS EC2 with GitHub Actions (Auto-Deploy)

**One-time EC2 setup:**
```bash
# On your EC2 instance
git clone https://github.com/your-username/medicine-recommender-app.git ~/medlens
cd ~/medlens
cp server/.env.example server/.env
# Edit server/.env and add your API keys
nano server/.env

# Start
docker compose up -d --build
```

**Add GitHub Secrets** (Settings → Secrets → Actions):
```
EC2_HOST     → your EC2 public IP or domain
EC2_SSH_KEY  → your private SSH key content
```

Now every `git push` to `main` triggers automatic redeploy via `.github/workflows/deploy.yml`:
```
git push origin main
  → GitHub Actions SSH into EC2
  → git pull
  → docker compose down
  → docker compose up -d --build
  → docker image prune -f
```

### Nginx HTTPS Setup

```bash
sudo cp nginx.conf /etc/nginx/sites-available/medlens
# Edit YOUR_DOMAIN_OR_IP in the file
sudo nano /etc/nginx/sites-available/medlens
sudo ln -s /etc/nginx/sites-available/medlens /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Add free SSL certificate
sudo certbot --nginx -d yourdomain.com
```

---

## 🔒 Security

- **API keys** stored in `.env` files — gitignored, never committed to version control
- **CORS** — in production (`NODE_ENV=production`), only `ALLOWED_ORIGINS` whitelist is accepted
- **File upload** — MIME type validation + 10MB hard limit via Multer
- **Input sanitization** — chat messages capped at 800 characters
- **No database** — zero SQL injection surface; data flows through JSON and external APIs only
- **Docker** — production deps only (`npm install --omit=dev`), secrets loaded at runtime via `env_file`

---

## 📋 Environment Variables Reference

```env
# ── Google Gemini (Required for Vision OCR) ─────────────────────────────────
GEMINI_API_KEY=AIzaSy...          # Primary key
GEMINI_API_KEY_2=AIzaSy...        # Optional — increases daily quota
GEMINI_API_KEY_3=AIzaSy...        # Optional — increases daily quota
GEMINI_API_KEYS=key1,key2,key3    # Alternative: comma-separated pool
GEMINI_MODEL=gemini-flash-lite-latest

# ── Groq Qwen (Optional but recommended — fast free fallback) ────────────────
GROQ_API_KEY=gsk_...
GROQ_MODEL=qwen/qwen3.8-27b

# ── OpenAI (Optional — paid fallback) ───────────────────────────────────────
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# ── Anthropic (Optional — paid fallback) ────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# ── Production CORS ──────────────────────────────────────────────────────────
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com

# ── Server ───────────────────────────────────────────────────────────────────
PORT=3000
```

---

## 💊 Local Drug Database

The local database (`server/data/drugDatabase.json`) contains **42 verified Indian drugs** covering:

| Category | Examples |
|---|---|
| Antibiotics | Augmentin, Azithral, Ciplox, Cefixime, Amoxicillin |
| Pain & Fever | Dolo 650, Brufen, Combiflam, Diclofenac |
| Stomach / Acidity | Pantocid, Omeprazole, Pan-D |
| Blood Pressure | Amlodipine, Telmisartan, Losartan, Atenolol |
| Diabetes | Metformin (Glycomet, Glucophage) |
| Cholesterol | Atorvastatin, Rosuvastatin |
| Allergy | Cetirizine, Montelukast, Levocetirizine |
| Vitamins | Calcium + D3, B-Complex, Vitamin D3 |
| Blood Thinners | Aspirin 75, Clopidogrel |
| Thyroid | Levothyroxine (Eltroxin) |

Every entry includes: brand name, aliases, active salt, drug class, Jan Aushadhi alternative with price, food instructions, and precautions.

---

## 📖 Documentation

Full technical documentation is available in the `docs/` folder:

| File | Contents |
|---|---|
| [`docs/PROJECT_UNDERSTANDING.md`](docs/PROJECT_UNDERSTANDING.md) | Complete technical deep-dive with real code, all API calls, pipeline diagrams |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture and design decisions |
| [`docs/DESIGN.md`](docs/DESIGN.md) | UI/UX design decisions |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security considerations and practices |

---

## ⚠️ Medical Disclaimer

MedLens provides **educational information only**. It is not a substitute for professional medical advice, diagnosis, or treatment. Always confirm medication changes — including generic substitutions — with your licensed doctor or registered pharmacist. Generic substitution requires a valid prescription in India.

For emergencies, call **108** (Ambulance) or **112** (National Emergency).

---

<div align="center">

**Built for India's Jan Aushadhi Programme** 🇮🇳

*Helping patients save money on medicines without compromising on quality*

© 2026 MedLens · MIT License

</div>
