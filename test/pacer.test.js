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

test('bekleme 3500–6000 ms aralığında', () => {
  const low = createPacer(DEFAULTS, deps({ rand: () => 0 })).next();
  assert.deepEqual(low, { action: 'search', waitMs: 3500 });
  const high = createPacer(DEFAULTS, deps({ rand: () => 0.999999 })).next();
  assert.equal(high.action, 'search');
  assert.ok(high.waitMs <= 6000 && high.waitMs >= 5999);
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

test('oturum arama sınırında durur', () => {
  const p = createPacer({ ...DEFAULTS, sessionMaxSearches: 3 }, deps());
  for (let i = 0; i < 3; i++) {
    p.next();
    p.recordSearch();
  }
  assert.deepEqual(p.next(), { action: 'stop', reason: 'sessionSearches' });
});

test('oturum süresi dolunca durur', () => {
  let t = 1000;
  const p = createPacer(DEFAULTS, deps({ now: () => t }));
  assert.equal(p.next().action, 'search');
  t = 1000 + 3600000;
  assert.deepEqual(p.next(), { action: 'stop', reason: 'sessionTime' });
});

test('günlük sınırda durur, gün değişince devam eder', () => {
  let day = '2026-09-24';
  const p = createPacer(DEFAULTS, deps({
    today: () => day,
    daily: { date: '2026-09-24', count: 2500 },
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
