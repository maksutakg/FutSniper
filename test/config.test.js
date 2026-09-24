import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, loadSettings, saveSettings, todayKey, loadDaily, saveDaily, delayWarning,
} from '../src/config.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

test('boş storage varsayılanları döndürür, dryRun açık', () => {
  const s = loadSettings(memoryStorage());
  assert.deepEqual(s, { ...DEFAULTS });
  assert.equal(s.dryRun, true);
  assert.equal(s.delayMinMs, 3500);
  assert.equal(s.dailyMaxSearches, 3500);
  assert.equal(s.workMinMs, 2400000);
  assert.equal(s.restMinMs, 1200000);
});

test('kaydedilen ayarlar varsayılanlarla birleşir', () => {
  const st = memoryStorage();
  saveSettings(st, { maxBuy: 12000, dryRun: false });
  const s = loadSettings(st);
  assert.equal(s.maxBuy, 12000);
  assert.equal(s.dryRun, false);
  assert.equal(s.delayMaxMs, DEFAULTS.delayMaxMs);
});

test('bozuk JSON varsayılanlara düşer', () => {
  const st = memoryStorage();
  st.setItem('futSniper.settings', '{bozuk');
  assert.deepEqual(loadSettings(st), { ...DEFAULTS });
});

test('todayKey yerel tarih formatı', () => {
  assert.equal(todayKey(new Date(2026, 8, 4, 23, 59)), '2026-09-04');
});

test('loadDaily aynı gün sayacı korur, farklı gün sıfırlar', () => {
  const st = memoryStorage();
  assert.deepEqual(loadDaily(st, '2026-09-24'), { date: '2026-09-24', count: 0 });
  saveDaily(st, { date: '2026-09-24', count: 120 });
  assert.deepEqual(loadDaily(st, '2026-09-24'), { date: '2026-09-24', count: 120 });
  assert.deepEqual(loadDaily(st, '2026-09-25'), { date: '2026-09-25', count: 0 });
});

test('delayWarning 3000 ms altında uyarır', () => {
  assert.equal(delayWarning({ delayMinMs: 3500 }), null);
  assert.equal(delayWarning({ delayMinMs: 3000 }), null);
  assert.match(delayWarning({ delayMinMs: 2000 }), /3 sn/);
});
