# Web App iç yapısı (doğrulama: 2026-09-24, oyun sürümü: FC 27)

Canlı Web App sekmesinde `javascript_tool` ile doğrulandı. İki gerçek arama yapıldı, satın alma yapılmadı.

## Servisler

- `services.Item.searchTransferMarket(criteria, page)`: 2 parametre, observable döndürür; `.observe(scope, (sender, res) => …)`
- `services.Item.bid(item, price)`: 2 parametre, observable
- `services.Item.clearTransferMarketCache()`: **var**, parametresiz
- `services.TransferMarket` ayrıca var ama yalnızca `isFeatureEnabledForUser` içeriyor; arama/bid `services.Item` üzerinde.

## Arama kriteri (`new UTSearchCriteriaDTO()`)

- `type`: getter/setter var (iç alan `_type`); `SearchType.PLAYER === 'player'`
- oyuncu alanı: `maskedDefId` (sayı; `players.json` içindeki `id` ile çalıştığı doğrulandı), ayrıca `defId: []`
- fiyat alanları: `minBuy`, `maxBuy`, `minBid`, `maxBid`
- diğer: `count` (varsayılan 20), `offset`, `sortBy: 'value'`, `_sort: 'desc'`

## Yanıt

- anahtarlar: `data`, `error`, `status`, `success`
- başarı: `res.success === true`, `res.status === 200`
- sonuçlar: `res.data.items` (sıralı gelmez)
- ilan: `item._auction.buyNowPrice` (sayı), `item._auction.tradeId` (**string**), `item._auction._tradeState === 'active'`
- hata kodu: **`res.error?.code ?? res.status`** (bkz. MagicBuyer-UT `purchaseUtil.js`, `errorHandler.js`). Planla fark: yalnızca `res.status` okunmamalı.

## Oyuncu listesi

- URL deseni: `https://www.ea.com/ea-sports-fc/ultimate-team/web-app/content/<GUID>/2027/fut/items/web/players.json`
- Transfers ekranında `performance` kayıtlarında zaten mevcut. Arama ekranına girmek gerekmedi.
- aynı dizinde `players_meta.json` ve `players_icons.json` da var; `/\/players\.json(\?|$)/` regex'i bunları eşlemez.
- şema: `{ LegendsPlayers: [136], Players: [19898] }`, kayıt `{ id, f, l, c?, r }`, planla aynı.

## Durum kodları

`UtasErrorCode` global'inden okundu (Web App'in kendi tablosu). 401/429/512/521 bu tabloda yok; bunlar HTTP düzeyi kodlar ve MagicBuyer-UT `errorCodeLookUp` tablosundan alındı.

| Kod | Web App adı / anlam | kind |
|---|---|---|
| 458 | CAPTCHA_REQUIRED | `captcha` |
| 429 | çok fazla istek | `rateLimited` |
| 512, 521 | Request Rejected (geçici engel) | `rateLimited` |
| 494 | LOCKED_TRANSFER_MARKET | `rateLimited` |
| 401 | oturum düştü | `sessionExpired` |
| 461 | PERMISSION_DENIED (başkası aldı) | `lost` |
| 426 | başkası aldı (MagicBuyer) | `lost` |
| 478 | NO_TRADE_EXISTS (ilan kalktı) | `lost` |
| 470 | NOT_ENOUGH_CREDIT | `insufficientCoins` |
| 473 | DESTINATION_FULL | `pileFull` |
| diğer 5xx | sunucu | `server` |
| 20000 ACCOUNT_BANNED ve geri kalan her şey | | `unknown` (dur) |

## Canlı testte öğrenilenler

- `players.json` sayfa açıldıktan ~6.6 sn sonra yükleniyor, yani servisler hazır olduktan sonra. `main.js` bu yüzden listeyi 2 sn'de bir tekrar arıyor.
- BIN ile alınan kart ana ekrandaki **Unassigned Items** kutusunda görünüyor. `services.Item.requestUnassignedItems()` yanıtında ise `res.data.items` boş döndü; bu servisin yanıt yapısı doğrulanmadı ve script bu servisi kullanmıyor.

## Plandan sapmalar

1. Hata kodu `res.error?.code ?? res.status` ile okunacak.
2. `STATUS_KINDS` tablosuna eklenenler: 494 → rateLimited, 426 ve 478 → lost, 473 → pileFull.
3. `tradeId` string; kod sadece log'da kullandığı için etkisi yok.
