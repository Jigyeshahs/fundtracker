const Views = {};

function riskBadge(level) {
  return `<span class="badge badge--${level.toLowerCase()}">${level}</span>`;
}

function statusBadge(status) {
  const cls = status === 'CONFIRMED_MULE' ? 'mule' : status === 'UNDER_REVIEW' ? 'review' : '';
  return `<span class="badge badge--status ${cls}">${status.replace(/_/g, ' ')}</span>`;
}

function fmtINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const disclosureBanner = `
  <div class="disclosure-banner">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.18A1 1 0 003 19.5h18a1 1 0 00.89-1.46L13.71 3.86a1 1 0 00-1.42 0z"/></svg>
    <div><b>Demonstration build.</b> All accounts, transactions, and case files shown are synthetic and generated for prototype evaluation. No live banking, NPCI, or law-enforcement data sources are connected. See README for the proposed data-integration path.</div>
  </div>
`;

// ============================================================
// DASHBOARD
// ============================================================

Views.dashboard = async function (root) {
  root.innerHTML = `<div class="empty-state">Loading dashboard…</div>`;
  const stats = await API.stats();

  const riskRows = stats.riskDistribution.map((r) => {
    const pct = stats.totalAccounts ? Math.round((r.count / stats.totalAccounts) * 100) : 0;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
          <span style="color:var(--slate-300);">${r.risk_level}</span>
          <span class="mono" style="color:var(--paper-100);">${r.count} accounts</span>
        </div>
        <div style="background:var(--ink-700);height:6px;border-radius:3px;overflow:hidden;">
          <div style="background:${RISK_COLORS[r.risk_level]};height:100%;width:${pct}%;"></div>
        </div>
      </div>`;
  }).join('');

  const flagRows = stats.flagTypeBreakdown.slice(0, 8).map((f) => `
    <div class="kv-row">
      <span class="kv-label">${f.flag_type.replace(/_/g, ' ')}</span>
      <span class="kv-value">${riskBadge(f.severity)} <span class="mono" style="margin-left:8px;">${f.count}</span></span>
    </div>
  `).join('');

  const recentRows = stats.recentFlaggedTxns.map((t) => `
    <tr data-go-account="${t.from_account_id}">
      <td><span class="mono">${t.txn_ref}</span></td>
      <td>${escapeHtml(t.from_name)} → ${escapeHtml(t.to_name)}</td>
      <td class="amount--flagged">${fmtINR(t.amount)}</td>
      <td class="mono">${t.txn_date}</td>
      <td style="color:var(--accent-300);font-size:12px;">${escapeHtml(t.flag_reason || '')}</td>
    </tr>
  `).join('');

  root.innerHTML = `
    <div class="view-header">
      <div class="view-title">Investigation Dashboard</div>
      <div class="view-subtitle">System-wide summary of monitored accounts, flagged transactions, and active case files.</div>
    </div>
    ${disclosureBanner}
    <div class="stat-grid">
      <div class="stat-tile stat-tile--accent">
        <div class="stat-tile__label">Accounts Monitored</div>
        <div class="stat-tile__value">${stats.totalAccounts}</div>
        <div class="stat-tile__delta">${stats.underReview} under active review</div>
      </div>
      <div class="stat-tile stat-tile--critical">
        <div class="stat-tile__label">Confirmed Mule Accounts</div>
        <div class="stat-tile__value">${stats.muleAccounts}</div>
        <div class="stat-tile__delta">${stats.criticalRisk} flagged CRITICAL risk</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile__label">Flagged Transactions</div>
        <div class="stat-tile__value">${stats.flaggedTxns}</div>
        <div class="stat-tile__delta">of ${stats.totalTxns} total recorded</div>
      </div>
      <div class="stat-tile stat-tile--ok">
        <div class="stat-tile__label">Flagged Fund Volume</div>
        <div class="stat-tile__value" style="font-size:22px;">${fmtINR(stats.totalFlaggedAmount)}</div>
        <div class="stat-tile__delta">${stats.openCases} case files open</div>
      </div>
    </div>

    <div class="detail-grid" style="grid-template-columns: 1.3fr 1fr;">
      <div class="card">
        <div class="card__header">
          <span class="card__title">Recent Flagged Transactions</span>
          <span class="chip" data-nav="transactions">View ledger →</span>
        </div>
        <div class="card__body" style="padding:0;">
          <table>
            <thead><tr><th>Ref</th><th>Flow</th><th>Amount</th><th>Date</th><th>Reason</th></tr></thead>
            <tbody>${recentRows || '<tr><td colspan="5" style="text-align:center;color:var(--slate-400);">No flagged transactions</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card">
          <div class="card__header"><span class="card__title">Risk Distribution</span></div>
          <div class="card__body">${riskRows}</div>
        </div>
        <div class="card">
          <div class="card__header"><span class="card__title">Flag Signal Breakdown</span></div>
          <div class="card__body" style="padding:6px 18px;">${flagRows}</div>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-go-account]').forEach((el) => {
    el.addEventListener('click', () => App.navigate('account-detail', { id: el.dataset.goAccount }));
  });
  root.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => App.navigate(el.dataset.nav));
  });
};

