import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSniper, pickEligible, SERVER_RETRY_MS } from '../src/sniper.js';
import { createPacer } from '../src/pacer.js';
import { MarketError } from '../src/market.js';
import { DEFAULTS } from '../src/config.js';

const CARD = 50000123;
const PLAYER = { id: 123, name: 'Test', rating: 80, cardId: CARD };

function setup({ settings = {}, searches, buys = [] }) {
  const s = { ...DEFAULTS, player: PLAYER, maxBuy: 10000, dryRun: false, ...settings };
  const pacer = createPacer(s, {
    now: () => 0, rand: () => 0, today: () => '2026-09-24', daily: { date: '2026-09-24', count: 0 },
  });
  const calls = { search: [], buy: [], sleep: [], log: [] };
  let sniper;
  const market = {
    async search(criteria) {
      calls.search.push(criteria);
      const next = searches.shift();
      if (typeof next === 'function') return next(sniper);
      if (next instanceof Error) throw next;
      return next ?? [];
    },
    async buy(item) {
      calls.buy.push(item);
      const next = buys.shift();
      if (next instanceof Error) throw next;
    },
  };
  sniper = createSniper({
    market,
    pacer,
    settings: s,
    sleep: async (ms) => { calls.sleep.push(ms); },
    rand: () => 0,
    onLog: (m) => calls.log.push(m),
  });
  return { sniper, calls };
}

const item = (tradeId, buyNowPrice, definitionId = CARD) => ({ tradeId, buyNowPrice, definitionId, raw: {} });

const ids = (items) => items.map((i) => i.tradeId);

test('pickEligible max altındakileri ucuzdan pahalıya sıralar', () => {
  const items = [item(1, 9500), item(2, 9000), item(3, 12000), item(4, 0)];
  assert.deepEqual(ids(pickEligible(items, 10000)), [2, 1]);
  assert.deepEqual(pickEligible([item(1, 12000)], 10000), []);
  assert.deepEqual(pickEligible([], 10000), []);
});

test('pickEligible cardId verilince sadece o versiyonu seçer', () => {
  const items = [item(1, 5000, 123), item(2, 9000, CARD)];
  assert.deepEqual(ids(pickEligible(items, 10000, CARD)), [2]);
  assert.deepEqual(pickEligible([item(1, 5000, 123)], 10000, CARD), []);
  assert.deepEqual(ids(pickEligible(items, 10000, null)), [1, 2]);
});

test('ilk ilan kaçarsa aynı sonuçtaki sıradakini beklemeden dener', async () => {
  const { sniper, calls } = setup({
    settings: { maxBuys: 1 },
    searches: [[item(1, 9000), item(2, 9500), item(3, 9800)]],
    buys: [new MarketError('lost', 461)],
  });
  assert.equal((await sniper.run()).reason, 'maxBuys');
  assert.deepEqual(ids(calls.buy), [1, 2]);
  assert.equal(calls.search.length, 1);
});

test('aynı sonuçtaki birden fazla ucuz ilanı alım sınırına kadar alır', async () => {
  const { sniper, calls } = setup({
    settings: { maxBuys: 2 },
    searches: [[item(1, 9000), item(2, 9500), item(3, 9800)]],
  });
  assert.equal((await sniper.run()).reason, 'maxBuys');
  assert.deepEqual(ids(calls.buy), [1, 2]);
  assert.equal(calls.search.length, 1);
});

test('dry-run aynı sonuçtaki her uygun ilanı loglar, hiçbirini almaz', async () => {
  const { sniper, calls } = setup({
    settings: { dryRun: true, dailyMaxSearches: 1 },
    searches: [[item(1, 9000), item(2, 9500)]],
  });
  await sniper.run();
  assert.equal(calls.buy.length, 0);
  assert.equal(calls.log.filter((m) => m.includes('DRY-RUN')).length, 2);
});

test('arama sırasında stop() gelirse sonuçtaki ilanlar denenmez', async () => {
  const { sniper, calls } = setup({
    searches: [(sn) => { sn.stop(); return [item(1, 9000), item(2, 9500)]; }],
  });
  assert.equal((await sniper.run()).reason, 'manual');
  assert.equal(calls.buy.length, 0);
});

test('yanlış versiyondaki ucuz ilan alınmaz', async () => {
  const { sniper, calls } = setup({
    settings: { dailyMaxSearches: 1 },
    searches: [[item(1, 1000, 123)]],
  });
  assert.equal((await sniper.run()).reason, 'daily');
  assert.equal(calls.buy.length, 0);
});

