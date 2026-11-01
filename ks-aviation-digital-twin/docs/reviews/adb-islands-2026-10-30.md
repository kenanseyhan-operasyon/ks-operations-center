# ADB ortak kayıt 23 · dolum ve mal kabul

Referans: ortak kayıt 23 (2026-10-30 12:45 UTC), yüklenen 53693–53697 tank merdiveni fotoğrafları ve tesis fotoğrafları 1 PDF, dolum ekipmanı sayfa 9.

- N2 ve mal kabul kanopileri kütüphane parçalarıdır. N2 dört cephede SOCAR işareti ve mevcut gece anahtarına bağlı ışıklı yazı kullanır. Görsel yüklenirken SOCAR yazısı görünür kalır.
- Köpük camı kontrol erişimi iki sahanlık, eğimli ızgaralı basamaklar, sarı korkuluklar ve beyaz konsollardan oluşur. Tank çevresine uyar. Merdiven boyu ve yüksekliği fotoğraf uyarlamasıdır; saha ölçümü değildir.
- Merkez nefeslik kapak ve boyunla gösterilir. İki tankta mevcut soğutma ringinden çatı püskürtme kolu ayrılır; mevcut düzenlenmiş alt boru güzergâhları korunur. Nozul yerleri ve debi hidrolik proje olarak doğrulanmamıştır.
- Dolumda iki, mal kabulde bir pompa–filtre–sayaç–hortum dizisi ayrı seçilebilir modüllerdir. Yeni modüllerin ölçüleri ve konumları görsel uyarlamadır. Uzun tank besleme boruları fotoğraflardan doğrulanmadan eklenmemiştir.
- Tesis kütüphanesi / Akış denemesi içinde Jet A-1 eğitim kontrolü bulunur. Hortumdan pompaya bağlantı zinciri, bonding, kaplin, vana, pompa, basılı tutma ve acil durdurma kontrol edilir. Örnek akış 300 L/dk, kaynak ve hedef boş hacmi 10.000 L'dir. Gerçek tank/araç kayıtlarını değiştirmez; Nathan hareketleriyle henüz entegre değildir.

Kayıt 23 tam sahne yedeği bu değişiklikle depoya eklenmez. Yükseltme sadece ön yüzde uygulanır, otomatik ortak kayıt yazmaz. Sonradan silinen modülleri tekrar eklemez. Mevcut yangın boru düzeni sürümünü yükseltmez.

Doğrulama: TypeScript, Vite, tesis, kütüphane, yangın/boru regresyonları ve kayıt 23 koruma/Jet A-1 durdurma testleri. Yerel model arşivleri bulunmadığından tam prebuild Render üzerinde çalıştırılır.

## Aynı gün görsel düzeltme

Tank köpük merdiveni adıyla kütüphaneye eklendi. Kontrol merdiveni ters çevrildi; çatıya 35 cm giren üst sahanlık ve onunla eşleşen korkuluk açıklığı tanımlandı. Çevre borusu merdiven dış sınırından en az 20 cm uzak kalacak şekilde dolaştırıldı; dikey besleme merdivenin karşı yanına alındı. Çatı soğutma halkası merkez nefesliğin çevresinde 5 m çapında kapalı dairedir. Kırmızı/mavi/yeşil kabartma amblem ve beyaz SOCAR yazısı dört cephede, gece aydınlatmasıyla kullanılır.

Doğrulama: birleşik tank/merdiven/boru geometrisi derinlik tamponlu yazılım OpenGL görüntüsünde incelendi. Çatıya sahanlık bindirmesi, korkuluk açıklığı, 2.5 m halka yarıçapı ve boru-merdiven dış zarf açıklığı otomatik testlerde kontrol edildi.
