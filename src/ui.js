const SEC = 1000;
const MIN = 60000;
const PCT = 0.01;

// [ayar, etiket, birim çarpanı]: panelde sn/dk/% gösterilir, ayarlarda ms/oran saklanır
const SETTING_FIELDS = [
  ['delayMinMs', 'Bekleme min (sn)', SEC],
  ['delayMaxMs', 'Bekleme max (sn)', SEC],
  ['hiccupChance', 'Uzun duraklama olasılığı (%)', PCT],
  ['hiccupMinMs', 'Uzun duraklama min (sn)', SEC],
  ['hiccupMaxMs', 'Uzun duraklama max (sn)', SEC],
  ['breakEveryMin', 'Mola: en az kaç aramada', 1],
  ['breakEveryMax', 'Mola: en fazla kaç aramada', 1],
  ['breakMinMs', 'Mola min (sn)', SEC],
  ['breakMaxMs', 'Mola max (sn)', SEC],
  ['workMinMs', 'Çalışma süresi min (dk)', MIN],
  ['workMaxMs', 'Çalışma süresi max (dk)', MIN],
  ['restMinMs', 'Dinlenme süresi min (dk)', MIN],
  ['restMaxMs', 'Dinlenme süresi max (dk)', MIN],
  ['dailyMaxSearches', 'Günlük arama sınırı', 1],
];