// ============================================================
// ACCOUNT REGISTRY
// ============================================================

Views.accounts = async function (root, params = {}) {
  root.innerHTML = `<div class="empty-state">Loading account registry…</div>`;

  const state = { search: params.search || '', status: params.status || '', risk_level: params.risk_level || '' };

  async function renderTable() {
    const accounts = await API.accounts({
      search: state.search || undefined,
      status: state.status || undefined,
      risk_level: state.risk_level || undefined,
    });

    const tbody = root.querySelector('#acc-tbody');
    tbody.innerHTML = accounts.map((a) => `
      <tr data-id="${a.id}">
        <td>
          <div class="holder-name">${escapeHtml(a.holder_name)}</div>
          <div class="holder-sub">${escapeHtml(a.bank_name)}</div>
        </td>
        <td class="mono">${escapeHtml(a.account_number)}</td>
        <td>${a.account_type}</td>
        <td>${statusBadge(a.status)}</td>
        <td>${riskBadge(a.risk_level)} <span class="mono" style="margin-left:6px;color:var(--slate-400);">${a.risk_score}</span></td>
        <td class="mono">${fmtDate(a.opened_date)}</td>
      </tr>
    `).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--slate-400);padding:40px;">No accounts match the current filters.</td></tr>`;

    tbody.querySelectorAll('tr[data-id]').forEach((row) => {
      row.addEventListener('click', () => App.navigate('account-detail', { id: row.dataset.id }));
    });
  }

  root.innerHTML = `
    <div class="view-header">
      <div class="view-title">Account Registry</div>
      <div class="view-subtitle">All accounts under monitoring across linked case files, ranked by computed risk score.</div>
    </div>

    <div class="controls-row">
      <input class="input search-input" id="acc-search" placeholder="Search by name or account number…" value="${escapeHtml(state.search)}">
      <select class="select" id="acc-status">
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="UNDER_REVIEW">Under Review</option>
        <option value="CONFIRMED_MULE">Confirmed Mule</option>
        <option value="FROZEN">Frozen</option>
      </select>
      <select class="select" id="acc-risk">
        <option value="">All risk levels</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
    </div>

    <div class="card">
      <table>
        <thead><tr><th>Account Holder</th><th>Account No.</th><th>Type</th><th>Status</th><th>Risk</th><th>Opened</th></tr></thead>
        <tbody id="acc-tbody"></tbody>
      </table>
    </div>
  `;

  root.querySelector('#acc-search').value = state.search;
  root.querySelector('#acc-status').value = state.status;
  root.querySelector('#acc-risk').value = state.risk_level;

  root.querySelector('#acc-search').addEventListener('input', (e) => { state.search = e.target.value; renderTable(); });
  root.querySelector('#acc-status').addEventListener('change', (e) => { state.status = e.target.value; renderTable(); });
  root.querySelector('#acc-risk').addEventListener('change', (e) => { state.risk_level = e.target.value; renderTable(); });

  await renderTable();
};

// ============================================================
// ACCOUNT DETAIL
// ============================================================

