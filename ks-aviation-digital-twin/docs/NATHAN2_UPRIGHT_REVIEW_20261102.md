# Nathan 2.0 — dik duruş ve kesintisiz merdiven kontrolü

Tarih: 2 Kasım 2026. Çalışma kapsamı yalnızca bağımsız Nathan laboratuvarıdır.

- Laboratuvar: https://ks-nathan2-motion-lab.onrender.com/
- Yayın dalı: `lab/nathan2-independent-20261102`
- Başlangıç sürümü: `bdb1a50b08e18fbacbbaee384de8d822af440cba`
- Gemini, çalışan Hotmail `ks-3d-test` ve Supabase üzerinde değişiklik yapılmadı.

## Hareket seçimi

Başlangıçta CMU 83 çıkış seçilir. Düz yaklaşmada ve inişte Nathan'ın mevcut
yürüyüşü kullanılır. CMU 113 otomatik seçilmez; ayrı kalite kapısı kapalıdır.
Önceki Nathan seçeneği karşılaştırma için korunmuştur.

CMU kaydı tek başına korkuluk tutuşu içermez. Gövde ve serbest kol hareketi
kayıttan gelir; basamak hedefleri ve tek el korkuluk teması laboratuvarın
temas çözücüsü tarafından uygulanır. Nihai bacak hareketi ham MoCap'in birebir
tekrarı değildir; basamak geometrisine uyarlanır.

## Düzeltilen nedenler

1. Nathan'ın kemik olmayan Armature üst dönüşümü, başlangıç iskeleti
   kurulurken kayboluyordu. Gerçek ters bağlama matrisleri üzerinden başlangıç
   pozu geri kuruldu; CMU'nun başlangıç pozuna göre dönme farkları Nathan'ın
   kendi eksenlerine uygulanıyor. Canlı model değiştirilmeden klonda hesaplanır.
2. CMU 83 kesiti sahanlıkta duruş içeriyordu; CMU 113 çıkış kesiti dönüş
   içeriyordu. Her kesit bir tam sağ–sol adıma indirildi. Son 180 ms'de küçük
   çevrim farkı yumuşatılır. İlk eklenmiş T-pozu oynatılmaz.
3. CMU 83'ün iki bozuk ayak bileği aralığı yalnızca bellekteki kopyada komşu
   düzgün rotasyonlardan tamamlandı: sağ 4,6833–4,95 s, sol 5,5333–5,8333 s.
   Kaynak BVH dosyaları değiştirilmedi; kalça, uyluk ve kaval hareketi korunur.
4. Animasyon zamanı kat edilen mesafeyle eşlendi. Hızlandırma küçük zaman
   adımlarına ayrılır; ikinci bir animasyon saati fazı kaydıramaz.
5. Ayak hedefi eğimli rota yüksekliği yerine gerçek düz basamak yüzeyini
   kullanır. Salınan ayak önce yükselir, basamağı geçer, sonra iner.
6. Korkuluk bulunamadığında ayak IK'si de kaldırılıyordu. Ayak teması artık
   yaklaşma, merdiven, dönüş ve bitişte devam eder; bitiş pozuna geçiş yumuşaktır.
7. Her basamak için ayrı kısa korkuluk parçası el hedefini sıçratıyordu.
   Tek, bağlı fiziksel korkuluk kullanılır. Tutuş erişilebilir giriş/çıkışta
   kademeli başlar ve biter. Kavrama yarıçapı gerçek boruya, 31 mm'ye eşlendi.
8. Art arda aynı korkuluk kontrol noktaları Catmull–Rom eğrisini sahanlıklarda
   geriye döndürüyordu. Yinelenen noktalar kaldırıldı; görsel boru ve temas
   örnekleri aynı temiz eğriyi ve yay uzunluğu çözünürlüğünü kullanır.
9. Laboratuvara özel `blendFromAnimatedHand` seçeneği elin serbest animasyondan
   kavramaya geçmesini sağlar. Diğer çağıranların varsayılan davranışı korunur.
10. Eksik çatı geçiş platformu eklendi; çatı yüzeyi rota yüksekliğine eşlendi.
    DUR gerçek pozu dondurur. Yakın takip kamerası ve gövde eğimi göstergesi eklendi.

## Gerçek iskelet ölçümleri

Gövde açısı, kalça–boyun doğrultusunun dünya dikeyiyle yaptığı açıdır.
Bu bir animasyon kontrol ölçüsüdür; kişinin yaşı/sağlığı hakkında yorum değildir.

