# FUT Sniper

EA FC Ultimate Team Web App için Tampermonkey userscript'i: seçtiğin kartı, belirlediğin
**Max BIN**'in altında bulunca anında satın alır.

> **Uyarı:** EA kullanım şartlarına aykırıdır; soft ban (12–72 saat) ve kalıcı ban riski vardır.
> Kullanım kendi sorumluluğundadır.

## Kurulum

Node veya VS Code gerekmez, sadece Chrome + [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).

1. `chrome://extensions` → **Developer mode** açık; Tampermonkey → Details → **Allow User Scripts** açık.
2. [`dist/fut-sniper.user.js`](dist/fut-sniper.user.js) dosyasını indir → Tampermonkey → Dashboard →
   Utilities → **Import from file** → Install.
3. Web App'e gir, sayfayı yenile; sağ üstte **FUT Sniper** paneli çıkar.

## Kullanım

1. Oyuncuyu ara ve seç → **Getir** ile versiyonu (normal, TOTW…) seç.
2. **Max BIN** ve **Kaç kart alsın** gir.
3. Önce **Dry-run** ile dene (satın almaz, sadece loglar), sonra kapatıp **Başlat**.

## Özellikler

- Sadece seçilen kart versiyonunu arar; başka versiyonu asla almaz.
- Her aramada rastgele min BIN ile güncel sonuç alır; aynı aramadaki tüm ucuz ilanları sırayla dener.
- İnsan gibi tempo: 3.5–6 sn bekleme, ara sıra 10–25 sn duraklama, 25–35 aramada bir kısa mola.
- 40–60 dk çalışır, 20–40 dk dinlenir, kendiliğinden devam eder; günlük sınır 3.500 arama.
- Captcha, 429, market kilidi, yetersiz coin gibi durumlarda durur ve sesli uyarı verir.
- Tüm ayarlar paneldeki **Ayarlar** bölümünden değiştirilebilir.

## Geliştirme

```bash
npm install
npm test        # birim testleri
npm run build   # src/ → dist/fut-sniper.user.js
```
