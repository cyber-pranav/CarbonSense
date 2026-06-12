/**
 * chat.js
 *
 * ChatComponent — self-contained chat UI component.
 *
 * XSS Mitigation Contract:
 * ─────────────────────────
 * ALL user-supplied and AI-generated text is inserted via textContent ONLY.
 * innerHTML is NEVER used in this component. This is the final enforcement
 * point of the XSS mitigation pipeline (sanitizer.js → profiler.js → chat.js).
 * Even if sanitizer.js were bypassed, textContent provides a complete safety net.
 *
 * Accessibility Guarantees:
 *  - Messages area is role="log" aria-live="polite" so screen readers announce new messages.
 *  - All user-supplied and AI-generated text is inserted via textContent (NEVER innerHTML).
 *  - Keyboard: Enter (without Shift) submits; Tab order is logical.
 *  - All interactive elements carry descriptive aria-label attributes.
 *
 * @module components/chat
 */
'use strict';

export class ChatComponent {
  /**
   * @param {HTMLElement} containerEl - The #chat-panel element
   */
  constructor(containerEl) {
    this.container    = containerEl;
    this.messagesEl   = null;
    this.inputEl      = null;
    this.sendBtn      = null;
    this.progressEl   = null;
    this.typingEl     = null;
    this._onSend      = null; // registered by app.js via .onSend setter
  }

  // ---------------------------------------------------------------------------
  // Public: Initialise
  // ---------------------------------------------------------------------------

  /**
   * Renders the full chat UI skeleton inside the container element.
   * Must be called once before any other methods.
   */
  init() {
    // Clear placeholder content
    this.container.innerHTML = '';
    this.container.style.padding = '0';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';

    // ── Panel header
    const header = document.createElement('div');
    header.className = 'chat-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'chat-title-wrap';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '20');
    icon.setAttribute('height', '20');
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '10');
    circle.setAttribute('cy', '10');
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', '#4CAF7D');
    circle.setAttribute('opacity', '0.85');
    icon.appendChild(circle);

    const title = document.createElement('h2');
    title.className = 'chat-title';
    title.textContent = 'Carbon Assistant';

    titleWrap.appendChild(icon);
    titleWrap.appendChild(title);
    header.appendChild(titleWrap);

    // Progress display
    this.progressEl = document.createElement('div');
    this.progressEl.className = 'chat-progress';
    this.progressEl.setAttribute('aria-live', 'polite');
    this.progressEl.setAttribute('aria-label', 'Questionnaire progress');
    this.progressEl.textContent = 'Starting…';
    header.appendChild(this.progressEl);

    this.container.appendChild(header);

    // ── Messages area
    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'chat-messages';
    this.messagesEl.setAttribute('role', 'log');
    this.messagesEl.setAttribute('aria-live', 'polite');
    this.messagesEl.setAttribute('aria-label', 'Conversation');
    this.messagesEl.setAttribute('aria-relevant', 'additions');
    this.container.appendChild(this.messagesEl);

