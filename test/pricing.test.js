import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepFor, roundDown, randomMinBuy, MIN_PRICE } from '../src/pricing.js';

test('stepFor aralık sınırları', () => {
  assert.equal(stepFor(150), 50);
  assert.equal(stepFor(999), 50);
  assert.equal(stepFor(1000), 100);
  assert.equal(stepFor(9999), 100);
  assert.equal(stepFor(10000), 250);
  assert.equal(stepFor(49999), 250);
  assert.equal(stepFor(50000), 500);
  assert.equal(stepFor(99999), 500);
  assert.equal(stepFor(100000), 1000);
  assert.equal(stepFor(2500000), 1000);
});

test('roundDown geçerli adıma aşağı yuvarlar', () => {
  assert.equal(roundDown(975), 950);
  assert.equal(roundDown(1049), 1000);
  assert.equal(roundDown(10100), 10000);
  assert.equal(roundDown(10260), 10250);
  assert.equal(roundDown(51234), 51000);
  assert.equal(roundDown(123456), 123000);
  assert.equal(roundDown(10000), 10000);
});

function isValidPrice(v) {
  return v === 0 || (v >= MIN_PRICE && roundDown(v) === v);
}

test('randomMinBuy her zaman geçerli, maxBuy altında ve %40 sınırında', () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const v = randomMinBuy(10000, Math.random);
    assert.ok(isValidPrice(v), `geçersiz fiyat: ${v}`);
    assert.ok(v < 10000);
    assert.ok(v <= 4000);
    seen.add(v);
  }
  assert.ok(seen.size > 1, 'rastgelelik yok');
});

test('randomMinBuy uç değerler', () => {
  assert.equal(randomMinBuy(10000, () => 0), 0);
  assert.equal(randomMinBuy(10000, () => 0.999999), 4000);
  assert.equal(randomMinBuy(200, () => 0.5), 0);
});