test('max altında sonuç gelince en ucuzu hemen alır', async () => {
  const { sniper, calls } = setup({
    settings: { maxBuys: 1 },
    searches: [[item(1, 9500), item(2, 9000), item(3, 12000)]],
  });
  const result = await sniper.run();
  assert.equal(result.reason, 'maxBuys');
  assert.equal(calls.buy.length, 1);
  assert.equal(calls.buy[0].tradeId, 2);
  assert.deepEqual(calls.search[0], { playerId: 123, cardId: CARD, maxBuy: 10000, minBuy: 0 });
});

test('dry-run satın almaz, loglar', async () => {
  const { sniper, calls } = setup({
    settings: { dryRun: true, dailyMaxSearches: 3 },
    searches: [[item(1, 5000)], [item(2, 5000)], [item(3, 5000)]],
  });
  const result = await sniper.run();
  assert.equal(result.reason, 'daily');
  assert.equal(calls.buy.length, 0);
  assert.ok(calls.log.some((m) => m.includes('DRY-RUN')));
});

for (const kind of ['captcha', 'rateLimited', 'sessionExpired', 'insufficientCoins', 'unknown']) {
  test(`aramada ${kind} → durur`, async () => {
    const { sniper, calls } = setup({ searches: [new MarketError(kind, 999)] });
    const result = await sniper.run();
    assert.equal(result.reason, kind);
    assert.equal(calls.search.length, 1);
  });
}

test('satın almada lost → devam eder', async () => {
  const { sniper, calls } = setup({
    settings: { maxBuys: 1 },
    searches: [[item(1, 9000)], [item(2, 9000)]],
    buys: [new MarketError('lost', 461)],
  });
  const result = await sniper.run();
  assert.equal(result.reason, 'maxBuys');
  assert.equal(calls.buy.length, 2);
});

test('satın almada captcha → durur', async () => {
  const { sniper } = setup({
    searches: [[item(1, 9000)]],
    buys: [new MarketError('captcha', 458)],
  });
  assert.equal((await sniper.run()).reason, 'captcha');
});

test('aramada server hatası: 30 sn bekleyip 1 kez tekrar dener', async () => {
  const { sniper, calls } = setup({
    settings: { dailyMaxSearches: 3 },
    searches: [new MarketError('server', 503), [], []],
  });
  const result = await sniper.run();
  assert.equal(result.reason, 'daily');
  assert.ok(calls.sleep.includes(SERVER_RETRY_MS));
});

test('aramada art arda iki server hatası → durur', async () => {
  const { sniper, calls } = setup({
    searches: [new MarketError('server', 503), new MarketError('server', 503)],
  });
  const result = await sniper.run();
  assert.equal(result.reason, 'server');
  assert.equal(calls.search.length, 2);
});

test('stop() döngüyü manual sebebiyle bitirir', async () => {
  const { sniper } = setup({
    searches: [(s) => { s.stop(); return []; }],
  });
  assert.equal((await sniper.run()).reason, 'manual');
});

test('dinlenme adımında bekler, bildirir ve kendiliğinden devam eder', async () => {
  const s = { ...DEFAULTS, player: PLAYER, maxBuy: 10000, dryRun: false, dailyMaxSearches: 1 };
  const steps = [{ action: 'rest', waitMs: 1200000 }];
  const pacer = createPacer(s, {
    now: () => 0, rand: () => 0, today: () => '2026-09-24', daily: { date: '2026-09-24', count: 0 },
  });
  const realNext = pacer.next;
  pacer.next = () => steps.shift() ?? realNext();
  const sleeps = [];
  const phases = [];
  const logs = [];
  const sniper = createSniper({
    market: { async search() { return []; }, async buy() {} },
    pacer,
    settings: s,
    sleep: async (ms) => { sleeps.push(ms); },
    rand: () => 0,
    onLog: (m) => logs.push(m),
    onPhase: (phase, ms) => phases.push([phase, ms]),
  });
  assert.equal((await sniper.run()).reason, 'daily');
  assert.equal(sleeps[0], 1200000);
  assert.deepEqual(phases, [['rest', 1200000], ['work', undefined]]);
  assert.ok(logs.some((m) => m.includes('Dinleniyor: 20 dk')));
});
