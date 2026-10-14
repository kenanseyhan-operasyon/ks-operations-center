# Nathan — fare/dokunmatik yönetim ve merdiven erişimi

Geliştirme dalı: `ks-3d-test`.
Test ortamı: https://ks-3d-test.onrender.com — Kenan Seyhan 3D Test.
Ana dal ve üretim dalı/Render servisi değiştirilmez. Yeni Render kaynağı oluşturulmaz.

## Kullanım

1. ADB Tesisi → kitaplık → **İkmal Personeli — Nathan** → sahneye yerleştir.
2. Nathan'a tıkla. **Personeli Yönet** paneli açılır; kitaplık, nesne düzenleme, servis ve tesis panelleri kapanır.
3. **Personeli Yönet** seçiliyken boş zemine tıkla/dokun. Nathan yönünü yumuşakça çevirip yürür. Yeni hedef eski rotayı değiştirir. Varınca Idle'a geçer.
4. Araç arka merdiveninin basamağına veya platform merdivenine tıkla. Telefonda küçük basamakları seçmek yerine panelin **Yakındaki merdivenler** listesini de kullanabilirsin.
5. Girişe yürür, hizalanır, ilgili kapı/korkuluk açılmasını bekler, merdiveni çıkar ve gerçek platform yüksekliğinde durur. **Merdivenden in** veya aynı merdivene yeniden tıklama inişi başlatır. **Hareketi durdur** ve **Çıkışa devam** merdivende duraklatmayı destekler.
6. **Kamera** mevcut kamera kontrollerini etkinleştirir. **Personeli Yönet** düğmesi hedef verme moduna geri döner. Sürükleme, iki parmak ve iptal edilen dokunma hedef komutu üretmez.
7. **Nesneyi düzenle** taşıma/döndürme/silme araçlarını açar. Animasyon önizlemesinde GLB'nin 16 klibinin tamamı korunur; önizleme otomatik yürümeyi durdurur.
8. **Kaydet**, Nathan'ın dünya konumunu ve merdiven/platform desteğini test ortamına ait tarayıcı kaydına yazar. Kayıt diğer cihazlarla paylaşılmaz. JSON dışarı aktarılabilir.

## Uygulama

- `nathan-navigation.ts`: .34 m × personel ölçeği açıklıklı, döndürülmüş nesne ayak izleri ve çizilmiş duvar/engel parçaları üzerinde A*. Açık kapılar geçilebilir; kapalı kapılar engeldir. Çapraz köşe kesme ve hareket adımında engelden geçme önlenir. Yeni engelde yeniden rota aranır; bulunamazsa durur. Hedef sınırı 120 m, arama bütçesi 24.000 düğüm.
- `nathan-access.ts`: R14'ün gerçek `Rear_Ladder_Close_Step*`, `Fixed_Step*`, `Tank_Top_Walkway`, `Platform_Grey_Floor` geometrisinden dünya koordinatlarında giriş, basamak ve yakın sahanlık hesaplar. Dönme, ölçek ve römork eklemi hesaba katılır. Tekerlekli platform/geçiş merdivenleri de desteklenir.
- `nathan-controller.ts`: yürüme → hizalanma → erişim hazırlığı → çıkış → bekleme → iniş durumları. Yön dönüşü 150°/sn ile sınırlı; ivmelenme/yavaşlama ve yürüme hızıyla ilişkili klip hızı vardır. Araç kullanımında merdiven/platformdaki personel kilidi korunur.
- `nathan-model.ts`: Nathan'ın +Z model önü uygulamanın -Z yönüne çevrilir. Animasyon kök hareketi iptal edilir; dünyadaki ayak konumunu denetleyici belirler. Gerçek skin sınırları her animasyon güncellemesinde zemine oturtulur. Kontrol klipleri kayıtlı önizleme ayarlarını ezmez.
- `nathan-input.ts`: fare ve dokunmatik için özel, iptal edilebilir tek dokunuş sahipliği; kamera modunda eski dinleyiciler olduğu gibi çalışır.
- Panelin yüksekliği sınırlıdır, içerik kaydırılır. Yönetim açıkken alt personel/nesne düğmeleri gizlenir; kayıt çubuğuna alan ayrılır.
- GLB, 178 nesneli ADB başlangıç sahnesi, araç/tesis varlıkları ve üretim bulut yapılandırması değiştirilmez.

## Doğrulama (2026-10-14)

- `npm test`: mevcut sahne, mobil düzen, tasarım, sürüş, kamera, kabin, bulut, tesis kapısı, personel, Nathan ve test sitesi kontrolleri; yeni hareket testi dahil.
- `npm run test:facility`, `npm run test:bridge`, `npm run test:details`.
- `VITE_KS_TEST_SITE=1 npm run build` ve `npm run verify:test-build`.
- Gerçek, değiştirilmemiş Nathan GLB: 16 klip; mevcut 626 poz karesi testi.
- Gerçek R14 GLB: arka merdiven/platform yaklaşma, hizalanma, çıkış, yakın sahanlıkta durma, kaydet/yükle, merdivende duraklatma ve ters kliple iniş.
- ADB'nin mevcut 178 nesneli sahnesi + bir Nathan + bir basamaklı merdiven: uçtan uca çıkış/iniş.
- ADB tesisindeki **mevcut** R14 (6.529, 0, 9.947; 165°): engeller taşınmadan her iki merdivenin uçtan uca testi. Arka giriş yaklaşık (4.62, 0, 2.80); platform girişi (9.52, 0, 13.76).
- Gerçek iskelet/skin ayak sınırları, yön/konum, Idle varışı, hedef değiştirme, dinamik engel, kapılar, seçili nesne/destek silme, kayıttan dönüş ve taşınan desteği takip etme kontrol edilir.
- JSDOM olay testleri: fare/dokunma, sürükleme, çoklu dokunma, iptal, kamera devri, panel düğmeleri ve 16 klip önizlemesi.

## Sınırlar ve doğrulanmamış noktalar

- Bu çalışma ortamında izin verilen tarayıcı kontrolü yok. Gerçek masaüstü/telefon WebGL görsel testi ve fiziksel cihaz dokunmatik testi **yapılmadı**. Otomatik testler GPU, dokuların ekranda görünümü veya panelin gerçek ekran piksel yerleşimini doğrulamaz.
- Dosyada özel iniş klibi yok; uygun tırmanma klibi ters oynatılır.
- Tam el/ayak IK ve basamağa temas çözücüsü yok. Ayak kayması hız eşleştirmesiyle azaltılır; kusursuz temas iddiası yok. Merdivendeki kök iz, mesh basamaklarından çıkarılmış yönlendirilmiş bir erişim yoludur, tam fizik simülasyonu değildir.
- Yol bulma muhafazakârdır: uçağın veya sundurmanın altından geçiş planlamaz. Aşırı dar/geçersiz girişte, 120 m dışındaki hedefte ve aşırı yükseltilmiş platformda komut reddedilir; teleport yapılmaz.
- Yüksek platformdan zemine doğrudan tıklama atlama/serbest düşüş başlatmaz; önce merdivenden inilmelidir.
- Merdivendeyken yeni bir zemin hedefi vermek çıkış/inişi duraklatır ve önce iniş ister.
- Otomatik araç sürme, hortum fiziği ve uçak bağlantısı bu Nathan geliştirmesine dahil değildir.
- Vite'ın mevcut büyük paket uyarısı devam eder; test derlemesi başarılıdır.
