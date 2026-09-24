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

// v1 kayıtları tüm ayarları (varsayılanlar dahil) saklıyordu; v2 yalnızca kullanıcının değiştirdiklerini.
const SETTINGS_VERSION = 2;
const REMOVED_KEYS = ['sessionMaxSearches', 'sessionMaxMs'];
const V1_DAILY_DEFAULT = 2500;

function migrate(saved) {
  if (saved._v === SETTINGS_VERSION) return saved;
  const out = { ...saved };
  for (const key of REMOVED_KEYS) delete out[key];
  // v1 varsayılanı olduğu gibi kaydedilmişti; kullanıcının seçimi değil, yeni varsayılana bırak
  if (out.dailyMaxSearches === V1_DAILY_DEFAULT) delete out.dailyMaxSearches;
  return out;
}

export function loadSettings(storage) {
  try {
    const { _v, ...saved } = migrate(JSON.parse(storage.getItem(SETTINGS_KEY)) ?? {});
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

// Varsayılana eşit ayarlar saklanmaz: varsayılanlar değişince dokunulmamış ayarlar yeni değeri alır.
export function saveSettings(storage, settings) {
  const changed = { _v: SETTINGS_VERSION };
  for (const [key, value] of Object.entries(settings)) {
    if (JSON.stringify(value) !== JSON.stringify(DEFAULTS[key])) changed[key] = value;
  }
  storage.setItem(SETTINGS_KEY, JSON.stringify(changed));
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
