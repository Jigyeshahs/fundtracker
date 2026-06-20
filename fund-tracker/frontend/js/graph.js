/**
 * FundGraph — lightweight force-directed network renderer.
 * No external charting library; built specifically for this fund-flow
 * use case so risk-coloring, flagged-edge styling, and the tooltip
 * behavior are exactly right rather than bent to fit a generic library.
 */

const RISK_COLORS = {
  LOW: '#4C8C6B',
  MEDIUM: '#C8902E',
  HIGH: '#C2521E',
  CRITICAL: '#B3261E',
};

class FundGraph {
  constructor(container, { onNodeClick } = {}) {
    this.container = container;
    this.onNodeClick = onNodeClick;
    this.nodes = [];
    this.edges = [];
    this.width = container.clientWidth || 900;
    this.height = container.clientHeight || 560;
    this.rootId = null;

    this.svg = null;
    this.simRunning = false;
  }

  setData({ nodes, edges, root_id = null }) {
    this.rootId = root_id;
    const prevPositions = {};
    this.nodes.forEach((n) => { prevPositions[n.id] = { x: n.x, y: n.y }; });

    this.nodes = nodes.map((n) => {
      const prev = prevPositions[n.id];
      return {
        ...n,
        x: prev ? prev.x : this.width / 2 + (Math.random() - 0.5) * 120,
        y: prev ? prev.y : this.height / 2 + (Math.random() - 0.5) * 120,
        vx: 0,
        vy: 0,
      };
    });
    this.edges = edges;
    this.render();
    this.runSimulation();
  }

  nodeRadius(node) {
    if (node.is_root) return 22;
    if (node.type === 'Cash-Out') return 16;
    const base = 11;
    const bump = { LOW: 0, MEDIUM: 2, HIGH: 4, CRITICAL: 6 }[node.risk_level] || 0;
    return base + bump;
  }

  runSimulation() {
    if (this.simRunning) return;
    this.simRunning = true;
    const iterations = 220;
    let i = 0;

    const step = () => {
      this.tick();
      this.updatePositions();
      i++;
      if (i < iterations) {
        requestAnimationFrame(step);
      } else {
        this.simRunning = false;
      }
    };
    requestAnimationFrame(step);
  }

  tick() {
    const nodes = this.nodes;
    const k = 0.012;          // repulsion strength
    const springK = 0.02;     // edge attraction strength
    const targetLen = 130;
    const centerPull = 0.0025;
    const damping = 0.82;

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist2 = dx * dx + dy * dy;
        if (dist2 < 1) dist2 = 1;
        const dist = Math.sqrt(dist2);
        const force = (k * 6000) / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }

    // Spring attraction along edges
    this.edges.forEach((e) => {
      const a = nodes.find((n) => n.id === e.source);
      const b = nodes.find((n) => n.id === e.target);
      if (!a || !b) return;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = dist - targetLen;
      const force = springK * diff;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });

