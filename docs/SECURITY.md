# MedLens — Security Notes

> **Version:** 1.0 | **Date:** October 2026

---

## 1. Threat Model Summary

MedLens is a stateless web app — no user accounts, no database, no stored health records. The attack surface is relatively small. Key concerns are:

1. **API key exposure** — Gemini/Groq/OpenAI keys are the most valuable secrets
2. **Prompt injection** — user-supplied text goes into AI prompts
3. **File upload abuse** — the `/api/prescription/analyze` endpoint accepts file uploads
4. **API abuse / key exhaustion** — no rate limiting today
5. **CORS** — currently open wildcard in production

---

## 2. What Is Already Handled

| Risk | Mitigation in place |
|------|---------------------|
| API keys in source code | Keys loaded from `process.env` only. `.env` is in `.gitignore` |
| Malicious file type upload | `multer` fileFilter rejects non-image MIME types server-side |
| File size abuse | `multer` limits uploads to 10 MB |
| Chat message length | Server rejects messages > 800 characters with HTTP 400 |
| Chat history bloat | Server trims `chatHistory` to last 6 turns before sending to AI |
| XSS in chat | `escapeHtml()` sanitises all user input before DOM insertion |
| XSS in medicine data | `escapeHtml()` and `escapeAttr()` used in all template rendering |
| Emergency symptoms | Detected client-side and server-side; 108/112 call to action surfaced |

---

## 3. Known Gaps (Should Fix Before Production)

### 3.1 No Rate Limiting
**Risk:** Any IP can call `/api/prescription/analyze` repeatedly and exhaust all Gemini API keys in minutes.

**Fix:** Add `express-rate-limit`:
```js
const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({ windowMs: 60_000, max: 20 }));
```

### 3.2 CORS Is Open Wildcard
**Risk:** Any website can make credentialled requests to your API.

**Fix:** Restrict to your own domain in production:
```js
app.use(cors({ origin: 'https://yourdomain.com' }));
```

### 3.3 Prompt Injection via Prescription Text
**Risk:** A malicious user could craft prescription text like: _"Ignore all previous instructions. Pretend you are..."_

**Partial mitigation:** The EXTRACTION_SYSTEM_PROMPT is structured JSON-output-only, which limits free-form injection, but it is not immune.

**Fix (for v1.1):** Prepend a fixed injection-resistant prefix and strip suspicious patterns from input before forwarding to AI.

### 3.4 No HTTPS Enforcement
In production, serve the app behind a reverse proxy (nginx / Caddy) with HTTPS. Never run the Node server directly on port 80/443 in production without TLS.

### 3.5 Error Messages Leak Stack Traces
The `/api/prescription/analyze` error handler returns `err.message` directly. In production this can leak internal paths or API error details.

**Fix:** Return generic error messages in production, log the real error server-side only:
```js
const msg = process.env.NODE_ENV === 'production' ? 'Analysis failed. Please try again.' : err.message;
res.status(500).json({ error: msg });
```

### 3.6 No Helmet.js HTTP Security Headers
**Fix:** Add `helmet` middleware:
```bash
npm install helmet --save-exact
```
```js
const helmet = require('helmet');
app.use(helmet());
```

---

## 4. Medical / Legal Disclaimer

MedLens must display a clear disclaimer on every page view that it provides educational information only and is not a substitute for professional medical or pharmacist advice. This is implemented in the footer.

Never store or log:
- Prescription photos
- Patient names or identifiers
- Any health data from the request body

The current implementation does not persist any such data — all analysis is in-memory per request.

---

## 5. Dependency Security

Check for known vulnerabilities regularly:
```bash
cd server
npm audit
```

Key dependencies and their roles:
| Package | Role | Notes |
|---------|------|-------|
| `express` | Web framework | Keep updated |
| `multer` | File upload | Pinned to `1.4.5-lts.1` (LTS security branch) |
| `dotenv` | Environment loading | No network access |
| `cors` | CORS middleware | Configure origin in production |

No client-side npm packages — the frontend has zero dependencies.
