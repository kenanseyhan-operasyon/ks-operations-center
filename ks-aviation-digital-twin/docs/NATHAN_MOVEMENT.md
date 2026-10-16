# Nathan — merdiven teması, hareketli platform, kabin ve göz kamerası

Geliştirme dalı: `ks-3d-test`.
Test ortamı: https://ks-3d-test.onrender.com — Kenan Seyhan 3D Test.
Ana dal ve üretim dalı/Render servisi değiştirilmez. Yeni Render kaynağı oluşturulmaz.
Test dalına ayrıca eklenen `d6ce2e6` rota başlangıcına sıfırlama düzeltmesi korunur.

## Kullanım

1. ADB Tesisi → kitaplık → **İkmal Personeli — Nathan** → sahneye yerleştir.
2. Nathan'a tıkla. **Personeli Yönet** paneli açılır; kitaplık, nesne düzenleme, servis ve tesis panelleri kapanır.
3. Boş zemine kısa tıkla/dokun: Nathan döner, yürür ve varınca Idle'a geçer. Yürürken yeni hedef rotayı değiştirir.
4. Haritayı **sol tuşla sürükleyerek kaydır**, sağ tuşla veya Shift + sol tuşla döndür, tekerlekle yakınlaş. Personel yönetiminde telefonda tek parmak kaydırır, iki parmak yakınlaştırır/kaydırır. Sürükleme, çoklu dokunma ve iptal edilen dokunma hedef komutu üretmez.
5. Tank sahasının içindeki boş zemine tıkla: mevcut duvar üstü geçiş merdiveninin girişine yürür, çıkar, üst sahanlığı geçer, diğer taraftan iner ve hedefe devam eder. Dönüş de aynı bağlantıyı kullanır; duvar kaldırılmaz.
6. **Tanka tıkla**: erişilebilen tankın gerçek çevresel merdivenine yürür, kıvrımı izleyerek çıkar ve çatıda durur. Çatının güvenli iç kısmına tıklamak çatı üzerinde yürütür; merkez kapağı ve kenar korkuluğuna açıklık bırakılır.
7. Çatıdayken **bağlı diğer tanka veya köprüye tıkla**. Nathan çatıdan köprü girişine yürür, köprü tabliyesini geçer ve diğer tankın çatısına ulaşır. Paneldeki köprü geçiş listesi de kullanılabilir. Zeminden köprü komutu, önce erişilebilir bağlı tankın merdivenine yönlendirir.
8. Tank çatısından zemine tıklama, önce merdivenden inişi ve ardından zemin hedefini planlar. **Merdivenden in**, tank çatısında merdivene yürüyüp inişi başlatır; köprüde duraklamışsa giriş tankına dönüp o tankın merdiveninden iner.
9. Araç arka merdivenine, platform merdivenine veya paneldeki **Yakındaki merdivenler** listesine tıkla. Girişe yürür, hizalanır, ilgili kapı/korkuluğun açılmasını bekler, çıkar ve sahanlıkta durur. İniş için **Merdivenden in** veya zemindeki yeni hedef kullanılır; yükselmiş platform önce alçalır.
10. **Hareketi durdur** desteği ve gerçek konumu korur. Merdivende/köprüde devam düğmesi hareketi sürdürür. Tank/geçiş merdivenindeyken yeni hedef güvenli uç noktaya kadar bekletilir; havada hedefe sıçrama yapılmaz.
11. **Kamera** hedef verme modunu kapatır. **Nesneyi düzenle** taşıma/döndürme/silme araçlarını açar. Animasyon önizlemesinde 16 özgün ve üç yeni erişim hareketiyle toplam 19 klip vardır; önizleme otomatik yürümeyi durdurur.
12. **Kaydet**, dünya konumu ile merdiven/tank/köprü desteğini test sitesine ait tarayıcı kaydına yazar. Kayıt diğer cihazlarla paylaşılmaz; JSON dışarı aktarılabilir.

## Düzeltilen nedenler ve uygulama

