import { SETTINGS_KEY, STORAGE_KEY } from './constants.js';

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadRecords() {
  return readJson(STORAGE_KEY, []);
}

export function saveRecords(records) {
  writeJson(STORAGE_KEY, records);
}

export function loadSettings() {
  return readJson(SETTINGS_KEY, { demoLoaded: false });
}

export function saveSettings(settings) {
  writeJson(SETTINGS_KEY, settings);
}
