/**
 * storage.js
 *
 * LocalStorage abstraction for profile and footprint data persistence.
 * Falls back to an in-memory store if localStorage is unavailable
 * (e.g., sandboxed environments, headless test runners, private-mode browsers).
 *
 * Privacy Guarantee: No data is ever sent to any remote server.
 * All persistence is strictly local (localStorage / in-memory fallback).
 * This is a core pillar of the Zero-Backend, Local-First Privacy-Centric Architecture.
 *
 * @module utils/storage
 */
'use strict';

const memoryStore = {};

/**
 * Saves profile data.
 * @param {object} data - Profile answers
 */
export function saveProfile(data) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('carbonsense_profile', JSON.stringify(data));
    } else {
      memoryStore['carbonsense_profile'] = JSON.stringify(data);
    }
  } catch (e) {
    console.error('Error saving profile:', e);
  }
}

/**
 * Loads profile data.
 * @returns {object|null} Saved profile or null
 */
export function loadProfile() {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('carbonsense_profile');
      return data ? JSON.parse(data) : null;
    } else {
      const data = memoryStore['carbonsense_profile'];
      return data ? JSON.parse(data) : null;
    }
  } catch (e) {
    console.error('Error loading profile:', e);
    return null;
  }
}

/**
 * Saves footprint calculation results.
 * @param {object} data - Footprint results
 */
export function saveFootprint(data) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('carbonsense_footprint', JSON.stringify(data));
    } else {
      memoryStore['carbonsense_footprint'] = JSON.stringify(data);
    }
  } catch (e) {
    console.error('Error saving footprint:', e);
  }
}

/**
 * Loads footprint calculation results.
 * @returns {object|null} Saved footprint or null
 */
export function loadFootprint() {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('carbonsense_footprint');
      return data ? JSON.parse(data) : null;
    } else {
      const data = memoryStore['carbonsense_footprint'];
      return data ? JSON.parse(data) : null;
    }
  } catch (e) {
    console.error('Error loading footprint:', e);
    return null;
  }
}

/**
 * Clears saved profile and footprint data.
 */
export function clearAll() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('carbonsense_profile');
      localStorage.removeItem('carbonsense_footprint');
    }
    delete memoryStore['carbonsense_profile'];
    delete memoryStore['carbonsense_footprint'];
  } catch (e) {
    console.error('Error clearing storage:', e);
  }
}
