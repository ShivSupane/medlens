require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const prescriptionRoutes = require('./routes/prescription');
const alternativesRoutes = require('./routes/alternatives');
const interactionsRoutes = require('./routes/interactions');
const missedDoseRoutes = require('./routes/missedDose');
const aiService = require('./services/aiService');

const app = express();

app.use(cors());
app.use(express.json());

// Serve the frontend web app
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/prescription', prescriptionRoutes);
app.use('/api/alternatives', alternativesRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/missed-dose', missedDoseRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'MedLens' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const active = aiService.getActiveProvider();
  console.log(`\n======================================================`);
  console.log(`  MedLens Server running at: http://localhost:${PORT}`);
  console.log(`  Active AI Provider: ${active.provider.toUpperCase()} (${active.isFreeTier ? '100% Free Tier' : 'Paid Tier'})`);
  if (active.provider === 'demo') {
    console.log(`  Tip: To scan custom prescription images with AI Vision,`);
    console.log(`       get a free Gemini API key from https://aistudio.google.com/`);
    console.log(`       and paste it into server/.env as GEMINI_API_KEY!`);
  }
  console.log(`======================================================\n`);
});
