export const MIN_PRICE = 150;
export const MIN_BUY_RATIO = 0.4;

const STEPS = [
  [1000, 50],
  [10000, 100],
  [50000, 250],
  [100000, 500],
  [Infinity, 1000],
];

export function stepFor(price) {
  for (const [limit, step] of STEPS) {
    if (price < limit) return step;
  }
}

export function roundDown(price) {
  const step = stepFor(price);
  return Math.floor(price / step) * step;
}

// Web App arama sonuçlarını önbellekten döndürmesin diye her aramada farklı bir min buy.
export function randomMinBuy(maxBuy, rand) {
  const cap = Math.floor(maxBuy * MIN_BUY_RATIO);
  const options = [0];
  for (let p = MIN_PRICE; p <= cap; p += stepFor(p)) options.push(p);
  return options[Math.floor(rand() * options.length)];
}
