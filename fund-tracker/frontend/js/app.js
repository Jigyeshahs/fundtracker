const App = {
  root: null,
  currentView: 'dashboard',

  init() {
    this.root = document.getElementById('view-root');
    this.bindNav();
    this.startClock();
    this.navigate('dashboard');
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.addEventListener('click', () => this.navigate(el.dataset.view));
    });
  },

  startClock() {
    const el = document.getElementById('clock');
    const tick = () => {
      el.textContent = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    };
    tick();
    setInterval(tick, 30000);
  },

  navigate(view, params = {}) {
    this.currentView = view;

    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    const breadcrumbMap = {
      dashboard: 'Dashboard',
      accounts: 'Account Registry',
      'account-detail': 'Account Registry / Detail',
      transactions: 'Transaction Ledger',
      graph: 'Fund Flow Map',
      cases: 'Case Files',
      'case-detail': 'Case Files / Detail',
    };
    document.getElementById('breadcrumb-text').innerHTML =
      `Cyber Crime Cell &nbsp;/&nbsp; <b>${breadcrumbMap[view] || view}</b>`;

    const renderMap = {
      dashboard: () => Views.dashboard(this.root),
      accounts: () => Views.accounts(this.root, params),
      'account-detail': () => Views.accountDetail(this.root, params),
      transactions: () => Views.transactions(this.root, params),
      graph: () => Views.graph(this.root, params),
      cases: () => Views.cases(this.root),
      'case-detail': () => Views.caseDetail(this.root, params),
    };

    const fn = renderMap[view];
    if (fn) {
      fn().catch((err) => {
        console.error(err);
        this.root.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠</div>Failed to load this view. Check that the backend server is running.</div>`;
      });
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
