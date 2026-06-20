/**
 * Seed script — builds a realistic simulated fraud scenario for demo purposes.
 *
 * Scenario: A victim is phished out of funds. Money is rapidly layered through
 * a chain of intermediary accounts (to break the audit trail), then fans out
 * into multiple mule accounts which cash out via ATM/UPI to merchant accounts.
 * A second scenario shows a fan-in pattern (multiple victims -> one mule).
 *
 * THIS IS SYNTHETIC DATA. No real persons, accounts, or banks are represented.
 */
const { save, nextId } = require('../db/store');

const data = {
  accounts: [],
  transactions: [],
  flags: [],
  cases: [],
  account_case_links: [],
  _nextId: {},
};

const BANKS = [
  { name: 'State Bank of India', ifsc: 'SBIN0001234' },
  { name: 'HDFC Bank', ifsc: 'HDFC0002345' },
  { name: 'ICICI Bank', ifsc: 'ICIC0003456' },
  { name: 'Punjab National Bank', ifsc: 'PUNB0004567' },
  { name: 'Axis Bank', ifsc: 'UTIB0005678' },
  { name: 'Bank of Baroda', ifsc: 'BARB0006789' },
  { name: 'Kotak Mahindra Bank', ifsc: 'KKBK0007890' },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function timeStr(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

let accCounter = 0;
function makeAccount({ name, type = 'Savings', status = 'ACTIVE', notes = null, openedDaysAgo = 1200, address = 'N/A' }) {
  accCounter++;
  const bank = BANKS[accCounter % BANKS.length];
  const id = nextId(data, 'accounts');
  const acc = {
    id,
    account_number: `XXXX${String(100000000 + accCounter * 137).slice(-9)}`,
    holder_name: name,
    bank_name: bank.name,
    ifsc: bank.ifsc,
    account_type: type,
    phone: `9${String(800000000 + accCounter * 911).slice(0, 9)}`,
    address,
    opened_date: daysAgo(openedDaysAgo),
    risk_score: 0,
    risk_level: 'LOW',
    status,
    notes,
    created_at: new Date().toISOString(),
  };
  data.accounts.push(acc);
  return acc;
}

let txnCounter = 1000;
function makeTxn({ from, to, amount, date, time, channel = 'IMPS', desc = '', flagged = false, reason = null }) {
  txnCounter++;
  const txn = {
    id: nextId(data, 'transactions'),
    txn_ref: `TXN${txnCounter}${Math.floor(Math.random() * 900 + 100)}`,
    from_account_id: from.id,
    to_account_id: to.id,
    amount,
    txn_date: date,
    txn_time: time,
    channel,
    description: desc,
    is_flagged: flagged ? 1 : 0,
    flag_reason: reason,
  };
  data.transactions.push(txn);
  return txn;
}

function makeFlag(f) {
  data.flags.push({ id: nextId(data, 'flags'), detected_at: new Date().toISOString(), ...f });
}

function makeCase(c) {
  const id = nextId(data, 'cases');
  const rec = { id, created_at: new Date().toISOString(), ...c };
  data.cases.push(rec);
  return rec;
}

function linkAccountToCase(caseId, accountId, role) {
  data.account_case_links.push({ id: nextId(data, 'account_case_links'), case_id: caseId, account_id: accountId, role });
}

// ---------------------------------------------------------------------
// SCENARIO 1: Phishing victim -> layering chain -> fan-out mule cluster
// ---------------------------------------------------------------------

const victim1 = makeAccount({ name: 'Rajesh Kumar Sharma', openedDaysAgo: 2400, address: 'Sector 14, Gurugram, Haryana' });

const layer1a = makeAccount({ name: 'Vikram Singh Rathore', openedDaysAgo: 45, status: 'UNDER_REVIEW', notes: 'Account opened recently, sudden high-value inflow' });
const layer1b = makeAccount({ name: 'Sunita Devi Patel', openedDaysAgo: 38, status: 'UNDER_REVIEW', notes: 'Minimal prior activity before incident' });

const mule1 = makeAccount({ name: 'Mohammed Iqbal Ansari', openedDaysAgo: 22, status: 'CONFIRMED_MULE', notes: 'Identity documents flagged as potentially fabricated; account holder untraceable at registered address' });
const mule2 = makeAccount({ name: 'Pooja Rani Verma', openedDaysAgo: 19, status: 'CONFIRMED_MULE', notes: 'Multiple unrelated fraud complaints link to this account' });
const mule3 = makeAccount({ name: 'Arvind Kumar Yadav', openedDaysAgo: 15, status: 'CONFIRMED_MULE', notes: 'Account holder reported as deceased two years prior to account opening — suspected identity theft' });

const cashout1 = makeAccount({ name: 'QuickPay Mobile Recharge Store', type: 'Current', openedDaysAgo: 900, status: 'UNDER_REVIEW', notes: 'Small merchant account receiving disproportionate fund volume' });
const cashout2 = makeAccount({ name: 'Sharma General Store', type: 'Current', openedDaysAgo: 800 });
const atmExit = makeAccount({ name: 'Cash Withdrawal — ATM Network', type: 'Cash-Out', openedDaysAgo: 9999, notes: 'Aggregated cash withdrawal point' });

makeTxn({ from: victim1, to: layer1a, amount: 480000, date: daysAgo(6), time: timeStr(11, 42), channel: 'IMPS', desc: 'Unauthorized transfer', flagged: true, reason: 'Victim-reported unauthorized transaction' });
makeTxn({ from: layer1a, to: layer1b, amount: 475000, date: daysAgo(6), time: timeStr(11, 58), channel: 'IMPS', desc: 'Fund transfer', flagged: true, reason: 'Same-day pass-through, <20 min holding time' });

makeTxn({ from: layer1b, to: mule1, amount: 158000, date: daysAgo(6), time: timeStr(12, 5), channel: 'IMPS', flagged: true, reason: 'Fan-out distribution, sub-threshold amount' });
makeTxn({ from: layer1b, to: mule2, amount: 160000, date: daysAgo(6), time: timeStr(12, 7), channel: 'IMPS', flagged: true, reason: 'Fan-out distribution, sub-threshold amount' });
makeTxn({ from: layer1b, to: mule3, amount: 157000, date: daysAgo(6), time: timeStr(12, 9), channel: 'IMPS', flagged: true, reason: 'Fan-out distribution, sub-threshold amount' });

makeTxn({ from: mule1, to: cashout1, amount: 150000, date: daysAgo(6), time: timeStr(14, 20), channel: 'UPI', flagged: true, reason: 'Rapid cash-out via low-volume merchant account' });
makeTxn({ from: mule1, to: atmExit, amount: 7500, date: daysAgo(6), time: timeStr(15, 0), channel: 'IMPS' });

makeTxn({ from: mule2, to: cashout2, amount: 100000, date: daysAgo(5), time: timeStr(10, 15), channel: 'UPI', flagged: true, reason: 'Rapid cash-out via low-volume merchant account' });
makeTxn({ from: mule2, to: atmExit, amount: 58000, date: daysAgo(5), time: timeStr(10, 45), channel: 'IMPS' });

makeTxn({ from: mule3, to: atmExit, amount: 155000, date: daysAgo(5), time: timeStr(9, 30), channel: 'IMPS', flagged: true, reason: 'Full balance withdrawn within 24 hours of receipt' });

// ---------------------------------------------------------------------
// SCENARIO 2: Investment scam — multiple victims fan IN to one mule
// ---------------------------------------------------------------------

const victim2 = makeAccount({ name: 'Anita Desai', openedDaysAgo: 1800, address: 'Andheri West, Mumbai' });
const victim3 = makeAccount({ name: 'Suresh Babu Reddy', openedDaysAgo: 2100, address: 'Banjara Hills, Hyderabad' });
const victim4 = makeAccount({ name: 'Kavita Joshi', openedDaysAgo: 1500, address: 'Kothrud, Pune' });

const fanInMule = makeAccount({ name: 'Deepak Chauhan', openedDaysAgo: 30, status: 'CONFIRMED_MULE', notes: 'Receives funds from multiple unrelated individuals — classic fan-in mule signature. Linked to fraudulent investment scheme advertised on social media.' });
const finalDest = makeAccount({ name: 'Unidentified Beneficiary Account (Overseas Routing Suspected)', type: 'Current', openedDaysAgo: 60, status: 'CONFIRMED_MULE', notes: 'Final aggregation point before suspected international wire-out. Subject of separate cross-border inquiry.' });

makeTxn({ from: victim2, to: fanInMule, amount: 220000, date: daysAgo(12), time: timeStr(16, 10), channel: 'NEFT', desc: 'Investment scheme deposit', flagged: true, reason: 'Victim complaint — fraudulent investment scheme' });
makeTxn({ from: victim3, to: fanInMule, amount: 340000, date: daysAgo(11), time: timeStr(13, 25), channel: 'NEFT', desc: 'Investment scheme deposit', flagged: true, reason: 'Victim complaint — fraudulent investment scheme' });
makeTxn({ from: victim4, to: fanInMule, amount: 175000, date: daysAgo(9), time: timeStr(18, 40), channel: 'NEFT', desc: 'Investment scheme deposit', flagged: true, reason: 'Victim complaint — fraudulent investment scheme' });

makeTxn({ from: fanInMule, to: finalDest, amount: 700000, date: daysAgo(8), time: timeStr(19, 5), channel: 'RTGS', flagged: true, reason: 'Aggregated fan-in funds consolidated and moved in single large transfer' });

// ---------------------------------------------------------------------
// SCENARIO 3: Clean/normal accounts for contrast
// ---------------------------------------------------------------------

const normal1 = makeAccount({ name: 'Priya Mehta', openedDaysAgo: 1900, address: 'Koramangala, Bengaluru' });
const normal2 = makeAccount({ name: 'Sanjay Gupta', openedDaysAgo: 2600, address: 'Salt Lake, Kolkata' });
const normal3 = makeAccount({ name: 'Lakshmi Narayanan', openedDaysAgo: 3100, address: 'T. Nagar, Chennai' });

for (let i = 0; i < 6; i++) {
  const pair = [
    [normal1, normal2],
    [normal2, normal3],
    [normal3, normal1],
  ][i % 3];
  makeTxn({
    from: pair[0],
    to: pair[1],
    amount: Math.floor(Math.random() * 8000 + 500),
    date: daysAgo(Math.floor(Math.random() * 60 + 1)),
    time: timeStr(Math.floor(Math.random() * 10 + 9), Math.floor(Math.random() * 59)),
    channel: ['UPI', 'IMPS', 'NEFT'][i % 3],
    desc: 'Routine transfer',
  });
}

// ---------------------------------------------------------------------
// FLAGS
// ---------------------------------------------------------------------

[
  { account_id: layer1a.id, flag_type: 'RAPID_PASSTHROUGH', severity: 'HIGH', description: 'Funds received and forwarded within 20 minutes of receipt' },
  { account_id: layer1b.id, flag_type: 'FAN_OUT', severity: 'HIGH', description: 'Single large inflow split into 3 outgoing transfers within minutes' },
  { account_id: layer1b.id, flag_type: 'STRUCTURING', severity: 'MEDIUM', description: 'Outgoing amounts kept just under common reporting thresholds' },
  { account_id: mule1.id, flag_type: 'NEW_ACCOUNT_HIGH_VOLUME', severity: 'CRITICAL', description: 'Account opened 22 days ago; received funds far exceeding declared income profile' },
  { account_id: mule1.id, flag_type: 'IDENTITY_MISMATCH', severity: 'CRITICAL', description: 'KYC documents flagged as potentially fabricated' },
  { account_id: mule2.id, flag_type: 'NEW_ACCOUNT_HIGH_VOLUME', severity: 'CRITICAL', description: 'Account opened 19 days ago; immediate high-value activity' },
  { account_id: mule2.id, flag_type: 'LINKED_COMPLAINTS', severity: 'HIGH', description: 'Account number appears in 2 other unrelated cybercrime complaints' },
  { account_id: mule3.id, flag_type: 'DECEASED_HOLDER', severity: 'CRITICAL', description: 'Registered account holder reported deceased prior to account opening date — strong indicator of identity theft' },
  { account_id: cashout1.id, flag_type: 'DISPROPORTIONATE_VOLUME', severity: 'MEDIUM', description: 'Transaction volume inconsistent with declared business scale' },
  { account_id: fanInMule.id, flag_type: 'FAN_IN', severity: 'CRITICAL', description: 'Receives funds from multiple unrelated individuals with no apparent legitimate business relationship' },
  { account_id: fanInMule.id, flag_type: 'NEW_ACCOUNT_HIGH_VOLUME', severity: 'HIGH', description: 'Account opened 30 days ago; cumulative inflow exceeds ₹7,00,000 within 2 weeks' },
  { account_id: finalDest.id, flag_type: 'CROSS_BORDER_RISK', severity: 'CRITICAL', description: 'Suspected routing point for international fund transfer; under joint inquiry' },
].forEach(makeFlag);

// ---------------------------------------------------------------------
// RISK SCORING
// ---------------------------------------------------------------------

function computeRisk(accountId) {
  const weights = { LOW: 10, MEDIUM: 25, HIGH: 40, CRITICAL: 60 };
  const flagsForAcc = data.flags.filter((f) => f.account_id === accountId);
  let score = flagsForAcc.reduce((sum, f) => sum + (weights[f.severity] || 0), 0);
  score = Math.min(score, 100);
  let level = 'LOW';
  if (score >= 80) level = 'CRITICAL';
  else if (score >= 50) level = 'HIGH';
  else if (score >= 25) level = 'MEDIUM';
  const acc = data.accounts.find((a) => a.id === accountId);
  acc.risk_score = score;
  acc.risk_level = level;
}

data.accounts.forEach((a) => computeRisk(a.id));

// ---------------------------------------------------------------------
// CASES
// ---------------------------------------------------------------------

const case1 = makeCase({
  case_number: 'CYB/2026/00417',
  title: 'Phishing Fraud — Layered Transfer to Mule Network',
  description: 'Victim Rajesh Kumar Sharma reported unauthorized transfer of ₹4,80,000 following a phishing call impersonating bank support. Funds traced through 2 layering accounts into 3 confirmed mule accounts before cash-out.',
  status: 'IN_PROGRESS',
  assigned_officer: 'Inspector A. Verma, Cyber Crime Cell',
});

const case2 = makeCase({
  case_number: 'CYB/2026/00422',
  title: 'Fraudulent Investment Scheme — Multi-Victim Fan-In',
  description: '3 victims reported losses totaling ₹7,35,000 to a social-media-advertised investment scheme. All payments converged on a single mule account before consolidation and suspected overseas routing.',
  status: 'OPEN',
  assigned_officer: 'Sub-Inspector R. Nair, Cyber Crime Cell',
});

[
  [case1.id, victim1.id, 'VICTIM'],
  [case1.id, layer1a.id, 'INTERMEDIARY'],
  [case1.id, layer1b.id, 'INTERMEDIARY'],
  [case1.id, mule1.id, 'MULE'],
  [case1.id, mule2.id, 'MULE'],
  [case1.id, mule3.id, 'MULE'],
  [case2.id, victim2.id, 'VICTIM'],
  [case2.id, victim3.id, 'VICTIM'],
  [case2.id, victim4.id, 'VICTIM'],
  [case2.id, fanInMule.id, 'MULE'],
  [case2.id, finalDest.id, 'MULE'],
].forEach(([cid, aid, role]) => linkAccountToCase(cid, aid, role));

save(data);

console.log('✅ Seed complete.');
console.log(`   Accounts: ${data.accounts.length}`);
console.log(`   Transactions: ${data.transactions.length}`);
console.log(`   Flags: ${data.flags.length}`);
console.log(`   Cases: ${data.cases.length}`);
