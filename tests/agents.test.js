/**
 * agents.test.js
 *
 * Integration tests for the full agent pipeline, storage abstraction,
 * and sanitiser utilities.
 *
 * Test Coverage:
 *  - Test 1: ProfilerAgent — verifies isComplete() is true after all 8 answers
 *  - Test 2: Pipeline — calculateFootprint produces correct shape with total_kg > 0
 *  - Test 3: Storage — save → load → clearAll round-trip returns null after clear
 *  - Test 4: Sanitizer — XSS stripping and NaN rejection validated
 *
 * All tests are designed to run without a live DOM or Anthropic API key.
 * The Recommendation Agent (recommender.js) is intentionally excluded from
 * integration tests to avoid requiring network credentials in CI.
 *
 * @module tests/agents.test
 */
'use strict';

import { ProfilerAgent }      from '../agents/profiler.js';
import { calculateFootprint } from '../agents/calculator.js';
import { saveFootprint, loadFootprint, clearAll } from '../utils/storage.js';
import { sanitizeText, sanitizeNumber }           from '../utils/sanitizer.js';

export const results = [];

/**
 * Logs an integration test result to the console and appends it to the results array.
 *
 * @param {string}  name     - Human-readable test name/description
 * @param {boolean} passed   - Whether the assertion passed
 * @param {*}       actual   - The actual value produced by the test subject
 * @param {*}       expected - The expected value or constraint description string
 * @returns {void}
 */
function logTest(name, passed, actual, expected) {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${name} | Actual: ${JSON.stringify(actual)} | Expected: ${JSON.stringify(expected)}`);
  results.push({ name, passed, actual, expected });
}

// ---------------------------------------------------------------------------
// Mock answer sets
// ---------------------------------------------------------------------------

/** One valid answer per question to drive the profiler to completion. */
const MOCK_ANSWERS_FULL = [
  'Car (Petrol)',           // q1 — transport mode
  '30',                     // q2 — daily km
  '2',                      // q3 — short flights
  '1',                      // q4 — long flights
  'Electricity (Grid)',     // q5 — energy source
  '250',                    // q6 — monthly kWh
  'Moderate meat',          // q7 — diet
  'Average consumer'        // q8 — shopping
];

/** High-emission fixture for pipeline validation. */
const MOCK_HIGH_EMISSION = {
  q1: 'Car (Petrol)',
  q2: 50,
  q3: 0,
  q4: 10,
  q5: 'Electricity (Grid)',
  q6: 400,
  q7: 'Meat-heavy',
  q8: 'High consumer'
};

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

/**
 * Runs all 4 agent integration tests.
 * @returns {{ runTests: Function, results: object[] }}
 */
export function runTests() {
  results.length = 0; // Reset

  // ── Test 1: ProfilerAgent completes after 8 submitted answers ─────────────
  try {
    const profiler = new ProfilerAgent();

    // Verify not complete at start
    const notCompleteAtStart = !profiler.isComplete();

    MOCK_ANSWERS_FULL.forEach((answer) => profiler.submitAnswer(answer));

    const isCompleteAfterAll = profiler.isComplete();
    const passed = notCompleteAtStart && isCompleteAfterAll;

    logTest(
      'Test 1: ProfilerAgent.isComplete() is true after all 8 answers',
      passed,
      { notCompleteAtStart, isCompleteAfterAll },
      { notCompleteAtStart: true, isCompleteAfterAll: true }
    );
  } catch (e) {
    logTest('Test 1: ProfilerAgent.isComplete() is true after all 8 answers', false, e.message, true);
  }

  // ── Test 2: calculateFootprint pipeline produces valid shape ───────────────
  try {
    const result = calculateFootprint(MOCK_HIGH_EMISSION);

    const hasAllKeys =
      'transport_kg' in result &&
      'energy_kg'    in result &&
      'diet_kg'      in result &&
      'shopping_kg'  in result &&
      'total_kg'     in result &&
      'breakdown'    in result;

    const totalPositive = result.total_kg > 0;
    const passed = hasAllKeys && totalPositive;

    logTest(
      'Test 2: calculateFootprint returns valid shape with total_kg > 0',
      passed,
      { total_kg: result.total_kg, hasAllKeys },
      { total_kg: '> 0', hasAllKeys: true }
    );
  } catch (e) {
    logTest('Test 2: calculateFootprint returns valid shape with total_kg > 0', false, e.message, 'valid object');
  }

  // ── Test 3: Storage round-trip — save, load, clearAll ─────────────────────
  try {
    const mockData = { total_kg: 3450.75, transport_kg: 500 };

    saveFootprint(mockData);
    const loaded = loadFootprint();
    const roundtripOk = JSON.stringify(loaded) === JSON.stringify(mockData);

    clearAll();
    const afterClear = loadFootprint();
    const clearOk = afterClear === null;

    const passed = roundtripOk && clearOk;

    logTest(
      'Test 3: Storage round-trip (saveFootprint → loadFootprint → clearAll)',
      passed,
      { roundtripOk, clearOk },
      { roundtripOk: true, clearOk: true }
    );
  } catch (e) {
    logTest('Test 3: Storage round-trip (saveFootprint → loadFootprint → clearAll)', false, e.message, 'round-trip pass');
  }

  // ── Test 4: Sanitizer security checks ─────────────────────────────────────
  try {
    const rawScript  = '<script>alert(1)</script>Hello';
    const cleanedText = sanitizeText(rawScript);
    const textOk = cleanedText === 'Hello';

    const nanResult = sanitizeNumber('abc', 0, 100);
    const numberOk  = nanResult === 0;

    const passed = textOk && numberOk;

    logTest(
      'Test 4: Sanitizer — strips script tags and returns 0 for NaN input',
      passed,
      { cleanedText, nanResult },
      { cleanedText: 'Hello', nanResult: 0 }
    );
  } catch (e) {
    logTest('Test 4: Sanitizer — strips script tags and returns 0 for NaN input', false, e.message, 'sanitized values');
  }

  return { runTests, results };
}