- Fare sorunu: yönetim dinleyicisi bütün işaretçi olaylarını tüketiyordu. `nathan-input.ts` yalnızca kısa tek dokunuşu hedef sayar; sürükleme/çoklu dokunmayı OrbitControls'a bırakır. Portre ekran koordinat vekilleri arasında ortak olay işareti çift seçimi önler. Serbest kamera ve nesne düzenleme modları yönetimden çıkış yapar.
- Periyodik kol açılması: orijinal 1,833 saniyelik yürüyüş klibinin ilk iki karesinde başlangıç/bağlama pozu vardı. `nathan-walk-loop.ts`, gerçek klibin 15–42. karelerindeki tam adımı kullanır ve son 0,1 saniyede döngü birleşimini yumuşatır. Çalışma zamanı döngüsü 0,9 saniyedir; kaynak GLB değiştirilmez, 16 klip korunur.
- `nathan-model.ts`: yarıda değiştirilen animasyon geçişlerinde toplam ağırlık 1 tutulur; 0,25 saniyelik geçişte boş bağlama pozunun görünmesi önlenir. Model önü uygulamanın yönüne çevrilir, kök hareket iptal edilir, gerçek skin ayak sınırları denetleyicinin yüzey yüksekliğine oturtulur.
- `nathan-navigation.ts`: .34 m × personel ölçeği açıklıklı A*, döndürülmüş nesneler, duvarlar, açık/kapalı kapılar, 1,78 m ölçekli gövde/baş açıklığı. Yükseklik hesaba katılır; duvarın üstünden geçmek duvarın içinden yürümek sayılmaz. Kapalı duvar bölgeleri başarısız aramayı erken keser. Hedef sınırı 120 m, arama bütçesi 24.000 düğümdür.
- `nathan-route.ts`: zemin bölgelerini gerçek, iki yönlü duvar geçiş merdivenleriyle bağlar; en fazla 8 yakın geçiş bağlantısı değerlendirilir. Duvar ayak izinde açıklık uydurulmaz.
- `nathan-access.ts`: R14'ün gerçek basamak/sahanlık meshlerinden erişim yolunu çıkarır; dönme, ölçek ve römork eklemini hesaba katar. Tekerlekli basamaklar, çift taraflı geçiş merdiveni ve mevcut tankın çevresel merdiveni desteklenir. Dar veya engelli giriş reddedilir.
- `nathan-roof.ts`: tankın güvenli çatı diski ve gerçek köprü uç bağlantıları üzerinde rota kurar. Çatı merkez kapağı engeldir. Köprü genişliği, eğimi, baş açıklığı ve iki tank bağlantısı doğrulanır; en fazla 24 köprü değerlendirilir. Boşluk üzerinden kestirme yapılmaz.
- `nathan-controller.ts`: zemin yaklaşması, hizalanma, hazırlık, merdiven, çatı ve köprü yürüyüşü, iniş ve bekleme durumlarını yönetir. Yön dönüşü ve ivmelenme sınırlıdır; hızla ilişkili klip hızı kullanılır. Yeni engelde durur/zemin rotasını yeniden arar. Yerel destek koordinatı, geçiş tarafı ve köprü yönü kaydedilir; duraklatma/yükleme konumu korur.
- Panelin yüksekliği sınırlı ve içeriği kaydırılabilirdir. Yönetimde diğer personel/nesne düğmeleri gizlenir.
- GLB, 178 nesneli ADB başlangıç sahnesi, tank/merdiven/köprü geometrileri, ekipman kitaplığı ve üretim bulut yapılandırması değiştirilmez.

## Merdiven, kabin ve kamera güncellemesi (2026-10-15)

