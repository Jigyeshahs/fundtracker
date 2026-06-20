const express = require('express');
const router = express.Router();
const { load } = require('../db/store');

// GET /api/cases — list all cases
router.get('/', (req, res) => {
  const db = load();
  const cases = [...db.cases].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json(cases);
});

// GET /api/cases/:id — case detail with linked accounts
router.get('/:id', (req, res) => {
  const db = load();
  const id = Number(req.params.id);
  const caseData = db.cases.find((c) => c.id === id);
  if (!caseData) return res.status(404).json({ error: 'Case not found' });

  const accounts = db.account_case_links
    .filter((l) => l.case_id === id)
    .map((l) => ({ ...db.accounts.find((a) => a.id === l.account_id), role: l.role }));

  res.json({ ...caseData, accounts });
});

module.exports = router;