Views.accountDetail = async function (root, params = {}) {
  root.innerHTML = `<div class="empty-state">Loading account detail…</div>`;
  const acc = await API.account(params.id);

  const flagsHtml = acc.flags.length
    ? acc.flags.map((f) => `
        <div class="flag-item sev-${f.severity.toLowerCase()}">
          <div class="flag-item__type">${f.flag_type.replace(/_/g, ' ')} <span style="float:right;">${riskBadge(f.severity)}</span></div>
          <div class="flag-item__desc">${escapeHtml(f.description)}</div>
        </div>`).join('')
    : `<div style="color:var(--slate-400);font-size:13px;">No risk flags recorded for this account.</div>`;

  const allTxns = [
    ...acc.transactions_sent.map((t) => ({ ...t, direction: 'OUT', counterparty: t.counterparty_name, counterpartyAcc: t.counterparty_account })),
    ...acc.transactions_received.map((t) => ({ ...t, direction: 'IN', counterparty: t.counterparty_name, counterpartyAcc: t.counterparty_account })),
  ].sort((a, b) => (a.txn_date + (a.txn_time || '') < b.txn_date + (b.txn_time || '') ? 1 : -1));

  const txnRows = allTxns.map((t) => `
    <tr>
      <td><span class="badge badge--status" style="color:${t.direction === 'OUT' ? 'var(--risk-high)' : 'var(--ok-500)'};">${t.direction === 'OUT' ? '↗ SENT' : '↙ RECEIVED'}</span></td>
      <td>${escapeHtml(t.counterparty)}<br><span class="mono holder-sub">${escapeHtml(t.counterpartyAcc)}</span></td>
      <td class="${t.is_flagged ? 'amount--flagged' : 'amount'}">${fmtINR(t.amount)}</td>
      <td class="mono">${t.txn_date} ${t.txn_time || ''}</td>
      <td>${t.channel}</td>
      <td style="font-size:11.5px;color:var(--accent-300);">${t.is_flagged ? escapeHtml(t.flag_reason || 'Flagged') : ''}</td>
    </tr>
  `).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--slate-400);padding:30px;">No transactions recorded.</td></tr>`;

  const casesHtml = acc.cases.length
    ? acc.cases.map((c) => `
        <div class="kv-row" style="cursor:pointer;" data-case="${c.id}">
          <span class="kv-label mono">${c.case_number}</span>
          <span class="kv-value">${c.role}</span>
        </div>`).join('')
    : `<div style="color:var(--slate-400);font-size:13px;">Not linked to any case file.</div>`;

  root.innerHTML = `
    <div class="view-header">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div class="view-title">${escapeHtml(acc.holder_name)}</div>
          <div class="view-subtitle mono">${escapeHtml(acc.account_number)} · ${escapeHtml(acc.bank_name)}</div>
        </div>
        <div style="display:flex;gap:8px;">
          ${statusBadge(acc.status)} ${riskBadge(acc.risk_level)}
        </div>
      </div>
    </div>

    <div class="controls-row">
      <span class="chip" data-trace="${acc.id}">🔍 Trace fund flow from this account →</span>
    </div>

    <div class="detail-grid">
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card">
          <div class="card__header"><span class="card__title">Transaction History</span></div>
          <div class="card__body" style="padding:0;max-height:480px;overflow-y:auto;">
            <table>
              <thead><tr><th>Direction</th><th>Counterparty</th><th>Amount</th><th>Date / Time</th><th>Channel</th><th>Flag</th></tr></thead>
              <tbody>${txnRows}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card">
          <div class="card__header"><span class="card__title">Account Particulars</span></div>
          <div class="card__body">
            <div class="kv-row"><span class="kv-label">Account Type</span><span class="kv-value">${acc.account_type}</span></div>
            <div class="kv-row"><span class="kv-label">IFSC</span><span class="kv-value mono">${escapeHtml(acc.ifsc || '—')}</span></div>
            <div class="kv-row"><span class="kv-label">Phone</span><span class="kv-value mono">${escapeHtml(acc.phone || '—')}</span></div>
            <div class="kv-row"><span class="kv-label">Address</span><span class="kv-value" style="max-width:180px;">${escapeHtml(acc.address || '—')}</span></div>
            <div class="kv-row"><span class="kv-label">Opened</span><span class="kv-value">${fmtDate(acc.opened_date)}</span></div>
            <div class="kv-row"><span class="kv-label">Risk Score</span><span class="kv-value">${acc.risk_score} / 100</span></div>
          </div>
        </div>

        ${acc.notes ? `<div class="notes-box"><b>Investigator note:</b> ${escapeHtml(acc.notes)}</div>` : ''}

        <div class="card">
          <div class="card__header"><span class="card__title">Risk Flags</span></div>
          <div class="card__body">${flagsHtml}</div>
        </div>

        <div class="card">
          <div class="card__header"><span class="card__title">Linked Case Files</span></div>
          <div class="card__body">${casesHtml}</div>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-trace]')?.addEventListener('click', () => {
    App.navigate('graph', { focus: acc.id });
  });
  root.querySelectorAll('[data-case]').forEach((el) => {
    el.addEventListener('click', () => App.navigate('case-detail', { id: el.dataset.case }));
  });
};

// ============================================================
// TRANSACTION LEDGER
// ============================================================

Views.transactions = async function (root, params = {}) {
  root.innerHTML = `<div class="empty-state">Loading transaction ledger…</div>`;
  const state = { flagged_only: params.flagged_only === 'true' };

  async function renderTable() {
    const txns = await API.transactions({ flagged_only: state.flagged_only ? 'true' : undefined });
    const tbody = root.querySelector('#txn-tbody');
    tbody.innerHTML = txns.map((t) => `
      <tr data-from="${t.from_account_id}">
        <td class="mono">${t.txn_ref}</td>
        <td>${escapeHtml(t.from_name)}<br><span class="mono holder-sub">${escapeHtml(t.from_account_number)}</span></td>
        <td>${escapeHtml(t.to_name)}<br><span class="mono holder-sub">${escapeHtml(t.to_account_number)}</span></td>
        <td class="${t.is_flagged ? 'amount--flagged' : 'amount'}">${fmtINR(t.amount)}</td>
        <td class="mono">${t.txn_date} ${t.txn_time || ''}</td>
        <td>${t.channel}</td>
        <td>${t.is_flagged ? `<span class="badge badge--high">FLAGGED</span>` : ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--slate-400);padding:40px;">No transactions match the current filters.</td></tr>`;

    tbody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', () => App.navigate('account-detail', { id: row.dataset.from }));
    });
  }

  root.innerHTML = `
    <div class="view-header">
      <div class="view-title">Transaction Ledger</div>
      <div class="view-subtitle">Complete record of fund movements across all monitored accounts.</div>
    </div>

    <div class="controls-row">
      <span class="chip ${state.flagged_only ? 'active' : ''}" id="flag-toggle">⚠ Flagged only</span>
    </div>

    <div class="card">
      <table>
        <thead><tr><th>Ref</th><th>From</th><th>To</th><th>Amount</th><th>Date / Time</th><th>Channel</th><th>Status</th></tr></thead>
        <tbody id="txn-tbody"></tbody>
      </table>
    </div>
  `;

  root.querySelector('#flag-toggle').addEventListener('click', (e) => {
    state.flagged_only = !state.flagged_only;
    e.target.classList.toggle('active', state.flagged_only);
    renderTable();
  });

  await renderTable();
};

