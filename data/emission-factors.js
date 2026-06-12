/**
 * emission-factors.js
 *
 * IPCC/EPA-based CO₂e emission coefficients and national/global reference averages.
 * All values are static, frozen constants for deterministic, auditable calculations.
 *
 * Deterministic Mathematical Compliance: These constants are the ground truth
 * for all carbon calculations. They cannot be overridden at runtime. The frozen
 * Object ensures any attempted mutation throws a TypeError in strict mode.
 *
 * Factor Sources:
 *  - transport: IPCC AR6 WGIII (2022), DEFRA GHG Conversion Factors (2023)
 *  - energy.electricity_kwh: CEA Annual Report 2023 — India grid average
 *  - energy.natural_gas_m3: IPCC AR5 — natural gas combustion
 *  - diet: Poore & Nemecek (2018), Science 360(6392)
 *  - shopping: WRAP UK clothing/electronics lifecycle estimates
 *  - india_average_kg: World Bank, 2022
 *  - global_average_kg: World Bank, 2022
 *
 * @module data/emission-factors
 */
'use strict';

export const EMISSION_FACTORS = Object.freeze({
  transport: Object.freeze({
    car_petrol_km: 0.192,       // kg CO2e per km
    car_diesel_km: 0.171,
    car_electric_km: 0.053,
    car_none: 0,
    flight_short_km: 0.255,     // <3hr flight per km
    flight_long_km: 0.195,      // >3hr flight per km
    bus_km: 0.089,
    train_km: 0.041,
    bike_walk: 0
  }),
  energy: Object.freeze({
    electricity_kwh: 0.233,     // India grid average kg CO2e/kWh
    natural_gas_m3: 2.04,
    lpg_kg: 2.98,
    renewable_kwh: 0.020
  }),
  diet: Object.freeze({
    meat_heavy: 3300,           // kg CO2e per year
    meat_moderate: 2500,
    vegetarian: 1700,
    vegan: 1500
  }),
  shopping: Object.freeze({
    high_consumer: 4000,        // kg CO2e per year (clothing, electronics)
    average_consumer: 2500,
    minimal_consumer: 1200
  }),
  global_average_kg: 4600,
  india_average_kg: 1900
});
