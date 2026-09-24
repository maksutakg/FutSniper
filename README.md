# FUT Sniper

EA FC Ultimate Team Web App için Tampermonkey userscript'i. Seçilen oyuncu kartını, belirlenen
**Max BIN** fiyatının altında bulunca anında satın alır.

> **Uyarı:** Otomasyon EA kullanım şartlarına aykırıdır. Transfer market soft ban (12–72 saat) ve
> tekrarlarsa kalıcı ban riski vardır. Kullanım tamamen kendi sorumluluğunuzdadır.

## Kurulum (kullanıcılar için)

Node, npm veya VS Code gerekmez; yalnızca Chrome + Tampermonkey.

1. Chrome'a [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) kurun.
2. `chrome://extensions` → sağ üstte **Developer mode**'u açın. Tampermonkey → **Details** →
   **Allow User Scripts** anahtarı varsa onu da açın.
3. [`dist/fut-sniper.user.js`](dist/fut-sniper.user.js) dosyasını indirin.
4. Tampermonkey → **Dashboard** → **Utilities** → **Import from file** → dosyayı seçip **Install**.
5. [Web App](https://www.ea.com/ea-sports-fc/ultimate-team/web-app/)'e giriş yapıp sayfayı yenileyin;
   sağ üstte **FUT Sniper** paneli çıkar.

## Kullanım

1. **Oyuncu ara** kutusuna ismi yazıp listeden seçin.
2. **Getir** ile oyuncunun piyasadaki kart versiyonlarını (normal, TOTW, …) getirip hedef versiyonu
   seçin. Listede olmayan bir versiyon için **Kart ID** (definitionId) girebilirsiniz.
3. **Max BIN**'i piyasa fiyatının altında girin, **Kaç kart alsın**'ı ayarlayın.
4. Önce **Dry-run** açıkken **Başlat**: bot arar ve "alınırdı" diye loglar ama satın almaz.
5. Sonuçlar mantıklıysa Dry-run'ı kapatıp tekrar başlatın.

Bot captcha, çok fazla istek (429), market kilidi, yetersiz coin gibi durumlarda kendiliğinden durur
ve sesli uyarı verir. Captcha'yı Web App'te elle çözüp tekrar başlatın.

### Varsayılan hız ayarları

| Ayar | Değer |
|---|---|
| Aramalar arası bekleme | 3.5–6 sn (rastgele) |
| Mola | her 25–35 aramada 15–30 sn |
| Oturum sınırı | 650 arama veya 1 saat |
| Günlük sınır | 2.500 arama |

Hepsi paneldeki **Ayarlar** bölümünden değiştirilebilir.

## Geliştirme

```bash
npm install
npm test        # birim testleri
npm run build   # src/ → dist/fut-sniper.user.js
```

Kod `src/` altında modüllere ayrılmıştır; build hepsini tek userscript dosyasında birleştirir.
Web App iç yapısıyla ilgili notlar: [`docs/webapp-internals.md`](docs/webapp-internals.md).
