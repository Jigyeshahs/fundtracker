const API = {
  base: '/api',

  async get(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${this.base}${path}${qs ? '?' + qs : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  stats() { return this.get('/stats'); },
  accounts(params) { return this.get('/accounts', params); },
  account(id) { return this.get(`/accounts/${id}`); },
  transactions(params) { return this.get('/transactions', params); },
  graph() { return this.get('/transactions/graph'); },
  graphTrace(accountId, depth = 2) { return this.get(`/transactions/graph/${accountId}`, { depth }); },
  cases() { return this.get('/cases'); },
  caseDetail(id) { return this.get(`/cases/${id}`); },
};
