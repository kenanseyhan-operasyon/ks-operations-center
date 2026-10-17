# Kabin ve Nathan — 17.10.2026 test raporu

Hedef: Kenan Seyhan 3D Test / `ks-3d-test` dalı. Ana dal ve ana site bu çalışma kapsamında değiştirilmedi.

## Değişenler

- Mevcut özel kabin, Mercedes-Benz Axor gündüz kabininin üretici broşüründeki temel ölçülerine uyarlandı. Kaynak, sayfa ve ölçülerin kesinlik düzeyi [CAB_REFERENCE.md](CAB_REFERENCE.md) dosyasında ayrıldı.
- Eski üst üste binmiş basamak/çamurluk düzeltmeleri kaldırıldı. Tekerin önünde gövdeye bağlı üç basamak ve montajlı tutamaklar oluşturuldu.
- Kapı; cam, iç kaplama, yazı ve üst basamak kapağıyla birlikte 90° açılıyor. İç görüşte cam kenarları saydamlaşıyor; dış görünüşe dönünce malzemeler geri geliyor.
- Ön aksın konumu güncellendi. Platformun sabit ve hareketli parçaları, merdiven–teker açıklığı için birlikte yaklaşık 355 mm geriye alındı. Bu bir proje yerleşim düzeltmesidir, üretici ölçüsü değildir.
- Nathan yeni basamak/eşik/koltuk/pedal/direksiyon noktalarını kullanıyor. Alt basamaklarda dik duruyor, üst eşik için eğiliyor, kollarını kapıdan uzak tutuyor ve ellerini sırayla direksiyona aktarıyor. İnişte kabine dönük tırmanma hareketi ters oynatılıyor.

## Doğrulananlar

| Kontrol | Sonuç |
|---|---|
| Üretici çizimindeki 2490 / 1650 / 2000 / 1510 / 1591 / 450 mm ölçüleri | Geometri üzerinden geçti |
| Basamaklar arası 277 / 286 / 263 mm yükseltiler | Geçti |
| Kabin basamakları–ön teker açıklığı | Geçti |
| Tam sağ/sol direksiyonda ön teker–platform basamağı açıklığı | Geçti |
| Kapı parçalarının 90° açılışı birlikte izlemesi | Geçti |
| 101 çıkış + 101 iniş pozunda tüm tekil cilt yüzeyi noktaları | Test edilen kapı düzlemi, taban ve tavan bölgelerinde çakışma yok |
| Aynı pozlarda el/ayak hedeflerinin erişilebilirliği | Geçti; alt basamaklarda iki el teması kontrol edildi |
| Örneklenen kabin içi en yüksek gövde noktası | 2,6628 m; 2,710 m tavan altında yaklaşık 47 mm açıklık |
| Mevcut `npm test` zinciri | Geçti |
| Kapı açılmasını bekleme → binme → oturma/çalıştırma/kapatma → hedef için basamaklardan inme | Geçti |
| Platform kapısı, düğme, yükselirken personeli taşıma, alçalıp inme | Geçti |
| ADB acil çıkış kapıları, 15 cm bordür ve yol bulma | Geçti |
| V personel bakışı / C kabin, masaüstü/dokunmatik olayları ve kamera geri dönüşü | Otomatik kontroller geçti |
| Test derlemesi ve `verify:test-build` | Geçti; 178 ADB nesnesi, orijinal 16 + ek 3 Nathan klibi, araç ve zemin varlıkları bulundu |

İlk denemelerde taban/kol çakışmaları bulundu ve düzeltildi. Ön aks değişince eski sabit aks konumunu bekleyen kontrol güncellendi; artık fiziksel ön ve çekici arka aksları arasındaki mesafeyi kontrol ediyor. Başarısız ilk denemeler başarılı gibi değerlendirilmedi.

## Sınırlar

Bu model orijinal fabrika CAD'i değildir. Üretici ölçüleriyle doğrulanan alanlar yukarıda sınırlıdır. Kaporta eğrileri, tam şasi kimliği, iç trim ve parmakların anatomik kavrayışı için birebir uygunluk iddiası yoktur.

202 poz taraması, belirli aralıklarda örnekleme ve tanımlı çakışma bölgeleri kullanır; her olası kullanıcı ölçeği, hareket zamanı ve bütün kabin parçaları için sürekli çarpışma ispatı değildir. Testler varsayılan araç ve Nathan ölçeğiyle yapıldı.

Geometri; dokusuz, derinlik tamponlu çevrimdışı görüntülerde incelendi. Gerçek masaüstü/telefon tarayıcısında WebGL görüntüsü ve hareket akıcılığı bu çalışma ortamında doğrulanamadı. Bu nedenle “kusursuz” veya “gerçek cihazda onaylandı” sonucu verilmemiştir.

Mevcut Vite derlemesinde büyük paket uyarısı sürüyor; derlemeyi engellemedi. Yeni ücretli servis veya kaynak oluşturulmadı.