    // ── Typing indicator (hidden by default)
    this.typingEl = document.createElement('div');
    this.typingEl.className = 'typing-indicator';
    this.typingEl.setAttribute('aria-label', 'CarbonSense is thinking');
    this.typingEl.setAttribute('aria-live', 'polite');
    this.typingEl.style.display = 'none';
    // Three animated dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'typing-dot';
      dot.setAttribute('aria-hidden', 'true');
      this.typingEl.appendChild(dot);
    }
    this.container.appendChild(this.typingEl);

    // ── Input row
    const inputRow = document.createElement('div');
    inputRow.className = 'chat-input-row';

    this.inputEl = document.createElement('textarea');
    this.inputEl.id = 'chat-input';
    this.inputEl.setAttribute('aria-label', 'Your answer');
    this.inputEl.setAttribute('rows', '2');
    this.inputEl.setAttribute('placeholder', 'Type your answer here…');
    this.inputEl.setAttribute('autocomplete', 'off');
    this.inputEl.setAttribute('spellcheck', 'false');

    this.sendBtn = document.createElement('button');
    this.sendBtn.id = 'chat-send';
    this.sendBtn.type = 'button';
    this.sendBtn.setAttribute('aria-label', 'Send answer');

    // Send icon SVG
    const sendSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sendSvg.setAttribute('width', '18');
    sendSvg.setAttribute('height', '18');
    sendSvg.setAttribute('viewBox', '0 0 24 24');
    sendSvg.setAttribute('fill', 'none');
    sendSvg.setAttribute('aria-hidden', 'true');
    sendSvg.setAttribute('focusable', 'false');
    const sendPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sendPath.setAttribute('d', 'M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13');
    sendPath.setAttribute('stroke', 'currentColor');
    sendPath.setAttribute('stroke-width', '2');
    sendPath.setAttribute('stroke-linecap', 'round');
    sendPath.setAttribute('stroke-linejoin', 'round');
    sendSvg.appendChild(sendPath);
    this.sendBtn.appendChild(sendSvg);

    inputRow.appendChild(this.inputEl);
    inputRow.appendChild(this.sendBtn);
    this.container.appendChild(inputRow);

    // ── Wire up events
    this.sendBtn.addEventListener('click', () => this._handleSend());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public: Set send handler (called by app.js)
  // ---------------------------------------------------------------------------

  set onSend(handler) {
    this._onSend = handler;
  }

  // ---------------------------------------------------------------------------
  // Public: Message management
  // ---------------------------------------------------------------------------

  /**
   * Adds a message bubble to the conversation log.
   *
   * @param {string} text - The message text (ALWAYS set via textContent, never innerHTML)
   * @param {'assistant'|'user'} role - Who sent the message
   */
  addMessage(text, role) {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message role-${role}`;

    // SECURITY: textContent prevents XSS — never use innerHTML here
    msgEl.textContent = text;

    // Typewriter animation for assistant messages
    if (role === 'assistant') {
      msgEl.style.animation = 'fadeInUp 0.3s ease forwards';
    }

    this.messagesEl.appendChild(msgEl);
    this._scrollToBottom();
  }

  /**
   * Clears the text input field.
   */
  clearInput() {
    this.inputEl.value = '';
    this.inputEl.focus();
  }

  /**
   * Enables or disables the textarea and send button.
   *
   * @param {boolean} disabled
   */
  setInputDisabled(disabled) {
    this.inputEl.disabled = disabled;
    this.sendBtn.disabled = disabled;
    if (disabled) {
      this.sendBtn.setAttribute('aria-disabled', 'true');
    } else {
      this.sendBtn.removeAttribute('aria-disabled');
      if (!disabled) this.inputEl.focus();
    }
  }

  /**
   * Shows the animated typing indicator (three-dot bounce).
   */
  showTypingIndicator() {
    this.typingEl.style.display = 'flex';
    this._scrollToBottom();
  }

  /**
   * Hides the typing indicator.
   */
  hideTypingIndicator() {
    this.typingEl.style.display = 'none';
  }

  /**
   * Updates the progress line (e.g. "Question 3 of 8").
   *
   * @param {number} current - Current question number (1-based)
   * @param {number} total   - Total number of questions
   */
  updateProgress(current, total) {
    if (!this.progressEl) return;
    if (current > total) {
      this.progressEl.textContent = 'Analysis complete ✓';
    } else {
      this.progressEl.textContent = `Question ${current} of ${total}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Reads the current input value and invokes the registered onSend callback.
   * Silently no-ops if the input is empty or no handler is registered.
   *
   * @private
   * @returns {void}
   */
  _handleSend() {
    const value = this.inputEl.value.trim();
    if (!value) return;
    if (typeof this._onSend === 'function') {
      this._onSend(value);
    }
  }

  /**
   * Scrolls the messages container to its bottom, ensuring the latest message
   * is always visible after appending new content.
   *
   * @private
   * @returns {void}
   */
  _scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
