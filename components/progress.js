/**
 * progress.js
 *
 * ProgressComponent — renders "Your Impact Potential" badges and the
 * "How many Earths?" motivational stat inside the dashboard panel.
 *
 * This component provides gamification-layer feedback grounded entirely in
 * the deterministic footprint data. No LLM calls are made here — badge
 * thresholds are derived directly from EMISSION_FACTORS constants.
 *
 * @module components/progress
 */
'use strict';

import { EMISSION_FACTORS } from '../data/emission-factors.js';

export class ProgressComponent {
  /**
   * @param {HTMLElement} containerEl - The #dashboard-panel element
   */
  constructor(containerEl) {
    this.container = containerEl;
    this.sectionEl = null;
  }

  // ---------------------------------------------------------------------------
  // Public
  // ---------------------------------------------------------------------------

  /**
   * Creates or updates the progress section inside the dashboard panel.
   *
   * Badge logic:
   *   - Diet is Vegetarian or Vegan   → "✅ Green Eater"
   *   - Transport is 0 kg (bike/walk) → "✅ Zero Emission Commuter"
   *   - Total < india_average (1900)  → "🏆 Below India Average"
   *
   * Earths stat: (total_kg / 4600) × 1.7
   *
   * @param {object} footprintData - Output from calculateFootprint()
   */
  render(footprintData) {
    const { transport_kg, diet_kg, total_kg } = footprintData;

    // Remove existing section if present
    if (this.sectionEl && this.sectionEl.parentNode) {
      this.sectionEl.parentNode.removeChild(this.sectionEl);
    }

    this.sectionEl = document.createElement('div');
    this.sectionEl.className = 'progress-section';

    // ── Heading
    const heading = document.createElement('h3');
    heading.className = 'progress-heading';
    heading.textContent = '🌱 Your Impact Potential';
    this.sectionEl.appendChild(heading);

    // ── Badges
    const badges = this._computeBadges(transport_kg, diet_kg, total_kg);

    if (badges.length > 0) {
      const badgesWrap = document.createElement('div');
      badgesWrap.className = 'progress-badges';
      badges.forEach((text) => {
        const badge = document.createElement('span');
        badge.className = 'progress-badge';
        badge.textContent = text;
        badgesWrap.appendChild(badge);
      });
      this.sectionEl.appendChild(badgesWrap);
    } else {
      const noBadge = document.createElement('p');
      noBadge.className = 'progress-no-badge';
      noBadge.textContent = 'Completing the questionnaire unlocks your achievement badges.';
      this.sectionEl.appendChild(noBadge);
    }

    // ── "How many Earths?" motivational stat
    const earths = ((total_kg / EMISSION_FACTORS.global_average_kg) * 1.7).toFixed(1);
    const statWrap = document.createElement('div');
    statWrap.className = 'progress-stat';

    const statNum = document.createElement('span');
    statNum.className = 'progress-stat-num';
    statNum.textContent = earths;
    statNum.setAttribute('aria-label', `${earths} Earths`);

    const statLabel = document.createElement('span');
    statLabel.className = 'progress-stat-label';
    statLabel.textContent = ' Earths needed if everyone lived like you';

    statWrap.appendChild(statNum);
    statWrap.appendChild(statLabel);
    this.sectionEl.appendChild(statWrap);

    this.container.appendChild(this.sectionEl);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Determines which achievement badges apply.
   *
   * @param {number} transport_kg
   * @param {number} diet_kg
   * @param {number} total_kg
   * @returns {string[]} Badge label strings
   */
  _computeBadges(transport_kg, diet_kg, total_kg) {
    const badges = [];

    // Diet: vegan ≤ 1500 kg, vegetarian ≤ 1700 kg
    if (diet_kg <= EMISSION_FACTORS.diet.vegetarian) {
      badges.push('✅ Green Eater');
    }

    // Transport: zero driving emissions (bike/walk — value is 0 for daily commute)
    if (transport_kg === 0) {
      badges.push('✅ Zero Emission Commuter');
    }

    // Total below India average
    if (total_kg < EMISSION_FACTORS.india_average_kg) {
      badges.push('🏆 Below India Average');
    }

    return badges;
  }
}
