import { randomMinBuy } from './pricing.js';

export const SERVER_RETRY_MS = 30000;

// Max altındaki ilanlar, ucuzdan pahalıya. cardId verilirse başka versiyonlar asla seçilmez
// (sunucu defId filtresine ek güvenlik).
export function pickEligible(items, maxBuy, cardId = null) {
  const eligible = items.filter((i) => i.buyNowPrice > 0 && i.buyNowPrice <= maxBuy
    && (!cardId || i.definitionId === cardId));
  return eligible.sort((a, b) => a.buyNowPrice - b.buyNowPrice);
}

export function createInterruptibleSleep() {
  let timer = null;
  let wake = null;
  return {
    sleep(ms) {
      return new Promise((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, ms);
      });
    },
    interrupt() {
      clearTimeout(timer);
      if (wake) wake();
    },
  };
}

export function createSniper({
  market, pacer, settings, sleep, rand,
  onLog = () => {}, onBuy = () => {}, onSearch = () => {},
}) {
  let stopped = false;

  async function search(criteria) {
    pacer.recordSearch();
    onSearch();
    return market.search(criteria);
  }

  // 5xx yalnızca aramada tekrar denenir; satın almada tekrar denemek çift alım riski taşır.
  async function searchWithRetry(criteria) {
    try {
      return await search(criteria);
    } catch (err) {
      if (err.kind !== 'server') throw err;
      onLog(`Sunucu hatası (${err.status}), ${SERVER_RETRY_MS / 1000} sn sonra tekrar denenecek`);
      await sleep(SERVER_RETRY_MS);
      if (stopped) return [];
      return search(criteria);
    }
  }

  function failure(err) {
    const reason = err.kind ?? 'unknown';
    onLog(`Durdu: ${err.message}`);
    return { reason, error: err };
  }

  async function run() {
    while (!stopped) {
      const step = pacer.next();
      if (step.action === 'stop') return { reason: step.reason };
      if (step.action === 'break') onLog(`Mola: ${Math.round(step.waitMs / 1000)} sn`);
      await sleep(step.waitMs);
      if (stopped) break;
      if (step.action === 'break') continue;

      const criteria = {
        playerId: settings.player.id,
        cardId: settings.player.cardId,
        maxBuy: settings.maxBuy,
        minBuy: randomMinBuy(settings.maxBuy, rand),
      };
      let items;
      try {
        items = await searchWithRetry(criteria);
      } catch (err) {
        return failure(err);
      }

      // Ucuz ilanlar çoğu zaman toplu gelir: biri kaçarsa ya da alınırsa yeni arama beklemeden sıradakine geç.
      for (const target of pickEligible(items, settings.maxBuy, settings.player.cardId)) {
        if (stopped || pacer.stats().buys >= settings.maxBuys) break;

        if (settings.dryRun) {
          onLog(`[DRY-RUN] ${target.buyNowPrice} coin'e alınırdı (trade ${target.tradeId})`);
          continue;
        }

        try {
          await market.buy(target);
        } catch (err) {
          if (err.kind === 'lost') {
            onLog(`Kaçtı: ${target.buyNowPrice} coin (${err.status})`);
            continue;
          }
          return failure(err);
        }
        pacer.recordBuy();
        onLog(`ALINDI: ${target.buyNowPrice} coin (trade ${target.tradeId})`);
        onBuy(target);
      }
    }
    return { reason: 'manual' };
  }

  return {
    run,
    stop() {
      stopped = true;
    },
  };
}
