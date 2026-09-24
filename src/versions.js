// Bir oyuncunun piyasadaki kart versiyonları (normal, TOTW, …); her versiyonun kendi definitionId'si var.
export function groupVersions(items) {
  const byCard = new Map();
  for (const i of items) {
    const v = byCard.get(i.definitionId)
      ?? { cardId: i.definitionId, rating: i.rating, rareflag: i.rareflag, listings: 0, minPrice: Infinity };
    v.listings++;
    if (i.buyNowPrice > 0) v.minPrice = Math.min(v.minPrice, i.buyNowPrice);
    byCard.set(i.definitionId, v);
  }
  return [...byCard.values()].sort((a, b) => a.minPrice - b.minPrice);
}
