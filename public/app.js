// ==========================================================================
// MedLens — Frontend Client Application Logic
// Enhanced with Full-Width Dashboard, Daily Timetable, Rich Meal Guidance,
// and Slide-Out Copilot Drawer.
// ==========================================================================

const API = ''; // Same-origin

// State
let currentRegimenData = null;
let selectedFile = null;
let chatHistory = [];

// Cumulative Savings Storage
const SAVINGS_KEY = 'medlens_cumulative_savings_inr';
function getCumulativeSavings() {
  return Number(localStorage.getItem(SAVINGS_KEY) || 0);
}
function addCumulativeSavings(amount) {
  const current = getCumulativeSavings();
  const updated = current + amount;
  localStorage.setItem(SAVINGS_KEY, String(updated));
  updateSavingsDisplay(0, updated);
}
function resetCumulativeSavings() {
  localStorage.setItem(SAVINGS_KEY, '0');
  updateSavingsDisplay(0, 0);
}

// Theme Elements
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleIcon = document.getElementById('themeToggleIcon');
const themeToggleText = document.getElementById('themeToggleText');

// Navigation Elements
const sampleBtn = document.getElementById('sampleBtn');
const quickSampleLink = document.getElementById('quickSampleLink');
const ttsLangSelect = document.getElementById('ttsLangSelect');

// Scanner Tabs & Modes
const tabPhoto = document.getElementById('tabPhoto');
const tabText = document.getElementById('tabText');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const previewFilename = document.getElementById('previewFilename');
const previewFilesize = document.getElementById('previewFilesize');
const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeBtnText = document.getElementById('analyzeBtnText');
const analyzeSpinner = document.getElementById('analyzeSpinner');
const clearBtn = document.getElementById('clearBtn');
const uploadStatusMsg = document.getElementById('uploadStatusMsg');

// Text Mode Elements
const textInputContainer = document.getElementById('textInputContainer');
const prescriptionTextInput = document.getElementById('prescriptionTextInput');
const analyzeTextBtn = document.getElementById('analyzeTextBtn');
const analyzeTextBtnText = document.getElementById('analyzeTextBtnText');
const analyzeTextSpinner = document.getElementById('analyzeTextSpinner');
const sampleTextBtn = document.getElementById('sampleTextBtn');

// Results Container Elements
const resultsContainer = document.getElementById('resultsContainer');
const instantSavingsVal = document.getElementById('instantSavingsVal');
const brandedCostVal = document.getElementById('brandedCostVal');
const genericCostVal = document.getElementById('genericCostVal');
const monthlySavingsVal = document.getElementById('monthlySavingsVal');
const lifetimeSavingsVal = document.getElementById('lifetimeSavingsVal');
const savingsPercentPill = document.getElementById('savingsPercentPill');
const resetSavingsBtn = document.getElementById('resetSavingsBtn');
const exportCalendarBtn = document.getElementById('exportCalendarBtn');

// Timetable, Synergy & Medicines
const timetableCard = document.getElementById('timetableCard');
const timetableGrid = document.getElementById('timetableGrid');
const synergyCard = document.getElementById('synergyCard');
const synergyText = document.getElementById('synergyText');
const interactionCard = document.getElementById('interactionCard');
const interactionBadge = document.getElementById('interactionBadge');
const interactionList = document.getElementById('interactionList');
const medicinesList = document.getElementById('medicinesList');
const medCountPill = document.getElementById('medCountPill');

// Slide-Out Copilot Drawer Elements
const copilotFab = document.getElementById('copilotFab');
const headerCopilotBtn = document.getElementById('headerCopilotBtn');
const copilotDrawerOverlay = document.getElementById('copilotDrawerOverlay');
const copilotBackdrop = document.getElementById('copilotBackdrop');
const closeCopilotBtn = document.getElementById('closeCopilotBtn');

// Chatbot Internal Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatSuggestions = document.getElementById('chatSuggestions');
const clearChatBtn = document.getElementById('clearChatBtn');
const emergencyAlertBanner = document.getElementById('emergencyAlertBanner');

