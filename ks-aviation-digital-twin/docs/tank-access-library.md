# Sahanlıklı tank merdiveni ve tesis kitaplığı

## Beton ve çimen dolgusu

- Zemin çizgileri, ayak izleri, yön okları, yazılar, taramalar, yürüyüş yolları ve kanallar dolgunun gerçek üst yüzeyine uyarlanır. Ana taban alanı (GROUND) yükseltilmez ve çimeni örtmez. Rögar kapağının yüzü dolgu kotuna oturur; duş, ağaç ve zemine basan ekipman ayakları yüzeye oturtulur. Bağlı parçalar da ana ekipmanla yükselir. Elle yükseltilmiş nesneler ve tank/köprü kotları korunur.
- Beton/çimen çizerken bordür kenarına 40 cm yakın noktalar kenara oturur; iki nokta arasındaki kısa bordür rotasının köşeleri çizime otomatik eklenir. İlk nokta yakındaki bordüre oturmuşsa dolgu üst kotu o bordürden alınır. Çizim sırasında ve bitirildiğinde mevcut çimen alanları korunur. Yakın açık bordür uçları ortak kesitlerde birleşir; çizimlerin kayıtlı noktaları değiştirilmez. Çakışan aynı malzemeler ortak dünya dokusunu kullanır ve üst üste geldiklerinde titremez. Önceden kaydedilmiş dolgular da bordür kenarlarına uyarlanır.

- Açık bordür, çit ve açık alan birlikte sınır oluşturuyorsa: kot alınacak bordürü seçin → Özellikler → **Bu bordür kotunda alan çiz** → **Beton sınırı çiz / Çimen sınırı çiz**. Dolacak alanın bütün köşelerini seçip **Bitir**’e basın; son nokta ilk noktaya bağlanır. Bordürün kapalı olması gerekmez ve fiziksel bordüre yeni parça eklenmez. Dolgu çizilen sınırda, seçilen bordürün o andaki dünya üst kotuna kadar oluşur. Bu dolgunun sınırı ve kotu bağımsız kaydedilir; daha sonra özelliklerden düzenlenebilir. Oluşturulan alan ayrıca çizgiyle beton/çimen olarak bölünebilir.

- Tesis kütüphanesi → Saha bölümünden **Beton zemin dolgusu** veya **Çimen zemin dolgusu** seçilip sınır noktaları çizilir ve Bitir'e basılır. Alan kapalı bordürün içindeyse üst kot bordürden alınır; diğer alanlarda varsayılan kalınlık 20 cm'dir ve özelliklerden değiştirilebilir.
- Mevcut bordürü seçip Özellikler → **Kapalı sınır** seçeneğini uygulayın. **Beton dolgu / Çimen dolgu** tek tuşla bordürün içini doldurur. Dolgu, bordürün iç kenarını ve üst kotunu izler; bordürün noktaları, konumu, yönü, ölçeği veya yüksekliği değişince güncellenir. **Bordür bağını kaldır** ile ayrı düzenlenebilir.
- **Çizgiyle beton / çimen ayır**: iki çizgi ucu seçilir, ardından alanın beton olacak tarafına tıklanır. Diğer taraf çimen olur. Çizgi alan sınırlarını kesecek şekilde uzatılır. Çizgiyi yeniden seç veya Escape ile seçim iptal edilebilir. İşlem tek geri alma adımıdır. İçbükey sınırların ayrı kalan parçaları da korunur; alan dışındaki boşluklar doldurulmaz.
- Dolgular kalınlığı olan üç boyutlu yüzeylerdir; 2D görünüm, JSON, geri alma ve bulut kayıtla korunur. Nathan, 22 cm'ye kadar yüzeylerde gerçek üst kota basar. Tank merdiveninin tabanı da altındaki dolguyla yükselir; tank gövdesinin ve çatı çıkışının kotu korunur.
- Bordür ve beton havuz duvarları ortak köşe kesitleri kullanır. Başlangıca 45 cm'den yakın son noktalar (bordür genişliğine göre tolerans artabilir) aynı köşede birleşir; açık sınırlar özelliklerden kapatılabilir. Kapı ve tel örgü hareketleri korunur.
- Tank merdiveninin zemindeki iç tutamağı kaldırılmıştır. Alt taşıyıcılar tank cidarına konsollarla bağlanır. Havuz giriş merdiveninin ayakları gri dikdörtgen çelik profiller ve taban plakalarıyla zemine oturur; üst korkuluklar sarı kalır.

`npm run test:site-ground`: dolgu üst kotu, iki yönde ayırma, içbükey sınırlar, dönme/ölçek, kalıcı kayıt, köşe birleşimleri, iç tutamağın kaldırılması, taban bağlantıları, Nathan erişimi ve arayüz izinleri. Gerçek Workspace tarayıcı kontrolü: üç noktalı bölme, geri alma/ileri alma ve Escape.

