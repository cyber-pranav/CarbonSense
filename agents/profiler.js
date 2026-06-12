/**
 * profiler.js
 *
 * Profiling Agent — manages multi-turn dialogue state and collects typed
 * answers from the user across the 8-question carbon profiling session.
 *
 * Agentic Decoupling Principle:
 * ──────────────────────────────
 * The ProfilerAgent is deliberately isolated from both the calculation engine
 * and the recommendation agent. It owns only dialogue state (question index +
 * answer map). Once complete, it hands the sanitised answers object to
 * calculateFootprint() — it never calls Claude directly.
 *
 * All answers are sanitised at the point of submission via utils/sanitizer.js
 * before being stored, ensuring a clean data boundary between user input and
 * the deterministic math engine.
 *
 * @module agents/profiler
 */
'use strict';

import { QUESTION_TREE } from '../data/categories.js';
import { sanitizeText, sanitizeNumber } from '../utils/sanitizer.js';

export class ProfilerAgent {
  /**
   * Initializes the ProfilerAgent state.
   */
  constructor() {
    this.reset();
  }

  /**
   * Returns the current question object or null if all questions are answered.
   * @returns {object|null} Question object or null
   */
  getCurrentQuestion() {
    if (this.currentQuestionIndex >= QUESTION_TREE.length) {
      return null;
    }
    return QUESTION_TREE[this.currentQuestionIndex];
  }

  /**
   * Sanitizes and submits the answer for the current question, then advances the index.
   * @param {any} value - Raw answer input
   */
  submitAnswer(value) {
    const q = this.getCurrentQuestion();
    if (!q) return;

    let sanitizedValue;
    if (q.type === 'number') {
      // Clamps numbers to non-negative values, max 1,000,000 to prevent overflow abuse
      sanitizedValue = sanitizeNumber(value, 0, 1000000);
    } else {
      // Choice questions are sanitized as strings
      sanitizedValue = sanitizeText(value);
    }

    this.answers[q.id] = sanitizedValue;
    this.currentQuestionIndex++;
  }

  /**
   * Checks if all questions have been answered.
   * @returns {boolean} True if profiling is complete
   */
  isComplete() {
    return this.currentQuestionIndex >= QUESTION_TREE.length;
  }

  /**
   * Returns the collected answers map.
   * @returns {object} Answers map
   */
  getAnswers() {
    return this.answers;
  }

  /**
   * Resets the agent's state to start over.
   */
  reset() {
    this.currentQuestionIndex = 0;
    this.answers = {};
  }
}