// Renkler Web App'in kendi temasından (body, .btn-standard, .btn-standard.primary) alındı.
const CSS = `
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

const MAX_LOG_LINES = 50;

function formatCoins(n) {
  return n > 0 ? n.toLocaleString('tr-TR') : '';
}

function parseCoins(text) {
  return Number(String(text).replace(/\D/g, '')) || 0;
}

export function createPanel({ settings, onChange, onPlayerQuery, onFetchVersions, onStart, onStop }) {
  let current = { ...settings };
  const root = document.createElement('div');
  root.id = 'fut-sniper';
  root.innerHTML = `
    <style>${CSS}</style>
    <div class="fs-head" data-state="idle">
      <span class="fs-title">FUT Sniper</span>
      <span class="fs-mini"><span class="fs-dot"></span><span data-mini>Hazır</span></span>
      <span class="fs-toggle">–</span>
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
        <select data-card><option value="">— versiyon seç —</option></select>
      </div>
      <div class="fs-target"></div>
      <hr>
      <div class="fs-section">FİYAT</div>
      <div class="fs-row fs-row-price">
        <label>Max BIN <input data-max inputmode="numeric" placeholder="0"></label>
        <label>Kaç kart alsın <input data-max-buys type="number" min="1"></label>
      </div>
      <label class="inline"><input data-dry type="checkbox"> Dry-run (satın alma yapma)</label>
      <details><summary>Ayarlar</summary><div class="fs-fields"></div></details>
      <div class="fs-warn"></div>
      <hr>
      <div class="fs-actions"><button data-start>Başlat</button><button data-stop>Durdur</button></div>
      <div class="fs-status" data-state="idle"><span class="fs-dot"></span><span data-status>Hazır</span></div>
      <div class="fs-stats"></div>
      <pre class="fs-log"></pre>
    </div>`;
  document.body.appendChild(root);

  const $ = (sel) => root.querySelector(sel);
  const logEl = $('.fs-log');
  const cardSelect = $('[data-card]');
  const lines = [];
  let versions = [];

  function log(text) {
    lines.push(`${new Date().toLocaleTimeString('tr-TR')} ${text}`);
    if (lines.length > MAX_LOG_LINES) lines.shift();
    logEl.textContent = lines.join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  }

  function update(patch) {
    current = { ...current, ...patch };
    onChange(current);
    renderTarget();
  }

  function renderTarget() {
    const p = current.player;
    const box = $('.fs-target');
    $('[data-q]').value = p ? `${p.name}${p.rating ? ` (${p.rating})` : ''}` : '';
    $('[data-id]').value = p?.id ?? '';
    $('[data-card-id]').value = p?.cardId ?? '';
    if (!p) {
      box.className = 'fs-target warn';
      box.textContent = 'Hedef seçilmedi';
    } else if (!p.cardId) {
      box.className = 'fs-target warn';
      box.textContent = `${p.name}${p.rating ? ` (${p.rating})` : ''} · versiyon seç`;
    } else {
      box.className = 'fs-target ok';
      box.textContent = `✔ ${p.name} · ${p.cardLabel ?? `Kart #${p.cardId}`}`;
    }
  }

  function renderVersions() {
    cardSelect.innerHTML = '<option value="">— versiyon seç —</option>';
    for (const v of versions) {
      const opt = document.createElement('option');
      opt.value = v.cardId;
      opt.textContent = v.label;
      cardSelect.appendChild(opt);
    }
    cardSelect.value = current.player?.cardId ?? '';
  }

  // Oyuncu değişince önceki versiyon seçimi geçersiz olur.
  function choosePlayer(player) {
    versions = [];
    renderVersions();
    update({ player: { ...player, cardId: null, cardLabel: null } });
  }

  function chooseCard(cardId, cardLabel) {
    update({ player: { ...current.player, cardId, cardLabel } });
    cardSelect.value = cardId ?? '';
  }

  for (const [key, label, scale] of SETTING_FIELDS) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    // 0.08 / 0.01 = 8.000000000000002 gibi kayan nokta artıklarını gösterme
    input.value = Number((current[key] / scale).toFixed(2));
    input.addEventListener('change', () => update({ [key]: Math.round(Number(input.value) * scale * 1e6) / 1e6 }));
    wrap.appendChild(input);
    $('.fs-fields').appendChild(wrap);
  }

  $('.fs-head').addEventListener('click', () => {
    root.classList.toggle('collapsed');
    $('.fs-toggle').textContent = root.classList.contains('collapsed') ? '+' : '–';
  });

  $('[data-q]').addEventListener('input', (e) => {
    const results = $('.fs-results');
    results.innerHTML = '';
    for (const p of onPlayerQuery(e.target.value)) {
      const btn = document.createElement('button');
      btn.textContent = `${p.name} (${p.rating}) #${p.id}`;
      btn.addEventListener('click', () => {
        results.innerHTML = '';
        choosePlayer(p);
      });
      results.appendChild(btn);
    }
  });

  $('[data-id]').addEventListener('change', (e) => {
    const id = Number(e.target.value);
    if (id > 0 && id !== current.player?.id) choosePlayer({ id, name: `#${id}`, rating: null });
  });

  $('[data-card-id]').addEventListener('change', (e) => {
    if (!current.player) {
      log('Önce oyuncu seç');
      e.target.value = '';
      return;
    }
    const cardId = Number(e.target.value);
    if (cardId > 0) chooseCard(cardId, `Kart #${cardId}`);
  });

  const versionsBtn = $('[data-versions]');
  versionsBtn.addEventListener('click', async () => {
    if (!current.player) {
      log('Önce oyuncu seç');
      return;
    }
    versionsBtn.disabled = true;
    try {
      versions = await onFetchVersions(current.player);
      renderVersions();
      if (versions.length === 1) chooseCard(versions[0].cardId, versions[0].label);
      log(versions.length
        ? `${versions.length} versiyon bulundu`
        : 'Piyasada ilan yok; versiyonu Kart ID ile girebilirsin');
    } catch (err) {
      log(`Versiyonlar alınamadı: ${err.message}`);
    } finally {
      versionsBtn.disabled = false;
    }
  });

  cardSelect.addEventListener('change', () => {
    const v = versions.find((x) => String(x.cardId) === cardSelect.value);
    chooseCard(v?.cardId ?? null, v?.label ?? null);
  });

  const maxInput = $('[data-max]');
  maxInput.value = formatCoins(current.maxBuy);
  maxInput.addEventListener('change', () => {
    update({ maxBuy: parseCoins(maxInput.value) });
    maxInput.value = formatCoins(current.maxBuy);
  });

  const maxBuysInput = $('[data-max-buys]');
  maxBuysInput.value = current.maxBuys;
  maxBuysInput.addEventListener('change', () => {
    update({ maxBuys: Math.max(1, Math.floor(Number(maxBuysInput.value)) || 1) });
    maxBuysInput.value = current.maxBuys;
  });

  const dry = $('[data-dry]');
  dry.checked = current.dryRun;
  dry.addEventListener('change', () => update({ dryRun: dry.checked }));

  $('[data-start]').addEventListener('click', onStart);
  $('[data-stop]').addEventListener('click', onStop);

  renderTarget();

  return {
    // state: 'idle' | 'running' | 'error' — nokta rengi ve küçültülmüş başlık için
    setStatus(text, state = 'idle') {
      $('[data-status]').textContent = text;
      $('[data-mini]').textContent = text.length > 22 ? `${text.slice(0, 21)}…` : text;
      $('.fs-status').dataset.state = state;
      $('.fs-head').dataset.state = state;
    },
    setStats(text) { $('.fs-stats').textContent = text; },
    setWarning(text) { $('.fs-warn').textContent = text ?? ''; },
    // main maxBuy'ı geçerli fiyat adımına yuvarlayınca kutuyu da güncelle
    setMaxBuy(value) {
      current.maxBuy = value;
      maxInput.value = formatCoins(value);
    },
    log,
  };
}
