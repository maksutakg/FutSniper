import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupVersions } from '../src/versions.js';

const it = (definitionId, rating, rareflag, buyNowPrice) => ({ definitionId, rating, rareflag, buyNowPrice });

test('groupVersions kartları definitionId ile gruplar, en ucuzdan pahalıya sıralar', () => {
  const items = [
    it(50565067, 89, 3, 1900000),
    it(233419, 88, 0, 725000),
    it(233419, 88, 0, 715000),
    it(50565067, 89, 3, 1843000),
    it(233419, 88, 0, 800000),
  ];
  assert.deepEqual(groupVersions(items), [
    { cardId: 233419, rating: 88, rareflag: 0, listings: 3, minPrice: 715000 },
    { cardId: 50565067, rating: 89, rareflag: 3, listings: 2, minPrice: 1843000 },
  ]);
});

test('groupVersions boş listede boş döner', () => {
  assert.deepEqual(groupVersions([]), []);
});
