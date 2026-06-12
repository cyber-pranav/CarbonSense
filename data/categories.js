/**
 * categories.js
 *
 * Question tree definition for the CarbonSense Profiling Agent.
 *
 * Contains 8 typed question objects across 4 emission categories:
 * Transport (q1–q4), Energy (q5–q6), Diet (q7), Shopping (q8).
 *
 * Each question object schema:
 * @typedef {Object} Question
 * @property {string}   id           - Unique question identifier (q1–q8)
 * @property {string}   category     - Emission category ('transport'|'energy'|'diet'|'shopping')
 * @property {string}   question     - Human-readable question text
 * @property {string}   type         - Input type ('choice'|'number')
 * @property {string}   [unit]       - Unit label for numeric questions (e.g. 'km', 'kWh')
 * @property {string[]} [options]    - Valid option strings for choice questions
 * @property {string}   emissionKey  - Key identifying the emission factor lookup
 *
 * The QUESTION_TREE array and all question objects are frozen (immutable)
 * to prevent accidental mutation across module boundaries.
 *
 * @module data/categories
 */
'use strict';

export const QUESTION_TREE = Object.freeze([
  Object.freeze({
    id: 'q1',
    category: 'transport',
    question: 'What is your primary mode of daily transport?',
    type: 'choice',
    options: ['Car (Petrol)', 'Car (Diesel)', 'Car (Electric)', 'Bus', 'Train', 'Bike/Walk'],
    emissionKey: 'mode'
  }),
  Object.freeze({
    id: 'q2',
    category: 'transport',
    question: 'How many km do you travel daily?',
    type: 'number',
    unit: 'km',
    emissionKey: 'daily_km'
  }),
  Object.freeze({
    id: 'q3',
    category: 'transport',
    question: 'How many short-haul flights (<3hr) do you take per year?',
    type: 'number',
    emissionKey: 'short_flights'
  }),
  Object.freeze({
    id: 'q4',
    category: 'transport',
    question: 'How many long-haul flights (>3hr) do you take per year?',
    type: 'number',
    emissionKey: 'long_flights'
  }),
  Object.freeze({
    id: 'q5',
    category: 'energy',
    question: 'What is your primary home energy source?',
    type: 'choice',
    options: ['Electricity (Grid)', 'Electricity (Solar/Renewable)', 'Natural Gas', 'LPG'],
    emissionKey: 'energy_source'
  }),
  Object.freeze({
    id: 'q6',
    category: 'energy',
    question: 'Estimate your monthly electricity usage in kWh (typical Indian home: 150-300 kWh)',
    type: 'number',
    unit: 'kWh',
    emissionKey: 'monthly_kwh'
  }),
  Object.freeze({
    id: 'q7',
    category: 'diet',
    question: 'How would you describe your diet?',
    type: 'choice',
    options: ['Meat-heavy', 'Moderate meat', 'Vegetarian', 'Vegan'],
    emissionKey: 'diet_style'
  }),
  Object.freeze({
    id: 'q8',
    category: 'shopping',
    question: 'How would you describe your consumption habits?',
    type: 'choice',
    options: ['High consumer', 'Average consumer', 'Minimal consumer'],
    emissionKey: 'shopping_style'
  })
]);
