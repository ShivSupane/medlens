# MedLens — Product Requirements Document (PRD)

> **Version:** 1.0  
> **Date:** October 2026  
> **Status:** Active development

---

## 1. Product Overview

MedLens is a web application that helps patients in India understand and save money on their prescriptions. It reads a prescription (photo or text), identifies each medicine's active chemical salt, finds certified PMBJP Jan Aushadhi generic equivalents, and calculates exact savings. A conversational AI copilot answers follow-up questions about doses, meal timings, and side effects.

---

## 2. Problem Statement

Indian patients routinely pay 3–8× more for branded medicines than necessary. The active chemical salt in a ₹180 Augmentin strip is identical to a ₹38 Jan Aushadhi generic — most patients simply do not know the generic exists or what to ask for at the chemist. Doctors write brand names by habit, not because the brand is medically superior.

---

## 3. Target Users

| User | Need |
|------|------|
| Outpatient with a new prescription | "How much will these medicines cost? Is there a cheaper option?" |
| Patient with chronic illness (BP, diabetes) | "How much am I wasting monthly on branded statins?" |
| Elderly patient, limited digital literacy | Voice readout in Hindi or regional language |
| Caregiver managing family prescriptions | Quick slip to hand the chemist listing generic alternatives |

---

## 4. Goals

- Make generic medicine savings visible and actionable in under 60 seconds
- Support prescriptions in any language or handwriting style via AI OCR
- Provide drug-drug interaction alerts for common combinations
- Give clear meal timing guidance ("take 30 min before breakfast") per medicine
- Function in demo mode when no API key is present, so users can still explore

---

## 5. Non-Goals (v1)

- Not a telehealth or doctor consultation platform
- Not a medicine delivery or e-commerce service
- Does not replace the pharmacist's professional judgment
- Does not store patient data on a server or user account system

---

## 6. Core Features

### 6.1 Prescription Scanner
- **Photo upload** — drag-and-drop or file-picker. Supported: PNG, JPG, WebP, HEIC up to 10 MB.
- **Text input** — paste or type medicine names, the AI normalises them.
- **Demo mode** — one-click sample regimen for exploration.

### 6.2 Savings Analysis
- Per-medicine branded vs generic price comparison in INR
- Instant savings on this prescription
- Projected 30-day recurring savings for chronic medications
- Running cumulative savings tracker (localStorage)

### 6.3 Jan Aushadhi Lookup
- Local verified database (50+ common Indian drugs)
- Live openFDA fallback for international brands
- NIH RxNorm for salt normalisation
- Google Gemini / Groq AI for drugs not in any database

### 6.4 Drug Interaction Engine
- Pairwise check for common high-risk combinations (e.g. blood thinner + NSAID)
- Three severity tiers: Red (avoid), Amber (caution), Green (safe)
- Plain-English pharmacist advice per flagged pair

### 6.5 AI Copilot Chat
- Regimen-aware: knows which medicines the patient just scanned
- Answers meal timing, "why is this prescribed", missed dose, food cautions
- Emergency symptom detection — surfaces 108/112 call prompt
- Voice readout (Web Speech API) in 7 Indian and international languages

### 6.6 Chemist Dispensing Slip
- Printable/copyable text listing active salt names and Jan Aushadhi target prices
- Designed to be shown directly to the dispensing chemist

### 6.7 Calendar Export
- Generates a `.ics` file with daily medicine reminders
- Compatible with Google Calendar, Apple Calendar, Outlook

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Time from upload to savings display | < 8 seconds (with API) |
| Demo load time | < 1.5 seconds |
| Prescription savings shown | > ₹50 average per common regimen |
| Mobile usability | Fully usable on a 360px wide screen |
| Accessibility | WCAG 2.1 AA contrast ratios |

---

## 8. Constraints & Assumptions

- No user authentication in v1 — all state is in-memory or localStorage
- API keys are environment variables; the app degrades gracefully to demo mode without them
- Prices in the database are indicative MRP — actual chemist prices may vary by region
- The AI-extracted medicine data must always be verified by the pharmacist before purchase

---

## 9. Future Roadmap

- PWA (offline support, install to home screen)
- Barcode scanner for medicine strips
- Hindi / regional language UI
- Prescription history (optional cloud sync, opt-in)
- Integration with ABDM / Ayushman Bharat digital health records
