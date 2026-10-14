const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const prescriptionRoutes = require('./routes/prescription');
const alternativesRoutes = require('./routes/alternatives');
const interactionsRoutes = require('./routes/interactions');
const missedDoseRoutes = require('./routes/missedDose');
const aiService = require('./services/aiService');

const app = express();

// CORS Configuration: In production, enforce origin whitelisting or same-origin.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. same-origin static frontend, curl, mobile apps, health checks)
      if (!origin) return callback(null, true);

      // In development / testing, allow all origins (localhost, dev ports, etc.)
      if (!isProduction) {
        return callback(null, true);
      }

      // In production, check against configured origins whitelist
      if (allowedOrigins.length > 0 && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
        return callback(null, true);
      }

      // If no origins configured in production, restrict to same-origin only
      if (allowedOrigins.length === 0) {
        return callback(new Error(`CORS blocked: Origin ${origin} not permitted in production without ALLOWED_ORIGINS configured.`));
      }

      return callback(new Error(`CORS blocked: Origin ${origin} not permitted.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json());

// Serve the frontend web app
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/prescription', prescriptionRoutes);
app.use('/api/alternatives', alternativesRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/missed-dose', missedDoseRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'MedLens' }));

// Global error handler for Multer file size limits and CORS errors
app.use((err, req, res, next) => {
  if (err && err.message && err.message.startsWith('CORS blocked:')) {
    return res.status(403).json({ error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Uploaded prescription file exceeds the maximum 10MB limit.' });
  }
  if (err) {
    console.error('Unhandled request error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
  }
  next();
});

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
