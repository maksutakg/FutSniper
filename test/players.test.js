import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPlayersUrl, parsePlayersJson, searchPlayers } from '../src/players.js';

test('findPlayersUrl players.json kaynağını bulur, players_meta.json değil', () => {
  const urls = [
    'https://www.ea.com/x/app.js',
    'https://www.ea.com/x/content/abc/2027/fut/items/web/players_meta.json',
    'https://www.ea.com/x/content/abc/2027/fut/items/web/players.json?v=3',
  ];
  assert.equal(findPlayersUrl(urls), urls[2]);
  assert.equal(findPlayersUrl(['https://a/b.js']), null);
});

test('parsePlayersJson ortak isim yoksa ad soyad kullanır', () => {
  const json = {
    LegendsPlayers: [{ id: 1, f: 'Zinedine', l: 'Zidane', r: 96 }],
    Players: [{ id: 2, f: 'Kylian', l: 'Mbappé Lottin', c: 'Mbappé', r: 91 }],
  };
  assert.deepEqual(parsePlayersJson(json), [
    { id: 1, name: 'Zinedine Zidane', rating: 96 },
    { id: 2, name: 'Mbappé', rating: 91 },
  ]);
});

const PLAYERS = [
  { id: 1, name: 'Arda Güler', rating: 82 },
  { id: 2, name: 'Kylian Mbappé', rating: 91 },
  { id: 3, name: 'Kerem Aktürkoğlu', rating: 79 },
  { id: 4, name: 'Mbappé Test', rating: 60 },
];

test('searchPlayers aksansız ve büyük/küçük harf duyarsız eşleşir', () => {
  assert.deepEqual(searchPlayers(PLAYERS, 'guler').map((p) => p.id), [1]);
  assert.deepEqual(searchPlayers(PLAYERS, 'MBAPPE').map((p) => p.id), [2, 4]);
});

test('searchPlayers 2 karakterden kısa sorguda boş, limit uygular', () => {
  assert.deepEqual(searchPlayers(PLAYERS, 'a'), []);
  assert.equal(searchPlayers(PLAYERS, 'er', 1).length, 1);
});