// Modals
const chemistModal = document.getElementById('chemistModal');
const openChemistSlipBtn = document.getElementById('openChemistSlipBtn');
const closeChemistModal = document.getElementById('closeChemistModal');
const chemistSlipText = document.getElementById('chemistSlipText');
const copySlipBtn = document.getElementById('copySlipBtn');
const printSlipBtn = document.getElementById('printSlipBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateSavingsDisplay(0, getCumulativeSavings());
  setupEventListeners();
});

// ---------- Theme Management ----------
function initTheme() {
  const saved = localStorage.getItem('medlens_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeToggleIcon) themeToggleIcon.textContent = '☀️';
    if (themeToggleText) themeToggleText.textContent = 'Light';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (themeToggleIcon) themeToggleIcon.textContent = '🌙';
    if (themeToggleText) themeToggleText.textContent = 'Dark';
  }
  localStorage.setItem('medlens_theme', theme);
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(isDark ? 'light' : 'dark');
}

// ---------- Drawer Open / Close Functions ----------
function openCopilot() {
  if (!copilotDrawerOverlay) return;
  copilotDrawerOverlay.hidden = false;
  requestAnimationFrame(() => {
    copilotDrawerOverlay.classList.add('open');
  });
}

function closeCopilot() {
  if (!copilotDrawerOverlay) return;
  copilotDrawerOverlay.classList.remove('open');
  setTimeout(() => {
    copilotDrawerOverlay.hidden = true;
  }, 320);
}

// ---------- Event Listeners ----------
function setupEventListeners() {
  // Scanner Mode Tabs
  if (tabPhoto && tabText) {
    tabPhoto.addEventListener('click', () => switchScannerTab('photo'));
    tabText.addEventListener('click', () => switchScannerTab('text'));
  }

  // File Upload
  browseBtn.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', (e) => {
    if (e.target !== quickSampleLink && e.target !== browseBtn) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  clearBtn.addEventListener('click', clearFileSelection);
  analyzeBtn.addEventListener('click', analyzePrescription);

  // Text Mode Actions
  if (analyzeTextBtn) analyzeTextBtn.addEventListener('click', analyzeTextPrescription);
  if (sampleTextBtn) {
    sampleTextBtn.addEventListener('click', () => {
      prescriptionTextInput.value = `Tab. Augmentin 625 Duo 1 tab twice daily after food x 5 days\nTab. Dolo 650 1 tab TDS SOS for fever\nCap. Pantocid 40 1 cap once daily before breakfast (OD AC) x 7 days`;
    });
  }

  // Sample Buttons
  sampleBtn.addEventListener('click', loadSamplePrescription);
  quickSampleLink.addEventListener('click', (e) => {
    e.stopPropagation();
    loadSamplePrescription();
  });

  // Copilot Drawer Toggles
  if (copilotFab) copilotFab.addEventListener('click', openCopilot);
  if (headerCopilotBtn) headerCopilotBtn.addEventListener('click', openCopilot);
  if (closeCopilotBtn) closeCopilotBtn.addEventListener('click', closeCopilot);
  if (copilotBackdrop) copilotBackdrop.addEventListener('click', closeCopilot);

  // Reset Savings
  resetSavingsBtn.addEventListener('click', () => {
    if (confirm('Reset cumulative saved balance to ₹0?')) {
      resetCumulativeSavings();
    }
  });

  // Calendar Export
  if (exportCalendarBtn) {
    exportCalendarBtn.addEventListener('click', exportDosageCalendar);
  }

  // Modal Helpers
  const showModal = (m) => { if (m) { m.hidden = false; m.style.display = 'flex'; } };
  const hideModal = (m) => { if (m) { m.hidden = true; m.style.display = 'none'; } };

  // Chemist Slip Modal
  openChemistSlipBtn.addEventListener('click', () => {
    showChemistSlip();
    showModal(chemistModal);
  });
  closeChemistModal.addEventListener('click', () => hideModal(chemistModal));
  chemistModal.addEventListener('click', (e) => {
    if (e.target === chemistModal) hideModal(chemistModal);
  });

  copySlipBtn.addEventListener('click', copyChemistSlip);
  printSlipBtn.addEventListener('click', () => window.print());

  // Theme Toggle Listener
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Ensure modals start hidden
  hideModal(chemistModal);

  // Chatbot form
  chatForm.addEventListener('submit', handleChatSubmit);
  clearChatBtn.addEventListener('click', clearChat);
  chatSuggestions.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip, .chip-btn');
    if (!btn) return;
    const query = btn.dataset.query;
    if (!query) return;
    chatInput.value = query;
    handleChatSubmit(new Event('submit'));
  });
}

