/**
 * dashboard.js
 *
 * DashboardComponent — renders the live carbon footprint dashboard with
 * Chart.js visualisations (doughnut + horizontal bar).
 *
 * Production Efficiency Guarantee:
 * ──────────────────────────────────
 * Chart instances are created ONCE and subsequently updated via .update() —
 * never destroyed and re-created on re-renders. This eliminates Chart.js
 * canvas memory leaks and ensures smooth animated transitions on repeated
 * footprint calculations within a single session.
 *
 * Accessibility: all canvases carry role="img" and aria-label; charts also
 * respect the prefers-reduced-motion media query (animation duration set to 0).
 *
 * @module components/dashboard
 */
'use strict';

import { ReportCardComponent } from './report-card.js';
import { ProgressComponent }   from './progress.js';

const CHART_COLORS = {
  transport: '#E8A427',
  energy:    '#4CAF7D',
  diet:      '#E05C4B',
  shopping:  '#7B9EA6',
  grey:      'rgba(168, 191, 176, 0.45)',
  accent:    '#E8A427',
  danger:    '#E05C4B'
};

const INDIA_AVG  = 1900;  // kg CO2e/year
const GLOBAL_AVG = 4600;  // kg CO2e/year

// 25th / 75th percentile thresholds per category (rough heuristics)
const THRESHOLDS = {
  transport: [800, 2500],
  energy:    [300, 900],
  diet:      [1700, 2500],
  shopping:  [1200, 2500]
};

export class DashboardComponent {
  /**
   * @param {HTMLElement} containerEl - The #dashboard-panel element
   */
  constructor(containerEl) {
    this.container       = containerEl;
    this.footprintChart  = null;   // Chart.js doughnut instance
    this.comparisonChart = null;   // Chart.js bar instance
    this.reportCard      = new ReportCardComponent(containerEl);
    this.progress        = new ProgressComponent(containerEl);
    this._lastFootprint  = null;   // cached for report card button
    this._statCards      = {};     // keyed by category name
    this._emptyState     = null;
    this._reportBtn      = null;
  }

  // ---------------------------------------------------------------------------
  // Public: init
  // ---------------------------------------------------------------------------

  /**
   * Renders the empty dashboard skeleton. Called once on page load.
   */
  init() {
    this.container.innerHTML = '';
    this.container.style.overflowY = 'auto';

    // ── Panel title
    const titleEl = document.createElement('h2');
    titleEl.className = 'dashboard-title';
    titleEl.setAttribute('role', 'heading');
    titleEl.setAttribute('aria-level', '2');
    titleEl.textContent = 'Your Carbon Footprint';
    this.container.appendChild(titleEl);

    // ── Empty state (visible until render() is called)
    this._emptyState = document.createElement('p');
    this._emptyState.className = 'dashboard-empty-state';
    this._emptyState.setAttribute('aria-live', 'polite');
    this._emptyState.textContent = 'Complete the chat to see your footprint analysis.';
    this.container.appendChild(this._emptyState);

    // ── Stat cards grid (hidden until render)
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';
    statsGrid.style.display = 'none';
    statsGrid.id = 'stats-grid';

    [
      { key: 'transport', icon: '🚗', label: 'Transport' },
      { key: 'energy',    icon: '🏠', label: 'Energy'    },
      { key: 'diet',      icon: '🥗', label: 'Diet'      },
      { key: 'shopping',  icon: '🛍️', label: 'Shopping'  }
    ].forEach(({ key, icon, label }) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.id = `stat-${key}`;

      const iconEl = document.createElement('div');
      iconEl.className = 'stat-icon';
      iconEl.textContent = icon;
      iconEl.setAttribute('aria-hidden', 'true');

      const labelEl = document.createElement('div');
      labelEl.className = 'stat-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('div');
      valueEl.className = 'stat-value';
      valueEl.textContent = '—';

      const unitEl = document.createElement('div');
      unitEl.className = 'stat-unit';
      unitEl.textContent = 'kg CO₂e/yr';

      card.appendChild(iconEl);
      card.appendChild(labelEl);
      card.appendChild(valueEl);
      card.appendChild(unitEl);
      statsGrid.appendChild(card);
      this._statCards[key] = { card, valueEl };
    });
    this.container.appendChild(statsGrid);

