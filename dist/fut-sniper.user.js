// ==UserScript==
// @name         FUT Sniper
// @namespace    fut-sniper
// @version      0.1.0
// @description  EA FC Web App tek hedef sniper
// @match        https://www.ea.com/*ultimate-team/web-app*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  // src/config.js
  var DEFAULTS = Object.freeze({
    delayMinMs: 3500,
    delayMaxMs: 6e3,
    breakEveryMin: 25,
    breakEveryMax: 35,
    breakMinMs: 15e3,
    breakMaxMs: 3e4,
    sessionMaxSearches: 650,
    sessionMaxMs: 36e5,
    dailyMaxSearches: 2500,
    maxBuys: 5,
    dryRun: true,
    maxBuy: 0,
    player: null
  });
  var MIN_SAFE_DELAY_MS = 3e3;
  var SETTINGS_KEY = "futSniper.settings";
  var DAILY_KEY = "futSniper.daily";
  function loadSettings(storage) {
    try {
      return { ...DEFAULTS, ...JSON.parse(storage.getItem(SETTINGS_KEY)) ?? {} };
    } catch {
      return { ...DEFAULTS };
    }
  }
  function saveSettings(storage, settings) {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  function todayKey(date = /* @__PURE__ */ new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function loadDaily(storage, today) {
    try {
      const daily = JSON.parse(storage.getItem(DAILY_KEY));
      if (daily && daily.date === today && Number.isInteger(daily.count)) return daily;
    } catch {
    }
    return { date: today, count: 0 };
  }
  function saveDaily(storage, daily) {
    storage.setItem(DAILY_KEY, JSON.stringify(daily));
  }
  function delayWarning(settings) {
    return settings.delayMinMs < MIN_SAFE_DELAY_MS ? "Uyar\u0131: 3 sn alt\u0131 bekleme soft ban riskini ciddi art\u0131r\u0131r." : null;
  }

  // src/pricing.js
  var MIN_PRICE = 150;
  var MIN_BUY_RATIO = 0.4;
  var STEPS = [
    [1e3, 50],
    [1e4, 100],
    [5e4, 250],
    [1e5, 500],
    [Infinity, 1e3]
  ];
  function stepFor(price) {
    for (const [limit, step] of STEPS) {
      if (price < limit) return step;
    }
  }
  function roundDown(price) {
    const step = stepFor(price);
    return Math.floor(price / step) * step;
  }
  function randomMinBuy(maxBuy, rand) {
    const cap = Math.floor(maxBuy * MIN_BUY_RATIO);
    const options = [0];
    for (let p = MIN_PRICE; p <= cap; p += stepFor(p)) options.push(p);
    return options[Math.floor(rand() * options.length)];
  }

  // src/pacer.js
  function randInt(rand, min, max) {
    return min + Math.floor(rand() * (max - min + 1));
  }
  function randBetween(rand, min, max) {
    return Math.round(min + rand() * (max - min));
  }
  function createPacer(settings, { now, rand, today, daily }) {
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
      if (buys >= settings.maxBuys) return { action: "stop", reason: "maxBuys" };
      if (sessionSearches >= settings.sessionMaxSearches) return { action: "stop", reason: "sessionSearches" };
      if (now() - startedAt >= settings.sessionMaxMs) return { action: "stop", reason: "sessionTime" };
      if (dailyCount >= settings.dailyMaxSearches) return { action: "stop", reason: "daily" };
      if (sinceBreak >= breakAt) {
        sinceBreak = 0;
        breakAt = randInt(rand, settings.breakEveryMin, settings.breakEveryMax);
        return { action: "break", waitMs: randBetween(rand, settings.breakMinMs, settings.breakMaxMs) };
      }
      return { action: "search", waitMs: randBetween(rand, settings.delayMinMs, settings.delayMaxMs) };
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

  // src/market.js
  var STATUS_KINDS = {
    458: "captcha",
    429: "rateLimited",
    512: "rateLimited",
    521: "rateLimited",
    494: "rateLimited",
    401: "sessionExpired",
    461: "lost",
    426: "lost",
    478: "lost",
    470: "insufficientCoins",
    473: "pileFull"
  };
  var MarketError = class extends Error {
    constructor(kind, status, message = `${kind}${status ? ` (${status})` : ""}`) {
      super(message);
      this.kind = kind;
      this.status = status;
    }
  };
  function classifyStatus(status) {
    if (STATUS_KINDS[status]) return STATUS_KINDS[status];
    if (status >= 500 && status < 600) return "server";
    return "unknown";
  }
  function normalizeItem(raw) {
    return {
      tradeId: raw._auction.tradeId,
      buyNowPrice: raw._auction.buyNowPrice,
      definitionId: raw.definitionId,
      rating: raw.rating,
      rareflag: raw.rareflag,
      raw
    };
  }
  function observe(observable) {
    return new Promise((resolve) => observable.observe(void 0, (_sender, res) => resolve(res)));
  }
  function fail(res) {
    const status = res.error?.code ?? res.status;
    return new MarketError(classifyStatus(status), status);
  }
  function createMarket(g = globalThis) {
    return {
      // cardId: belirli bir kart versiyonu (definitionId); yoksa oyuncunun tüm versiyonları aranır.
      async search({ playerId, cardId, maxBuy, minBuy }) {
        g.services.Item.clearTransferMarketCache();
        const criteria = new g.UTSearchCriteriaDTO();
        criteria.type = g.SearchType.PLAYER;
        if (cardId) criteria.defId = [cardId];
        else criteria.maskedDefId = playerId;
        criteria.maxBuy = maxBuy;
        criteria.minBuy = minBuy;
        const res = await observe(g.services.Item.searchTransferMarket(criteria, 1));
        if (!res.success) throw fail(res);
        return (res.data?.items ?? []).map(normalizeItem);
      },
      async buy(item) {
        const res = await observe(g.services.Item.bid(item.raw, item.buyNowPrice));
        if (!res.success) throw fail(res);
      },
      rarityName(rareflag) {
        const name = g.services.Localization.localize(`item.raretype${rareflag}`);
        return name.startsWith("*") ? `\xD6zel (${rareflag})` : name;
      }
    };
  }

  // src/sniper.js
  var SERVER_RETRY_MS = 3e4;
  function pickEligible(items, maxBuy, cardId = null) {
    const eligible = items.filter((i) => i.buyNowPrice > 0 && i.buyNowPrice <= maxBuy && (!cardId || i.definitionId === cardId));
    return eligible.sort((a, b) => a.buyNowPrice - b.buyNowPrice);
  }
  function createInterruptibleSleep() {
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
      }
    };
  }
  function createSniper({
    market,
    pacer,
    settings,
    sleep,
    rand,
    onLog = () => {
    },
    onBuy = () => {
    },
    onSearch = () => {
    }
  }) {
    let stopped = false;
    async function search(criteria) {
      pacer.recordSearch();
      onSearch();
      return market.search(criteria);
    }
    async function searchWithRetry(criteria) {
      try {
        return await search(criteria);
      } catch (err) {
        if (err.kind !== "server") throw err;
        onLog(`Sunucu hatas\u0131 (${err.status}), ${SERVER_RETRY_MS / 1e3} sn sonra tekrar denenecek`);
        await sleep(SERVER_RETRY_MS);
        if (stopped) return [];
        return search(criteria);
      }
    }
    function failure(err) {
      const reason = err.kind ?? "unknown";
      onLog(`Durdu: ${err.message}`);
      return { reason, error: err };
    }
    async function run() {
      while (!stopped) {
        const step = pacer.next();
        if (step.action === "stop") return { reason: step.reason };
        if (step.action === "break") onLog(`Mola: ${Math.round(step.waitMs / 1e3)} sn`);
        await sleep(step.waitMs);
        if (stopped) break;
        if (step.action === "break") continue;
        const criteria = {
          playerId: settings.player.id,
          cardId: settings.player.cardId,
          maxBuy: settings.maxBuy,
          minBuy: randomMinBuy(settings.maxBuy, rand)
        };
        let items;
        try {
          items = await searchWithRetry(criteria);
        } catch (err) {
          return failure(err);
        }
        for (const target of pickEligible(items, settings.maxBuy, settings.player.cardId)) {
          if (stopped || pacer.stats().buys >= settings.maxBuys) break;
          if (settings.dryRun) {
            onLog(`[DRY-RUN] ${target.buyNowPrice} coin'e al\u0131n\u0131rd\u0131 (trade ${target.tradeId})`);
            continue;
          }
          try {
            await market.buy(target);
          } catch (err) {
            if (err.kind === "lost") {
              onLog(`Ka\xE7t\u0131: ${target.buyNowPrice} coin (${err.status})`);
              continue;
            }
            return failure(err);
          }
          pacer.recordBuy();
          onLog(`ALINDI: ${target.buyNowPrice} coin (trade ${target.tradeId})`);
          onBuy(target);
        }
      }
      return { reason: "manual" };
    }
    return {
      run,
      stop() {
        stopped = true;
      }
    };
  }

  // src/players.js
  function findPlayersUrl(resourceUrls) {
    return resourceUrls.find((u) => /\/players\.json(\?|$)/.test(u)) ?? null;
  }
  function parsePlayersJson(json) {
    const all = [...json.LegendsPlayers ?? [], ...json.Players ?? []];
    return all.map((p) => ({ id: p.id, name: p.c ?? `${p.f} ${p.l}`, rating: p.r }));
  }
  function normalize(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").toLowerCase();
  }
  function searchPlayers(players, query, limit = 10) {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return players.filter((p) => normalize(p.name).includes(q)).sort((a, b) => b.rating - a.rating).slice(0, limit);
  }

  // src/versions.js
  function groupVersions(items) {
    const byCard = /* @__PURE__ */ new Map();
    for (const i of items) {
      const v = byCard.get(i.definitionId) ?? { cardId: i.definitionId, rating: i.rating, rareflag: i.rareflag, listings: 0, minPrice: Infinity };
      v.listings++;
      if (i.buyNowPrice > 0) v.minPrice = Math.min(v.minPrice, i.buyNowPrice);
      byCard.set(i.definitionId, v);
    }
    return [...byCard.values()].sort((a, b) => a.minPrice - b.minPrice);
  }

  // src/ui.js
  var SETTING_FIELDS = [
    ["delayMinMs", "Bekleme min (ms)"],
    ["delayMaxMs", "Bekleme max (ms)"],
    ["breakEveryMin", "Mola: en az ka\xE7 aramada"],
    ["breakEveryMax", "Mola: en fazla ka\xE7 aramada"],
    ["breakMinMs", "Mola min (ms)"],
    ["breakMaxMs", "Mola max (ms)"],
    ["sessionMaxSearches", "Oturum arama s\u0131n\u0131r\u0131"],
    ["sessionMaxMs", "Oturum s\xFCre s\u0131n\u0131r\u0131 (ms)"],
    ["dailyMaxSearches", "G\xFCnl\xFCk arama s\u0131n\u0131r\u0131"]
  ];
  var CSS = `
#fut-sniper { position: fixed; top: 80px; right: 16px; width: 310px; z-index: 99999;
  background: #202c3d; color: #fcfcfc; font: 12px/1.4 UltimateTeam, sans-serif;
  border: 1px solid #2f3f55; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,.45); overflow: hidden; }
#fut-sniper .fs-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: #233144; font-size: 13px; cursor: pointer; user-select: none; }
#fut-sniper .fs-title { flex: 1; }
#fut-sniper .fs-mini { font-size: 11px; color: #dedad8; }
#fut-sniper .fs-toggle { color: #dedad8; }
#fut-sniper .fs-body { padding: 10px 12px; display: grid; gap: 8px; max-height: 75vh; overflow: auto; }
#fut-sniper.collapsed .fs-body { display: none; }
#fut-sniper .fs-section { font-size: 10px; letter-spacing: .08em; color: #8fa3bd; }
#fut-sniper hr { border: none; border-top: 1px solid #2f3f55; margin: 2px 0; }
#fut-sniper label { display: grid; gap: 3px; color: #dedad8; }
#fut-sniper label.inline { display: flex; gap: 6px; align-items: center; }
#fut-sniper .fs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
#fut-sniper .fs-row-price { grid-template-columns: 3fr 2fr; }
#fut-sniper input, #fut-sniper select { background: #1d272f; color: #fcfcfc; border: 1px solid #34465e;
  border-radius: 6px; padding: 5px 7px; font: inherit; min-width: 0; }
#fut-sniper input:focus, #fut-sniper select:focus { outline: none; border-color: #b1ffff; }
#fut-sniper button { padding: 7px 16px; cursor: pointer; color: #fcfcfc; background: #233144;
  border: 1px solid #34465e; border-radius: 8px; font: 12px UltimateTeam, sans-serif; }
#fut-sniper button:hover { filter: brightness(1.15); }
#fut-sniper button:disabled { opacity: .5; cursor: wait; }
#fut-sniper .fs-versions { display: grid; grid-template-columns: auto 1fr; gap: 6px; }
#fut-sniper .fs-versions button { padding: 5px 10px; }
#fut-sniper .fs-results:empty { display: none; }
#fut-sniper .fs-results button { display: block; width: 100%; text-align: left; margin-top: 3px;
  padding: 5px 8px; background: #1d272f; }
#fut-sniper .fs-target { padding: 6px 8px; border-radius: 6px; background: #1d272f; border: 1px solid #34465e; }
#fut-sniper .fs-target.ok { border-color: #2e6b5a; color: #b1ffff; }
#fut-sniper .fs-target.warn { border-color: #6b5a2e; color: #ffcf70; }
#fut-sniper .fs-actions { display: flex; gap: 8px; }
#fut-sniper .fs-actions button { flex: 1; }
#fut-sniper button[data-start] { color: #151616; border: none;
  background: linear-gradient(135deg, #b1ffff 0, #f2fcfc 17%, #f1f0ff 65%, #e2d6ff 100%); }
#fut-sniper button[data-stop] { color: #ff8a8a; border-color: #6b3440; }
#fut-sniper .fs-warn:empty { display: none; }
#fut-sniper .fs-warn { color: #ffcf70; }
#fut-sniper .fs-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #6c7a8c; margin-right: 6px; vertical-align: middle; }
#fut-sniper [data-state="running"] .fs-dot { background: #b1ffff; box-shadow: 0 0 6px #b1ffff; }
#fut-sniper [data-state="error"] .fs-dot { background: #ff6b6b; }
#fut-sniper .fs-stats { color: #dedad8; }
#fut-sniper .fs-log { margin: 0; max-height: 180px; overflow: auto; background: #1d272f;
  border-radius: 6px; padding: 6px; white-space: pre-wrap; color: #dedad8; }
`;
  var MAX_LOG_LINES = 50;
  function formatCoins(n) {
    return n > 0 ? n.toLocaleString("tr-TR") : "";
  }
  function parseCoins(text) {
    return Number(String(text).replace(/\D/g, "")) || 0;
  }
  function createPanel({ settings, onChange, onPlayerQuery, onFetchVersions, onStart, onStop }) {
    let current = { ...settings };
    const root = document.createElement("div");
    root.id = "fut-sniper";
    root.innerHTML = `
    <style>${CSS}</style>
    <div class="fs-head" data-state="idle">
      <span class="fs-title">FUT Sniper</span>
      <span class="fs-mini"><span class="fs-dot"></span><span data-mini>Haz\u0131r</span></span>
      <span class="fs-toggle">\u2013</span>
    </div>
    <div class="fs-body">
      <div class="fs-section">HEDEF</div>
      <label>Oyuncu ara <input data-q placeholder="en az 2 harf"></label>
      <div class="fs-results"></div>
      <div class="fs-row">
        <label>Oyuncu ID <input data-id type="number"></label>
        <label>Kart ID <input data-card-id type="number" placeholder="definitionId"></label>
      </div>
      <div class="fs-versions">
        <button data-versions>Getir</button>
        <select data-card><option value="">\u2014 versiyon se\xE7 \u2014</option></select>
      </div>
      <div class="fs-target"></div>
      <hr>
      <div class="fs-section">F\u0130YAT</div>
      <div class="fs-row fs-row-price">
        <label>Max BIN <input data-max inputmode="numeric" placeholder="0"></label>
        <label>Ka\xE7 kart als\u0131n <input data-max-buys type="number" min="1"></label>
      </div>
      <label class="inline"><input data-dry type="checkbox"> Dry-run (sat\u0131n alma yapma)</label>
      <details><summary>Ayarlar</summary><div class="fs-fields"></div></details>
      <div class="fs-warn"></div>
      <hr>
      <div class="fs-actions"><button data-start>Ba\u015Flat</button><button data-stop>Durdur</button></div>
      <div class="fs-status" data-state="idle"><span class="fs-dot"></span><span data-status>Haz\u0131r</span></div>
      <div class="fs-stats"></div>
      <pre class="fs-log"></pre>
    </div>`;
    document.body.appendChild(root);
    const $ = (sel) => root.querySelector(sel);
    const logEl = $(".fs-log");
    const cardSelect = $("[data-card]");
    const lines = [];
    let versions = [];
    function log(text) {
      lines.push(`${(/* @__PURE__ */ new Date()).toLocaleTimeString("tr-TR")} ${text}`);
      if (lines.length > MAX_LOG_LINES) lines.shift();
      logEl.textContent = lines.join("\n");
      logEl.scrollTop = logEl.scrollHeight;
    }
    function update(patch) {
      current = { ...current, ...patch };
      onChange(current);
      renderTarget();
    }
    function renderTarget() {
      const p = current.player;
      const box = $(".fs-target");
      $("[data-q]").value = p ? `${p.name}${p.rating ? ` (${p.rating})` : ""}` : "";
      $("[data-id]").value = p?.id ?? "";
      $("[data-card-id]").value = p?.cardId ?? "";
      if (!p) {
        box.className = "fs-target warn";
        box.textContent = "Hedef se\xE7ilmedi";
      } else if (!p.cardId) {
        box.className = "fs-target warn";
        box.textContent = `${p.name}${p.rating ? ` (${p.rating})` : ""} \xB7 versiyon se\xE7`;
      } else {
        box.className = "fs-target ok";
        box.textContent = `\u2714 ${p.name} \xB7 ${p.cardLabel ?? `Kart #${p.cardId}`}`;
      }
    }
    function renderVersions() {
      cardSelect.innerHTML = '<option value="">\u2014 versiyon se\xE7 \u2014</option>';
      for (const v of versions) {
        const opt = document.createElement("option");
        opt.value = v.cardId;
        opt.textContent = v.label;
        cardSelect.appendChild(opt);
      }
      cardSelect.value = current.player?.cardId ?? "";
    }
    function choosePlayer(player) {
      versions = [];
      renderVersions();
      update({ player: { ...player, cardId: null, cardLabel: null } });
    }
    function chooseCard(cardId, cardLabel) {
      update({ player: { ...current.player, cardId, cardLabel } });
      cardSelect.value = cardId ?? "";
    }
    for (const [key, label] of SETTING_FIELDS) {
      const wrap = document.createElement("label");
      wrap.textContent = label;
      const input = document.createElement("input");
      input.type = "number";
      input.value = current[key];
      input.addEventListener("change", () => update({ [key]: Number(input.value) }));
      wrap.appendChild(input);
      $(".fs-fields").appendChild(wrap);
    }
    $(".fs-head").addEventListener("click", () => {
      root.classList.toggle("collapsed");
      $(".fs-toggle").textContent = root.classList.contains("collapsed") ? "+" : "\u2013";
    });
    $("[data-q]").addEventListener("input", (e) => {
      const results = $(".fs-results");
      results.innerHTML = "";
      for (const p of onPlayerQuery(e.target.value)) {
        const btn = document.createElement("button");
        btn.textContent = `${p.name} (${p.rating}) #${p.id}`;
        btn.addEventListener("click", () => {
          results.innerHTML = "";
          choosePlayer(p);
        });
        results.appendChild(btn);
      }
    });
    $("[data-id]").addEventListener("change", (e) => {
      const id = Number(e.target.value);
      if (id > 0 && id !== current.player?.id) choosePlayer({ id, name: `#${id}`, rating: null });
    });
    $("[data-card-id]").addEventListener("change", (e) => {
      if (!current.player) {
        log("\xD6nce oyuncu se\xE7");
        e.target.value = "";
        return;
      }
      const cardId = Number(e.target.value);
      if (cardId > 0) chooseCard(cardId, `Kart #${cardId}`);
    });
    const versionsBtn = $("[data-versions]");
    versionsBtn.addEventListener("click", async () => {
      if (!current.player) {
        log("\xD6nce oyuncu se\xE7");
        return;
      }
      versionsBtn.disabled = true;
      try {
        versions = await onFetchVersions(current.player);
        renderVersions();
        if (versions.length === 1) chooseCard(versions[0].cardId, versions[0].label);
        log(versions.length ? `${versions.length} versiyon bulundu` : "Piyasada ilan yok; versiyonu Kart ID ile girebilirsin");
      } catch (err) {
        log(`Versiyonlar al\u0131namad\u0131: ${err.message}`);
      } finally {
        versionsBtn.disabled = false;
      }
    });
    cardSelect.addEventListener("change", () => {
      const v = versions.find((x) => String(x.cardId) === cardSelect.value);
      chooseCard(v?.cardId ?? null, v?.label ?? null);
    });
    const maxInput = $("[data-max]");
    maxInput.value = formatCoins(current.maxBuy);
    maxInput.addEventListener("change", () => {
      update({ maxBuy: parseCoins(maxInput.value) });
      maxInput.value = formatCoins(current.maxBuy);
    });
    const maxBuysInput = $("[data-max-buys]");
    maxBuysInput.value = current.maxBuys;
    maxBuysInput.addEventListener("change", () => {
      update({ maxBuys: Math.max(1, Math.floor(Number(maxBuysInput.value)) || 1) });
      maxBuysInput.value = current.maxBuys;
    });
    const dry = $("[data-dry]");
    dry.checked = current.dryRun;
    dry.addEventListener("change", () => update({ dryRun: dry.checked }));
    $("[data-start]").addEventListener("click", onStart);
    $("[data-stop]").addEventListener("click", onStop);
    renderTarget();
    return {
      // state: 'idle' | 'running' | 'error' — nokta rengi ve küçültülmüş başlık için
      setStatus(text, state = "idle") {
        $("[data-status]").textContent = text;
        $("[data-mini]").textContent = text.length > 22 ? `${text.slice(0, 21)}\u2026` : text;
        $(".fs-status").dataset.state = state;
        $(".fs-head").dataset.state = state;
      },
      setStats(text) {
        $(".fs-stats").textContent = text;
      },
      setWarning(text) {
        $(".fs-warn").textContent = text ?? "";
      },
      // main maxBuy'ı geçerli fiyat adımına yuvarlayınca kutuyu da güncelle
      setMaxBuy(value) {
        current.maxBuy = value;
        maxInput.value = formatCoins(value);
      },
      log
    };
  }

  // src/alerts.js
  function beep(times = 3) {
    const ctx = new AudioContext();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(ctx.destination);
      const start = ctx.currentTime + i * 0.3;
      osc.start(start);
      osc.stop(start + 0.18);
    }
  }
  function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
  function alertUser(title, body) {
    beep();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }

  // src/main.js
  var REASONS = {
    manual: "elle durduruldu",
    maxBuys: "al\u0131m s\u0131n\u0131r\u0131na ula\u015F\u0131ld\u0131",
    sessionSearches: "oturum arama s\u0131n\u0131r\u0131 doldu",
    sessionTime: "oturum s\xFCresi doldu",
    daily: "g\xFCnl\xFCk arama s\u0131n\u0131r\u0131 doldu",
    captcha: "CAPTCHA \u2014 Web App'te elle \xE7\xF6z",
    rateLimited: "\xE7ok fazla istek / market kilitli (soft ban habercisi) \u2014 bir s\xFCre ara ver",
    sessionExpired: "oturum d\xFC\u015Ft\xFC \u2014 tekrar giri\u015F yap",
    insufficientCoins: "yetersiz coin",
    pileFull: "hedef liste dolu \u2014 Unassigned/Transfer listesini bo\u015Falt",
    server: "sunucu hatas\u0131 tekrarland\u0131",
    unknown: "bilinmeyen hata"
  };
  var QUIET_REASONS = /* @__PURE__ */ new Set(["manual", "maxBuys", "sessionSearches", "sessionTime", "daily"]);
  function waitForWebApp() {
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (globalThis.services?.Item && globalThis.UTSearchCriteriaDTO) {
          clearInterval(timer);
          resolve();
        }
      }, 1e3);
    });
  }
  var PLAYERS_POLL_MS = 2e3;
  async function loadPlayers() {
    for (; ; ) {
      const url = findPlayersUrl(performance.getEntriesByType("resource").map((e) => e.name));
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
      }
    });
    panel.setWarning(delayWarning(settings));
    panel.log("Oyuncu listesi bekleniyor\u2026 (bu s\u0131rada ID ile de hedef se\xE7ebilirsin)");
    loadPlayers().then((list) => {
      players = list;
      panel.log(`${list.length} oyuncu y\xFCklendi`);
    }).catch((err) => panel.log(`Oyuncu listesi y\xFCklenemedi: ${err.message}`));
    async function fetchVersions(player) {
      if (active) throw new Error("sniper \xE7al\u0131\u015F\u0131rken versiyon aranamaz");
      const market = createMarket();
      const items = await market.search({ playerId: player.id, cardId: null, maxBuy: 0, minBuy: 0 });
      const daily = loadDaily(storage, todayKey());
      saveDaily(storage, { ...daily, count: daily.count + 1 });
      return groupVersions(items).map((v) => ({
        ...v,
        label: `${v.rating} ${market.rarityName(v.rareflag)} \u2014 en ucuz ${v.minPrice.toLocaleString("tr-TR")} (${v.listings} ilan)`
      }));
    }
    async function start() {
      if (active) return;
      if (!settings.player || !(settings.maxBuy > 0)) {
        panel.log("\xD6nce hedef oyuncu ve Max BIN gir");
        return;
      }
      if (!settings.player.cardId) {
        panel.log('\xD6nce kart versiyonu se\xE7 ("Versiyonlar\u0131 getir" ya da Kart ID)');
        return;
      }
      requestNotificationPermission();
      const run = { ...settings };
      const pacer = createPacer(run, {
        now: Date.now,
        rand: Math.random,
        today: () => todayKey(),
        daily: loadDaily(storage, todayKey())
      });
      const { sleep, interrupt } = createInterruptibleSleep();
      let spent = 0;
      const renderStats = () => {
        const s = pacer.stats();
        panel.setStats(`Oturum: ${s.sessionSearches} arama | Bug\xFCn: ${s.daily.count} | Al\u0131nan: ${s.buys} | Harcanan: ${spent}`);
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
        }
      });
      active = {
        stop() {
          sniper.stop();
          interrupt();
        }
      };
      panel.setStatus(run.dryRun ? "\xC7al\u0131\u015F\u0131yor (DRY-RUN)" : "\xC7al\u0131\u015F\u0131yor", "running");
      panel.log(`Ba\u015Flad\u0131: ${run.player.name} [${run.player.cardLabel}] \u2264 ${run.maxBuy}`);
      const result = await sniper.run();
      active = null;
      const text = REASONS[result.reason] ?? result.reason;
      const quiet = QUIET_REASONS.has(result.reason);
      panel.setStatus(`Durdu: ${text}`, quiet ? "idle" : "error");
      if (!quiet) alertUser("FUT Sniper durdu", text);
    }
  }
  main();
})();
