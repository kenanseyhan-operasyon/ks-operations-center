# ADB tesis parçaları ve akış denemesi — 11 Ekim 2026

Mevcut ADB sahnesine 48 düzenlenebilir tesis parçası eklendi. Araçlar, rotalar,
hesap sistemi ve yayınlanmış sahne bu sürüm için değiştirilmedi. Fotoğraf
referansları 229 tesis fotoğrafı ve altı video; geometriler ölçülmüş saha rölevesi
değil, yerleşim tasarımı için ayarlanabilir modellerdir.

## Kullanım

1. ADB Tesisi içindeki araç menüsünden **Tesis parçaları / akış** bölümünü açın.
2. **Parçalar** sekmesinde Yangın, Boru / vana, Merdiven / geçiş, Saha veya
   Çizgi / yazı grubunu seçin. Yerleştirme ve değişiklikler mevcut tasarımcı
   yetkisini kullanır; ziyaretçi ortak sahneyi değiştiremez.
3. **Bağlantı / özellik** sekmesinde ölçü, renk, yazı, vana etiketi ve bağlantıları
   düzenleyin. Zemin çizgileri ve alanların noktaları sürüklenebilir. Levha ve
   duvar ekipmanları **Bir yüzeye tak** ile duvar, tel örgü veya tank yüzeyine
   bağlanır ve o nesneyle birlikte hareket eder.
4. Tank seçildiğinde çevresel merdivenin başlangıç açısı, genişliği, dönüş yönü
   ve dolanma açısı ayarlanır. Köprü için iki tank seçilir; köprü konumu, boyu
   ve eğimi tankları takip eder. Gerçek kot farkı ve sahanlık ihtiyacı yerleşimde
   ayrıca değerlendirilmelidir.
5. **Boru / vana → Bağlanmış su / köpük takımı ekle**, 14 parçalık düzenlenebilir
   başlangıç takımı ekler. Mevcut ADB yerleşimini değiştirmez veya kendiliğinden
   kaydetmez. Tasarımı mevcut **Kaydet** düğmesiyle açıkça kaydedin.

## Su ve köpük mantığı

Bağlantı modeli yönlüdür. Borunun boyası akışkanı belirlemez. Su, ana hattan
bağımsız kollara ayrılır. Emiş karıştırıcısının ana girişine su, yan girişine
konsantre deposu veya onun vanası bağlanır. Açık çıkış bulunduğunda karıştırıcı
sonrası akış ayarlanan oranla köpüklü su olur; diğer su kolları su olarak kalır.
Konsantre vanası kapandığında veya depo boşaldığında su akışı devam eder.
Su beslemesi kapandığında yalnız ona bağlı kollar etkilenir. Döngülü, kopuk veya
yanlış akışkanlı bağlantılar durum mesajıyla belirtilir.

**Akış denemesi** sekmesindeki vana hareketleri, depo seviyeleri ve olaylar
tasarımın başlangıç ayarlarından ayrı tutulur. Deneme tasarımı kaydetmez.
Debi girilmedikçe konsantre tüketimi hesaplanmaz. Girilen deneme debisiyle
tüketim, çözeltinin debisi × ayarlı oran × süre olarak hesaplanır.

Bu sürüm basınç kaybını, Venturi emişinin çalışma aralığını, pompa eğrisini,
gerçek köpük kalitesini veya yangın söndürme başarısını hesaplamaz. Varsayılan
karışım oranı ekipman tavsiyesi değildir; saha ekipmanına göre düzenlenir.
Yangın alarmı ile acil durdurma ayrı nesnelerdir. Acil durdurma sadece açıkça
atanmış ekipmanları etkiler; hedef atanmamışsa yalnız olay kaydı oluşturur.

## Parça grupları

- Yangın monitörü, yay biçimli monitör duvarı, köpük tankı ve bidonu, dolaplar,
  duvar/tekerlekli tüpler, hidrant, alarm butonu, acil stop ve ikaz lambası.
- Su beslemesi, çizilebilir kırmızı/sarı borular, T ve dirsek bağlantıları,
  vanalar, emiş karıştırıcısı, soğutma çıkışı, sprinkler ve manometreli boru.
- Tanklar arası köprü, havuz duvarı geçişi, mobil merdiven, yaya kapısı.
- Bekçi mobosu, WC, atık sahası, motorin ünitesi, dubalar, koniler, zincirler,
  bariyer, bordür, drenaj, rögar, döküntü seti, göz ve vücut duşu.
- Yüzey levhası, zemin yazısı/oku, toplanma işareti, sürekli/kesikli çizgi,
  ayak izleri, yürüyüş alanı ve taralı alan.

## Veri uyumluluğu ve doğrulama

Yeni ayarlar nesnenin isteğe bağlı `facility` alanında saklanır; mevcut
`KS_DIGITAL_TWIN_V1` şeması ve bulut kayıt akışı korunur. Supabase şema, Auth,
RLS ve kullanıcı kayıtlarına müdahale edilmedi. Yayımlanmış 93 nesnelik ADB
kaydına test verisi yazılmadı.

- `npm run test:facility`: 48 parçanın geometrisi, bağımsız su/köpük kolları,
  vana/depo durumları, bağlı nesneler, kopyalama, geçmiş ve JSON uyumluluğu.
