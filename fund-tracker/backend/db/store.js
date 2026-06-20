/**
 * Lightweight JSON-file-backed data store.
 *
 * Why not a real database? This project is built for demo/pitch purposes on
 * pre-loaded synthetic data (per project scope). A flat JSON store keeps the
 * setup to "npm install && npm start" with zero native build dependencies —
 * which matters because better-sqlite3 / similar packages require a C++
 * toolchain that isn't guaranteed on every reviewer's machine.
 *
 * Swapping this for SQLite/Postgres later only requires rewriting this file —
 * every route consumes the same db.accounts / db.transactions / etc. arrays,
 * so the rest of the codebase does not need to change.
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DATA_PATH)) {
    return { accounts: [], transactions: [], flags: [], cases: [], account_case_links: [], _nextId: {} };
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function nextId(data, table) {
  if (!data._nextId) data._nextId = {};
  data._nextId[table] = (data._nextId[table] || 0) + 1;
  return data._nextId[table];
}

module.exports = { load, save, nextId, DATA_PATH };
