const express = require('express');
const router = express.Router();
const { load } = require('../db/store');

// GET /api/transactions — list transactions with optional filters
router.get('/', (req, res) => {
  const db = load();
  const { flagged_only, min_amount, channel } = req.query;
  const accountById = (id) => db.accounts.find((a) => a.id === id);

  let results = db.transactions.map((t) => ({
    ...t,
    from_name: accountById(t.from_account_id)?.holder_name,
    from_account_number: accountById(t.from_account_id)?.account_number,
    to_name: accountById(t.to_account_id)?.holder_name,
    to_account_number: accountById(t.to_account_id)?.account_number,
  }));

  if (flagged_only === 'true') results = results.filter((t) => t.is_flagged === 1);
  if (min_amount) results = results.filter((t) => t.amount >= Number(min_amount));
  if (channel) results = results.filter((t) => t.channel === channel);

  results.sort((a, b) => (a.txn_date + a.txn_time < b.txn_date + b.txn_time ? 1 : -1));
  res.json(results.slice(0, 500));
});

// GET /api/transactions/graph — full graph data (nodes + edges) for visualization
router.get('/graph', (req, res) => {
  const db = load();

  const nodes = db.accounts.map((a) => ({
    id: a.id,
    label: a.holder_name,
    account_number: a.account_number,
    bank_name: a.bank_name,
    risk_score: a.risk_score,
    risk_level: a.risk_level,
    status: a.status,
    type: a.account_type,
  }));

  const edges = db.transactions.map((t) => ({
    id: t.id,
    source: t.from_account_id,
    target: t.to_account_id,
    amount: t.amount,
    date: t.txn_date,
    time: t.txn_time,
    channel: t.channel,
    flagged: !!t.is_flagged,
    reason: t.flag_reason,
  }));

  res.json({ nodes, edges });
});

// GET /api/transactions/graph/:accountId — subgraph centered on one account (trace mode)
router.get('/graph/:accountId', (req, res) => {
  const db = load();
  const depth = Math.min(Number(req.query.depth) || 2, 4);
  const rootId = Number(req.params.accountId);

  const visited = new Set([rootId]);
  let frontier = [rootId];

  for (let d = 0; d < depth; d++) {
    if (frontier.length === 0) break;
    const connected = db.transactions.filter(
      (t) => frontier.includes(t.from_account_id) || frontier.includes(t.to_account_id)
    );
    const next = [];
    connected.forEach((t) => {
      if (!visited.has(t.from_account_id)) { visited.add(t.from_account_id); next.push(t.from_account_id); }
      if (!visited.has(t.to_account_id)) { visited.add(t.to_account_id); next.push(t.to_account_id); }
    });
    frontier = next;
  }

  const nodes = db.accounts
    .filter((a) => visited.has(a.id))
    .map((a) => ({
      id: a.id,
      label: a.holder_name,
      account_number: a.account_number,
      bank_name: a.bank_name,
      risk_score: a.risk_score,
      risk_level: a.risk_level,
      status: a.status,
      type: a.account_type,
      is_root: a.id === rootId,
    }));

  const edges = db.transactions
    .filter((t) => visited.has(t.from_account_id) && visited.has(t.to_account_id))
    .map((t) => ({
      id: t.id,
      source: t.from_account_id,
      target: t.to_account_id,
      amount: t.amount,
      date: t.txn_date,
      time: t.txn_time,
      channel: t.channel,
      flagged: !!t.is_flagged,
      reason: t.flag_reason,
    }));

  res.json({ nodes, edges, root_id: rootId });
});

module.exports = router;
