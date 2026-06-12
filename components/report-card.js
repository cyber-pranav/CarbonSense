/**
 * report-card.js
 *
 * ReportCardComponent — generates a shareable carbon footprint PNG.
 *
 * Uses html2canvas (loaded via CDN in index.html) to capture an off-screen
 * styled div, then triggers a file download. All DOM construction uses
 * createElement + textContent — never innerHTML. This maintains the
 * zero-innerHTML XSS mitigation guarantee across the entire codebase.
 *
 * The generated PNG is 600px wide at 2x pixel density (1200px actual),
 * suitable for social sharing on retina displays.
 *
 * @module components/report-card
 */
'use strict';

export class ReportCardComponent {
  /**
   * @param {HTMLElement} containerEl - Parent panel (used for scoping if needed)
   */
  constructor(containerEl) {
    this.container = containerEl;
  }

  // ---------------------------------------------------------------------------
  // Public
  // ---------------------------------------------------------------------------

  /**
   * Generates and downloads a 600 × auto PNG of the report card.
   *
   * @param {object} footprintData - Output from calculateFootprint()
   * @returns {Promise<void>}
   */
  async generate(footprintData) {
    const {
      transport_kg, energy_kg, diet_kg, shopping_kg,
      total_kg, vs_global_pct
    } = footprintData;

    // ── Build the off-screen report card element ────────────────────────────
    const card = document.createElement('div');
    card.className = 'rc-card';

    // Position off-screen so it's invisible but measurable
    Object.assign(card.style, {
      position: 'absolute',
      left:     '-9999px',
      top:      '0',
      width:    '600px',
      background: '#FFFFFF',
      color:    '#0D2B1F',
      padding:  '2rem',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      boxSizing: 'border-box'
    });

    // Header row: logo wordmark + date
    const header = this._el('div', null, {
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: '1.5rem',
      borderBottom: '2px solid #E8A427', paddingBottom: '1rem'
    });
    const logo = this._el('span', 'CarbonSense', {
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: '1.6rem', fontWeight: '700',
      color: '#0D2B1F', letterSpacing: '-0.02em'
    });
    const dateEl = this._el('span', new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    }), { fontSize: '0.8rem', color: '#3A5248' });
    header.appendChild(logo);
    header.appendChild(dateEl);
    card.appendChild(header);

    // Total footprint headline
    const headline = this._el('div', null, { textAlign: 'center', margin: '1.5rem 0' });
    const totalNum = this._el('div', `${total_kg.toLocaleString()} kg`, {
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: '3.2rem', fontWeight: '900',
      color: '#0D2B1F', lineHeight: '1'
    });
    const totalLabel = this._el('div', 'CO₂e per year', {
      fontSize: '1rem', color: '#3A5248', marginTop: '0.35rem'
    });
    headline.appendChild(totalNum);
    headline.appendChild(totalLabel);
    card.appendChild(headline);

    // Category breakdown bars
    const categories = [
      { label: '🚗 Transport', kg: transport_kg, color: '#E8A427' },
      { label: '🏠 Energy',    kg: energy_kg,    color: '#4CAF7D' },
      { label: '🥗 Diet',      kg: diet_kg,      color: '#E05C4B' },
      { label: '🛍️ Shopping',  kg: shopping_kg,  color: '#7B9EA6' }
    ];
    const maxKg = Math.max(...categories.map(c => c.kg), 1);

    const barsSection = this._el('div', null, { marginBottom: '1.5rem' });
    const barsTitle = this._el('div', 'Breakdown by Category', {
      fontSize: '0.78rem', fontWeight: '700', color: '#3A5248',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: '0.75rem'
    });
    barsSection.appendChild(barsTitle);

    categories.forEach(({ label, kg, color }) => {
      const row = this._el('div', null, {
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        marginBottom: '0.5rem'
      });
      const lbl = this._el('div', label, {
        width: '120px', fontSize: '0.85rem',
        flexShrink: '0', color: '#0D2B1F'
      });
      const barWrap = this._el('div', null, {
        flex: '1', background: '#F0EBE1',
        borderRadius: '4px', height: '14px', overflow: 'hidden'
      });
      const barFill = this._el('div', null, {
        width: `${Math.round((kg / maxKg) * 100)}%`,
        height: '100%', background: color,
        borderRadius: '4px', minWidth: '4px'
      });
      barWrap.appendChild(barFill);
      const val = this._el('div', `${Math.round(kg)} kg`, {
        width: '72px', textAlign: 'right',
        fontSize: '0.82rem', color: '#3A5248',
        flexShrink: '0'
      });
      row.appendChild(lbl);
      row.appendChild(barWrap);
      row.appendChild(val);
      barsSection.appendChild(row);
    });
    card.appendChild(barsSection);

    // Comparison text
    const comparison = this._el('div',
      `You emit ${vs_global_pct}% of the global average (4,600 kg/year)`,
      {
        textAlign: 'center', fontSize: '0.9rem', color: '#3A5248',
        background: '#F5F0E8', borderRadius: '8px',
        padding: '0.75rem 1rem', marginBottom: '1.5rem'
      }
    );
    card.appendChild(comparison);

    // Tagline footer
    const tagline = this._el('div', 'Track it. Reduce it. Share it.', {
      textAlign: 'center',
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: '1rem', fontStyle: 'italic',
      color: '#0D2B1F', borderTop: '1px solid #E0D8CE',
      paddingTop: '1rem'
    });
    card.appendChild(tagline);

    // ── Capture & download ─────────────────────────────────────────────────
    document.body.appendChild(card);

    try {
      if (typeof window.html2canvas !== 'function') {
        throw new Error(
          'html2canvas is not loaded. Make sure the CDN script is present in index.html.'
        );
      }

      const canvas = await window.html2canvas(card, { scale: 2, useCORS: true });

      await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('canvas.toBlob returned null')); return; }
          const url  = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href     = url;
          link.download = `carbonsense-report-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      });
    } finally {
      document.body.removeChild(card);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates a styled element with textContent and inline styles.
   *
   * @param {string}      tag      - HTML tag name
   * @param {string|null} text     - textContent (null = no text node)
   * @param {object}      styles   - camelCase CSS properties
   * @returns {HTMLElement}
   */
  _el(tag, text, styles = {}) {
    const el = document.createElement(tag);
    if (text !== null && text !== undefined) el.textContent = text;
    Object.assign(el.style, styles);
    return el;
  }
}
