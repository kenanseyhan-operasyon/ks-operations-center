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
