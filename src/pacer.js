function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

function randBetween(rand, min, max) {
  return Math.round(min + rand() * (max - min));
}

export function createPacer(settings, { now, rand, today, daily }) {
  let sessionSearches = 0;
  let buys = 0;
  let sinceBreak = 0;
  let breakAt = randInt(rand, settings.breakEveryMin, settings.breakEveryMax);
  let workEndsAt = now() + randBetween(rand, settings.workMinMs, settings.workMaxMs);
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
    if (dailyCount >= settings.dailyMaxSearches) return { action: 'stop', reason: 'daily' };
    if (now() >= workEndsAt) {
      const restMs = randBetween(rand, settings.restMinMs, settings.restMaxMs);
      workEndsAt = now() + restMs + randBetween(rand, settings.workMinMs, settings.workMaxMs);
      sinceBreak = 0;
      return { action: 'rest', waitMs: restMs };
    }
    if (sinceBreak >= breakAt) {
      sinceBreak = 0;
      breakAt = randInt(rand, settings.breakEveryMin, settings.breakEveryMax);
      return { action: 'break', waitMs: randBetween(rand, settings.breakMinMs, settings.breakMaxMs) };
    }
    // Hep aynı aralıkla arama makine gibi görünür: arada bir "dalgınlık" duraklaması.
    const hiccup = rand() >= 1 - settings.hiccupChance;
    const waitMs = hiccup
      ? randBetween(rand, settings.hiccupMinMs, settings.hiccupMaxMs)
      : randBetween(rand, settings.delayMinMs, settings.delayMaxMs);
    return { action: 'search', waitMs };
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