Tank çatı ve merdiven korkulukları saha giriş merdiveniyle aynı `#dce142` sarıyı kullanır. Tank cidarına bakan iç merdiven korkuluğu kaldırılmıştır; dış kenar, açık taban yaklaşımı ve üst sahanlık koruması korunur.

Nathan tank merdiveninin gerçek basamak ve sahanlık rotasını kullanır. Bağlı köprü yalnızca kendi yürüyüş kotunda geçilebilir kabul edilir; alttan yaklaşımda köprü ve diğer gerçek engeller çarpışma kontrolünde kalır. Çatı hedefi merdivenin hesaplanan çıkışıdır.

## ADB ortak bulut kaydı

`ks-gemini-nathan-test.onrender.com` için bulut kaydı ayrı Gemini Supabase projesinde tutulur. `VITE_KS_TEST_SITE=1` ve `VITE_KS_TEST_CLOUD=1` birlikte, ayrıca `VITE_TEST_SUPABASE_URL` ve yalnızca yayınlanabilir `VITE_TEST_SUPABASE_ANON_KEY` gerekir. Ana sahanın Supabase ayarları kullanılmaz. Bulut bayrağı olmadan test sitesi eski cihaz kaydını kullanır.

Doğrulanmış, izin listesindeki tasarımcı hesabı Kaydet ile kişisel ve herkesin açılışta gördüğü ortak ADB kaydını aynı işlemde yayınlar. Başka cihazlar ve ziyaretçiler ortak kaydı okur. İlk girişte eski tarayıcı çalışması varsa korunur ve otomatik yayınlanmaz; Kaydet ile yayınlanır. Eşzamanlı kayıt çakışırsa çalışma cihazda kalır ve kullanıcıya bildirilir.

Kurulum SQL'i `scripts/adb-shared-cloud.sql` içindedir. Tasarımcı ilk kez Hesap oluştur ile kaydolup e-postasını doğrular; mevcut ana sistem hesabı bu ayrı projenin hesabı değildir. Supabase Auth Site URL ve izinli dönüş URL'si sitenin tam adresi olmalıdır. Geri dönüş için test bulut bayrağı kaldırılıp yeniden derlenebilir; eski test saklama anahtarı ve yedekler korunur.

`test:shared-cloud` ilk yetkilendirme, eski cihaz taslağını koruma, ortak yayın, ikinci cihaz/ziyaretçi okuması ve kayıt çakışmasını; `test:tank-walk` iki merdiven yönünü, köprü birleşimini ve gerçek engelleri doğrular.

## Kullanım

1. 3D tasarım görünümünde Tesis kütüphanesi → Merdiven / geçiş → Sahanlıklı tank merdiveni → Merdiveni oluştur.
2. Zemindeki tankın yanında başlangıç noktasını seçin. Nokta tankın dışında, cidardan en fazla 3 m uzakta olmalıdır.
3. Saat yönü veya ters yön seçin. Yönü ikinci tıklamadan önce değiştirebilirsiniz.
4. Aynı tankın üst yüzeyinde, merkez kapağından uzakta çıkış noktasını seçin. İmleç hareketinde merdivenin önizlemesi gösterilir. İkinci tıklama işlemi kaydeder.
5. Escape veya Vazgeç, önizlemeyi kaldırır. Tamamlanmamış seçim sahneye kaydedilmez.

Tank özelliklerinden başlangıç açısı, toplam dolanma açısı, yön, merdiven eni ve ara sahanlık boyu değiştirilebilir. Başlangıç/çıkış yeniden sahneden de seçilebilir. Merdiveni olduğu gibi döndür bölümünde 1°, 5°, 15°, 45° veya 90° adım seçilip Sola döndür / Sağa döndür düğmelerine basılabilir. Basamaklar, ara sahanlıklar, dönüş yönü, seçilen taban ve üst çıkış birlikte döner; tankın yönü ve logosu değişmez. İşlemi bitirince üstteki Kaydet düğmesine basılır. Sayısal başlangıç açısını değiştirmek de iki ucu birlikte döndürür. Toplam dolanma açısını veya yükselme yönünü değiştirmek eski nokta seçimlerini kaldırır. Diğer özellikleri uygulamak nokta seçimlerini korur.

Merdiven modeli ve personelin erişim rotası aynı basamak/sahanlık tanımını kullanır. Yüksekliğe göre ara sahanlıklar eklenir. Seçilen yönde yeterli basamak boyu bulunmuyorsa çıkış açısı korunarak bir tam tur eklenir; en fazla üç tur desteklenir. Mevcut nesnelerin taşıma, döndürme ve ölçek dönüşümleri korunur.

## Köprü ve korkuluklar