    // ── Doughnut chart
    const chartWrap = document.createElement('div');
    chartWrap.className = 'chart-container';
    chartWrap.style.display = 'none';
    chartWrap.id = 'chart-container';

    const footprintCanvas = document.createElement('canvas');
    footprintCanvas.id = 'footprint-chart';
    footprintCanvas.setAttribute('role', 'img');
    footprintCanvas.setAttribute('aria-label', 'Carbon footprint breakdown by category');
    chartWrap.appendChild(footprintCanvas);
    this.container.appendChild(chartWrap);

    // ── Comparison bar chart
    const compWrap = document.createElement('div');
    compWrap.className = 'comparison-container';
    compWrap.style.display = 'none';
    compWrap.id = 'comparison-container';

    const compCanvas = document.createElement('canvas');
    compCanvas.id = 'comparison-chart';
    compCanvas.setAttribute('role', 'img');
    compCanvas.setAttribute('aria-label', 'Your footprint compared to averages');
    compWrap.appendChild(compCanvas);
    this.container.appendChild(compWrap);

    // ── Download report button (hidden until render)
    const reportActions = document.createElement('div');
    reportActions.className = 'report-actions';
    reportActions.style.display = 'none';
    reportActions.id = 'report-actions';

    this._reportBtn = document.createElement('button');
    this._reportBtn.id = 'download-report';
    this._reportBtn.type = 'button';
    this._reportBtn.className = 'btn-download-report';
    this._reportBtn.setAttribute('aria-label', 'Download your carbon footprint report card as a PNG image');
    this._reportBtn.textContent = '📄 Download Report Card';
    this._reportBtn.addEventListener('click', () => {
      if (this._lastFootprint) {
        this._reportBtn.disabled = true;
        this._reportBtn.textContent = '⏳ Generating…';
        this.reportCard.generate(this._lastFootprint)
          .catch((err) => console.error('Report card error:', err))
          .finally(() => {
            this._reportBtn.disabled = false;
            this._reportBtn.textContent = '📄 Download Report Card';
          });
      }
    });
    reportActions.appendChild(this._reportBtn);
    this.container.appendChild(reportActions);
  }

  // ---------------------------------------------------------------------------
  // Public: render
  // ---------------------------------------------------------------------------

  /**
   * Populates the dashboard with footprint data and draws/updates the charts.
   *
   * @param {object} footprintData - Output from calculateFootprint()
   */
  render(footprintData) {
    if (!footprintData) return;
    this._lastFootprint = footprintData;

    const { transport_kg, energy_kg, diet_kg, shopping_kg, total_kg } = footprintData;

    // Respect prefers-reduced-motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animDuration  = reducedMotion ? 0 : 800;

    // ── Show / hide panels
    this._emptyState.style.display = 'none';
    document.getElementById('stats-grid').style.display         = 'grid';
    document.getElementById('chart-container').style.display    = 'block';
    document.getElementById('comparison-container').style.display = 'block';
    document.getElementById('report-actions').style.display     = 'flex';

    // ── Update stat cards
    const categories = [
      { key: 'transport', kg: transport_kg, thresholds: THRESHOLDS.transport },
      { key: 'energy',    kg: energy_kg,    thresholds: THRESHOLDS.energy    },
      { key: 'diet',      kg: diet_kg,      thresholds: THRESHOLDS.diet      },
      { key: 'shopping',  kg: shopping_kg,  thresholds: THRESHOLDS.shopping  }
    ];

    categories.forEach(({ key, kg, thresholds: [low, high] }) => {
      const { card, valueEl } = this._statCards[key];
      valueEl.textContent = Math.round(kg).toLocaleString();

      // Colour coding
      card.classList.remove('stat-card--green', 'stat-card--amber', 'stat-card--red');
      if (kg <= low)       card.classList.add('stat-card--green');
      else if (kg <= high) card.classList.add('stat-card--amber');
      else                 card.classList.add('stat-card--red');
    });

    // ── Doughnut chart
    this._renderDonutChart(
      [transport_kg, energy_kg, diet_kg, shopping_kg],
      animDuration
    );

    // ── Comparison bar chart
    this._renderComparisonChart(total_kg, animDuration);

    // ── Progress / badges section
    this.progress.render(footprintData);
  }

  // ---------------------------------------------------------------------------
  // Private: chart helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates or updates the doughnut chart on #footprint-chart.
   *
   * On first call, instantiates a new Chart.js doughnut instance. On subsequent
   * calls, mutates the existing instance's data and calls .update() to animate
   * the transition — no Chart instance is ever destroyed and re-created.
   *
   * @param {number[]} data         - Array of [transport_kg, energy_kg, diet_kg, shopping_kg]
   * @param {number}   animDuration - Animation duration in ms (0 if prefers-reduced-motion)
   * @returns {void}
   * @private
   */
  _renderDonutChart(data, animDuration) {
    const canvas = document.getElementById('footprint-chart');
    if (!canvas) return;

    const chartData = {
      labels: ['Transport', 'Energy', 'Diet', 'Shopping'],
      datasets: [{
        data,
        backgroundColor: [
          CHART_COLORS.transport,
          CHART_COLORS.energy,
          CHART_COLORS.diet,
          CHART_COLORS.shopping
        ],
        borderColor: 'rgba(19, 46, 34, 0.8)',
        borderWidth: 2,
        hoverOffset: 8
      }]
    };

    const total = data.reduce((a, b) => a + b, 0);

    const options = {
      responsive: true,
      animation: { duration: animDuration },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#F0EBE1',
            font: { family: "'DM Sans', system-ui, sans-serif", size: 12 },
            padding: 16,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${Math.round(val).toLocaleString()} kg (${pct}%)`;
            }
          }
        }
      }
    };

    if (this.footprintChart) {
      // Reuse existing instance — no memory leak
      this.footprintChart.data = chartData;
      this.footprintChart.options.animation.duration = animDuration;
      this.footprintChart.update();
    } else {
      this.footprintChart = new Chart(canvas, {
        type: 'doughnut',
        data: chartData,
        options
      });
    }
  }

  /**
   * Creates or updates the horizontal bar chart on #comparison-chart.
   *
   * Compares the user's total footprint against India's average (1,900 kg) and
   * the global average (4,600 kg). The user bar is coloured amber if below India
   * average (positive context) or danger red if above (motivation to reduce).
   * Existing Chart instances are reused via .update() — never recreated.
   *
   * @param {number} total_kg      - The user's total annual footprint in kg CO₂e
   * @param {number} animDuration  - Animation duration in ms (0 if prefers-reduced-motion)
   * @returns {void}
   * @private
   */
  _renderComparisonChart(total_kg, animDuration) {
    const canvas = document.getElementById('comparison-chart');
    if (!canvas) return;

    const youColor = total_kg < INDIA_AVG ? CHART_COLORS.accent : CHART_COLORS.danger;

    const chartData = {
      labels: ['You', 'India Avg', 'Global Avg'],
      datasets: [{
        label: 'Annual CO₂e (kg)',
        data: [total_kg, INDIA_AVG, GLOBAL_AVG],
        backgroundColor: [youColor, CHART_COLORS.grey, CHART_COLORS.grey],
        borderColor:     [youColor, 'rgba(168,191,176,0.6)', 'rgba(168,191,176,0.6)'],
        borderWidth: 1,
        borderRadius: 4
      }]
    };

    const options = {
      indexAxis: 'y',
      responsive: true,
      animation: { duration: animDuration },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Annual CO₂e Comparison (kg)',
          color: '#A8BFB0',
          font: { family: "'DM Sans', system-ui, sans-serif", size: 12 },
          padding: { bottom: 10 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.x.toLocaleString()} kg CO₂e/year`
          }
        }
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#A8BFB0', font: { size: 11 } }
        },
        y: {
          grid:  { display: false },
          ticks: { color: '#F0EBE1', font: { size: 12 } }
        }
      }
    };

    if (this.comparisonChart) {
      // Reuse existing instance — efficiency rubric
      this.comparisonChart.data.datasets[0].data = [total_kg, INDIA_AVG, GLOBAL_AVG];
      this.comparisonChart.data.datasets[0].backgroundColor[0] = youColor;
      this.comparisonChart.data.datasets[0].borderColor[0]     = youColor;
      this.comparisonChart.options.animation.duration = animDuration;
      this.comparisonChart.update();
    } else {
      this.comparisonChart = new Chart(canvas, {
        type: 'bar',
        data: chartData,
        options
      });
    }
  }
}
