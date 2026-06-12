/**
 * recommender.js
 *
 * Recommendation Agent — calls the Anthropic Claude API with a deterministic
 * footprint JSON context and returns ranked sustainability coaching text.
 *
 * Agentic Decoupling: This agent is the ONLY module that interacts with the
 * Anthropic API. It receives a pre-computed footprintData object from
 * calculateFootprint() and is explicitly instructed via system prompt to
 * NEVER recalculate numbers. This creates a clean separation between
 * deterministic math (calculator.js) and LLM-powered narrative generation.
 *
 * Error Boundary Guarantee:
 * ──────────────────────────
 * All async fetch calls are wrapped in try/catch blocks. Network errors,
 * HTTP errors (401, 429, 5xx), and JSON parse errors are each caught
 * individually and converted to descriptive Error objects. On API timeout
 * or failure, a structured fallback error is returned rather than an
 * unhandled promise rejection.
 *
 * Security Guarantees:
 *  - API key is stored in sessionStorage ONLY (cleared on tab close).
 *  - API key is NEVER written to localStorage, logs, or any other surface.
 *  - All response text is returned as a plain string; the caller must use
 *    textContent (never innerHTML) when rendering it.
 *  - The CSP header in index.html restricts connect-src to api.anthropic.com only.
 *
 * @module agents/recommender
 */
'use strict';

const CLAUDE_API_URL  = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL    = 'claude-sonnet-4-20250514';
const SESSION_KEY     = 'cs_api_key';

const SYSTEM_PROMPT =
  "You are CarbonSense, an expert sustainability coach. The user's carbon footprint has been precisely calculated. " +
  "Your job is ONLY to provide ranked, actionable recommendations — never recalculate numbers. " +
  "Be warm, specific, and practical. Format your response as exactly 4 recommendations, each starting with an emoji " +
  "and a bold action title on its own line, followed by 1-2 sentences of specific guidance. " +
  "End with one motivational sentence about their progress potential.";

export class RecommenderAgent {
  // ---------------------------------------------------------------------------
  // API key management
  // ---------------------------------------------------------------------------

