const express = require('express');
const router = express.Router();
const { load } = require('../db/store');

// GET /api/accounts — list all accounts, with optional filters
router.get('/', (req, res) => {
  const db = load();
  const { status, risk_level, search } = req.query;

  let results = db.accounts;

  if (status) results = results.filter((a) => a.status === status);
  if (risk_level) results = results.filter((a) => a.risk_level === risk_level);
  if (search) {
    const s = search.toLowerCase();
    results = results.filter(
      (a) => a.holder_name.toLowerCase().includes(s) || a.account_number.toLowerCase().includes(s)
    );
  }

  results = [...results].sort((a, b) => b.risk_score - a.risk_score);
  res.json(results);
});

// GET /api/accounts/:id — full detail for one account, including flags and transactions
router.get('/:id', (req, res) => {
  const db = load();
  const id = Number(req.params.id);
  const account = db.accounts.find((a) => a.id === id);

  if (!account) return res.status(404).json({ error: 'Account not found' });

  const flags = db.flags
    .filter((f) => f.account_id === id)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const accountById = (aid) => db.accounts.find((a) => a.id === aid);

  const sent = db.transactions
    .filter((t) => t.from_account_id === id)
    .map((t) => ({
      ...t,
      counterparty_name: accountById(t.to_account_id)?.holder_name,
      counterparty_account: accountById(t.to_account_id)?.account_number,
    }))
    .sort((a, b) => (a.txn_date + a.txn_time < b.txn_date + b.txn_time ? 1 : -1));

  const received = db.transactions
    .filter((t) => t.to_account_id === id)
    .map((t) => ({
      ...t,
      counterparty_name: accountById(t.from_account_id)?.holder_name,
      counterparty_account: accountById(t.from_account_id)?.account_number,
    }))
    .sort((a, b) => (a.txn_date + a.txn_time < b.txn_date + b.txn_time ? 1 : -1));

  const cases = db.account_case_links
    .filter((l) => l.account_id === id)
    .map((l) => ({ ...db.cases.find((c) => c.id === l.case_id), role: l.role }));

  res.json({ ...account, flags, transactions_sent: sent, transactions_received: received, cases });
});

function severityRank(s) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[s] || 0;
}

module.exports = router;
