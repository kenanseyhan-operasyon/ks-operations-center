# Kabin / platform yerleşimi — 17.10.2026 görsel düzeltme raporu

Hedef: **Kenan Seyhan 3D Test**, `ks-3d-test` dalı. Bu çalışma ana dalı ve ana siteyi değiştirmez. Kullanıcının 07:06, 07:07 ve 07:14 tarihli üç işaretli görseli esas alındı.

## Düzeltmeler

- Kabinin ön yüzü sabit tutularak arka tarafı 180 mm kısaltıldı. Kaynak broşürdeki 1.650 mm uzunluk, bu özel yerleşimde 1.470 mm oldu; yeni uzunluk üretici ölçüsü olarak sunulmuyor.
- Platformun 355 mm geriye taşınması geri alındı. Platform özgün yerinde; yükselme boyunca filtreye girmiyor.
- Platformun kapalı konumu yaklaşık 219 mm aşağı alındı. İki makas kademesinin açıları ve bağlantı konumları birlikte güncellendi; en yüksek çalışma konumu korundu.
- Ek platform basamakları kaldırıldı. Özgün üç basamak 355 / 670 / 990 mm yüksekliklere ayarlandı.
- Ek dış tutamaklar kaldırıldı; Nathan özgün giriş korkuluğunu kullanıyor ve platforma yerleşince bırakıyor. Yaylı kapı ve personelle yükselme işlevleri korundu.
- Hortum tamburu yaklaşık 120 mm arkaya, bonding makarası ve desteği 120 mm öne alındı. Kılavuz ve hortumun üst bağlantısı tamburu izliyor.
- SOCAR çevresindeki ve kabin arkasındaki siyah yüzey çakışmalarının nedeni kaldırıldı: iç kaplama dış boyadan içeri ayrıldı, eş düzlemdeki siyah kabuk kopyası kaldırıldı.
- Kabin içindeki uzun ek korkuluklar kaldırıldı. Kapı kasası ve kapı iç kaplamasına bağlı kısa tutamaklar kullanılıyor. Ön aks özgün konumunda; daraltılan kabin basamakları tekerin önünde kalıyor.
- Nathan açık kapının arkasından yaklaşıyor, ayaklarını gerçek basamaklara yerleştiriyor ve kabine geçerken ellerini sırayla aktarıyor.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Özgün platform konumu ve yalnızca üç basamak | Geçti |
| 81 yükselme konumunda platform–filtre açıklığı | Geçti |
| Kapalı/açık platform yüksekliği ve özgün üst çalışma konumu | Geçti |
| İç kaplama–dış kaporta ayrımı | Geometri kontrolü geçti |
| Ön teker–basamak açıklığı ve 90° kapı bütünlüğü | Geçti |
| 101 binme + 101 inme pozu | Test edilen taban, tavan ve açık kapı bölgelerinde çakışma yok; el/ayak erişimi geçti |
| Nathan platform/kabin uçtan uca etkileşimleri | Yaylı kapı, düğme, personelle yükselme, alçalma ve hedefe inerek yürüme geçti |
| Mevcut test zinciri | Tüm gruplar tamamlandı; oturum kesintisinden sonra kalan gruplar ayrıca çalıştırıldı |
| TypeScript / Vite test derlemesi | Geçti |
| `verify:test-build` | 178 ADB nesnesi, özgün 16 + ek 3 Nathan klibi, araç/zemin varlıkları ve test yapılandırması geçti |

Başlangıçta kısa tutamaklara erişim ve kapıya yaklaşma testleri başarısız oldu; güzergâh, gövde konumu ve el geçişi düzeltildikten sonra yukarıdaki poz taraması geçti. Önceki sonuçlar yeni geometri için otomatik olarak geçerli sayılmadı. Eski platform testindeki sabit “1,5 metreden yüksek” beklentisi, indirilen platformun gerçek taban yüksekliğini kontrol edecek şekilde güncellendi; yeni kontrol ve hareket testleri geçti.

## Sınırlar

Bu model orijinal fabrika CAD'i değildir. Ölçülerin kaynağı ve yerleşim varsayımları [CAB_REFERENCE.md](CAB_REFERENCE.md) dosyasındadır. Fabrika kabini veya anatomik olarak kusursuz parmak kavrayışı iddiası yoktur.

Görseller gerçek geometriyle, dokusuz çevrimdışı derinlik tamponu kullanılarak incelendi. Gerçek bilgisayar/telefon tarayıcısındaki WebGL görüntüsü ve akıcılığı bu ortamda doğrulanamadı. Poz taraması belirli aralıklarda ve tanımlı bölgelerde yapılır; her kullanıcı ölçeği ve her yüzey için sürekli çarpışma ispatı değildir.

Mevcut büyük JavaScript paket uyarısı devam ediyor; derlemeyi engellemiyor. Yeni ücretli servis veya kaynak oluşturulmadı.
