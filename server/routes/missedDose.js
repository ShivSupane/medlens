const express = require('express');

const router = express.Router();

// POST { scheduledTime: "14:00", currentTime: "18:00", frequencyHours: 8 }
// Deliberately generic and conservative — this gives a standard rule of thumb,
// not per-drug dosing logic, and always defers to a professional for anything
// narrow-therapeutic-index (blood thinners, insulin, seizure meds, etc).
router.post('/advise', (req, res) => {
  const { scheduledTime, currentTime, frequencyHours } = req.body;
  if (!scheduledTime || !currentTime || !frequencyHours) {
    return res.status(400).json({ error: 'scheduledTime, currentTime, and frequencyHours are required.' });
  }

  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  let diffMinutes = toMinutes(currentTime) - toMinutes(scheduledTime);
  if (diffMinutes < 0) diffMinutes += 24 * 60;

  const halfWindowMinutes = (frequencyHours * 60) / 2;
  const withinSafeWindow = diffMinutes <= halfWindowMinutes;

  res.json({
    minutesLate: diffMinutes,
    recommendation: withinSafeWindow
      ? 'Generally OK to take the missed dose now, then continue the normal schedule.'
      : "Generally better to skip the missed dose and take the next one at its normal time — don't double up.",
    importantException:
      'This is a general rule of thumb only. For blood thinners, insulin, seizure medicine, or anything your doctor specifically flagged, follow their instructions or the leaflet instead of this generic rule.',
    disclaimer: 'Not medical advice. When unsure, call your pharmacist.'
  });
});

module.exports = router;