// ============================================================
// FUND FLOW MAP (graph)
// ============================================================

let activeGraphInstance = null;

Views.graph = async function (root, params = {}) {
  root.innerHTML = `<div class="empty-state">Loading fund flow map…</div>`;

  root.innerHTML = `
    <div class="view-header">
      <div class="view-title">Fund Flow Map</div>
      <div class="view-subtitle">Visual trace of money movement between accounts. Node size and color reflect computed risk; red edges mark flagged transactions.</div>
    </div>

    <div class="controls-row">
      <input class="input search-input" id="graph-search" placeholder="Jump to account by name…">
      <span class="chip active" id="graph-mode-full">Full network</span>
      <span class="chip" id="graph-mode-reset" style="display:none;">← Back to full network</span>
    </div>

    <div class="graph-shell" id="graph-container" style="height:560px;"></div>
  `;

  const container = root.querySelector('#graph-container');
  const graph = new FundGraph(container, {
    onNodeClick: (id) => App.navigate('account-detail', { id }),
  });
  activeGraphInstance = graph;

  // legend
  const legend = document.createElement('div');
  legend.className = 'graph-legend';
  legend.innerHTML = `
    <div style="font-weight:600;color:var(--paper-100);margin-bottom:2px;">Risk level</div>
    <div class="legend-row"><span class="legend-dot" style="background:#4C8C6B;"></span>Low</div>
    <div class="legend-row"><span class="legend-dot" style="background:#C8902E;"></span>Medium</div>
    <div class="legend-row"><span class="legend-dot" style="background:#C2521E;"></span>High</div>
    <div class="legend-row"><span class="legend-dot" style="background:#B3261E;"></span>Critical</div>
    <div style="border-top:1px solid var(--line);margin-top:4px;padding-top:6px;color:var(--slate-400);">Red edge = flagged transaction</div>
  `;
  container.appendChild(legend);

  async function loadFull() {
    const data = await API.graph();
    graph.setData(data);
    root.querySelector('#graph-mode-full').classList.add('active');
    root.querySelector('#graph-mode-reset').style.display = 'none';
  }

  async function loadTrace(accountId) {
    const data = await API.graphTrace(accountId, 3);
    graph.setData(data);
    root.querySelector('#graph-mode-full').classList.remove('active');
    root.querySelector('#graph-mode-reset').style.display = 'inline-block';
  }

  root.querySelector('#graph-mode-reset').addEventListener('click', loadFull);
  root.querySelector('#graph-mode-full').addEventListener('click', loadFull);

  root.querySelector('#graph-search').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim();
    if (!q) return;
    const results = await API.accounts({ search: q });
    if (results.length) loadTrace(results[0].id);
  });

  if (params.focus) {
    await loadTrace(Number(params.focus));
  } else {
    await loadFull();
  }
};

