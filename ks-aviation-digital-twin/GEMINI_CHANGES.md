# Gemini fikirleri — Nathan ayrı test sürümü (17.10.2026)

Bu çalışma mevcut KS Aviation Digital Twin projesinin **ayrı bir kopyasında** yapılmıştır. Astra/orijinal GitHub ve Render değiştirilmemiştir.

## Uygulanan kod değişiklikleri
- `src/nathan-camera.ts`: Ön/arka takip kamerasına zamandan bağımsız sönümleme (önceki ayrı test paketinden).
- `src/nathan-gemini-motion.ts`: Nathan için kare süresini ve sağ/sol dönüş açılarını eşit işleyen, güvenli yürüyüş adımı yardımcıları.
- `src/nathan-controller.ts`: Normal yürüyüş ve tank/çatı yürüyüşünde dönüş açısının **mutlak değeri** esas alındı. Önceki kodda `error > 35` / `error > 30` nedeniyle negatif yönlü dönüşte Nathan yürümeye devam edebiliyordu. Yeni sürümde iki yöne de aynı kural uygulanır; dönüş esnasında yürüyüş hızı sıfıra doğru azaltılır.
- `tests/gemini-motion.test.mjs`: Her iki dönüş yönü, hareket sınırları ve çatı eşiği için testler.

## Korunan mekanikler
Mevcut `nathan-navigation.ts`, `nathan-access.ts`, merdiven temasları, kapılar, araç operasyonları ve sürücü mantığı korunmuştur. Gemini'nin genel `NathanController.js` / `TriggerZone.js` örnekleri mevcut TypeScript projesinin yerine **körlemesine eklenmemiştir**.

## Gerçek test durumu
- `node --experimental-strip-types tests/gemini-motion.test.mjs`: PASS.
- `node tests/gemini-camera.test.mjs`: PASS.
- `npm ci` bu çalışma ortamında zaman aşımına uğradı; tam `npm run build`, `npm run test:nathan` ve gerçek tarayıcı 3D kullanım testleri **henüz geçmedi / doğrulanmadı**.

## Render yayını
Yeni özel GitHub deposuna **ZIP dosyasının kendisini değil, içindeki proje dosyalarını** aktarın. Dosyaların kökünde `package.json` olmalı. Render Static Site için Build Command `npm ci && npm run build`, Publish Directory `dist`. `npm run build` öncesi prebuild script'i modelleri parçalarından oluşturur. GitHub depoya erişim vermeden uzaktan dağıtım tamamlanamaz.

## Kontrol senaryoları
Nathan'ı aynı hızla sağa ve sola 90 ve 180 derece döneceği noktalara gönderin; yön değiştirmeden ilerlememeli. Tank üstünde de iki yönde eşdeğer davranışı doğrulayın. Kamera ön/arka takip modunda ani yön değişimlerini karşılaştırın. Merdiven, kapı ve araç senaryolarında eski davranışların korunup korunmadığını ayrıca kontrol edin.


## Gemini phase 1+2 reviewed (October 2026)
- `nathan-controller.ts`: exponential angular smoothing with 180 deg/s cap; exponential velocity approach (4.5/s start, 6/s stop). Existing stop-before-turn `walkingStep`, route navigation, contact/IK, and camera API preserved.
- Did **not** replace `NathanCamera`: Gemini proposed `NathanCameraController` constructor requires `Scene` and breaks existing canvas/pointer and `set/update` callers.
- Did **not** add extra offset-line `clearHull` on top of the existing radius-inflated obstacle footprints: that would double-count body clearance and block valid narrow passages. Existing `clear` already checks the inflated collision volumes.
- Did **not** replace `stairPose`: Gemini sample has a different signature and lacks proof of three simultaneous physical contacts. Existing pose/contact rig preserved.
- Assertions of millisecond-exact FPS equality, physics-proof foot contact and sphere casting are NOT validated. Gemini code uses ordinary raycasting, not sphere casting.
- Runtime browser/WebGL test and full build must be completed before release.
