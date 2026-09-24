import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPacer } from '../src/pacer.js';
import { DEFAULTS } from '../src/config.js';

function deps(overrides = {}) {
  return {
    now: () => 0,
    rand: () => 0,
    today: () => '2026-09-24',
    daily: { date: '2026-09-24', count: 0 },
    ...overrides,
  };
}

// Sırayla verilen değerleri döndürür, bitince 0 döner.
function seq(values) {
  const queue = [...values];
  return () => (queue.length ? queue.shift() : 0);
}

const NO_HICCUP = { ...DEFAULTS, hiccupChance: 0 };

test('bekleme 3500–6000 ms aralığında', () => {
  const low = createPacer(NO_HICCUP, deps({ rand: () => 0 })).next();
  assert.deepEqual(low, { action: 'search', waitMs: 3500 });
  const high = createPacer(NO_HICCUP, deps({ rand: () => 0.999999 })).next();
  assert.equal(high.action, 'search');
  assert.ok(high.waitMs <= 6000 && high.waitMs >= 5999);
});

test('aramaların ~%8inde 10–25 sn duraklama olur', () => {
  // kurulum 2 rand çeker (mola ve çalışma süresi); sonra duraklama zarı, sonra süre
  const hiccup = createPacer(DEFAULTS, deps({ rand: seq([0, 0, 0.95, 0]) })).next();
  assert.deepEqual(hiccup, { action: 'search', waitMs: 10000 });
  const normal = createPacer(DEFAULTS, deps({ rand: seq([0, 0, 0.5, 0]) })).next();
  assert.deepEqual(normal, { action: 'search', waitMs: 3500 });
  assert.equal(DEFAULTS.hiccupChance, 0.08);
});

test('rand=0 iken 25 aramadan sonra 15 sn mola', () => {
  const p = createPacer(DEFAULTS, deps());
  for (let i = 0; i < 25; i++) {
    assert.equal(p.next().action, 'search');
    p.recordSearch();
  }
  assert.deepEqual(p.next(), { action: 'break', waitMs: 15000 });
  assert.equal(p.next().action, 'search');
});

test('rand≈1 iken mola 35 aramada bir', () => {
  const p = createPacer(DEFAULTS, deps({ rand: () => 0.999999 }));
  for (let i = 0; i < 35; i++) {
    assert.equal(p.next().action, 'search');
    p.recordSearch();
  }
  assert.equal(p.next().action, 'break');
});

test('40 dk çalışınca 20 dk dinlenir, sonra kendiliğinden devam eder', () => {
  let t = 0;
  const p = createPacer(DEFAULTS, deps({ now: () => t }));
  assert.equal(p.next().action, 'search');
  t = 2400000 - 1;
  assert.equal(p.next().action, 'search');
  t = 2400000;
  assert.deepEqual(p.next(), { action: 'rest', waitMs: 1200000 });
  t = 3600000;
  assert.equal(p.next().action, 'search');
  // bir sonraki dinlenme: 2400000 + 1200000 dinlenme + 2400000 çalışma
  t = 6000000;
  assert.equal(p.next().action, 'rest');
});

test('rand≈1 iken 60 dk çalışır, 40 dk dinlenir', () => {
  let t = 0;
  const p = createPacer(DEFAULTS, deps({ now: () => t, rand: () => 0.999999 }));
  t = 3600000 - 1000;
  assert.equal(p.next().action, 'search');
  t = 3600000;
  const rest = p.next();
  assert.equal(rest.action, 'rest');
  assert.ok(rest.waitMs >= 2399000 && rest.waitMs <= 2400000);
});

test('dinlenme kısa mola sayacını sıfırlar', () => {
  let t = 0;
  const p = createPacer(DEFAULTS, deps({ now: () => t }));
  for (let i = 0; i < 20; i++) {
    p.next();
    p.recordSearch();
  }
  t = 2400000;
  assert.equal(p.next().action, 'rest');
  t = 3600000;
  for (let i = 0; i < 25; i++) {
    assert.equal(p.next().action, 'search');
    p.recordSearch();
  }
  assert.equal(p.next().action, 'break');
});

test('günlük 3500 sınırında durur, gün değişince devam eder', () => {
  let day = '2026-09-24';
  const p = createPacer(DEFAULTS, deps({
    today: () => day,
    daily: { date: '2026-09-24', count: 3500 },
  }));
  assert.deepEqual(p.next(), { action: 'stop', reason: 'daily' });
  day = '2026-09-25';
  assert.equal(p.next().action, 'search');
  p.recordSearch();
  assert.deepEqual(p.stats().daily, { date: '2026-09-25', count: 1 });
});

test('alım sınırında durur', () => {
  const p = createPacer({ ...DEFAULTS, maxBuys: 2 }, deps());
  p.recordBuy();
  assert.equal(p.next().action, 'search');
  p.recordBuy();
  assert.deepEqual(p.next(), { action: 'stop', reason: 'maxBuys' });
});

test('stats sayaçları', () => {
  const p = createPacer(DEFAULTS, deps({ daily: { date: '2026-09-24', count: 10 } }));
  p.recordSearch();
  p.recordSearch();
  p.recordBuy();
  assert.deepEqual(p.stats(), {
    sessionSearches: 2,
    buys: 1,
    daily: { date: '2026-09-24', count: 12 },
  });
});