- `npm test`: mevcut 18 test grubunun tamamı geçti.
- `npm run build`: TypeScript ve üretim derlemesi geçti.
- Chromium ekran testi: takım ekleme, vana kullanımı, merdiven ayarı, çizgi
  noktası sürükleme, gerçek 3D yüzey seçimi, duvarla hareket, kayıt ve ikinci
  cihaz görünümü, mobil panel ve ziyaretçi yetkisi. Bulut istekleri bu testte
  yalıtılmış sahte sunucuya yönlendirildi; üretim hesabında kayıt yapılmadı.

## Köprü ve tank merdiveni düzeltmesi — 11 Ekim 2026, akşam

- Köprü kartındaki **İki ucu seç**, ilk noktayı doğrudan tank çatısından alır.
  İlk tık nesne yaratmaz; ikinci noktaya giderken yüksekte önizleme görünür.
  İkinci tank veya yükseltilmiş platform gerçek kotuyla seçilir. Boş alandaki
  bitiş noktası ilk tankın çatı kotunda kalır. Zemin ilk nokta olamaz.
- Mevcut köprüde **Uçları yeniden seç**, aynı nesneyi yeni iki noktaya bağlar.
  Vazgeç/Esc yarım yerleştirmeyi kaydetmeden kaldırır.
- Bağlantı noktaları nesnelerle birlikte saklanır; tankın taşınmasını,
  dönmesini ve yüksekliğini izler. Eğik köprülerin korkuluk açıklığı, köprünün
  gerçek kesişiminden ve genişliğinden hesaplanır. Köprü silinince açıklık kapanır.
- Merdiven revizyonu özellikle `84 (1).zip` içindeki üst sahanlık/köprü
  fotoğrafları ve `90 (1).zip` içindeki Tank 2 taşıyıcı yakın planıyla
  karşılaştırıldı: ızgara basamak, sac yan taşıyıcı, üçgen konsol, açık giriş,
  üst yatay sahanlık ve devam eden çift sıra korkuluk. Varsayılan sarım
  180 derece; mevcut açıkça kaydedilmiş açı ve genişlik ayarları korunur.
- `npm run test:bridge` gerçek 3D ışınla çatı seçimini, çapraz köprü boyunca
  korkuluk açıklığını, kalıcı bağlantıları, silme/geri almayı doğrular.

## Saha ayrıntıları — 12 Ekim 2026

- Bekçi mobosunda ön, arka, sağ ve sol pencere kutuları hemen uygulanır.
  Mevcut kayıtların varsayılanı ön/sağ/sol açık, arka kapalıdır. Yeni alanlar
  isteğe bağlıdır; `false` değerleri de bulut kaydında korunur.
- Levhaların dokusu kendi en/boy oranında üretilir. Yazı yatayda ezilmez,
  cepheden doğru okunur; açık/koyu renkler kontrastlı bir zemine yerleşir.
- Yürüme yolu, ayak izleri ve duba gövdeleri yalnız gece modunda düşük
  sabit ışık yayar. Ayak izlerinde ayrı sağ/sol taban ve topuk kullanılır.
- Şişeli göz yıkama istasyonunda iki kapağın yönü aşağıdır. Kütüphane kartı
  doğrudan **Yüzeye tak** akışını başlatır; tıklanan yer parçanın merkezi olur.
  Atık sahası ön örgüsü görünmez bir seçim yüzeyiyle boşluklardan da seçilir.
  Yerleştirme geçerli yüzey seçilmeden nesne yaratmaz. Bağlantılar duvar veya
  kulübenin taşınmasını izler; çatı ve döngü oluşturan bağlantılar reddedilir.
- Motorin tankında yükseltilmiş beyaz çelik ayak, sızıntı tavası (seçenekli),
  ön/yan MOTORİN levhaları, dispenser, hortumlar ve fotoğraftaki 30/1202
  plakası bulunur. Mevcut nesnenin konumu veya kaydı değiştirilmez.
- **Köpük tankı kulübesi** yangın kategorisindedir. Özelliklerdeki
  **İçine köpük tankı ekle** her basışta bir tank ekler (en fazla iki); tanklar dekor değildir,
  ayrı seçilir ve su/köpük bağlantı modelini kullanır. Kulübeyle hareket eder.
- **Sigara içme alanı** saha kategorisindedir: açık ön/yan geçiş, oluklu
  panel ve çatı, sarı bank, kül tablası, bordür ve yeşil levha.
- Fotoğraftaki birleşik duşta yeşil çanak, iki sarı kapaklı göz nozulu,
  yan itme kolu, üst duş çanı ve üçgen çekme kolu bulunur. Su girişine bir
  besleme bağlayın. **Akış denemesi** sekmesinde göz yıkama ve üst duşu ayrı
  çalıştırın. Hareketli su ancak su beslemesi varken görünür; üst vana
  kapanınca kesilir. Köpük/konsantre yanlış akışkan olarak reddedilir.
  Deneme kontrolleri kayıtlı başlangıç ayarlarını değiştirmez.

Doğrulama: `npm test` içindeki mevcut 18 grup, `test:facility` (50 parça,
369 mesh grubu), `test:bridge`, yeni `test:details` ve üretim derlemesi geçti.
Chromium masaüstü ve 390×844 dokunmatik görünümde kutular, gerçek örgüye
3D yerleştirme, iki tank ekleme, duş/vana kontrolleri, gece/gündüz geçişi,
yazı oranları, yalıtılmış kayıt/ikinci cihazdan açma ve ziyaretçi yetkisi
kontrol edildi. Modeller ekran görüntülerinde incelendi. Bulut testleri
sahte sunucudadır; üretim sahnesine veya kullanıcı verisine yazılmadı.
