import {
  loadSettings, saveSettings, loadDaily, saveDaily, todayKey, delayWarning,
} from './config.js';
import { roundDown } from './pricing.js';
import { createPacer } from './pacer.js';
import { createMarket } from './market.js';
import { createSniper, createInterruptibleSleep } from './sniper.js';
import { findPlayersUrl, parsePlayersJson, searchPlayers } from './players.js';
import { groupVersions } from './versions.js';
import { createPanel } from './ui.js';
import { alertUser, beep, requestNotificationPermission } from './alerts.js';

const REASONS = {
  manual: 'elle durduruldu',
  maxBuys: 'alım sınırına ulaşıldı',
  sessionSearches: 'oturum arama sınırı doldu',
  sessionTime: 'oturum süresi doldu',
  daily: 'günlük arama sınırı doldu',
  captcha: 'CAPTCHA — Web App\'te elle çöz',
  rateLimited: 'çok fazla istek / market kilitli (soft ban habercisi) — bir süre ara ver',
  sessionExpired: 'oturum düştü — tekrar giriş yap',
  insufficientCoins: 'yetersiz coin',
  pileFull: 'hedef liste dolu — Unassigned/Transfer listesini boşalt',
  server: 'sunucu hatası tekrarlandı',
  unknown: 'bilinmeyen hata',
};

// Kendi limitlerimiz dışındaki her durma kullanıcıyı uyarır.
const QUIET_REASONS = new Set(['manual', 'maxBuys', 'sessionSearches', 'sessionTime', 'daily']);

function waitForWebApp() {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (globalThis.services?.Item && globalThis.UTSearchCriteriaDTO) {
        clearInterval(timer);
        resolve();
      }
    }, 1000);
  });
}

const PLAYERS_POLL_MS = 2000;

// Web App players.json'ı servisler hazır olduktan birkaç saniye sonra (giriş ekranındaysa girişten sonra) yükler.
async function loadPlayers() {
  for (;;) {
    const url = findPlayersUrl(performance.getEntriesByType('resource').map((e) => e.name));
    if (url) {
      const res = await fetch(url);
      return parsePlayersJson(await res.json());
    }
    await new Promise((resolve) => setTimeout(resolve, PLAYERS_POLL_MS));
  }
}

async function main() {
  await waitForWebApp();
  const storage = localStorage;
  let settings = loadSettings(storage);
  let players = [];
  let active = null;

  const panel = createPanel({
    settings,
    onChange(next) {
      settings = { ...next, maxBuy: next.maxBuy > 0 ? roundDown(next.maxBuy) : 0 };
      saveSettings(storage, settings);
      if (settings.maxBuy !== next.maxBuy) panel.setMaxBuy(settings.maxBuy);
      panel.setWarning(delayWarning(settings));
    },
    onPlayerQuery: (q) => searchPlayers(players, q),
    onFetchVersions: fetchVersions,
    onStart: start,
    onStop() {
      active?.stop();
    },
  });
  panel.setWarning(delayWarning(settings));

  panel.log('Oyuncu listesi bekleniyor… (bu sırada ID ile de hedef seçebilirsin)');
  loadPlayers()
    .then((list) => {
      players = list;
      panel.log(`${list.length} oyuncu yüklendi`);
    })
    .catch((err) => panel.log(`Oyuncu listesi yüklenemedi: ${err.message}`));

  // Oyuncunun piyasadaki versiyonlarını tek aramayla bulur; bu arama da günlük sayaca eklenir.
  async function fetchVersions(player) {
    if (active) throw new Error('sniper çalışırken versiyon aranamaz');
    const market = createMarket();
    const items = await market.search({ playerId: player.id, cardId: null, maxBuy: 0, minBuy: 0 });
    const daily = loadDaily(storage, todayKey());
    saveDaily(storage, { ...daily, count: daily.count + 1 });
    return groupVersions(items).map((v) => ({
      ...v,
      label: `${v.rating} ${market.rarityName(v.rareflag)} — en ucuz ${v.minPrice.toLocaleString('tr-TR')} (${v.listings} ilan)`,
    }));
  }

  async function start() {
    if (active) return;
    if (!settings.player || !(settings.maxBuy > 0)) {
      panel.log('Önce hedef oyuncu ve Max BIN gir');
      return;
    }
    if (!settings.player.cardId) {
      panel.log('Önce kart versiyonu seç ("Versiyonları getir" ya da Kart ID)');
      return;
    }
    requestNotificationPermission();

    const run = { ...settings };
    const pacer = createPacer(run, {
      now: Date.now,
      rand: Math.random,
      today: () => todayKey(),
      daily: loadDaily(storage, todayKey()),
    });
    const { sleep, interrupt } = createInterruptibleSleep();
    let spent = 0;

    const renderStats = () => {
      const s = pacer.stats();
      panel.setStats(`Oturum: ${s.sessionSearches} arama | Bugün: ${s.daily.count} | Alınan: ${s.buys} | Harcanan: ${spent}`);
    };

    const sniper = createSniper({
      market: createMarket(),
      pacer,
      settings: run,
      sleep,
      rand: Math.random,
      onLog: panel.log,
      onSearch() {
        saveDaily(storage, pacer.stats().daily);
        renderStats();
      },
      onBuy(item) {
        spent += item.buyNowPrice;
        beep(1);
        renderStats();
      },
    });

    active = {
      stop() {
        sniper.stop();
        interrupt();
      },
    };
    panel.setStatus(run.dryRun ? 'Çalışıyor (DRY-RUN)' : 'Çalışıyor', 'running');
    panel.log(`Başladı: ${run.player.name} [${run.player.cardLabel}] ≤ ${run.maxBuy}`);

    const result = await sniper.run();
    active = null;
    const text = REASONS[result.reason] ?? result.reason;
    const quiet = QUIET_REASONS.has(result.reason);
    panel.setStatus(`Durdu: ${text}`, quiet ? 'idle' : 'error');
    if (!quiet) alertUser('FUT Sniper durdu', text);
  }
}

main();
