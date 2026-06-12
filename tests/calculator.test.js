/**
 * calculator.test.js
 *
 * Unit tests for the deterministic carbon calculation engine.
 *
 * Test Coverage:
 *  - Test 1: Zero-emission scenario — total below 3,000 kg CO₂e
 *  - Test 2: High-emission scenario — total exceeds 8,000 kg CO₂e
 *  - Test 3: Result shape — all 4 category keys present
 *  - Test 4: Breakdown percentages sum to 100% (±1% tolerance)
 *
 * All tests are pure function calls — no DOM, no API calls, no mocking required.
 * This test file can be run in both browser (via test-runner.html) and
 * headless Node.js environments (via npm test).
 *
 * @module tests/calculator.test
 */
'use strict';

import { calculateFootprint } from '../agents/calculator.js';

export const results = [];

/**
 * Logs a test outcome to the console and appends it to the results array.
 *
 * @param {string}  name     - Human-readable test name/description
 * @param {boolean} passed   - Whether the assertion passed
 * @param {*}       actual   - The actual value produced by the test
 * @param {*}       expected - The expected value or constraint description
 * @returns {void}
 */
function logTest(name, passed, actual, expected) {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${name} | Actual: ${JSON.stringify(actual)} | Expected: ${JSON.stringify(expected)}`);
  results.push({ name, passed, actual, expected });
}

/**
 * Runs the calculator unit tests.
 * @returns {object} The run result containing the run function and results array
 */
export function runTests() {
  results.length = 0; // Reset results

  // Test 1: zero-emission input (bike, renewable, vegan, minimal)
  try {
    const zeroAnswers = {
      q1: 'Bike/Walk',
      q2: 0,
      q3: 0,
      q4: 0,
      q5: 'Electricity (Solar/Renewable)',
      q6: 0,
      q7: 'Vegan',
      q8: 'Minimal consumer'
    };
    const res = calculateFootprint(zeroAnswers);
    // Note: The absolute minimum mathematical footprint using the blueprint factors is:
    // Vegan (1500) + Minimal consumer (1200) = 2700 kg.
    // Thus we test if it is less than 3000 to remain mathematically correct.
    const passed = res.total_kg < 3000;
    logTest('Test 1: Zero-emission footprint bounds (< 3000 kg CO2e)', passed, res.total_kg, '< 3000');
  } catch (e) {
    logTest('Test 1: Zero-emission footprint bounds (< 3000 kg CO2e)', false, e.message, '< 3000');
  }

  // Test 2: high-emission input
  try {
    const highAnswers = {
      q1: 'Car (Petrol)',
      q2: 50,
      q3: 0,
      q4: 10,
      q5: 'Electricity (Grid)',
      q6: 400,
      q7: 'Meat-heavy',
      q8: 'High consumer'
    };
    const res = calculateFootprint(highAnswers);
    const passed = res.total_kg > 8000;
    logTest('Test 2: High-emission footprint bounds (> 8000 kg CO2e)', passed, res.total_kg, '> 8000');
  } catch (e) {
    logTest('Test 2: High-emission footprint bounds (> 8000 kg CO2e)', false, e.message, '> 8000');
  }

  // Test 3: calculateFootprint result always has all 4 category keys
  try {
    const defaultAnswers = {};
    const res = calculateFootprint(defaultAnswers);
    const hasKeys = 'transport_kg' in res && 'energy_kg' in res && 'diet_kg' in res && 'shopping_kg' in res;
    logTest('Test 3: Result contains all 4 emission categories', hasKeys, hasKeys, true);
  } catch (e) {
    logTest('Test 3: Result contains all 4 emission categories', false, e.message, true);
  }

  // Test 4: breakdown percentages sum to ~100 (within 1%)
  try {
    const testAnswers = {
      q1: 'Car (Diesel)',
      q2: 20,
      q3: 2,
      q4: 1,
      q5: 'Natural Gas',
      q6: 250,
      q7: 'Moderate meat',
      q8: 'Average consumer'
    };
    const res = calculateFootprint(testAnswers);
    const totalPct = res.breakdown.reduce((sum, item) => sum + item.pct, 0);
    const passed = Math.abs(totalPct - 100) <= 1.0;
    logTest('Test 4: Breakdown percentages sum to 100% (within 1%)', passed, totalPct, '100% ± 1%');
  } catch (e) {
    logTest('Test 4: Breakdown percentages sum to 100% (within 1%)', false, e.message, '100% ± 1%');
  }

  return { runTests, results };
}
