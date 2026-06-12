/**
 * calculator.js
 *
 * Deterministic Calculation Engine — maps user lifestyle answers to annual
 * CO₂ equivalent kilograms using static IPCC/EPA emission coefficients.
 *
 * Deterministic Mathematical Compliance Guarantee:
 * ─────────────────────────────────────────────────
 * This function is PURE: given identical inputs it always produces identical
 * outputs. It has zero side effects, no DOM access, no API calls, and no
 * randomness. This design ensures the AI recommendation layer (Claude) never
 * recalculates numbers — it only provides narrative coaching grounded in the
 * deterministic output of this engine.
 *
 * Emission factor sources:
 *  - IPCC 2021 AR6 Working Group III — transport and energy factors
 *  - EPA GHG equivalencies — consumer goods / diet
 *  - CEA 2023 Annual Report — India grid electricity intensity (0.233 kg/kWh)
 *  - World Bank 2022 — national/global average footprints
 *
 * @module agents/calculator
 */
'use strict';

import { EMISSION_FACTORS } from '../data/emission-factors.js';

/**
 * Calculates the annual carbon footprint based on user-supplied lifestyle answers.
 *
 * This is the core deterministic math engine. It performs pure CO₂e calculations
 * using frozen IPCC/EPA emission factors — the same inputs always produce the
 * same outputs. The result is passed directly to the RecommenderAgent as context;
 * Claude receives the pre-computed numbers and is explicitly forbidden from
 * recalculating them.
 *
 * @param {Object} answers                   - Map of question IDs to sanitised user answers
 * @param {string} answers.q1                - Primary transport mode (e.g. 'Car (Petrol)', 'Bike/Walk')
 * @param {number|string} answers.q2         - Daily travel distance in km
 * @param {number|string} answers.q3         - Number of short-haul flights per year (<3hr)
 * @param {number|string} answers.q4         - Number of long-haul flights per year (>3hr)
 * @param {string} answers.q5                - Home energy source (e.g. 'Electricity (Grid)')
 * @param {number|string} answers.q6         - Monthly electricity usage in kWh
 * @param {string} answers.q7                - Diet type (e.g. 'Vegetarian', 'Meat-heavy')
 * @param {string} answers.q8                - Shopping habit (e.g. 'Average consumer')
 *
 * @returns {{
 *   transport_kg: number,
 *   energy_kg: number,
 *   diet_kg: number,
 *   shopping_kg: number,
 *   total_kg: number,
 *   vs_india_pct: number,
 *   vs_global_pct: number,
 *   breakdown: Array<{label: string, kg: number, pct: number}>
 * }} Calculated carbon footprint object with per-category and aggregate metrics
 */