// ---------- Tab Switcher ----------
function switchScannerTab(tab) {
  if (tab === 'photo') {
    tabPhoto.classList.add('active');
    tabText.classList.remove('active');
    dropZone.hidden = false;
    textInputContainer.hidden = true;
    if (selectedFile) previewContainer.hidden = false;
  } else {
    tabText.classList.add('active');
    tabPhoto.classList.remove('active');
    dropZone.hidden = true;
    previewContainer.hidden = true;
    textInputContainer.hidden = false;
  }
}

// ---------- File Handling ----------
function handleFileSelect(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file (PNG, JPG, JPEG).');
    return;
  }

  selectedFile = file;
  previewFilename.textContent = file.name;
  previewFilesize.textContent = `${(file.size / 1024).toFixed(1)} KB · Image ready`;
  previewImage.src = URL.createObjectURL(file);
  previewContainer.hidden = false;
  uploadStatusMsg.textContent = '';
}

function clearFileSelection() {
  selectedFile = null;
  fileInput.value = '';
  previewContainer.hidden = true;
  uploadStatusMsg.textContent = '';
}

// ---------- Analysis Pipeline (Photo) ----------
async function analyzePrescription() {
  if (!selectedFile) return;

  setAnalyzingState(true, 'Digitizing and analyzing clinical prescription…');

  try {
    const formData = new FormData();
    formData.append('prescription', selectedFile);

    const res = await fetch(`${API}/api/prescription/analyze`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to analyze prescription.');
    }

    renderPrescriptionReport(data);
    uploadStatusMsg.innerHTML = `✓ Successfully verified <strong>${data.metrics.totalMedicines}</strong> medicine(s) via <em>${data.providerUsed || 'AI Engine'}</em>.`;
  } catch (err) {
    console.error(err);
    uploadStatusMsg.innerHTML = `<span style="color: #ef4444; font-weight: 500;">⚠️ ${err.message}</span>`;
  } finally {
    setAnalyzingState(false);
  }
}

