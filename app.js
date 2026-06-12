/**
 * app.js — CarbonSense Orchestrator
 *
 * Zero-Backend, Local-First Privacy-Centric Architecture with
 * Agentic Decoupling and Deterministic Mathematical Compliance.
 *
 * Responsibilities:
 *  - Instantiates all agents and UI components.
 *  - Drives the profiling dialogue loop.
 *  - Calls the deterministic calculator then the AI recommender.
 *  - All dynamic text is injected via ChatComponent.addMessage() which uses
 *    textContent (never innerHTML) — XSS safe by design.
 *
 * @module app
 */
'use strict';

import { ProfilerAgent }      from './agents/profiler.js';
import { calculateFootprint } from './agents/calculator.js';
import { RecommenderAgent }   from './agents/recommender.js';
import { ChatComponent }      from './components/chat.js';
import { DashboardComponent } from './components/dashboard.js';
import { saveFootprint }      from './utils/storage.js';

/** Total questions in the profiling tree. */
const TOTAL_QUESTIONS = 8;

/**
 * initApp — bootstraps the CarbonSense application.
 *
 * Wires agents → components → event handlers, then kicks off
 * the first profiling question.
 *
 * @returns {Promise<void>}
 */
export async function initApp() {
  console.info('CarbonSense initialized');

  // ── Instantiate agents
  const profiler    = new ProfilerAgent();
  const recommender = new RecommenderAgent();

  // ── Instantiate & initialise UI components
  const chatPanelEl      = document.getElementById('chat-panel');
  const dashboardPanelEl = document.getElementById('dashboard-panel');

  if (!chatPanelEl || !dashboardPanelEl) {
    console.error('CarbonSense: required panel elements not found in DOM.');
    return;
  }

  const chat      = new ChatComponent(chatPanelEl);
  const dashboard = new DashboardComponent(dashboardPanelEl);

  chat.init();
  dashboard.init();

  // ── Expose dashboard render to global scope (stub hook for Phase 4)
  window.renderDashboard = (footprintData) => dashboard.render(footprintData);

  // ── Greeting + first question
  chat.addMessage(
    "👋 Hi! I'm CarbonSense. I'll help you understand your carbon footprint in about 2 minutes. Let's start!",
    'assistant'
  );
  _askNextQuestion(profiler, chat);

  // ── Register send handler
  chat.onSend = (rawValue) => _handleUserAnswer(rawValue, profiler, recommender, chat);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Reads the current question from the profiler and displays it in the chat.
 *
 * @param {ProfilerAgent}   profiler
 * @param {ChatComponent}   chat
 */
function _askNextQuestion(profiler, chat) {
  const question = profiler.getCurrentQuestion();
  if (!question) return;

  const questionNumber = profiler.currentQuestionIndex + 1;
  chat.updateProgress(questionNumber, TOTAL_QUESTIONS);

  let displayText = question.question;

  // For choice questions, append formatted option list
  if (question.type === 'choice' && question.options?.length) {
    const optionsList = question.options
      .map((opt, i) => `  ${i + 1}. ${opt}`)
      .join('\n');
    displayText += '\n\n' + optionsList;
  }

  if (question.unit) {
    displayText += `\n(Unit: ${question.unit})`;
  }

  chat.addMessage(displayText, 'assistant');
  chat.clearInput();
}

/**
 * Processes a user's raw input: sanitises, records the answer, and either
 * asks the next question or runs the full analysis pipeline.
 *
 * @param {string}            rawValue
 * @param {ProfilerAgent}     profiler
 * @param {RecommenderAgent}  recommender
 * @param {ChatComponent}     chat
 */
async function _handleUserAnswer(rawValue, profiler, recommender, chat) {
  const value = rawValue.trim();
  if (!value) return;

  // Display user message first
  chat.addMessage(value, 'user');
  chat.clearInput();
  chat.setInputDisabled(true);

  // Record answer in profiler (sanitisation happens inside submitAnswer)
  profiler.submitAnswer(value);

  if (profiler.isComplete()) {
    // ── All 8 questions answered → run analysis pipeline
    chat.updateProgress(TOTAL_QUESTIONS + 1, TOTAL_QUESTIONS); // shows "Analysis complete ✓"
    chat.showTypingIndicator();

    try {
      // 1. Deterministic carbon calculation (pure, no API call)
      const footprintData = calculateFootprint(profiler.getAnswers());

      // 2. Persist to localStorage
      saveFootprint(footprintData);

      // 3. Build a human-readable summary to show while waiting for AI
      const summaryLines = [
        '📋 Footprint calculated! Here\'s your breakdown:',
        `  🚗 Transport: ${footprintData.transport_kg} kg CO₂e/year`,
        `  🏠 Energy:    ${footprintData.energy_kg} kg CO₂e/year`,
        `  🥗 Diet:      ${footprintData.diet_kg} kg CO₂e/year`,
        `  🛍️ Shopping:  ${footprintData.shopping_kg} kg CO₂e/year`,
        `  ─────────────────────────────────`,
        `  🌍 Total:     ${footprintData.total_kg} kg CO₂e/year`,
        `  📊 vs India avg (1900 kg): ${footprintData.vs_india_pct}%`,
        `  🌐 vs Global avg (4600 kg): ${footprintData.vs_global_pct}%`,
        '',
        '✨ Getting your personalised recommendations from the AI coach…'
      ].join('\n');
      chat.hideTypingIndicator();
      chat.addMessage(summaryLines, 'assistant');
      chat.showTypingIndicator();

      // 4. AI recommendation — Claude receives deterministic JSON, never recalculates
      const recommendations = await recommender.getRecommendations(footprintData);
      chat.hideTypingIndicator();

      // 5. Display AI recommendations (textContent safe — no innerHTML)
      chat.addMessage('🌱 Here are your personalised reduction actions:\n\n' + recommendations, 'assistant');

      // 6. Trigger dashboard render (stub in Phase 3; full chart render in Phase 4)
      if (typeof window.renderDashboard === 'function') {
        window.renderDashboard(footprintData);
      }

    } catch (err) {
      chat.hideTypingIndicator();
      console.error('CarbonSense pipeline error:', err);

      // Friendly error message — err.message is plain text, safe for textContent
      const errorMsg =
        `⚠️ Something went wrong: ${err.message}\n\n` +
        'You can refresh the page and try again. Your answers have not been lost from this session.';
      chat.addMessage(errorMsg, 'assistant');
      chat.setInputDisabled(false);
    }

  } else {
    // ── More questions remain
    chat.setInputDisabled(false);
    _askNextQuestion(profiler, chat);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initApp().catch((err) => {
    console.error('CarbonSense failed to initialise:', err);
  });
});