Köprü uçları mevcut iki nokta seçimiyle yerleştirilir. Tank üst korkuluğunda geçiş açılır ve açıklığın iki yanı köprü korkuluğuna bağlanır. Köprünün yürüyüş koridoru merdiven veya üst sahanlık korkuluğunu aynı kotta kesiyorsa kesişen korkuluk bölümü kaldırılır, kesilen uçlar köprü yanlarına bağlanır. Üstten geçen köprü alttaki merdivenin korkuluğunu açmaz. Köprü silindiğinde açıklıklar yeniden hesaplanır; geri alma mevcut sahne geçmişini kullanır.

## Tank logosu

Tanklarda karşılıklı iki okunabilir, silindirik cidarı takip eden logo bulunur. Boyut, merkez kotu ve ilk yüzün açısı tank özelliklerinden ayarlanır; ikinci yüz 180° karşısındadır. PNG, JPG veya WebP yüklenebilir (en fazla 1,4 MB). Yüklenen görsel mevcut sahne JSON dosyasına dahil edilir; ayrıca bir sunucu ya da tablo gerekmez. SOCAR logosuna dön düğmesi özel görseli kaldırır.

Varsayılan SOCAR görselinin kaynağı: https://www.socararge.com.tr/galeri — resmi galeride yayımlanan `socar.png`. Görsel uygulama kaynağına gömülüdür; çalışma sırasında başka bir siteden indirilmez.

## Kitaplıklar

Tesis kitaplığında arama, tüm parçalar görünümü, kategori filtreleri ve vektör parça kartları bulunur. Yerleştirme, merkeze ekleme, yüzeye takma, çizim, su/köpük takımı, özellikler ve akış denemesi işlevleri korunur. Araç/uçak/personel kitaplığında aynı tasarım diliyle arama ve kategori filtreleri bulunur; mevcut ölçü ve kaynak açıklamaları korunur.

## Doğrulama

- `npm run test:tank-access`: iki yön, seçilen giriş/çıkış, yatay sahanlık, basamak yüksekliği, dönüşümler, kayıt/geri alma, aynı/farklı kotta korkuluk ve karşılıklı logolar.
- `npm run test:library`: bütün tesis kataloğuna erişim, merdiven arama/yerleştirme, özellik uygularken seçimleri koruma, logo sıfırlama, dil ve araç filtreleri.
- Mevcut `test:bridge`, `test:facility`, `test:details` testleri.
- TypeScript kontrolü ve Vite derlemesi.
- Chromium ile masaüstü/dar ekran arayüzü, gerçek Workspace üzerinde taban → yön → üst çıkış tıklamaları ve Escape ile iptal.

Yayın hazırlığında gerçek model dosyaları alınarak kaynak parçalarının Git nesne özetleri doğrulandı. Değişiklikler çalışan `f6b055e3002113c0075adb10ce7ab44537e34b2f` sürümüne birleştirildi; Nathan/araç/hortum/deadman düzeltmeleri ve mevcut yayın öncesi test kapıları korundu. Tam yayın derlemesi, yayın paketi doğrulaması, personel ve Nathan temel testleri başarılı.

Geniş testlerde iki mevcut sorun görüldü: `r14.test.ts` içinde 55° dönüşte `Drum_Exit_Frame_Brace` çakışması değişiklik yapılmamış çalışan sürümde de birebir yeniden üretildi. `nathan-access-fixes.test.ts` son hedef-seçim taklidinde mevcut `pickDeadman` metodu eksik; ilgili uygulama metodu çalışan sürümle aynıdır. Bunlar için uygulama davranışı veya eski test beklentileri değiştirilmedi.

Köprü seçiliyken Özellikler → Köprü hassas hizalama → Sola 1° / Sağa 1° ile merkezi çevresinde döndürülür. Tank uçları ve korkuluk boşlukları birlikte güncellenir. Uçlardan biri tank çatısı dışına çıkacaksa işlem uygulanmaz; uçları daha içeriden seçin.

Üst sahanlık alanına taşan son merdiven kolu korkulukları sahanlık girişinde sonlanır. Köprü koridorunun uç sınırında kesilen korkuluklara geçişi kapatan çapraz bağlantı eklenmez.

Merdivenin üst sahanlığı artık basamak hesabında ayrı bir düz bölüm olarak ayrılır. Son yükseliş bu bölümün girişinde tank çatı kotuna ulaşır; sahanlığın altında kalan ek basamaklar üretilmez. Personelin rotası aynı düz bölümden geçer.

Korkuluk açıklıkları çift yönlüdür: tank ve merdiven tarafına ek olarak köprünün kendi yan korkulukları da tank çatısı ve merdiven girişinde kesilir. Merdiven girişi olmayan karşı kenar ve köprünün orta bölümü korunur. Merdiveni veya köprüyü döndürme, taşıma ve silme işlemleri bu açıklıkları yeniden hesaplar. `test:tank-junction` iki gerçek modelin birlikte geçişini, son yükselişi ve üst kotu kontrol eder; yayın öncesi testlere eklenmiştir.