- **V** Nathan’ın gözünden görünümünü açar/kapatır. **C** mevcut araç kabini kısayolu olarak kalır. Panelde gözünden, arkadan, önden, üstten ve serbest görünüm düğmeleri vardır. Göz kamerasında sürükleme bakışı döndürür; yalnız kendi örneğinin baş üçgenleri kamera için gizlenir, paylaşılan model değişmez.
- Arka merdiven klibinin diğer hareketlere göre 180° ters yönü çalışma zamanında düzeltilir. Çıkış ve inişte yüz merdivene dönüktür. R14’ün ilk basamağındaki ve platform girişindeki ölçülen yükseklik boşluklarına görünür ara basamaklar eklenir.
- `nathan-stair-gait.ts` bir ayağı sabit tutup diğerini basamaktan kaldırarak geçirir. `nathan-contact.ts`, gerçek iskelette iki parçalı bacak/kol çözümü uygular; pelvis erişim için alçalır, ayaklar basamağa ve ulaşılabilen eller gerçek korkuluk çizgilerine yerleşir. IK’den sonra ikinci bir genel zemin düzeltmesi uygulanmaz.
- İkmal platformundaki kişi `Platform_Grey_Floor` nesnesinin yerel koordinatına bağlanır. **Platformu yükselt / indir** düğmesi önce kapıyı kapatır. **Merdivenden in** önce platformu alçaltır, sonra kapıyı açıp inişi başlatır. Destek kaydının kapı beklenirken yanlış koordinat sistemine çevrilmesi önlenir. Model yeniden yüklenene kadar son kayıtlı dünya konumu korunur.
- Kabine veya **Yakındaki merdivenler → Sürücü kapısı · araca bin** seçeneğine tıklayın. Nathan kapıya yaklaşır; kapı açılır; görünür giriş basamaklarını kullanır, tavan altında eğilir ve koltuğa döner. Motor çalışır, kapı kapanır. **W/A/S/D** veya paneldeki dokunmatik düğmeler mevcut sürüş sistemini kullanır. **Q/E** sinyal, **H** dörtlü, **I** motor, **Boşluk** fren. **Araçtan in** için önce aracı durdurun.
- Kabin kapısında yalnızca cam değil, gövde sacı, iç döşeme, kolçak ve tutamak da aynı menteşeyle açılır. Açık kapı ve tamamlanmamış biniş sürüşü engeller. Koltuk desteği araçla birlikte taşınır; pedallar ve direksiyon el/ayak hedeflerini verir. Kabin görünümünde personel paneli küçültülür.
- Panik barlı **acil çıkış/yaya kapısına** tıklayın: Nathan ulaşılabilir taraftan yaklaşır ve kapıyı açıp kapatır. Kapı seçiliyken ayrı aç/kapat düğmesi de bulunur. Yol bulma açık kanadı ve direkleri engel saymaya devam eder, açıklıktan geçişi açar.
- İki ön amber sinyalin yüzeyi büyütülür; sol/sağ/dörtlü davranışı mevcut sürüş sinyal durumunu izler. Orijinal GLB değiştirilmez.
- Destekteyken serbest animasyon önizlemesi yerine önce zemine inilmesi istenir; koltuk/merdiven pozuyla 16 klibin önizlemesi birbirine karışmaz.

## Kullanıcı dosyaları ve erişim düzeltmeleri (2026-10-16)

- Gönderilen `Climbing (1).fbx`, `Climbing Down Wall.fbx`, `Descending Stairs.fbx` dosyalarının `mixamo.com` hareketleri Nathan'ın aynı 88 kemikli iskeletine aktarılır. Kaynak/rest eksen farkı düzeltilir, eksik kemik kanalları tamamlanır. `scripts/import-nathan-access.mjs` dönüşümü tekrar üretir; kaynak SHA-256 değerleri `public/models/personnel/nathan-access-animations.json` içinde kayıtlıdır. 16 özgün GLB hareketine üç klip eklenir; panelde **19 hareket** vardır. Özgün GLB değiştirilmez.
- Otomatik yaya rotası, ana araç kapıları kapalıyken uygun acil çıkış kapısından geçebilir. Nathan gerçek girişe yaklaşır, kapıyı işletir ve açıklıktan yürür. Kapı direkleri ve açılmış kanat engel kalır. A* aramasında 4 m hücreli engel indeksi aynı kesin çarpışma kontrolünü daha az adayla çalıştırır; yakın kapı yaklaşımı, kapalı çitin tamamını taramadan denenir.
- 15 cm bordürler destek yüzeyidir; 22,1 cm üzerindeki bordürler engel kalır. Yüzey yüksekliği yürüyüşe ve ayak hedeflerine uygulanır; yükseltilmiş çizilmiş zeminler de kendi kotunda desteklenir.
- Kabin basamakları ön tekerin önüne taşınır; tampon yan dönüşünde basamak boşluğu açılır. Kapı, ön/arka ve iç tutamaklar gerçek erişim hedefleridir. Kapı tamamen açılana kadar Nathan kapı süpürme alanının dışında bekler. Zemindeki yaklaşmada yönünü yoluna çevirir.
- Arka iki alçak basamak tamponun dışına ve altına alınır. Tamponun orta bölümü ince bir basamaktır; merdiven yan bağlantıları tampona ulaşır. Üstteki katlanır tutamaklar uzatılır; eğri korkuluk teması gerçek tüp kesitlerinden hesaplanır.
- El temas noktası bilek yerine avuç içidir. Tırmanma klibinin kök salınımı gövdeyi merdivenden çeviremez. El aktarımı için adım başı/sonunda iki ayak basamakta tutulur; ulaşılabilir kavrama noktaları ayak geçişinde korunur. Uygun yeni iniş klibi ileri zamanla oynar; eski varlıkla çalışan testler için önceki ters klip yedeği korunur.
- İkmal platformu kapıları personel geçerken açılır, sahanlığa geçince kendiliğinden kapanır. Gerçek yeşil platform düğmesi seçildiğinde parlak kırmızı olur ve platform personelle yükselir; ters komutta yeşil olur ve alçalır. Zemine hedef verme, gerekiyorsa alçaltma → kapı → merdivenden iniş → hedefe yürüyüş sırasını kullanır. Aynı otomatik iniş kabin ve arka merdiven için de geçerlidir.
- **V** görünümünde baş, çene, göz, ağız ve bunların bağlı üçgenleri yalnız ilgili kişi örneğinde gizlenir. Kabine girildiğinde V görünümü de cam köşelerini açar; dış görünümde normal geometri geri gelir. **C** araç kabini olarak kalır.
- Göz görünümünde kısa tıklama/dokunma hedef verir; sürükleme bakışı değiştirir. Aynı olay iki kontrol işleyicisinde tekrar çalıştırılmaz. İptal ve iki parmak hareketi hedef komutu üretmez.

