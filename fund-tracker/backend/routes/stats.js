const express = require('express');
const router = express.Router();
const { load } = require('../db/store');

// GET /api/stats — dashboard summary numbers
router.get('/', (req, res) => {
  const db = load();
  const accountById = (id) => db.accounts.find((a) => a.id === id);

  const totalAccounts = db.accounts.length;
  const muleAccounts = db.accounts.filter((a) => a.status === 'CONFIRMED_MULE').length;
  const underReview = db.accounts.filter((a) => a.status === 'UNDER_REVIEW').length;
  const totalTxns = db.transactions.length;
  const flaggedTxns = db.transactions.filter((t) => t.is_flagged === 1).length;
  const totalFlaggedAmount = db.transactions
    .filter((t) => t.is_flagged === 1)
    .reduce((sum, t) => sum + t.amount, 0);
  const openCases = db.cases.filter((c) => c.status !== 'CLOSED').length;
  const criticalRisk = db.accounts.filter((a) => a.risk_level === 'CRITICAL').length;

  const riskDistribution = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((level) => ({
    risk_level: level,
    count: db.accounts.filter((a) => a.risk_level === level).length,
  }));

  const flagTypeMap = {};
  db.flags.forEach((f) => {
    const key = `${f.flag_type}|${f.severity}`;
    flagTypeMap[key] = (flagTypeMap[key] || 0) + 1;
  });
  const flagTypeBreakdown = Object.entries(flagTypeMap)
    .map(([key, count]) => {
      const [flag_type, severity] = key.split('|');
      return { flag_type, severity, count };
    })
    .sort((a, b) => b.count - a.count);

  const recentFlaggedTxns = db.transactions
    .filter((t) => t.is_flagged === 1)
    .map((t) => ({
      ...t,
      from_name: accountById(t.from_account_id)?.holder_name,
      to_name: accountById(t.to_account_id)?.holder_name,
    }))
    .sort((a, b) => (a.txn_date + a.txn_time < b.txn_date + b.txn_time ? 1 : -1))
    .slice(0, 8);

  res.json({
    totalAccounts,
    muleAccounts,
    underReview,
    totalTxns,
    flaggedTxns,
    totalFlaggedAmount,
    openCases,
    criticalRisk,
    riskDistribution,
    flagTypeBreakdown,
    recentFlaggedTxns,
  });
});

module.exports = router;
