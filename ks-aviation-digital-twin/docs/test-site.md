# Kenan Seyhan 3D Test

Kalıcı geliştirme dalı: `ks-3d-test`. Nathan Aşama 1 dalı `feature/nathan-operator` üzerinden oluşturuldu. Aynı uygulama ve varlıklar kullanılır. Ana yayın dalı `ks-aviation-digital-twin` ve deponun `main` dalı değiştirilmez.

## Kullanım

1. Ana sayfada **ADB Tesisi · Nathan’ı test et** seçilir. Tesis 3D olarak açılır, tasarım ve kütüphane hazırdır.
2. **İkmal Personeli — Nathan → Merkeze ekle ve git** seçilir. Personel seçilir, kamera yaklaşır ve 16 hareketin seçim paneli açılır.
3. Hareket seçilir ve **Oynat** kullanılır. Duraklat, durdur, döngü ve hız ayarlanabilir. Düzenle ile mevcut taşıma, döndürme ve silme araçları açılır.
4. **Kaydet** test sahnesini bu adresin tarayıcı deposuna yazar. Yenileme veya sonraki açılışta kayıt geri yüklenir. Telefon ve bilgisayarın kayıtları ayrıdır. Taşımak ve yedeklemek için mevcut **JSON dışarı aktar / içeri al** kullanılır. Tarayıcı verilerini silmek yerel kaydı siler.

Nathan’ın Driving, Opening vb. hareketleri bu aşamada GLB animasyonlarıdır. Araç sürme, hortum fiziği, uçak bağlantısı veya gerçek vana kontrolü olarak sunulmaz.

## Veri ayrımı

- İlk açılış kaynağı: üretimde herkese açık ADB sahnesinin 17 numaralı yayını, 178 nesne, 13 Ekim 2026. Tam kopya `public/data/adb-test-seed.json`; kaynak ve SHA-256 `docs/adb-test-seed.json` içinde.
- Yeni test kaydı ana sahneye yayınlanmaz. `TestSitePanel` yalnızca paket içindeki başlangıç JSON'unu okur ve `KS_3D_TEST_ADB_V1` anahtarına yerel kayıt yazar. Supabase oturumu veya yazma çağrısı kullanmaz.
- `VITE_KS_TEST_SITE=1` derleme ortam değişkenidir; URL veya yerel depolama ile etkinleştirilemez. Bu değişken yokken üretimin mevcut tasarımcı girişi ve kayıt akışı korunur.
- Test derlemesinde `cloud-config.json` zorunlu olarak boş üretilir. Üretim ortam değişkenleri test servisine kopyalanmaz. Yeni veritabanı, hesap veya ücretli kaynak oluşturulmaz.
- Başlangıç kopyası canlı sahneyle otomatik senkronize edilmez; sonraki üretim kayıtlarının test çalışmasını ezmesi önlenir. Gerektiğinde onaylı yeni bir başlangıç kopyası alınır.

## Render ayarları

| Ayar | Test servisi |
|---|---|
| Ad / istenen adres | `ks-3d-test` / `https://ks-3d-test.onrender.com` |
| Tür | Static Site |
| Depo | `kenanseyhan-operasyon/ks-operations-center` |
| Dal | `ks-3d-test` |
| Derleme | `cd ks-aviation-digital-twin && npm ci --no-audit --no-fund && npm run build && npm run verify:test-build` |
| Yayın klasörü | `ks-aviation-digital-twin/dist` |
| Ortam | `VITE_KS_TEST_SITE=1`, `SKIP_INSTALL_DEPS=true` |
| Otomatik yayın | Yalnızca `ks-3d-test` dalındaki yeni commitler |

Render statik siteleri ücretsiz yayınlanır; derleme dakikaları ve trafik çalışma alanının ortak kotasına dahildir. Ücretli kaynak veya plan yükseltmesi yapılmaz. Kota aşımı hesabın mevcut fatura ayarlarına göre ek ücret doğurabilir. Bu bağlantının araçları fatura/kalan kota değerlerini göstermediği için sınırsız ücretsiz kullanım taahhüdü verilmez.

## Sonraki geliştirmeler

Yeni değişiklikleri bu dal üzerinde veya bundan ayrılan özellik dalında hazırla. Testleri çalıştır, `ks-3d-test` dalına aktar, test sitesinde incele. Kullanıcı açıkça onayladıktan sonra yalnızca onaylı değişiklikleri ana yayın dalına taşı. Test adresi, başlangıç kopyası ve test ortam değişkeni üretime taşınmamalı. Ana dala otomatik birleştirme veya otomatik üretim yayını kurulmadı.

## Doğrulama

`npm test` mevcut regresyon testlerini, gerçek Nathan GLB testlerini ve test kayıt ayrımını çalıştırır. `npm run test:facility`, `npm run test:bridge`, `npm run test:details` mevcut tesis modüllerini kontrol eder.

`VITE_KS_TEST_SITE=1 npm run build && npm run verify:test-build` başlık, PWA, boş bulut bağlantısı, ADB kopyası, Nathan SHA-256 ve 16 hareket, araç ve zemin dosyalarını doğrular. Normal `npm run build` üretim görünümünün derlenmesini kontrol eder. Gerçek cihazda WebGL görünümü ve dokunmatik kullanım ayrıca değerlendirilmelidir; Node/DOM testleri bunun yerine geçmez.

14 Ekim 2026 doğrulaması: `npm test`, üç ek tesis testi, normal derleme, test derlemesi ve `verify:test-build` başarılı. Yanlışlıkla üretim bağlantı değerleri verilmiş bir test derlemesinde de boş bulut ayarının üretildiği doğrulandı. Mevcut Vite 500 kB parça boyutu uyarısı sürüyor. Gerçek masaüstü/mobil WebGL testi bu oturumda yapılamadı.
