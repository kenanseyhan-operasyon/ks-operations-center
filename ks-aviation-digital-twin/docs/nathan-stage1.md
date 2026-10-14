# Nathan personel modülü — Aşama 1

14 Ekim 2026. Geliştirme dalı: `feature/nathan-operator`.
Başlangıç: canlı `ks-aviation-digital-twin` dalının `4f89f6a020857b824497488b36001eb225401d9a` sürümü.

## Doğrulanan mimari

- Proje: `kenanseyhan-operasyon/ks-operations-center`, uygulama dizini `ks-aviation-digital-twin`.
- TypeScript + Vite + Three.js; `Workspace` sahne, seçim, TransformControls, serbest/Orbit kamera ve mobil girişleri yönetir.
- `scene-data.ts` katalog, doğrulama, JSON ve geri al/ileri al geçmişini; `objects.ts` seçilebilir nesne köklerini; `gse-library.ts` ekipman kartlarını sağlar.
- Mevcut `REFUEL_OPERATOR` prosedürel personeli ve operasyon modülü korunmuştur. Nathan ayrı `NATHAN_OPERATOR` tür ayarıyla eklenmiştir; onun animasyonları araç/ikmal operasyonlarına bağlanmaz.
- Render statik site: https://ks-aviation-digital-twin.onrender.com. Canlı servis `ks-aviation-digital-twin` dalını izler; bu çalışma için canlı dal, Render ayarı veya üretim sahnesi değiştirilmemiştir.

## Model ve varlık akışı

Kullanıcının sağladığı `KS_Nathan_15_Hareket.glb`: **25.874.096 bayt**, **16 klip**, **12.216 köşe**, bir iskelet ve gömülü 8192 × 8192 JPEG doku.

SHA-256: `579deba138d7311119821ffd37cf10694533322d79bcbe63dabffcbb6b65c3ef`.

Projedeki mevcut model paketleme yaklaşımı kullanıldı: `model-parts/nathan/` kaynak parçaları, `scripts/extract-nathan.mjs` ile derleme/test öncesinde `/public/models/personnel/KS_Nathan_15_Hareket.glb` dosyasını yeniden oluşturur. Boyut, SHA-256 ve klip listesi doğrulanır. Kaynak GLB baytları değiştirilmez. GitHub bağlantısının 16 MiB istek sınırı nedeniyle tek büyük ikili yükleme yerine bu kaynak parçaları kullanılmıştır.

Model yalnızca ilk Nathan sahneye eklendiğinde yüklenir. Kopyalar geometri, malzeme ve dokuyu paylaşır; iskeletleri ve animasyon durumları ayrıdır. GPU doku boyutu telefonda en fazla 2048, masaüstünde en fazla 4096 piksele ve cihaz sınırına göre küçültülür; özgün dosya korunur. Gerçek cihaz performans ölçümü henüz yapılmamıştır.

## Kullanım ve davranış

1. Tasarım yetkisiyle **Kitaplık → İkmal Personeli — Nathan** kartını açın.
2. **Haritada yerleştir** veya **Merkeze ekle ve git** kullanın.
3. Personeli seçip **Personel** düğmesinden animasyon panelini açın.
4. Klip seçin; **Oynat / Duraklat / Durdur**, tekrar ve hız kontrollerini kullanın. Durdur seçili klibin başlangıcına döner. Oynayan klipler 0,25 saniyede birbirine geçer.
5. **Nesneyi düzenle** mevcut tasarım panelini açar. Taşıma, döndürme, silme, kopyalama ve geri alma mevcut araçlarla yapılır. Normal **Kaydet** işlemi konumu ve animasyon tercihlerini saklar; kayıt açıldığında hareket kendiliğinden başlamaz.

Seçilebilir kök nesne animasyondan ayrıdır. Boy 1,78 metreye normalize edilir. Kemik animasyonu gerçek sahne konumunu değiştirmez; geometri her hareket adımında zemine hizalanır. Yükleme sırasında seçilebilir işaretçi, hata durumunda açıklama ve yeniden deneme bulunur. Silinen veya değiştirilen bir nesnenin geç tamamlanan yüklemesi sahneye geri dönemez. Sahne/görünüm değişiminde oynatma durur, personel kaydı korunur.

Bu aşamada **Driving**, **Opening** ve diğer adlar yalnızca klip adlarıdır. Araç sürme, kapı/valf işletme, hortum fiziği, uçak bağlantısı, gerçek tırmanma veya yakıt transferi Nathan için uygulanmamıştır. Kamera kısayolları ve dokunma kontrolleri Nathan paneline aktarılmaz; mevcut kamera sistemi kullanılır.

## GLB içinden okunan hareketler

| # | Klip | Süre (s) |
|---|---|---:|
| 1 | Climbing | 1,60 |
| 2 | Climbing_Ladder | 0,80 |
| 3 | Climbing_To_Top | 4,03 |
| 4 | Crouch_To_Stand | 2,60 |
| 5 | Driving | 5,03 |
| 6 | Idle | 8,37 |
| 7 | Jumping_Down | 2,70 |
| 8 | Kneeling_Down | 2,80 |
| 9 | Nathan_Original_Walk | 1,83 |
| 10 | Opening | 5,27 |
| 11 | Opening_1 | 11,00 |
| 12 | Pulling_Lever | 6,30 |
| 13 | Running | 1,67 |
| 14 | Running_Up_Stairs | 0,63 |
| 15 | Shaking_Hands_2 | 4,40 |
| 16 | Walking_Turn_180 | 1,03 |

Panel bu tabloya bağımlı değildir; liste gerçek GLB `AnimationClip` verisinden oluşturulur.

## Doğrulama

- `npm test`: mevcut 19 test grubu ve yeni Nathan testi başarılı.
- `npm run test:facility`, `npm run test:bridge`, `npm run test:details`: başarılı.
- `npm run build`: TypeScript ve üretim derlemesi başarılı. Vite'ın büyük JavaScript parçası uyarısı derlemeyi engellemedi.
- Nathan testi gerçek GLB ile 16 klip boyunca **626 örnek kareyi** kontrol eder: zemin, sonlu dönüşümler, sabit kök konumu, bağımsız kopyalar, ray ile seçim, oynat/duraklat/durdur, klip geçişi, tek sefer oynatma, JSON kayıt dönüşümü, taşı/döndür/sil/geri al, geç yükleme iptali ve yeniden deneme.
- Panel kontrolleri ve kütüphane ekleme düğmeleri DOM testinde doğrulandı. Kamera/mobil kontrollerin mevcut otomatik testleri geçti.
- Dört pozun gerçek skinned geometrisi SVGRenderer ile görüntülenerek incelendi. Bu görüntü doku veya WebGL kontrolü değildir.

**Doğrulama sınırı:** Bu ortamda desteklenen tarayıcı otomasyonu olmadığı için gerçek masaüstü/telefon WebGL testi ve cihaz performans ölçümü yapılmadı. Node testinde yalnızca JPEG çözümü yerine boş bir doku kullanılır; geometri, kemikler ve animasyonlar özgün dosyadan okunur. Canlı yayına geçmeden önce Nathan ekleme, animasyonlar, kayıt açma ve mobil gezinme gerçek tarayıcıda kontrol edilmelidir.
