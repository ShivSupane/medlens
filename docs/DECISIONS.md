# MedLens — Architecture Decision Records (ADRs)

> Key decisions made during design and development, with rationale.

---

## ADR-001 — No Frontend Framework

**Date:** Project inception  
**Status:** Active

**Decision:** Use vanilla HTML, CSS, and JavaScript with no build toolchain.

**Rationale:**
- Zero setup friction — the project works by opening `index.html` or starting the Express server
- No Node.js frontend dependencies to maintain or audit
- Faster initial load for users on slow Indian mobile connections
- The UI complexity doesn't require a reactive framework — there's one main state object and a flat component tree

**Trade-offs:**
- No component reuse abstractions; HTML is string-templated in JS
- No TypeScript; type errors caught at runtime
- Adding a framework later would require a full migration

---

## ADR-002 — Multi-Key Gemini Pool Instead of a Single Key

**Date:** Early development  
**Status:** Active

**Decision:** Support `GEMINI_API_KEYS` (comma-separated) and `GEMINI_API_KEY_1..4` environment variables and rotate through them with round-robin + failover.

**Rationale:**
- Gemini free tier is 15 requests/minute per key. A prescription analysis can use 1–3 AI calls (vision + global resolver + chat)
- Multiple free keys effectively multiply the rate limit without any cost
- A school/clinic deployment with 10+ users would exhaust a single key instantly

**Trade-offs:**
- More configuration for new developers
- Key rotation state is lost on server restart (not a meaningful problem given the short request window)

---

## ADR-003 — 5-Tier Drug Resolver

**Date:** Development  
**Status:** Active

**Decision:** Resolve unknown drug brands through: Local DB → openFDA → Groq AI → Gemini AI → NIH RxNorm.

**Rationale:**
- The local database covers ~80% of common Indian prescriptions instantly at zero latency/cost
- openFDA covers international brand names
- Groq Qwen 2.5 has pharmacology training and responds in ~1 second with zero rate limits on free tier
- Gemini handles edge cases and regional/vernacular drug names
- RxNorm is a conservative fallback for salt normalisation

**Trade-offs:**
- Increasing latency for unrecognised drugs (each tier adds ~1–3 seconds)
- openFDA primarily covers US-registered drugs; many Indian-only brands fall through to AI tiers

---

## ADR-004 — In-Memory Resolution Cache

**Date:** Development  
**Status:** Active

**Decision:** Cache resolved drug data in a `Map()` in `globalResolver.js` for the lifetime of the Node process.

**Rationale:**
- A prescription with 4 medicines might trigger 4 resolver lookups; if the server sees the same medicine again in the next request, the cache avoids redundant API calls
- Simple to implement, no Redis dependency

**Trade-offs:**
- Cache is lost on server restart
- No eviction policy — could grow unbounded in long-running deployments (mitigation: drug names are short strings, practical cache size is negligible)

---

## ADR-005 — Same-Origin API (No Separate Frontend Hosting)

**Date:** Project inception  
**Status:** Active

**Decision:** Express serves the `public/` directory statically. The frontend uses relative paths (`API = ''`).

**Rationale:**
- Eliminates CORS configuration for development
- Single deployment target — `npm start` in `server/` serves everything
- Simpler for non-technical users to run locally

**Trade-offs:**
- Tighter coupling between frontend and backend
- CDN-caching the frontend separately requires additional proxy configuration

---

## ADR-006 — Medical Disclaimer Strategy

**Date:** Design phase  
**Status:** Active

**Decision:** Disclaimers appear in three places: page footer, Copilot chat footer, and within the Copilot system prompt (so the AI itself defers to a pharmacist).

**Rationale:**
- Legal and ethical requirement — MedLens is not a licensed medical service
- The AI system prompt explicitly instructs the bot to recommend professional confirmation
- The footer disclaimer is visible on every page view without being intrusive

---

## ADR-007 — No User Accounts / No Data Persistence

**Date:** Project inception  
**Status:** Active

**Decision:** No authentication, no server-side storage of prescriptions or chat history.

**Rationale:**
- Prescription data is sensitive health information — storing it creates regulatory and privacy obligations
- In-memory + localStorage is sufficient for the v1 use case (single-session savings tracking)
- Dramatically reduces the attack surface

**Trade-offs:**
- Users cannot retrieve previous analyses after closing the tab
- No usage analytics without adding privacy-compliant logging

---

## ADR-008 — Gemini Model Name Fix (Bug Fix Decision)

**Date:** October 2026  
**Status:** Resolved

**Context:** The codebase hardcoded `gemini-3.8-flash` as the default Gemini model. This model does not exist in the Gemini API. All API calls silently fell through to demo mode.

**Decision:** Changed default to `gemini-1.5-flash`, which is the stable free-tier model. Users can override with `GEMINI_MODEL=gemini-2.0-flash` in `.env`.
