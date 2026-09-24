import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStatus, normalizeItem, MarketError, createMarket } from '../src/market.js';

test('classifyStatus bilinen kodlar', () => {
  assert.equal(classifyStatus(458), 'captcha');
  assert.equal(classifyStatus(429), 'rateLimited');
  assert.equal(classifyStatus(512), 'rateLimited');
  assert.equal(classifyStatus(521), 'rateLimited');
  assert.equal(classifyStatus(494), 'rateLimited');
  assert.equal(classifyStatus(401), 'sessionExpired');
  assert.equal(classifyStatus(461), 'lost');
  assert.equal(classifyStatus(426), 'lost');
  assert.equal(classifyStatus(478), 'lost');
  assert.equal(classifyStatus(470), 'insufficientCoins');
  assert.equal(classifyStatus(473), 'pileFull');
});

test('classifyStatus 5xx server, geri kalanı unknown', () => {
  assert.equal(classifyStatus(500), 'server');
  assert.equal(classifyStatus(503), 'server');
  assert.equal(classifyStatus(20000), 'unknown');
  assert.equal(classifyStatus(999), 'unknown');
  assert.equal(classifyStatus(undefined), 'unknown');
});

test('normalizeItem ilan ve kart alanlarını çıkarır', () => {
  const raw = { definitionId: 50565067, rating: 89, rareflag: 3, _auction: { tradeId: '42', buyNowPrice: 9000 } };
  assert.deepEqual(normalizeItem(raw), {
    tradeId: '42', buyNowPrice: 9000, definitionId: 50565067, rating: 89, rareflag: 3, raw,
  });
});

function fakeGlobals({ searchRes, bidRes, strings = {} }) {
  const calls = { criteria: null, bid: null, cleared: 0 };
  const observable = (res) => ({ observe: (_scope, cb) => cb(null, res) });
  class UTSearchCriteriaDTO {}
  return {
    calls,
    g: {
      UTSearchCriteriaDTO,
      SearchType: { PLAYER: 'player' },
      services: {
        // Web App eksik çevirilerde anahtarı '*' önekiyle döndürür
        Localization: { localize: (k) => strings[k] ?? `*${k}` },
        Item: {
          clearTransferMarketCache() { calls.cleared++; },
          searchTransferMarket(c, page) { calls.criteria = { ...c, page }; return observable(searchRes); },
          bid(item, price) { calls.bid = { item, price }; return observable(bidRes); },
        },
      },
    },
  };
}

test('search önbelleği temizler, kriterleri kurar ve sonuçları normalize eder', async () => {
  const raw = { definitionId: 123, rating: 80, rareflag: 1, _auction: { tradeId: '1', buyNowPrice: 5000 } };
  const { g, calls } = fakeGlobals({ searchRes: { success: true, status: 200, data: { items: [raw] } } });
  const items = await createMarket(g).search({ playerId: 123, cardId: null, maxBuy: 6000, minBuy: 300 });
  assert.deepEqual(items, [{ tradeId: '1', buyNowPrice: 5000, definitionId: 123, rating: 80, rareflag: 1, raw }]);
  assert.equal(calls.cleared, 1);
  assert.equal(calls.criteria.type, 'player');
  assert.equal(calls.criteria.maskedDefId, 123);
  assert.equal(calls.criteria.defId, undefined);
  assert.equal(calls.criteria.maxBuy, 6000);
  assert.equal(calls.criteria.minBuy, 300);
  assert.equal(calls.criteria.page, 1);
});

test('cardId verilince sadece o versiyon aranır (defId), maskedDefId kullanılmaz', async () => {
  const { g, calls } = fakeGlobals({ searchRes: { success: true, status: 200, data: { items: [] } } });
  await createMarket(g).search({ playerId: 233419, cardId: 50565067, maxBuy: 2000000, minBuy: 0 });
  assert.deepEqual(calls.criteria.defId, [50565067]);
  assert.equal(calls.criteria.maskedDefId, undefined);
});

test('search başarısızsa MarketError fırlatır', async () => {
  const { g } = fakeGlobals({ searchRes: { success: false, status: 458 } });
  await assert.rejects(
    createMarket(g).search({ playerId: 1, maxBuy: 1000, minBuy: 0 }),
    (err) => err instanceof MarketError && err.kind === 'captcha' && err.status === 458,
  );
});

test('hata kodu önce res.error.code alanından okunur', async () => {
  const { g } = fakeGlobals({ searchRes: { success: false, status: 200, error: { code: 458 } } });
  await assert.rejects(
    createMarket(g).search({ playerId: 1, maxBuy: 1000, minBuy: 0 }),
    (err) => err.kind === 'captcha' && err.status === 458,
  );
});

test('buy BIN fiyatıyla bid çağırır, hatada MarketError', async () => {
  const raw = { _auction: { tradeId: '1', buyNowPrice: 5000 } };
  const ok = fakeGlobals({ bidRes: { success: true } });
  await createMarket(ok.g).buy({ tradeId: '1', buyNowPrice: 5000, raw });
  assert.deepEqual(ok.calls.bid, { item: raw, price: 5000 });

  const bad = fakeGlobals({ bidRes: { success: false, status: 461 } });
  await assert.rejects(
    createMarket(bad.g).buy({ tradeId: '1', buyNowPrice: 5000, raw }),
    (err) => err.kind === 'lost',
  );
});

test('rarityName Web App çevirisini kullanır, çeviri yoksa kodu gösterir', () => {
  const { g } = fakeGlobals({ strings: { 'item.raretype3': 'Team of the Week' } });
  const market = createMarket(g);
  assert.equal(market.rarityName(3), 'Team of the Week');
  assert.equal(market.rarityName(99), 'Özel (99)');
});
