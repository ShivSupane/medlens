# MedLens — Architecture Document

> **Version:** 1.0 | **Date:** October 2026

---

## 1. High-Level Overview

```
Browser (Vanilla JS + CSS)
    │
    │  HTTP / REST
    ▼
Node.js Express Server  (server/server.js)
    ├── /api/prescription  ──► AI Vision OCR ──► Drug Enrichment ──► DDI Check
    ├── /api/alternatives  ──► Local DB → openFDA
    ├── /api/interactions  ──► Interaction Engine
    └── /api/missed-dose   ──► Rule-based advisor
    │
    ├── External APIs
    │     ├── Google Gemini  (vision OCR + text extraction + AI chat)
    │     ├── Groq Qwen 2.5  (text fallback, ultra-fast)
    │     ├── OpenAI GPT-4o  (vision fallback)
    │     ├── Anthropic Claude (vision fallback)
    │     ├── openFDA        (US drug database)
    │     └── NIH RxNorm     (universal salt normalisation)
    │
    └── Static file serving  ──► public/ (index.html, styles.css, app.js)
```

---

## 2. Project Structure

```
medicine-recommender-app/
├── public/                    # Frontend (served statically)
│   ├── index.html             # Single-page application shell
│   ├── styles.css             # Design system + component styles
│   └── app.js                 # All client-side logic
│
├── server/                    # Node.js backend
│   ├── server.js              # Express bootstrap, middleware, route mounting
│   ├── .env                   # Local secrets (never committed)
│   ├── .env.example           # Template for new developers
│   │
│   ├── data/
│   │   └── drugDatabase.json  # Local Jan Aushadhi + India verified drug DB
│   │
│   ├── routes/
│   │   ├── prescription.js    # Main analysis pipeline (upload, text, sample, chat)
│   │   ├── alternatives.js    # Direct drug lookup endpoint
│   │   ├── interactions.js    # DDI check endpoint
│   │   └── missedDose.js      # Missed dose time calculator
│   │
│   └── services/
│       ├── aiService.js       # Multi-provider AI (Gemini pool, Groq, OpenAI, Claude)
│       ├── globalResolver.js  # 5-tier drug identity resolver with cache
│       └── interactionEngine.js  # Drug-drug interaction rule database
│
└── docs/                      # Project documentation
    ├── PRD.md
    ├── ARCHITECTURE.md
    ├── DESIGN.md
    ├── TEST_PLAN.md
    ├── SECURITY.md
    ├── DECISIONS.md
    └── MEMORY.md
```

---

## 3. Data Flow — Prescription Analysis

```
User uploads image / pastes text
        │
        ▼
POST /api/prescription/analyze (or /analyze-text)
        │
        ▼
[Step 1] AI Extraction
  Gemini Vision Pool (key 1 → key 2 → key 3)
  → OpenAI GPT-4o vision (if Gemini fails)
  → Anthropic Claude vision (if OpenAI fails)
  → Demo sample (if all AI unavailable)
        │
        │ returns: { medicines: [...] }
        ▼
[Step 2] Drug Enrichment  (enrichMedicines)
  For each extracted medicine:
    Tier 1 → Local drugDatabase.json (instant)
    Tier 2 → openFDA REST API
    Tier 3 → Groq AI pharmacology resolver
    Tier 4 → Gemini AI global resolver
    Tier 5 → NIH RxNorm
        │
        │ returns: enriched medicines + costs
        ▼
[Step 3] Drug-Drug Interaction Check
  checkRegimenInteractions(verifiedMeds)
  Pairwise salt comparison against rule database
        │
        ▼
[Step 4] Clinical Synergy Summary
  generatePrescriptionSynergy(medicines)
        │
        ▼
JSON response → Frontend renders results
```

---

## 4. AI Provider Cascade

The system uses a waterfall strategy to maximise uptime:

| Priority | Provider | Use Case | Cost |
|----------|----------|----------|------|
| 1 | Google Gemini (multi-key pool) | Vision OCR + text + chat | Free tier |
| 2 | Groq Qwen 2.5 | Text extraction + drug resolution | Free tier |
| 3 | OpenAI GPT-4o-mini | Vision fallback | Paid |
| 4 | Anthropic Claude | Vision fallback | Paid |
| 5 | Demo mode | Sample prescription | No API |

Multi-key pool: Gemini keys rotate round-robin; on 429/quota, the next key is tried immediately. Key pool is configured via `GEMINI_API_KEYS` (comma-separated) or individual `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, etc.

---

## 5. Drug Resolution — 5-Tier Resolver

`globalResolver.js` runs sequentially until a match is found:

| Tier | Source | Latency | Coverage |
|------|--------|---------|----------|
| 1 | Local `drugDatabase.json` | ~0 ms | ~50 top Indian brands |
| 2 | openFDA REST API | ~1-3 s | US/International FDA drugs |
| 3 | Groq Qwen 2.5 AI | ~1-2 s | Global pharmacology knowledge |
| 4 | Gemini AI pool | ~2-4 s | Global, multi-language brands |
| 5 | NIH RxNorm | ~1-3 s | Universal clinical names |

All resolved results are cached in-memory for the session lifetime.

---

## 6. Frontend Architecture

The frontend is intentionally dependency-free vanilla JavaScript:

- **State:** `currentRegimenData` (object), `chatHistory` (array), `selectedFile` (File)
- **Persistent state:** localStorage (theme preference, cumulative savings)
- **Rendering:** DOM manipulation, no virtual DOM or framework
- **Communication:** `fetch()` with async/await
- **Accessibility:** ARIA roles, `aria-live` regions, keyboard navigation support

---

## 7. Key Design Decisions

- **Same-origin serving:** Express serves the frontend statically, so the `API` variable in `app.js` is an empty string (relative path). No CORS headaches in development.
- **No bundler:** Zero build step — load the page, it works. Makes deployment trivial.
- **multer memoryStorage:** Images are processed in-memory and forwarded as base64 to AI providers. No temp files on disk.
- **resolutionCache:** Simple Map() in globalResolver. Clears on server restart. Prevents redundant API calls for repeated drug names within a session.
