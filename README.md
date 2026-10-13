# MedLens — AI Prescription Reader & Generic Savings Assistant

A smart prescription scanner and clinical copilot web application. MedLens reads prescription photos using multimodal vision AI, matches each medicine against a verified drug database to identify its active salt composition, explains what condition each drug treats, lists crucial precautions and food timings, flags harmful drug-drug interactions on the same prescription, calculates instant and cumulative generic savings (Jan Aushadhi equivalents), and includes an interactive AI medical chatbot assistant.

---

## ⚡ Key Highlights & Architecture

- **Free AI Vision OCR**: Powered by **Google Gemini 1.5 Flash** (100% Free with no credit card via Google AI Studio). Also supports Anthropic Claude and OpenAI.
- **Salt-to-Salt Interaction Matrix**: Clinical drug-drug interaction checker evaluating normalized active molecules rather than brand names (Red: High risk/contraindicated, Amber: Monitor/Timing alert, Green: Protective synergy).
- **Verified Jan Aushadhi & Generic Equivalents**: Compares branded market prices against bioequivalent Indian Jan Aushadhi / certified generic salts.
- **Running Savings Engine**: Tracks instant prescription savings and cumulative patient savings across sessions in local storage.
- **Chemist Dispensing Slip Generator**: 1-click printable/copyable slip requesting exact generic salt substitutions to present to your pharmacist.
- **Context-Aware Medical Copilot**: Grounded conversational chatbot that knows the patient's current regimen and answers dosage, meal-timing, and synergy questions.
- **Multilingual Audio (TTS)**: Built-in voice readout for dosage instructions and chatbot answers.
- **Pure Human Regimen Focus**: No pet or veterinary modes.

---

## 📁 Project Structure

```
medicine-recommender-app/
├── server/
│   ├── server.js                     # Express server & static asset mount
│   ├── package.json
│   ├── .env.example                  # Environment key templates
│   ├── .env                          # Local environment variables
│   ├── data/
│   │   └── drugDatabase.json         # Verified database with active salts & Jan Aushadhi prices
│   ├── services/
│   │   ├── aiService.js              # Multi-provider Vision & Chat engine (Gemini / Claude / OpenAI)
│   │   └── interactionEngine.js      # Salt-based Drug-Drug Interaction & Synergy matrix
│   └── routes/
│       ├── prescription.js           # Unified /analyze, /sample, /chat, & /status API routes
│       ├── alternatives.js           # Salt lookup and generic pricing endpoint
│       ├── interactions.js           # Pairwise interaction check endpoint
│       └── missedDose.js             # Missed dose rule-of-thumb advisor
└── public/
    ├── index.html                    # Modern responsive split-view dashboard & chatbot
    ├── styles.css                    # Emerald & deep teal modern healthcare design system
    └── app.js                        # Frontend client application logic, savings ticker & TTS
```

---

## 🚀 Quick Setup & Free API Key Guide

### 1. Get a 100% Free Google Gemini API Key (Recommended)
1. Go to **[Google AI Studio](https://aistudio.google.com/)**.
2. Sign in with any standard Google account.
3. Click **"Get API key"** -> **"Create API key"**.
4. *No credit card required. Free tier includes up to 15 requests per minute and 1,500 requests per day.*

### 2. Configure Your Environment
Open `server/.env` and paste your key:
```env
GEMINI_API_KEY=AIzaSyYourGeminiKeyHere
GEMINI_MODEL=gemini-1.5-flash
PORT=3000
```
*(Optional: If you prefer Claude or OpenAI, you can set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` instead).*

### 3. Run MedLens
```bash
cd server
npm install
npm start
```

Open **`http://localhost:3000`** in your browser.

> **💡 Instant Demo Mode**: You can click **"⚡ Try Sample"** in the top navigation bar to test the entire prescription extraction, generic savings calculation, interaction matrix, and conversational chatbot immediately without needing to upload an image.