// ============================================================
// CASE FILES
// ============================================================

Views.cases = async function (root) {
  root.innerHTML = `<div class="empty-state">Loading case files…</div>`;
  const cases = await API.cases();

  root.innerHTML = `
    <div class="view-header">
      <div class="view-title">Case Files</div>
      <div class="view-subtitle">Open and in-progress investigations with linked accounts and roles.</div>
    </div>
    <div id="case-list"></div>
  `;

  const list = root.querySelector('#case-list');
  list.innerHTML = cases.map((c) => `
    <div class="case-card" data-id="${c.id}">
      <div class="case-card__ref">${c.case_number}</div>
      <div class="case-card__title">${escapeHtml(c.title)}</div>
      <div class="case-card__desc">${escapeHtml(c.description)}</div>
      <div class="case-card__meta">
        <span>${statusBadge2(c.status)}</span>
        <span>Officer: ${escapeHtml(c.assigned_officer)}</span>
        <span>Opened: ${fmtDate(c.created_at)}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.case-card').forEach((el) => {
    el.addEventListener('click', () => App.navigate('case-detail', { id: el.dataset.id }));
  });
};

function statusBadge2(status) {
  const map = { OPEN: 'medium', IN_PROGRESS: 'high', CLOSED: 'low' };
  return `<span class="badge badge--${map[status] || 'low'}">${status.replace(/_/g, ' ')}</span>`;
}

Views.caseDetail = async function (root, params = {}) {
  root.innerHTML = `<div class="empty-state">Loading case file…</div>`;
  const c = await API.caseDetail(params.id);

  const roleOrder = { VICTIM: 0, INTERMEDIARY: 1, MULE: 2 };
  const accounts = [...c.accounts].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

  const accRows = accounts.map((a) => `
    <tr data-id="${a.id}">
      <td><span class="badge badge--status">${a.role}</span></td>
      <td>
        <div class="holder-name">${escapeHtml(a.holder_name)}</div>
        <div class="holder-sub mono">${escapeHtml(a.account_number)}</div>
      </td>
      <td>${escapeHtml(a.bank_name)}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${riskBadge(a.risk_level)}</td>
    </tr>
  `).join('');

  root.innerHTML = `
    <div class="view-header">
      <div class="view-title mono" style="font-family:var(--font-mono);font-size:14px;color:var(--accent-300);margin-bottom:6px;">${c.case_number}</div>
      <div class="view-title">${escapeHtml(c.title)}</div>
      <div class="view-subtitle">${escapeHtml(c.description)}</div>
    </div>

    <div class="controls-row">
      ${statusBadge2(c.status)}
      <span style="color:var(--slate-400);font-size:12.5px;">Assigned: ${escapeHtml(c.assigned_officer)}</span>
      <span style="color:var(--slate-400);font-size:12.5px;">Opened: ${fmtDate(c.created_at)}</span>
    </div>

    <div class="card">
      <div class="card__header"><span class="card__title">Linked Accounts (${accounts.length})</span></div>
      <table>
        <thead><tr><th>Role</th><th>Account Holder</th><th>Bank</th><th>Status</th><th>Risk</th></tr></thead>
        <tbody>${accRows}</tbody>
      </table>
    </div>

    <div style="margin-top:16px;">
      <span class="chip" id="case-graph-btn">View fund flow map for this case →</span>
    </div>
  `;

  root.querySelectorAll('tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => App.navigate('account-detail', { id: row.dataset.id }));
  });

  root.querySelector('#case-graph-btn').addEventListener('click', () => {
    const mule = accounts.find((a) => a.role === 'MULE') || accounts[0];
    App.navigate('graph', { focus: mule.id });
  });
};
