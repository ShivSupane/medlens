const express = require('express');
const { checkRegimenInteractions } = require('../services/interactionEngine');
const db = require('../data/drugDatabase.json');

const router = express.Router();

function cleanStr(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveDrugInfo(name) {
  const q = cleanStr(name);
  const found = db.drugs.find((d) => {
    const brand = cleanStr(d.brand);
    if (brand === q || q.includes(brand) || brand.includes(q)) return true;
    return (d.aliases || []).some((a) => {
      const alias = cleanStr(a);
      return alias === q || q.includes(alias) || alias.includes(q);
    });
  });

  if (found) {
    return {
      brand: found.brand,
      salt: found.salt,
      saltNormalized: found.saltNormalized
    };
  }

  return {
    brand: name,
    salt: name,
    saltNormalized: name
  };
}

// POST /api/interactions/check
// Accepts { drugs: ["Brufen 400", "Amlokind 5"] } OR { medicines: [ { brand, salt } ] }
router.post('/check', (req, res) => {
  const { drugs, medicines } = req.body;

  let medList = [];
  if (Array.isArray(medicines) && medicines.length >= 2) {
    medList = medicines;
  } else if (Array.isArray(drugs) && drugs.length >= 2) {
    medList = drugs.map(resolveDrugInfo);
  } else {
    return res.status(400).json({ error: 'Provide at least two medicines to check interactions.' });
  }

  const report = checkRegimenInteractions(medList);
  res.json({
    checkedCount: medList.length,
    ...report
  });
});

module.exports = router;
