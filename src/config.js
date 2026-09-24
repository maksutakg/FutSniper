export const DEFAULTS = Object.freeze({
  delayMinMs: 3500,
  delayMaxMs: 6000,
  breakEveryMin: 25,
  breakEveryMax: 35,
  breakMinMs: 15000,
  breakMaxMs: 30000,
  sessionMaxSearches: 650,
  sessionMaxMs: 3600000,
  dailyMaxSearches: 2500,
  maxBuys: 5,
  dryRun: true,
  maxBuy: 0,
  player: null,
});

export const MIN_SAFE_DELAY_MS = 3000;

const SETTINGS_KEY = 'futSniper.settings';
const DAILY_KEY = 'futSniper.daily';

export function loadSettings(storage) {
  try {
    return { ...DEFAULTS, ...(JSON.parse(storage.getItem(SETTINGS_KEY)) ?? {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(storage, settings) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadDaily(storage, today) {
  try {
    const daily = JSON.parse(storage.getItem(DAILY_KEY));
    if (daily && daily.date === today && Number.isInteger(daily.count)) return daily;
  } catch {
    // bozuk kayıt: sıfırdan başla
  }
  return { date: today, count: 0 };
}

export function saveDaily(storage, daily) {
  storage.setItem(DAILY_KEY, JSON.stringify(daily));
}

export function delayWarning(settings) {
  return settings.delayMinMs < MIN_SAFE_DELAY_MS
    ? 'Uyarı: 3 sn altı bekleme soft ban riskini ciddi artırır.'
    : null;
}