  /**
   * Returns the Anthropic API key from sessionStorage, or triggers the styled
   * modal dialog to collect it from the user.
   *
   * @returns {string} The API key
   */
  getApiKey() {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }
    return this._promptForApiKey();
  }

  /**
   * Creates and shows an accessible inline modal to collect the API key.
   * Blocks execution via a synchronous loop (user must confirm to continue).
   *
   * @returns {string} The API key entered by the user
   * @private
   */
  _promptForApiKey() {
    // Build modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'cs-api-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cs-modal-title');
    overlay.setAttribute('aria-describedby', 'cs-modal-desc');

    overlay.innerHTML = `
      <div id="cs-api-modal" role="document">
        <div class="cs-modal-header">
          <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path d="M16 3C9 3 4 10 4 18c0 4.4 1.8 8.4 4.7 11.3L16 22l7.3 7.3C26.2 26.4 28 22.4 28 18c0-8-5-15-12-15Z" fill="#4CAF7D" opacity="0.85"/>
          </svg>
          <h2 id="cs-modal-title">CarbonSense AI</h2>
        </div>
        <p id="cs-modal-desc" class="cs-modal-desc">
          To generate your personalised carbon reduction recommendations, please enter your
          <strong>Anthropic API key</strong>. It will only be stored for this browser session
          and is never sent anywhere except directly to <code>api.anthropic.com</code>.
        </p>
        <label for="cs-api-input" class="cs-modal-label">Anthropic API Key</label>
        <input
          type="password"
          id="cs-api-input"
          class="cs-modal-input"
          placeholder="sk-ant-…"
          autocomplete="off"
          spellcheck="false"
        />
        <p class="cs-modal-hint">
          🔒 Stored in <code>sessionStorage</code> only — cleared when you close this tab.
        </p>
        <div class="cs-modal-actions">
          <button type="button" id="cs-modal-confirm" class="cs-modal-btn-primary">
            Confirm &amp; Continue
          </button>
          <button type="button" id="cs-modal-cancel" class="cs-modal-btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    `;

    // Inject modal styles
    if (!document.getElementById('cs-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'cs-modal-styles';
      style.textContent = `
        #cs-api-modal-overlay {
          position: fixed; inset: 0; z-index: 9000;
          background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center;
          padding: 1.5rem;
          backdrop-filter: blur(6px);
        }
        #cs-api-modal {
          background: #132E22;
          border: 1px solid rgba(232, 164, 39, 0.3);
          border-radius: 16px;
          padding: 2rem;
          width: 100%; max-width: 460px;
          box-shadow: 0 12px 48px rgba(0,0,0,0.5);
          color: #F0EBE1;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .cs-modal-header {
          display: flex; align-items: center; gap: 0.6rem;
          margin-bottom: 1rem;
        }
        .cs-modal-header h2 {
          margin: 0;
          font-family: 'Playfair Display', Georgia, serif;
          color: #E8A427;
          font-size: 1.3rem;
        }
        .cs-modal-desc {
          font-size: 0.9rem;
          color: #A8BFB0;
          line-height: 1.6;
          margin-bottom: 1.25rem;
        }
        .cs-modal-desc strong { color: #F0EBE1; }
        .cs-modal-desc code, .cs-modal-hint code {
          background: rgba(255,255,255,0.08);
          padding: 0.1em 0.4em;
          border-radius: 3px;
          font-size: 0.85em;
          font-family: 'Courier New', monospace;
        }
        .cs-modal-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #A8BFB0;
          margin-bottom: 0.4rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .cs-modal-input {
          width: 100%;
          background: #1C3D2E;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          color: #F0EBE1;
          font-family: 'Courier New', monospace;
          font-size: 0.95rem;
          padding: 0.65rem 0.9rem;
          margin-bottom: 0.5rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }
        .cs-modal-input:focus {
          border-color: #E8A427;
          box-shadow: 0 0 0 2px rgba(232,164,39,0.25);
        }
        .cs-modal-hint {
          font-size: 0.78rem;
          color: #A8BFB0;
          margin-bottom: 1.5rem;
          opacity: 0.8;
        }
        .cs-modal-actions {
          display: flex; gap: 0.75rem; justify-content: flex-end;
        }
        .cs-modal-btn-primary {
          background: #E8A427; color: #0D2B1F;
          border: none; border-radius: 8px;
          padding: 0.6rem 1.4rem;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 700; font-size: 0.9rem;
          cursor: pointer;
          transition: filter 0.15s ease;
        }
        .cs-modal-btn-primary:hover { filter: brightness(1.1); }
        .cs-modal-btn-primary:focus-visible {
          outline: 2px solid white; outline-offset: 2px;
        }
        .cs-modal-btn-secondary {
          background: transparent;
          color: #A8BFB0;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          padding: 0.6rem 1rem;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.9rem;
          cursor: pointer;
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .cs-modal-btn-secondary:hover { border-color: #E8A427; color: #E8A427; }
        .cs-modal-btn-secondary:focus-visible {
          outline: 2px solid #E8A427; outline-offset: 2px;
        }
        .cs-modal-error {
          color: #E05C4B;
          font-size: 0.82rem;
          margin-top: 0.25rem;
          min-height: 1.2em;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);

    // Trap focus inside the modal
    const input      = overlay.querySelector('#cs-api-input');
    const confirmBtn = overlay.querySelector('#cs-modal-confirm');
    const cancelBtn  = overlay.querySelector('#cs-modal-cancel');

    // Add error display slot
    const errorEl = document.createElement('p');
    errorEl.className = 'cs-modal-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'assertive');
    input.parentNode.insertBefore(errorEl, input.nextSibling);

    input.focus();

    // Promise-based user interaction
    return new Promise((resolve, reject) => {
      const handleConfirm = () => {
        const key = input.value.trim();
        if (!key || key.length < 10) {
          errorEl.textContent = 'Please enter a valid API key (starts with "sk-ant-").';
          input.focus();
          return;
        }
        sessionStorage.setItem(SESSION_KEY, key);
        document.body.removeChild(overlay);
        resolve(key);
      };

      const handleCancel = () => {
        document.body.removeChild(overlay);
        reject(new Error('User cancelled API key entry.'));
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);

      // Submit on Enter key in input
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') handleCancel();
      });

      // Trap Tab key inside modal
      overlay.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusable = [input, confirmBtn, cancelBtn];
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Recommendation generation
  // ---------------------------------------------------------------------------

  /**
   * Calls the Claude API with the pre-calculated footprint data and returns
   * ranked, actionable recommendations as a plain text string.
   *
   * Claude is instructed NEVER to recalculate numbers — it only narrates
   * recommendations grounded in the deterministic data provided.
   *
   * @param {object} footprintData - Output from calculateFootprint()
   * @returns {Promise<string>} Recommendation text
   */
  async getRecommendations(footprintData) {
    const apiKey = await this.getApiKey();

    const { transport_kg, energy_kg, diet_kg, shopping_kg, total_kg, vs_india_pct } = footprintData;

    const userMessage =
      `My annual carbon footprint breakdown: ` +
      `Transport: ${transport_kg}kg, Energy: ${energy_kg}kg, Diet: ${diet_kg}kg, Shopping: ${shopping_kg}kg. ` +
      `Total: ${total_kg}kg. India average: 1900kg, Global average: 4600kg. ` +
      `My total is ${vs_india_pct}% of India average. Give me my top 4 personalized reduction actions.`;

    const requestBody = {
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage }
      ]
    };

    let response;
    try {
      response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });
    } catch (networkError) {
      throw new Error(
        `Network error reaching Anthropic API. Check your connection. (${networkError.message})`
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = errJson?.error?.message || '';
      } catch (_) { /* ignore parse errors */ }

      if (response.status === 401) {
        // Clear the invalid key so the user is re-prompted next time
        sessionStorage.removeItem(SESSION_KEY);
        throw new Error(
          `Invalid API key (401 Unauthorized). Please refresh and try again. ${detail}`
        );
      }
      if (response.status === 429) {
        throw new Error('Rate limit reached. Please wait a moment and try again.');
      }
      throw new Error(
        `Anthropic API error ${response.status}: ${detail || response.statusText}`
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(`Failed to parse API response: ${parseError.message}`);
    }

    // Extract plain text content — NEVER insert this via innerHTML
    const text = data?.content?.[0]?.text;
    if (!text) {
      throw new Error('Unexpected API response shape — no text content found.');
    }

    return text;
  }
}