export function calculateFootprint(answers) {
  // Extract and apply fallbacks for missing answers
  const q1 = answers.q1 || 'Bike/Walk';
  const q2 = parseFloat(answers.q2) || 0;
  const q3 = parseFloat(answers.q3) || 0;
  const q4 = parseFloat(answers.q4) || 0;
  const q5 = answers.q5 || 'Electricity (Grid)';
  const q6 = parseFloat(answers.q6) || 0;
  const q7 = answers.q7 || 'Vegetarian';
  const q8 = answers.q8 || 'Average consumer';

  // 1. Transport Annual Calculations (kg CO2e / year)
  let transport_factor = 0;
  switch (q1) {
    case 'Car (Petrol)':
      transport_factor = EMISSION_FACTORS.transport.car_petrol_km;
      break;
    case 'Car (Diesel)':
      transport_factor = EMISSION_FACTORS.transport.car_diesel_km;
      break;
    case 'Car (Electric)':
      transport_factor = EMISSION_FACTORS.transport.car_electric_km;
      break;
    case 'Bus':
      transport_factor = EMISSION_FACTORS.transport.bus_km;
      break;
    case 'Train':
      transport_factor = EMISSION_FACTORS.transport.train_km;
      break;
    case 'Bike/Walk':
    default:
      transport_factor = EMISSION_FACTORS.transport.bike_walk;
      break;
  }

  const short_distance_per_flight = 800; // km
  const long_distance_per_flight = 6000; // km
  const short_factor = EMISSION_FACTORS.transport.flight_short_km;
  const long_factor = EMISSION_FACTORS.transport.flight_long_km;

  const transport_kg = (q2 * 365 * transport_factor) +
                       (q3 * short_distance_per_flight * short_factor) +
                       (q4 * long_distance_per_flight * long_factor);

  // 2. Energy Annual Calculations (kg CO2e / year)
  let energy_factor = 0;
  switch (q5) {
    case 'Electricity (Grid)':
      energy_factor = EMISSION_FACTORS.energy.electricity_kwh;
      break;
    case 'Electricity (Solar/Renewable)':
      energy_factor = EMISSION_FACTORS.energy.renewable_kwh;
      break;
    case 'Natural Gas':
      energy_factor = EMISSION_FACTORS.energy.natural_gas_m3;
      break;
    case 'LPG':
      energy_factor = EMISSION_FACTORS.energy.lpg_kg;
      break;
    default:
      energy_factor = EMISSION_FACTORS.energy.electricity_kwh;
      break;
  }

  const energy_kg = q6 * 12 * energy_factor;

  // 3. Diet Annual Calculations (kg CO2e / year)
  let diet_kg = 0;
  switch (q7) {
    case 'Meat-heavy':
      diet_kg = EMISSION_FACTORS.diet.meat_heavy;
      break;
    case 'Moderate meat':
      diet_kg = EMISSION_FACTORS.diet.meat_moderate;
      break;
    case 'Vegetarian':
      diet_kg = EMISSION_FACTORS.diet.vegetarian;
      break;
    case 'Vegan':
      diet_kg = EMISSION_FACTORS.diet.vegan;
      break;
    default:
      diet_kg = EMISSION_FACTORS.diet.vegetarian;
      break;
  }

  // 4. Shopping Annual Calculations (kg CO2e / year)
  let shopping_kg = 0;
  switch (q8) {
    case 'High consumer':
      shopping_kg = EMISSION_FACTORS.shopping.high_consumer;
      break;
    case 'Average consumer':
      shopping_kg = EMISSION_FACTORS.shopping.average_consumer;
      break;
    case 'Minimal consumer':
      shopping_kg = EMISSION_FACTORS.shopping.minimal_consumer;
      break;
    default:
      shopping_kg = EMISSION_FACTORS.shopping.average_consumer;
      break;
  }

  // Total
  const total_kg = transport_kg + energy_kg + diet_kg + shopping_kg;

  // Compare with averages
  const vs_india_pct = Math.round((total_kg / EMISSION_FACTORS.india_average_kg) * 100);
  const vs_global_pct = Math.round((total_kg / EMISSION_FACTORS.global_average_kg) * 100);

  // Breakdown percentages
  const transport_pct = total_kg > 0 ? (transport_kg / total_kg) * 100 : 0;
  const energy_pct = total_kg > 0 ? (energy_kg / total_kg) * 100 : 0;
  const diet_pct = total_kg > 0 ? (diet_kg / total_kg) * 100 : 0;
  const shopping_pct = total_kg > 0 ? (shopping_kg / total_kg) * 100 : 0;

  const breakdown = [
    { label: 'Transport', kg: Math.round(transport_kg), pct: Math.round(transport_pct * 10) / 10 },
    { label: 'Energy',    kg: Math.round(energy_kg),    pct: Math.round(energy_pct * 10) / 10 },
    { label: 'Diet',      kg: Math.round(diet_kg),      pct: Math.round(diet_pct * 10) / 10 },
    { label: 'Shopping',  kg: Math.round(shopping_kg),  pct: Math.round(shopping_pct * 10) / 10 }
  ];

  return {
    transport_kg: Math.round(transport_kg * 100) / 100,
    energy_kg: Math.round(energy_kg * 100) / 100,
    diet_kg,
    shopping_kg,
    total_kg: Math.round(total_kg * 100) / 100,
    vs_india_pct,
    vs_global_pct,
    breakdown
  };
}