| Kayıt | Ortalama gövde açısı | En büyük gövde açısı | Süre |
| --- | ---: | ---: | ---: |
| Eski CMU 83 aktarımı, aynı test düzeneği | 90,06° | 93,01° | Eski kesit |
| Düzeltilmiş CMU 83 çıkış | 14,61° | 17,93° | 1,7667 s |
| Düzeltilmiş CMU 113 çıkış — kapalı seçenek | 6,08° | 8,73° | 1,5 s |
| Düzeltilmiş CMU 113 iniş — kapalı seçenek | 4,90° | 11,73° | 1,4333 s |

CMU 83 kaynak aralığı: 4,3167–6,0833 s. CMU 113 çıkış: 0,7333–2,2333 s;
iniş: 3,9–5,3333 s. Çevrim sınırında eklem farkı 0,04°'den küçüktür.

## Kesintisiz varsayılan rota testi

Test gerçek Nathan GLB'sini, canlı sayfanın hareket seçimi/zamanlama kodunu ve
temas çözücüsünü kullanır. 60 Hz'de tam yaklaşma, çıkış, çatı dönüşü, iniş ve
bitiş yerleşmesi değerlendirilir. Fiziksel yüzey kontrolü, görünür basamak ve
platform geometrilerine bağımsız Three.js ışın kesişimiyle yapılır.

| Ölçüm | Çıkış | İniş |
| --- | ---: | ---: |
| İncelenen kare | 6.407 | 6.478 |
| Ayak teması bulunan kare | 6.407 | 6.478 |
| Tam tutuş gereken kare | 5.819 | 5.819 |
| Bu bölümde eksik tutuş | 0 | 0 |
| Salınan taban referansının basamağa batması | 0 mm | 0 mm |
| İki kare arasında en büyük taban yer değiştirmesi | 46,6 mm | 45,1 mm |
| En büyük bilek yer değiştirmesi | 38,3 mm | 31,8 mm |
| Korkuluk merkez çizgisinden en büyük kavrama farkı | 0,039 mm | 0,044 mm |

Kontroller yalnızca hedeflere yakınlığı ölçmez: serbest bırakılmış elin gerçek
bileği de izlenir. Önceki kör nokta, el merkezi korkulukta kalırken bileğin
ters dönmesiydi. Temiz eğri bu sıçramayı kaynağında giderdi; el rotasyonuna
genel bir hız sınırlaması eklenmedi.

Ek kontroller: saat yönü/ters yön, 0°/45°/−125° tank dönüşleri ve 1×/4× hızları
içeren 12 motor senaryosu; gerçek iskelette duraklatma ve kare hızından bağımsız
poz; kaynak rotasyon/çevrim testleri; mevcut araç/el kavrama regresyonları.

Çalıştırma: `npm run test:nathan2`. İsteğe bağlı CMU 113 rota kontrolü varsayılan
yayın kapısını açmaz. Tam uygulama ayrıca TypeScript ve Vite derlemesinden geçirilir.

## Görsel inceleme ve sınırlar

Gerçek GLB'nin dokusu ve deforme olmuş yüzeyinden önden/yandan CPU kontrol
görüntüleri üretildi. Bunlar tarayıcı ekran görüntüsü değildir. Bu oturumun
uzak tarayıcısında WebGL bağlamı açılamadığı için tarayıcıda hareketli 3D kabulü
yapılamadı; sayfa bu durumu artık yükleniyor mesajında takılmadan açıklar.

CMU 83; düzeltilmiş dik duruş, çevrim, kesintisiz rota kontrolleri ve son
gerçek-model görselleri incelendikten sonra yalnızca laboratuvar değerlendirmesi
için açıldı. Görsel örnekler iki sahanlığı, korkuluğun kademeli bırakılmasını ve
çatıdaki iki ayaklı son duruşu da içerir. CMU 113 kapısı kapalı kalır.

Bu sürüm bağımsız laboratuvarda değerlendirme içindir. Taban ve kavrama
referanslarının çok küçük sayısal hatası; bütün ayakkabı/parmak yüzeylerinin
çarpışmasız olduğunu veya hareketin kişi tarafından doğal bulunduğunu kanıtlamaz.
Korkuluk direklerinin çevresinde parmak çarpışması ve merdivenin ortasında ani
180° yön değişimi, ayrı hareket düzenlemesi gerektirebilecek sınırlar olarak kalır.
CMU 113'ün başının yana bakışı ayrıca gözden geçirilmeye devam eder.

Kaynak ve kullanım belgeleri `public/mocap/cmu/READMEFIRST_CMU_BVH.txt` ve
`docs/NATHAN2_REAL_FREE_MOCAP_20261102.md` içinde korunmuştur.
