export const DEFAULTS = Object.freeze({
  delayMinMs: 3500,
  delayMaxMs: 6000,
  breakEveryMin: 25,
  breakEveryMax: 35,
  breakMinMs: 15000,
  breakMaxMs: 30000,
  // aramaların bu kadarında kısa "dalgınlık" duraklaması (insan gibi düzensizlik)
  hiccupChance: 0.08,
  hiccupMinMs: 10000,
  hiccupMaxMs: 25000,
  // çalış–dinlen döngüsü: dinlenmeden sonra kendiliğinden devam eder
  workMinMs: 2400000,
  workMaxMs: 3600000,
  restMinMs: 1200000,
  restMaxMs: 2400000,
  dailyMaxSearches: 3500,
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
