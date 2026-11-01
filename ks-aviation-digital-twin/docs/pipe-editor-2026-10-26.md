# 26 Ekim 2026 — Yangın hatları ve ölçülü düzenleyici

## Kapsam

İlk aşama mevcut yangın hatlarıdır. Kaynaklar: mevcut P04 ve vaziyet planı, önceki altı saha videosu ve 26 Ekim'de gönderilen 74 (3)(1), 76 (4)(1), 85 (4)(1), 52561/62/63/64/66/67 fotoğrafları ile işaretli tesis ekran görüntüsü. Mevcut 187 nesnenin konum, ölçü ve yönleri korunur. Revizyon 3, tarayıcıdaki referans düzenini günceller; sunucudaki yayımlanmış sahneye kendiliğinden yazmaz.

## Kullanım

- Görünüm ve araçlar menüsünde, Gece modu yanındaki **Yeraltı göster** düğmesi başlangıçta kapalıdır. Açıldığında gömülü borular saydam olarak görünür. Aynı ayar yangın hatları çizimine ve SVG indirmeye uygulanır.
- **Boru düzenle** ile güzergâh listesini açın. Hat adına tıklayarak noktalarını inceleyin; kutucuklarla toplu işlem için birden çok güzergâh seçin. Arama kutusu tank, dolum ve monitör hatlarını süzer.
- X enine, Z tanklar boyunca, Y yüksekliktir; tesis koordinatları metre cinsindendir. İlgili noktanın değerini değiştirip **Bu hattı uygula** seçin. + araya nokta ekler, − ara noktayı siler. Bağlı ilk ve son uçlar kilitlidir; uç konumu için ilgili ekipmanı taşıyın.
- Toplu uzatma/kısaltmada eksen, kesit konumu, taraf ve santimetre cinsinden değişim girin. Kesitin seçilen tarafındaki mevcut noktalar birlikte kayar. Pozitif değer seçilen eksenin artı yönüne, negatif değer eksi yönüne taşır. Özellikle eksi tarafta bu yönü dikkate alın. Bağlı uçlar sabit kalır. İşlem CAD kesit kesme veya otomatik yeniden borulama yapmaz.
- **Güzergâhı kaydır** seçimi kesit filtresi olmadan ara noktaları birlikte taşır. Birlikte seçilmiş paralel güzergâhlarda aynı dönüşüm uygulanır.
- Her toplu işlem tek **Geri al** adımıdır; **İleri al** desteklenir. Değişiklikler mevcut tasarımcı yetkisini kullanır. Kaydet/yayımla, mevcut sahne kaydetme akışıyla yapılır. Görüntüleyici yetkisiyle hatlar incelenebilir, değişiklik uygulanamaz.
- Ekipman ekleme/silme mevcut tesis kütüphanesi ve özellikler araçlarıyla sürer. Yeni panelde fareyle nokta sürükleme bulunmaz; ölçüyle düzenleme vardır.

## Saha eşleştirmesi

- Boru dirsekleri sürekli, yuvarlatılmış merkez çizgisi üzerinden oluşturulur.
- Tek kollu vana: kol boruya paralel açık, dik kapalı. Fotoğrafta açık görülen dolum ve mal kabul vanaları yeni referans sahnede açık başlar; önceden kaydedilmiş kullanıcı vana durumları korunur.
- Etiketlere göre Tank 2 köpük ve soğutma alt, Tank 1 üst seviyededir. Dolum ve mal kabul üstte yan yana; monitör beslemesi alttadır.
- Metal köpük emişi hat içi karıştırıcıya bağlanır; ayrı kaide ve çıkıntılı yan bağlantı kaldırılmıştır. Bu görsel sadeleştirme karışım oranı veya hidrolik performans hesabı değildir.
- İki tank çevresine kapaklı hortum bağlantısı ve bağımsız tek kollu vana eklenmiştir. Ana su hattına bağlıdır, başlangıçta kapalıdır ve yangın deneme panelinden ayrı işletilir.
- Boru değişiklikleri `routeEdited` ile işaretlenir ve referans geçişinde korunur. Geçersiz çoklu işlem hiçbir güzergâhı yarım değiştirmez.

## Doğrulama ve sınırlar

Mevcut nesnelerin korunması, 10 bağımsız devre, köpük/su ayrımı, hortum çıkışları, yeraltı görünürlüğü ve seçim, vana kol yönü, bağlı uçların korunması, toplu işlem, geri al/ileri al ve sürüm geçişi test edilir. Fotoğraflar kesin kot, boru çapı, fitting standardı veya tüm hortum çıkışlarının konumunu belirlemeye yetmez. İki hortum bağlantısının nihai yerleri ve ölçüleri saha ölçüsüyle doğrulanmalıdır. Gerçek basınç/debi veya söndürme başarısı hesaplanmaz.

## Sonraki aşamalar

1. Dolum adasının fotoğrafa uygun çatısı ve gerçek yakıt hattı, filtre, dolum hortumu ve bağlantıları.
2. Mal kabulün gerçek yakıt hattı, filtre, hortum ve bağlantıları.
3. Ofis SOCAR tabelaları ile dolum, mal kabul ve saha lambalarının gece görünümü.
4. Ölçülü saha doğrulaması ardından gerçek operasyon sırası ve yangın/yakıt simülasyonu.

Bu sürüm yalnızca ilk aşamayı tamamlar; sonraki aşamalar veya birebir saha ölçüsü tamamlanmış sayılmaz.
