# MedLens — Project Memory

> Running log of important context, bugs found/fixed, and things to remember. Update this as the project evolves.

---

## Project Context

- **Name:** MedLens
- **Purpose:** Help Indian patients find Jan Aushadhi generic alternatives to branded medicines and calculate savings
- **Stack:** Node.js + Express backend, vanilla JS frontend, no build tools
- **AI Providers:** Google Gemini (primary), Groq Qwen (fallback), OpenAI, Anthropic Claude
- **Drug Databases:** Local JSON, openFDA, NIH RxNorm
- **Deployment:** Single Express server serves both API and static frontend

---

## Known Bugs Fixed (Oct 2026)

| # | Bug | Fix |
|---|-----|-----|
| 1 | Gemini model name `gemini-3.8-flash` doesn't exist → all vision fell to demo mode | Changed default to `gemini-1.5-flash` in `aiService.js` |
| 2 | Gemini API timeout was 3 seconds — too short for vision OCR | Changed `AbortSignal.timeout` to 28000ms |
| 3 | `multer` had no MIME type check — any file type accepted | Added `fileFilter` to `prescription.js` allowing only image types |
| 4 | Chat messages had no length limit → could bloat AI prompts | Added 800-char limit on server and `chatHistory.slice(-6)` |
| 5 | No `.gitignore` → `server/.env` could be accidentally committed | Created `.gitignore` at project root |
| 6 | Frontend chat used class `chat-msg-bot`/`chat-msg-user` but redesigned CSS uses `bot`/`user` | Updated all `addBotMessage`, `addUserMessage`, `clearChat`, `addTypingIndicator` functions |

---

## Known Issues (Not Yet Fixed)

| # | Issue | Priority |
|---|-------|----------|
| 1 | No rate limiting on any API endpoint | High — fix before any public deployment |
| 2 | CORS is open wildcard (`app.use(cors())`) | High — restrict origin in production |
| 3 | Error messages in production leak internal details | Medium |
| 4 | No `helmet.js` HTTP security headers | Medium |
| 5 | `resolutionCache` grows unbounded (no eviction) | Low — negligible in practice |
| 6 | Focus not trapped inside Copilot drawer (accessibility) | Low / v1.1 |
| 7 | `.env` only has `GEMINI_API_KEY` in example, not `GEMINI_API_KEYS` (multi-key) | Low |

---

## Drug Database Notes

- `server/data/drugDatabase.json` is the local verified dataset
- Covers ~50 top Indian branded drugs with Jan Aushadhi alternatives
- To add a new drug: add an entry matching the existing schema with `brand`, `salt`, `saltNormalized`, `aliases`, `class`, `priceINR`, `alternatives[]`, `precautions[]`, `foodInstructions`, `conditionHint`
- Drugs not in the local DB fall to the 5-tier global resolver in `globalResolver.js`

---

## AI Configuration

- Default model: `gemini-1.5-flash` (free tier, 15 req/min per key)
- Override in `.env`: `GEMINI_MODEL=gemini-2.0-flash`
- Multi-key pool: set `GEMINI_API_KEYS=key1,key2,key3` or individual `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, etc.
- Keys rotate round-robin; on rate limit (HTTP 429), next key is tried immediately
- Groq is a fast free-tier text fallback: `GROQ_API_KEY=...` and optional `GROQ_MODEL=qwen/qwen3.8-27b`

---

## UI Component Map

| Visual element | HTML id | Rendered by |
|----------------|---------|-------------|
| Scanner tabs | `tabPhoto`, `tabText` | static HTML |
| Dropzone | `dropZone` | static HTML |
| Preview bar | `previewContainer` | JS: `handleFileSelect()` |
| Savings card | `resultsContainer` inner | JS: `renderPrescriptionReport()` |
| Timetable grid | `timetableGrid` | JS: `renderDailyTimetable()` |
| Synergy text | `synergyText` | JS: `renderPrescriptionReport()` |
| Interaction list | `interactionList` | JS: `renderInteractions()` |
| Medicine cards | `medicinesList` | JS: `renderMedicineCards()` |
| Copilot drawer | `copilotDrawerOverlay` | JS: `openCopilot()` / `closeCopilot()` |
| Chat messages | `chatMessages` | JS: `addBotMessage()` / `addUserMessage()` |
| Chemist slip modal | `chemistModal` | JS: `showChemistSlip()` |

---

## File Change Log

| File | Last major change | Summary |
|------|------------------|---------|
| `server/services/aiService.js` | Oct 2026 | Fixed model name, increased timeout |
| `server/routes/prescription.js` | Oct 2026 | Added MIME filter, chat length limit |
| `public/index.html` | Oct 2026 | Full UI redesign — cleaner, mobile-first |
| `public/styles.css` | Oct 2026 | New design system with mobile breakpoints |
| `public/app.js` | Oct 2026 | Fixed chat message class names, savings badge class |
| `.gitignore` | Oct 2026 | Created — protects `.env` from being committed |

---

## Quick Start Reminder

```bash
cd server
# copy .env.example to .env and add your Gemini key
npm install
npm start
# open http://localhost:3000
```