// ---------- Analysis Pipeline (Text) ----------
async function analyzeTextPrescription() {
  const text = (prescriptionTextInput.value || '').trim();
  if (!text) {
    alert('Please type or paste prescription text first.');
    return;
  }

  setTextAnalyzingState(true, 'Verifying clinical regimen and dosage schedule…');

  try {
    const res = await fetch(`${API}/api/prescription/analyze-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to analyze prescription text.');
    }

    renderPrescriptionReport(data);
    uploadStatusMsg.innerHTML = `✓ Successfully verified <strong>${data.metrics.totalMedicines}</strong> medicine(s) via <em>${data.providerUsed || 'AI Engine'}</em>.`;
  } catch (err) {
    console.error(err);
    uploadStatusMsg.innerHTML = `<span style="color: #ef4444; font-weight: 500;">⚠️ ${err.message}</span>`;
  } finally {
    setTextAnalyzingState(false);
  }
}

async function loadSamplePrescription() {
  setAnalyzingState(true, 'Loading verified sample prescription…');

  try {
    const res = await fetch(`${API}/api/prescription/sample`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load sample.');

    renderPrescriptionReport(data);
    uploadStatusMsg.textContent = `✓ Loaded sample prescription (${data.metrics.totalMedicines} medicines with Jan Aushadhi savings).`;
  } catch (err) {
    console.error(err);
    uploadStatusMsg.textContent = `⚠️ ${err.message}`;
  } finally {
    setAnalyzingState(false);
  }
}

function setAnalyzingState(isAnalyzing, statusText = '') {
  analyzeBtn.disabled = isAnalyzing;
  analyzeSpinner.hidden = !isAnalyzing;
  analyzeBtnText.textContent = isAnalyzing ? 'Analyzing…' : 'Scan with AI Vision';
  if (statusText) uploadStatusMsg.textContent = statusText;
}

function setTextAnalyzingState(isAnalyzing, statusText = '') {
  if (!analyzeTextBtn) return;
  analyzeTextBtn.disabled = isAnalyzing;
  analyzeTextSpinner.hidden = !isAnalyzing;
  analyzeTextBtnText.textContent = isAnalyzing ? 'Analyzing Text…' : 'Analyze Prescription Text';
  if (statusText) uploadStatusMsg.textContent = statusText;
}

// ---------- Render Prescription Intelligence Report ----------
function renderPrescriptionReport(data) {
  currentRegimenData = data;
  resultsContainer.hidden = false;

  // 1. Update Savings
  const metrics = data.metrics;
  instantSavingsVal.textContent = metrics.prescriptionSavingsINR.toLocaleString('en-IN');
  brandedCostVal.textContent = metrics.totalBrandedCost.toLocaleString('en-IN');
  genericCostVal.textContent = metrics.totalGenericCost.toLocaleString('en-IN');
  savingsPercentPill.textContent = `${metrics.savingsPercent}% CHEAPER`;

  // Calculate projected monthly recurring savings
  const monthlySavings = calculateProjectedMonthlySavings(data.medicines, metrics.prescriptionSavingsINR);
  if (monthlySavingsVal) {
    monthlySavingsVal.textContent = monthlySavings.toLocaleString('en-IN');
  }

  // Accumulate savings
  if (metrics.prescriptionSavingsINR > 0) {
    addCumulativeSavings(metrics.prescriptionSavingsINR);
  } else {
    updateSavingsDisplay(0, getCumulativeSavings());
  }

  // 2. Render Daily Dosage Timetable & Pill Tracker
  renderDailyTimetable(data.medicines);

  // 3. Clinical Synergy
  if (data.clinicalSynergy) {
    synergyCard.hidden = false;
    synergyText.textContent = data.clinicalSynergy;
  } else {
    synergyCard.hidden = true;
  }

  // 4. Drug Interactions
  renderInteractions(data.interactions);

  // 5. Medicine Regimen Cards
  renderMedicineCards(data.medicines);

  // 6. Notify Chatbot of New Regimen
  addBotMessage(
    `I've analyzed your prescription! We identified **${data.medicines.length} medicines**. By choosing PMBJP Jan Aushadhi generic substitutes, you can save **₹${metrics.prescriptionSavingsINR} (${metrics.savingsPercent}%)** immediately, with projected monthly recurring savings of **₹${monthlySavings}**!\n\nOpen Copilot anytime to ask about meal timings, what these medicines cure, or dietary cautions.`
  );

  // Scroll smoothly to results
  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Render Daily Dosage Timetable ----------
function renderDailyTimetable(medicines) {
  if (!timetableCard || !timetableGrid) return;
  timetableCard.hidden = false;

  const slots = {
    morning: { title: 'Morning Slot', icon: '🌅', time: '07:00 – 09:00 AM (Breakfast)', meds: [] },
    afternoon: { title: 'Afternoon Slot', icon: '☀️', time: '01:00 – 02:00 PM (Lunch)', meds: [] },
    evening: { title: 'Evening Slot', icon: '🌇', time: '05:00 – 07:00 PM (Snacks)', meds: [] },
    night: { title: 'Bedtime Slot', icon: '🌙', time: '09:00 – 10:30 PM (Dinner / Sleep)', meds: [] },
    asNeeded: { title: 'As Needed (SOS)', icon: '⚡', time: 'Only if Symptoms/Fever occur', meds: [] }
  };

  medicines.forEach((m) => {
    const timeSlots = m.timeSlots || ['morning', 'night'];
    const name = m.brand || m.drugName || m.rawText;
    const doseDesc = `${m.strength ? m.strength + ' · ' : ''}${m.mealTiming || 'With food'}`.trim();

    if (timeSlots.includes('as-needed')) {
      slots.asNeeded.meds.push({ name, dose: doseDesc });
    } else {
      if (timeSlots.includes('morning')) slots.morning.meds.push({ name, dose: doseDesc });
      if (timeSlots.includes('afternoon')) slots.afternoon.meds.push({ name, dose: doseDesc });
      if (timeSlots.includes('evening')) slots.evening.meds.push({ name, dose: doseDesc });
      if (timeSlots.includes('night')) slots.night.meds.push({ name, dose: doseDesc });
    }
  });

  timetableGrid.innerHTML = Object.values(slots)
    .filter((slot) => slot.meds.length > 0)
    .map(
      (slot) => `
      <div class="time-slot-card">
        <div class="time-slot-header">
          <div class="time-slot-title">${slot.icon} ${slot.title}</div>
          <div class="time-slot-time">${slot.time}</div>
        </div>
        <div class="time-slot-meds">
          ${slot.meds
            .map(
              (p) => `
            <div class="slot-pill-item">
              <div class="slot-pill-name">${escapeHtml(p.name)}</div>
              <div class="slot-pill-dose">${escapeHtml(p.dose)}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
    )
    .join('');
}

function calculateProjectedMonthlySavings(medicines, instantSavings) {
  const chronicSalts = [
    'amlodipine',
    'telmisartan',
    'metformin',
    'atorvastatin',
    'aspirin',
    'calcium',
    'pantoprazole'
  ];

  let chronicSavingsMonthly = 0;
  medicines.forEach((m) => {
    const saltNorm = (m.saltNormalized || m.salt || '').toLowerCase();
    const isChronic = chronicSalts.some((c) => saltNorm.includes(c));
    if (isChronic && m.savingsINR > 0) {
      chronicSavingsMonthly += Math.round(m.savingsINR * 2.5);
    }
  });

  return chronicSavingsMonthly > 0 ? chronicSavingsMonthly : Math.round(instantSavings * 1.6);
}

function updateSavingsDisplay(instant, cumulative) {
  lifetimeSavingsVal.textContent = cumulative.toLocaleString('en-IN');
}

// ---------- Render Interactions ----------
function renderInteractions(interactions) {
  if (!interactions || !interactions.results || interactions.results.length === 0) {
    interactionCard.hidden = false;
    interactionBadge.className = 'interaction-badge badge-green';
    interactionBadge.textContent = 'Safe Regimen';
    interactionList.innerHTML = `
      <div class="interaction-item item-green">
        <div class="interaction-item-title">✓ No Adverse Drug-Drug Combinations Flagged</div>
        <div>No high-risk pairwise interactions were detected among these medicines in our verified database. Always double-check with your pharmacist.</div>
      </div>
    `;
    return;
  }

  interactionCard.hidden = false;
  const isHighRisk = interactions.hasHighRisk;
  interactionBadge.className = `interaction-badge ${isHighRisk ? 'badge-red' : 'badge-amber'}`;
  interactionBadge.textContent = isHighRisk ? 'Caution: Alert Flagged' : 'Clinical Precautions';

  interactionList.innerHTML = interactions.results
    .map((item) => {
      const severityClass =
        item.severity === 'Red' ? 'item-red' : item.severity === 'Green' ? 'item-green' : 'item-amber';

      return `
      <div class="interaction-item ${severityClass}">
        <div class="interaction-item-title">
          ${item.severity === 'Red' ? '🚨' : item.severity === 'Green' ? '🌱' : '⚠️'}
          <strong>${escapeHtml(item.drugA)}</strong> + <strong>${escapeHtml(item.drugB)}</strong>: ${escapeHtml(item.title)}
        </div>
        <div>${escapeHtml(item.description)}</div>
        <div class="interaction-item-action">👉 <strong>Pharmacist Advice:</strong> ${escapeHtml(item.action)}</div>
      </div>
    `;
    })
    .join('');
}

// ---------- Render Medicine Cards with Rich Addons ----------
function renderMedicineCards(medicines) {
  medicinesList.innerHTML = '';
  medCountPill.textContent = `${medicines.length} Medicine${medicines.length > 1 ? 's' : ''}`;

  medicines.forEach((med) => {
    const card = document.createElement('div');
    card.className = 'med-card';

    if (!med.isVerified) {
      card.innerHTML = `
        <div class="med-main-info">
          <div class="med-header-row">
            <div class="med-brand-name">${escapeHtml(med.drugName || med.rawText)}</div>
            <span class="med-strength-tag" style="background:var(--gold-50); color:var(--gold-500); border:1px solid rgba(217,119,6,0.3);">Pharmacist Verification</span>
          </div>
          <p style="color:var(--text-muted); font-size:13px; line-height:1.5;">${escapeHtml(med.message || 'Prescription item recognized. Please confirm the active chemical salt with your pharmacist.')}</p>
        </div>
        <div class="med-alt-box" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:8px;">
          <p style="font-size:13px; color:var(--text-muted)">Show this item to your dispensing chemist to identify generic salt.</p>
          <button class="btn btn-sm btn-accent ask-med-btn" data-med="${escapeAttr(med.drugName || med.rawText)}">
            💬 Ask Copilot
          </button>
        </div>
      `;
      medicinesList.appendChild(card);
      return;
    }

    const precautionsHtml = (med.precautions || [])
      .map((p) => `<li>${escapeHtml(p)}</li>`)
      .join('');

    const alt = med.bestAlternative;
    const altHtml = alt
      ? `
      <div class="med-alt-box">
        <div>
          <div class="alt-eyebrow">${alt.isJanAushadhi ? '⭐ PMBJP JAN AUSHADHI GENERIC' : 'CERTIFIED GENERIC EQUIVALENT'}</div>
          <div class="alt-name">${escapeHtml(alt.brand)}</div>
          <div class="alt-manufacturer">Mfr: ${escapeHtml(alt.manufacturer)}</div>
          
          <div class="alt-price-row">
            <div>
              <span class="alt-price-val">₹${alt.priceINR}</span>
              <span style="font-size:12px; color:var(--text-soft)"> / strip</span>
            </div>
            <span class="alt-save-badge">Save ₹${med.savingsINR} (${med.savingsPercent}% off)</span>
          </div>
        </div>

        <div class="alt-actions-row">
          <button class="btn btn-sm btn-outline-med speak-btn" data-text="${escapeAttr(buildMedSpeechText(med))}">
            🔊 Listen
          </button>
          <button class="btn btn-sm btn-accent ask-med-btn" data-med="${escapeAttr(med.brand)}">
            💬 Ask Copilot
          </button>
        </div>
      </div>
    `
      : `<div class="med-alt-box"><p style="color:var(--text-soft)">No cheaper generic listed.</p></div>`;

    card.innerHTML = `
      <div class="med-main-info">
        <div class="med-header-row">
          <div class="med-brand-name">
            ${escapeHtml(med.brand)}
            <span class="med-strength-tag">${escapeHtml(med.strength)}</span>
          </div>
          <span class="med-condition-pill">${escapeHtml(med.class || 'Prescription Drug')}</span>
        </div>

        <div class="med-salt-line">
          <strong>Active Salt:</strong> ${escapeHtml(med.salt)}
        </div>

        <div class="med-dosage-block">
          <span class="med-timing-label">Dose & Frequency:</span> ${escapeHtml(med.frequency)}<br>
          <span class="med-timing-label">Timing:</span> ${escapeHtml(med.foodInstructions)}
        </div>

        <!-- NEW: Why to Take (Clinical Reason) -->
        <div class="med-why-box">
          <div class="med-why-title">🩺 Why to Take (Clinical Purpose)</div>
          <div class="med-why-desc">${escapeHtml(med.whyToTake || med.conditionHint || 'Prescribed for healing and recovery.')}</div>
        </div>

        <!-- NEW: Best Meal & Dietary Guidance -->
        <div class="med-meal-box">
          <div class="med-meal-timing-row">
            <span class="med-meal-timing-pill">🍽️ ${escapeHtml(med.mealTiming || 'With Meals')}</span>
            <span style="font-size:12px; font-weight:600; color:var(--text-soft);">Dietary Guidance</span>
          </div>
          <div class="meal-guidance-line">
            <strong>🥣 Best Meals to Pair With:</strong> ${escapeHtml(med.bestMeals || 'Take with water and light nutritious meals.')}
          </div>
          <div class="meal-avoid-line">
            <strong>🚫 Foods to Avoid:</strong> ${escapeHtml(med.foodsToAvoid || 'Avoid alcohol while taking medication.')}
          </div>
        </div>

        <div>
          <strong style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Key Precautions:</strong>
          <ul class="med-precautions-list">
            ${precautionsHtml}
          </ul>
        </div>
      </div>

      ${altHtml}
    `;

    medicinesList.appendChild(card);
  });

  // Attach button events
  document.querySelectorAll('.speak-btn').forEach((btn) => {
    btn.addEventListener('click', () => speak(btn.dataset.text));
  });

  document.querySelectorAll('.ask-med-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const medName = btn.dataset.med;
      chatInput.value = `Tell me more about ${medName}: what best meals should I eat with it, and what side effects to watch for?`;
      openCopilot();
      handleChatSubmit(new Event('submit'));
    });
  });
}

