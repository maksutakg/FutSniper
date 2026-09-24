function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

function randBetween(rand, min, max) {
  return Math.round(min + rand() * (max - min));
}

export function createPacer(settings, { now, rand, today, daily }) {
  const startedAt = now();
  let sessionSearches = 0;
  let buys = 0;
  let sinceBreak = 0;
  let breakAt = randInt(rand, settings.breakEveryMin, settings.breakEveryMax);
  let dailyDate = daily.date;
  let dailyCount = daily.count;

  function syncDay() {
    const d = today();
    if (d !== dailyDate) {
      dailyDate = d;
      dailyCount = 0;
    }
  }

  function next() {
    syncDay();
    if (buys >= settings.maxBuys) return { action: 'stop', reason: 'maxBuys' };
    if (sessionSearches >= settings.sessionMaxSearches) return { action: 'stop', reason: 'sessionSearches' };
    if (now() - startedAt >= settings.sessionMaxMs) return { action: 'stop', reason: 'sessionTime' };
    if (dailyCount >= settings.dailyMaxSearches) return { action: 'stop', reason: 'daily' };
    if (sinceBreak >= breakAt) {
      sinceBreak = 0;
      breakAt = randInt(rand, settings.breakEveryMin, settings.breakEveryMax);
      return { action: 'break', waitMs: randBetween(rand, settings.breakMinMs, settings.breakMaxMs) };
    }
    return { action: 'search', waitMs: randBetween(rand, settings.delayMinMs, settings.delayMaxMs) };
  }

  function recordSearch() {
    syncDay();
    sessionSearches++;
    dailyCount++;
    sinceBreak++;
  }

  function recordBuy() {
    buys++;
  }

  function stats() {
    return { sessionSearches, buys, daily: { date: dailyDate, count: dailyCount } };
  }

  return { next, recordSearch, recordBuy, stats };
}