    // Pull toward center
    nodes.forEach((n) => {
      n.vx += (this.width / 2 - n.x) * centerPull;
      n.vy += (this.height / 2 - n.y) * centerPull;
      n.vx *= damping;
      n.vy *= damping;
    });
  }

  updatePositions() {
    const pad = 40;
    this.nodes.forEach((n) => {
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(pad, Math.min(this.width - pad, n.x));
      n.y = Math.max(pad, Math.min(this.height - pad, n.y));
    });
    this.draw();
  }

  render() {
    this.container.innerHTML = `
      <svg id="fg-svg" width="100%" height="100%" viewBox="0 0 ${this.width} ${this.height}" style="display:block;">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#4A5566"></path>
          </marker>
          <marker id="arrow-flagged" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#C2521E"></path>
          </marker>
        </defs>
        <g id="fg-edges"></g>
        <g id="fg-nodes"></g>
      </svg>
      <div class="graph-tooltip" id="fg-tooltip"></div>
    `;
    this.svg = this.container.querySelector('#fg-svg');
    this.tooltip = this.container.querySelector('#fg-tooltip');
    this.draw();
  }

  draw() {
    if (!this.svg) return;
    const edgesG = this.svg.querySelector('#fg-edges');
    const nodesG = this.svg.querySelector('#fg-nodes');

    edgesG.innerHTML = this.edges.map((e) => {
      const a = this.nodes.find((n) => n.id === e.source);
      const b = this.nodes.find((n) => n.id === e.target);
      if (!a || !b) return '';
      const flagged = e.flagged;
      const color = flagged ? '#C2521E' : '#3A4452';
      const width = flagged ? 1.8 : 1.2;
      const dash = flagged ? '' : '';
      const ra = this.nodeRadius(a), rb = this.nodeRadius(b);
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const x1 = a.x + (dx / dist) * ra;
      const y1 = a.y + (dy / dist) * ra;
      const x2 = b.x - (dx / dist) * (rb + 6);
      const y2 = b.y - (dy / dist) * (rb + 6);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${dash} marker-end="url(#${flagged ? 'arrow-flagged' : 'arrow'})" data-edge-id="${e.id}" style="cursor:pointer;" opacity="${flagged ? 0.95 : 0.55}"/>`;
    }).join('');

    nodesG.innerHTML = this.nodes.map((n) => {
      const r = this.nodeRadius(n);
      const color = RISK_COLORS[n.risk_level] || '#6B7686';
      const isRoot = n.is_root;
      const ring = isRoot ? `<circle cx="${n.x}" cy="${n.y}" r="${r + 5}" fill="none" stroke="#C8902E" stroke-width="1.5" stroke-dasharray="3,3"/>` : '';
      const initials = (n.label || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
      const labelY = n.y + r + 14;
      return `
        <g class="fg-node" data-id="${n.id}" style="cursor:pointer;">
          ${ring}
          <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.6"/>
          <text x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-size="${Math.max(9, r * 0.62)}" font-family="Inter, sans-serif" font-weight="600" fill="${color}">${initials}</text>
          <text x="${n.x}" y="${labelY}" text-anchor="middle" font-size="10.5" font-family="Inter, sans-serif" fill="#97A1AE">${truncate(n.label, 16)}</text>
        </g>`;
    }).join('');

    this.attachEvents();
  }

  attachEvents() {
    const nodeEls = this.svg.querySelectorAll('.fg-node');
    nodeEls.forEach((el) => {
      el.onmouseenter = (ev) => this.showTooltip(ev, Number(el.dataset.id));
      el.onmouseleave = () => { this.tooltip.style.display = 'none'; };
      el.onclick = () => {
        if (this.onNodeClick) this.onNodeClick(Number(el.dataset.id));
      };
    });

    const edgeEls = this.svg.querySelectorAll('[data-edge-id]');
    edgeEls.forEach((el) => {
      el.onmouseenter = (ev) => this.showEdgeTooltip(ev, Number(el.dataset.edgeId));
      el.onmouseleave = () => { this.tooltip.style.display = 'none'; };
    });
  }

  showTooltip(ev, nodeId) {
    const n = this.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    const rect = this.container.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    this.tooltip.innerHTML = `
      <div class="graph-tooltip__title">${escapeHtml(n.label)}</div>
      <div class="graph-tooltip__row">A/C: ${escapeHtml(n.account_number)}</div>
      <div class="graph-tooltip__row">${escapeHtml(n.bank_name)}</div>
      <div class="graph-tooltip__row">Risk: ${n.risk_level} (${n.risk_score}/100)</div>
      <div class="graph-tooltip__row">Status: ${n.status.replace(/_/g, ' ')}</div>
    `;
    this.positionTooltip(x, y);
  }

  showEdgeTooltip(ev, edgeId) {
    const e = this.edges.find((x) => x.id === edgeId);
    if (!e) return;
    const rect = this.container.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    this.tooltip.innerHTML = `
      <div class="graph-tooltip__title">₹${formatINR(e.amount)}</div>
      <div class="graph-tooltip__row">${e.date} · ${e.time || ''}</div>
      <div class="graph-tooltip__row">Channel: ${e.channel}</div>
      ${e.flagged ? `<div class="graph-tooltip__row" style="color:#C2521E;">⚠ ${escapeHtml(e.reason || 'Flagged')}</div>` : ''}
    `;
    this.positionTooltip(x, y);
  }

  positionTooltip(x, y) {
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${Math.min(x + 14, this.width - 270)}px`;
    this.tooltip.style.top = `${Math.max(y - 10, 10)}px`;
  }
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatINR(n) {
  return Number(n).toLocaleString('en-IN');
}