function buildMedSpeechText(med) {
  return `${med.brand}, containing active ingredient ${med.salt}. Purpose: ${med.whyToTake || med.conditionHint}. Dosage: ${med.frequency}. Meal timing: ${med.mealTiming || med.foodInstructions}. Best meals: ${med.bestMeals || ''}.`;
}

// Multilingual TTS Speech Engine
function speak(text) {
  if (!('speechSynthesis' in window)) {
    alert('Audio speech is not supported in this browser.');
    return;
  }
  window.speechSynthesis.cancel();

  const selectedLang = ttsLangSelect ? ttsLangSelect.value : 'en-IN';
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = selectedLang;
  utter.rate = 0.92;

  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find((v) => v.lang.startsWith(selectedLang.slice(0, 2)));
  if (matchedVoice) utter.voice = matchedVoice;

  window.speechSynthesis.speak(utter);
}

// ---------- One-Click Calendar Export (.ics) ----------
function exportDosageCalendar() {
  if (!currentRegimenData || !currentRegimenData.medicines) {
    alert('Please scan or load a prescription first!');
    return;
  }

  const now = new Date();
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MedLens Healthcare//Prescription Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  const formatICSDate = (date) =>
    date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  currentRegimenData.medicines.forEach((med, idx) => {
    if (!med.isVerified) return;

    const start = new Date(now.getTime() + (idx * 30 + 60) * 60000);
    const end = new Date(start.getTime() + 15 * 60000);

    icsContent.push(
      'BEGIN:VEVENT',
      `UID:medlens-${Date.now()}-${idx}@medlens.local`,
      `DTSTAMP:${formatICSDate(now)}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:💊 Take ${med.brand} (${med.strength || ''})`,
      `DESCRIPTION:Active Salt: ${med.salt}\\nDosage: ${med.frequency}\\nTiming: ${med.mealTiming || med.foodInstructions}\\nBest Meals: ${med.bestMeals || ''}`,
      'RRULE:FREQ=DAILY;COUNT=7',
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      `DESCRIPTION:Reminder: Time to take ${med.brand}`,
      'END:VALARM',
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');

  const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MedLens_Dosage_Schedule_${now.toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Chemist Dispensing Slip ----------
function showChemistSlip() {
  if (!currentRegimenData || !currentRegimenData.medicines) return;

  const lines = [
    '==================================================',
    '       MEDLENS GENERIC DISPENSING REQUEST        ',
    '==================================================',
    `Date: ${new Date().toLocaleDateString('en-IN')}`,
    'To the Dispensing Pharmacist:',
    'Please dispense affordable PMBJP Jan Aushadhi or certified',
    'bioequivalent generic formulations for the following salts:\n'
  ];

  currentRegimenData.medicines.forEach((m, idx) => {
    lines.push(`${idx + 1}. PRESCRIPTION: ${m.brand || m.drugName} (${m.strength || ''})`);
    lines.push(`   ACTIVE SALT : ${m.salt || m.rawText}`);
    if (m.bestAlternative) {
      lines.push(`   SUGGESTED GENERIC: ${m.bestAlternative.brand} (${m.bestAlternative.manufacturer})`);
      lines.push(`   TARGET PRICE: ~₹${m.bestAlternative.priceINR} (Branded MRP was ₹${m.priceINR})`);
    }
    lines.push(`   DOSAGE TIMING: ${m.frequency || 'As advised'}\n`);
  });

  lines.push('--------------------------------------------------');
  lines.push(`Total Branded Cost : ₹${currentRegimenData.metrics.totalBrandedCost}`);
  lines.push(`Total Generic Cost : ₹${currentRegimenData.metrics.totalGenericCost}`);
  lines.push(`Total Patient Savings: ₹${currentRegimenData.metrics.prescriptionSavingsINR} (${currentRegimenData.metrics.savingsPercent}% Saved)`);
  lines.push('==================================================');

  chemistSlipText.textContent = lines.join('\n');
  chemistModal.hidden = false;
  chemistModal.style.display = 'flex';
}

function copyChemistSlip() {
  navigator.clipboard.writeText(chemistSlipText.textContent).then(() => {
    const orig = copySlipBtn.textContent;
    copySlipBtn.textContent = '✓ Copied to Clipboard!';
    setTimeout(() => (copySlipBtn.textContent = orig), 2000);
  });
}

// ---------- Chatbot Logic ----------
async function handleChatSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;

  // Emergency check on frontend
  const isEmergency = /chest pain|heart attack|breathless|short of breath|anaphylaxis|throat closing|unconscious/i.test(
    msg
  );
  if (emergencyAlertBanner) {
    emergencyAlertBanner.hidden = !isEmergency;
  }

  addUserMessage(msg);
  chatInput.value = '';

  const typingId = addTypingIndicator();

  try {
    const res = await fetch(`${API}/api/prescription/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        currentPrescription: currentRegimenData,
        chatHistory: chatHistory.slice(-6)
      })
    });

    const data = await res.json();
    removeTypingIndicator(typingId);

    if (data.reply) {
      addBotMessage(data.reply);
      chatHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: data.reply });
    } else {
      addBotMessage('I could not process that request right now. Please try again.');
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    addBotMessage('Sorry, I encountered an issue connecting to the MedLens server.');
  }
}

function addUserMessage(text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg user';
  msgEl.innerHTML = `
    <div class="msg-bubble">${escapeHtml(text)}</div>
    <p class="msg-meta">You · Just now</p>
  `;
  chatMessages.appendChild(msgEl);
  scrollChatToBottom();
}

function addBotMessage(markdownText) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg bot';

  const html = formatMarkdownToHtml(markdownText);

  msgEl.innerHTML = `
    <div class="msg-bubble">${html}</div>
    <p class="msg-meta" style="display:flex; justify-content:space-between; align-items:center;">
      <span>MedLens Copilot</span>
      <button class="btn btn-ghost-sm speak-chat-btn" style="font-size:11px;padding:3px 8px;" title="Listen to answer">🔊</button>
    </p>
  `;

  chatMessages.appendChild(msgEl);
  scrollChatToBottom();

  const speakBtn = msgEl.querySelector('.speak-chat-btn');
  if (speakBtn) {
    speakBtn.addEventListener('click', () => {
      const cleanAudioText = markdownText.replace(/[*#_`]/g, '');
      speak(cleanAudioText);
    });
  }
}

function addTypingIndicator() {
  const id = `typing-${Date.now()}`;
  const el = document.createElement('div');
  el.id = id;
  el.className = 'chat-msg bot';
  el.innerHTML = `
    <div class="msg-bubble" style="color:var(--txt-soft); font-style:italic;">
      MedLens is reviewing your prescription…
    </div>
  `;
  chatMessages.appendChild(el);
  scrollChatToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function clearChat() {
  chatMessages.innerHTML = `
    <div class="chat-msg bot">
      <div class="msg-bubble">Chat cleared. How can I help with your prescription?</div>
      <p class="msg-meta">Just now</p>
    </div>
  `;
  chatHistory = [];
  if (emergencyAlertBanner) emergencyAlertBanner.hidden = true;
}

function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Markdown formatter helper
function formatMarkdownToHtml(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(?:^|\n)- (.*?)(?=\n|$)/g, '<br>• $1');
  out = out.replace(/(?:^|\n)\d+\. (.*?)(?=\n|$)/g, '<br><strong>$&</strong>');
  out = out.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  return out;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