## Doğrulama (2026-10-15)

- `npm test`: sahne, mobil düzen, tasarım, sürüş, kamera, kabin, bulut, tesis kapısı, personel, Nathan ve test sitesi regresyonları, yeni hareket senaryoları dahil geçti.
- `npm run test:facility`, `npm run test:bridge`, `npm run test:details` geçti.
- `VITE_KS_TEST_SITE=1 npm run build` ve `npm run verify:test-build` geçti. Başlangıç sahnesi, test ortamı izolasyonu ve model varlıkları doğrulandı.
- Gerçek, değişmemiş 25.874.096 bayt Nathan GLB: 16 klip ve 616 örnek poz karesi. Ek 720 gerçek skin karesinde tekrarlanan yürüyüş birleşimi ve hızlı Idle/yürüyüş geçişi test edildi; ölçülen en büyük kol açısı 31,3°, animasyon ağırlıkları toplamı 1.
- Gerçek R14: iki merdiven, dönmüş/ölçeklenmiş/eklemli araç, yaklaşma, hazırlık, çıkış, duraklatma, kaydet/yükle ve ters kliple iniş. ADB tesisindeki mevcut R14'ün iki erişimi de geçer.
- Gerçek 178 nesneli ADB sahnesi: dış alan → mevcut duvar üstü merdiveni → tank sahası içi → aynı bağlantıdan dışarı dönüş.
- Aynı sahne: dış alan → duvar geçişi → T1 çevresel merdiveni → merdivende duraklat/kaydet/yükle/devam → T1 çatısı. Çatıda kapak çevresinden yürüyüş ve korkuluk sınırından taşan hedefin reddi.
- T1 çatısı → mevcut T1–T2 köprüsü → köprüde duraklat/kaydet/yükle/devam → T2 çatısı → köprüden dönüş → tank merdiveniyle iniş → tank sahasından dışarı çıkış.
- Zeminden köprü komutu, dinamik köprü engelinde durma, giriş tankına geri dönüp iniş, eksik köprü, yetersiz genişlik, silinen destek, kapalı giriş, baş açıklığı ve yeni hedefi merdiven sonuna kadar bekletme testleri.
- JSDOM içinde gerçek Three.js OrbitControls olayları: sol sürükleme/kaydırma, sağ sürükleme/döndürme, tek parmak, iki parmak yakınlaştırma, kısa hedef dokunuşu, iptal, portre koordinat vekilleri ve mod devri. Model/zemin geometrisi testleri GPU gerektirmez.

- `npm run test:nathan-interactions`: gerçek modellerde 404 merdiven çıkış/iniş pozu, ulaşılabilen korkuluklarda el teması, 101 kabin biniş pozu ve baş açıklığı; gerçek kapı açıklığı; ön sinyallerin görünürlüğü ve yanıp sönmesi; personelle platform yükseltme/alçaltma; kabine biniş/motor/kapı/araçla taşınma/iniş; acil çıkış kapısını açıp geçme; göz/ön/arka/üst kameraları; gerçek Workspace V/C klavye ayrımı. Bu test GPU görüntüsü üretmez.

