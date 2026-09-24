// EA Web App iç servislerine dokunan TEK modül. Yeni sezonda bir şey değişirse yalnızca burası güncellenir.
// Kodlar ve yapılar: docs/webapp-internals.md

const STATUS_KINDS = {
  458: 'captcha',
  429: 'rateLimited',
  512: 'rateLimited',
  521: 'rateLimited',
  494: 'rateLimited',
  401: 'sessionExpired',
  461: 'lost',
  426: 'lost',
  478: 'lost',
  470: 'insufficientCoins',
  473: 'pileFull',
};

export class MarketError extends Error {
  constructor(kind, status, message = `${kind}${status ? ` (${status})` : ''}`) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export function classifyStatus(status) {
  if (STATUS_KINDS[status]) return STATUS_KINDS[status];
  if (status >= 500 && status < 600) return 'server';
  return 'unknown';
}

export function normalizeItem(raw) {
  return {
    tradeId: raw._auction.tradeId,
    buyNowPrice: raw._auction.buyNowPrice,
    definitionId: raw.definitionId,
    rating: raw.rating,
    rareflag: raw.rareflag,
    raw,
  };
}

function observe(observable) {
  return new Promise((resolve) => observable.observe(undefined, (_sender, res) => resolve(res)));
}

function fail(res) {
  const status = res.error?.code ?? res.status;
  return new MarketError(classifyStatus(status), status);
}

export function createMarket(g = globalThis) {
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
      return name.startsWith('*') ? `Özel (${rareflag})` : name;
    },
  };
}
