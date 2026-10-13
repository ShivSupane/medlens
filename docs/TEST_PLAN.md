# MedLens — Test Plan

> **Version:** 1.0 | **Date:** October 2026

---

## 1. Overview

This document describes the test cases for MedLens. The project currently has no automated test suite. This plan identifies what should be tested and how.

---

## 2. Test Environments

| Environment | Description |
|-------------|-------------|
| Local dev | `node server.js` in `server/`, frontend at `localhost:3000` |
| Demo mode | No API keys set — should serve sample data gracefully |
| API mode | At least one `GEMINI_API_KEY` set in `server/.env` |

---

## 3. Backend API Tests

### 3.1 Health check
- `GET /api/health` → `{ status: "ok", app: "MedLens" }` with HTTP 200

### 3.2 POST /api/prescription/sample
- Returns a valid response object with `medicines`, `metrics`, `interactions`, `clinicalSynergy`
- `metrics.totalMedicines` equals `medicines.length`
- `metrics.prescriptionSavingsINR >= 0`
- `medicines[0].isVerified === true`

### 3.3 POST /api/prescription/analyze-text
**Valid input:**
```
Tab Augmentin 625 1 tab BD × 5 days
Tab Dolo 650 TDS SOS
Cap Pantocid 40 OD AC
```
Expected: HTTP 200, 3 medicines returned, all `isVerified === true`, `metrics.savingsPercent > 0`

**Empty input:**
```json
{ "text": "" }
```
Expected: HTTP 400, `{ "error": "..." }`

**Oversized message in chat:**
```json
{ "message": "x".repeat(900) }
```
Expected: HTTP 400, message too long error

### 3.4 POST /api/prescription/analyze (file upload)
- Valid JPG prescription image → HTTP 200, medicines array non-empty
- Non-image file (e.g. `.txt` file) → HTTP 400 from multer fileFilter
- File > 10 MB → HTTP 500 / multer size limit error

### 3.5 POST /api/prescription/chat
- `{ message: "When should I take Augmentin?", chatHistory: [] }` → HTTP 200, `reply` is non-empty string
- `{ message: "" }` → HTTP 400
- `{ message: null }` → HTTP 400

### 3.6 POST /api/alternatives/lookup
- `{ drugName: "Augmentin 625" }` → `found: true`, `salt` present, `alternatives` array non-empty
- `{ drugName: "" }` → HTTP 400
- `{ drugName: "complete nonsense xyz123" }` → `found: false`

### 3.7 POST /api/interactions/check
- `{ drugs: ["Aspirin", "Warfarin"] }` → `hasHighRisk: true` or `results` length > 0
- `{ drugs: ["Pantocid 40"] }` (only one drug) → HTTP 400

### 3.8 POST /api/missed-dose/advise
- `{ scheduledTime: "14:00", currentTime: "15:00", frequencyHours: 8 }` → within window, take now
- `{ scheduledTime: "08:00", currentTime: "16:00", frequencyHours: 8 }` → skip, don't double up
- Missing fields → HTTP 400

---

## 4. Frontend Functional Tests (Manual)

### 4.1 Theme toggle
- Click Dark button → page switches to dark mode, icon changes to ☀️
- Reload page → dark mode persists from localStorage

### 4.2 Tab switching
- Click "Type / Paste Text" → dropzone hides, textarea appears
- Click "Upload Image" → textarea hides, dropzone appears

### 4.3 Sample load
- Click "Try Demo" → spinner shows briefly, results render below scanner card
- Savings card shows non-zero values
- Timetable shows at least morning and night slots
- At least 3 medicine cards rendered

### 4.4 Text analysis
- Paste sample text, click Analyze Text → same result as demo load
- Empty textarea → alert shown, no API call made

### 4.5 Copilot drawer
- Click "Ask Copilot" in header or FAB → drawer slides in from right
- Click backdrop → drawer closes
- Click ✕ → drawer closes
- Type a question, hit Enter → bot replies, typing indicator shown then replaced
- Click suggestion chip → question auto-fills and submits
- Clear button → chat resets to initial message

### 4.6 Chemist slip
- After analysis, click "Chemist Slip" → modal opens with formatted slip text
- Copy button → clipboard copy works
- Click outside modal → modal closes

### 4.7 Calendar export
- Click "Export Schedule" → `.ics` file downloads
- Open in calendar app → events visible

### 4.8 Savings tracker reset
- After loading demo, savings show > 0
- Click "Reset tracker" → confirm dialog → savings reset to ₹0

---

## 5. Accessibility Tests (Manual)

- [ ] All buttons reachable via Tab key
- [ ] Copilot drawer operable via keyboard
- [ ] Status messages announced by screen reader (VoiceOver / NVDA)
- [ ] Contrast ratio ≥ 4.5:1 for all body text (check with browser DevTools)
- [ ] No reliance on colour alone for meaning (all colour-coded items have icons or text)

---

## 6. Regression Tests (Run After Each Code Change)

1. Demo sample loads and renders 3 medicine cards
2. Savings numbers are non-zero
3. Copilot drawer opens and closes
4. Dark mode toggles correctly
5. Server starts without errors: `node server.js`

---

## 7. Recommended Testing Tools

| Tool | Purpose |
|------|---------|
| [REST Client (VS Code)](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) | API endpoint testing |
| Browser DevTools → Accessibility panel | Contrast and ARIA checks |
| [axe DevTools](https://www.deque.com/axe/) | Automated accessibility scan |
| Lighthouse (Chrome) | Performance, accessibility, best practices audit |
| [Postman](https://www.postman.com/) | Comprehensive API testing with collections |