## Doğrulama (2026-10-16)

- Son kod üzerinde `npm test` bütünüyle geçti; önceki kamera, sürüş, personel, ADB, kapı ve test ortamı regresyonları korundu. `test:facility`, `test:bridge` ve `test:details` de geçti.
- `VITE_KS_TEST_SITE=1 npm run build`, `npm run verify:test-build` ve `git diff --check` geçti. Derlemede özgün GLB'nin 25.874.096 baytı ve SHA-256 değeri, 16 özgün + üç yeni klip, 178 ADB nesnesi ve test bulut izolasyonu doğrulandı.
- Yeni `test:nathan-access` testi gerçek ADB'nin iki acil çıkışında iki yönlü rotayı, kapıya yaklaşma/açma/dışarı yürüme sırasını, 15 cm bordüre çıkma/durma/inmeyi ve daha yüksek engellerin korunmasını doğruladı. Engel indeksi 10.000 örnekte önceki kesin çarpışma hesabıyla aynı sonucu verdi.
- Gerçek araç bölgesinden yakın acil çıkışa rota bu ortamda yaklaşık 20 ms; diğer dış hedefe rota 0,85 saniyede bulundu. Bu süreler cihaz performansına bağlıdır.
- Gerçek iskelette 1.206 çıkış/iniş pozu örneklendi. Merdiven uçuşlarında iki elin gerçek korkuluklara erişimi arka merdivende her yönde 139/139, platformda 102/102, kabin basamaklarında 40/40 örnekte geçti; ayak erişimi de denetlendi. Sahanlıkta tutamak bırakılır. Bu ölçüm, parmakların tek tek görsel kavrama doğrulaması değildir.
- Gerçek Workspace ve modellerle platform yaylı kapıları → yeşil düğme → kırmızı/yükselme/personelle taşınma → yeşil/alçalma → zemine hedefte merdivenden iniş ve yürüme testi geçti.
- Kabin kapısı tam açılana kadar dışarıda bekleme → basamaklar → koltuk/motor/kapı → V görünümünde köşe saydamlığı → zemin hedefinde basamaklardan inip yürüme testi geçti. Basamakların ön tekerleği kesmediği, arka basamakların tampon dışında olduğu ve orta tamponun ince basamak oluşturduğu denetlendi.
- V/C ayrımı, baş/çene/göz/ağız maskesi, göz kamerasında tek hedef dokunuşu, sürükleme, iptal, çoklu dokunma ve serbest kameraya dönüş testleri geçti.

## Sınırlar ve doğrulanmamış noktalar

- Bu ortamda izin verilen tarayıcı kontrolü yok. Gerçek masaüstü/telefon WebGL görsel testi ve fiziksel cihaz dokunmatik testi **yapılmadı**. Otomatik testler GPU görüntüsünü, dokuların ekrandaki görünümünü veya panellerin gerçek piksel yerleşimini doğrulamaz.
- Üç yeni dosya merdiven çıkış/iniş hareketlerini sağlar; özel bir kabine biniş hareketi yoktur. Kabin erişimi gerçek basamak, koltuk, pedal ve tutamak hedefleriyle tamamlanır. Parmakların tek tek kavraması ve tüm vücut için fizik tabanlı çarpışma çözümü yoktur. Üç nokta temas zamanlaması ve kol/bacak erişimi uygulanır; her pozda kusursuz anatomik temas doğrulanmış değildir.
- Merdiven hareketi gerçek geometriden türeyen yönlendirilmiş bir erişim yoludur; tam fizik simülasyonu değildir.
- Yol bulma muhafazakârdır: uçağın veya sundurmanın altından geçiş planlamaz. Aşırı dar, engelli, 120 m dışındaki veya yükseltilmiş araç platformuna zeminden erişim reddedilir; üzerindeki personel inmek istediğinde platform önce alçalır.
- İki tanka bağlanmayan serbest uçlu köprüler geçiş için desteklenmez. Çatı kenarından atlama/serbest düşüş yoktur.
- Nathan’ın kabin binişi ve mevcut manuel sürüşle bağlantısı eklendi. Hortum fiziği, uçağa bağlantı ve otomatik ikmal görevi tamamlanmış değildir.
- Vite'ın mevcut büyük paket uyarısı devam eder; derlemeyi engellemez.
