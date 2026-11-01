# Nathan: ikmalci hareket mimarisi ve geliştirme tasarımı

Tarih: 18 Ekim 2026. Bu belge yazılım/animasyon tasarımıdır; işletmenin onaylı ikmal prosedürünün yerine geçmez. Aşağıdaki yeni ekipman etkileşimleri tasarımdır, henüz çalışan özellik olarak sunulmaz.

## Mevcut sistemin değerlendirmesi

`NathanController` rota, erişim ve araç durumunu; `NathanActor` klipleri ve geçişleri; `NathanContactRig` ayak/el temaslarını yönetiyor. Mevcut analitik iki kemikli IK korunabilir. Motor değiştirmek gerekmiyor. Kaynak GLB'de 16, ek erişim dosyasında 3 klip var. Bunlar tek başına kapling takma, hortum taşıma veya deadman işletme davranışı sağlamıyor.

Bu değişiklikte:

- Kapı aynasının gövdesi, kolları, canlı yüzeyi, kamera ve bakış hedefi aynı menteşeye bağlandı.
- İnce, yuvarlak kesitli kavisli ön/kapı tutamakları ve referanstaki koltuk yanı tutamağı eklendi. IK hedefleri borunun merkez eğrisinden alınıyor; montaj dönüşleri kavrama alanına dahil edilmiyor.
- İç görüşte yeni tutamaklar ve basamak/çamurluk ilaveleri gizleniyor; dış görüşte geri geliyor. Ayna render geçişleri bu durumu geri yüklüyor.
- Serbest duruş/yürüyüş başparmakları, kaynak animasyonun avuca kıvrılan dönüşü yerine dinlenme pozuna yaklaştırıldı. Tutunma/sürüş kliplerine uygulanmadı.
- Normal mobil merdiven, dikey merdiven/tepeye çıkış kodundan ayrıldı; inişte yürüyüş yönüne dönüp merdiven iniş klibini kullanıyor.
- Dikey erişim inişi, duvar inişi klibinin farklı gövde hareketi yerine aynı çıkış klibini ters yönde kullanıyor; ayak/el temas çözümü korunuyor.
- Kontrol sırasında geçici hareketler kullanıcının seçtiği önizleme klibini değiştirmiyor; kontrol bırakılınca önizleme seçimi geri yükleniyor.

İkinci video incelemesinde kabin için silindirik el kavrama katmanı, dik oturuş, gerçek direksiyon eğimi, sınırlı tutuş yayı, son basamakta el bırakma ve çakışan taban yüzeyinin kaldırılması uygulandı. Bulgular ve doğrulama: [NATHAN_CAB_VIDEO_REVIEW.md](NATHAN_CAB_VIDEO_REVIEW.md).

## Geliştirilmesi gereken ortak altyapı

Her etkileşim `yaklaş → hizalan → uzan → kavra → uygula → bırak → ayrıl` evrelerine sahip olmalı. Süre tek başına başarı sayılmamalı: kavrama, kilit ve bağlantı olayları doğrulanmalı. İptal, duraklatma ve kayıt/yükleme her evrede tanımlanmalı.

Her ekipman üzerinde adlandırılmış yerel hedefler bulunmalı: sol/sağ el, bakış, ayak konumu, bağlantı ekseni, nesne tutuş noktası, çalışma alanı ve çarpışma hacmi. Hedefler ekipmanın dönüşümüyle dünyaya taşınmalı. Animasyon sonrası sıra: gövde/kalça ayarı → ayak IK → el IK → parmak tutuş pozu → temas doğrulama. IK sonrasında ikinci bir zemine oturtma işlemi yapılmamalı.

Kabin için serbest, silindirik kavrama ve direksiyon el pozları uygulanmıştır. İnce kıskaç, kapling iki el ve tetik pozları hâlâ gereklidir. Avucun hedefe ulaşması parmakların doğru kavradığı anlamına gelmiyor. Hedef erişilemezse kolu uzatmak yerine kök/ayak konumu yeniden planlanmalı veya işlem durmalı.

## Hareket paketi

| Etkileşim | Animasyon ve hedefler | Başarı ölçütü |
|---|---|---|
| Araca binme/inme | Basamak hedefleri, sabit tutamak, el değişimi, kabin içinde dönüş | Temas sürekliliği, tavan/kapı/taban çakışması olmaması |
| Oturma ve kemer | Koltuğa kalça yerleşimi, sırt hizası, tokaya uzanma, kemer şeridi | Kemer durumu ve görünür kayış; ayrı tak/çıkar olayları |
| Bonding kablosu | Makaradan alma, yürüyüşte kablo uzaması, kıskaç aç/kapat | Tanımlı bağlantı noktasına gerçek nesne bağlanması |
| Hortum taşıma | İki elle taşıma, ağırlığa uygun gövde, hortum boyu kısıtı | Hortumun çekerek karakteri/ekipmanı delmemesi |
| Kapling bağlama/sökme | Uçak bağlantı eksenine yaklaşma, iki el IK, itme/döndürme/kilit | Mekanik kilit ve hortum bağlantı durumunun eşleşmesi |
| Taşınır merdiven | Kavrama, taşıma, yerleştirme, açma ve kilitleme | Merdiven nesnesi elleri izler; açık/kilitli durum ayrı tutulur |
| Deadman | Ele alma, tutma/tetik, bırakma | Bırakma olayının simülasyon akışını kesmesi |
| Numune alma | Kabı sabitleme, numune aparatına uzanma, pistonu/vanayı işletme | El/kap hedefleri ve numune durumu; aparat tipine özel klip |
| Yangın tüpü | Alma/taşıma, hortumu yöneltme, kolu işletme | İki elde farklı hedefler; boşaltma yönü nozulla eşleşir |
| Yangın monitörü | İki el tutuş, azimut/yükseliş, kontrol kolu | Mekanik limitlere uyum, ayakların sabit kalması |

Bu hareketlerin süreleri, kapling dönüş açısı, hortum ağırlığı, numune aparatının tipi ve prosedür sırası temsili sabitlerle üretim eğitimine taşınmamalı. Kullanılacak gerçek araç/ekipman ve saha referans videosuyla kalibre edilmeli.

## Üretim sırası ve doğrulama

Önce erişim/oturma/kemer; sonra nesne kavrama katmanı; ardından bonding ve kapling; daha sonra hortum, deadman, numune ve acil durum ekipmanı. Her aşamada 30/60/120 fps, duraklat/devam, anlık hedef değişimi, döndürülmüş/ölçeklenmiş araç ve erişilemeyen hedef denenmeli. El/ayak hata toleransları, kayma, eklem limitleri, çarpışma ve üç nokta temasın sürekliliği ayrı ölçülmeli. Mevcut örneklenmiş temas testleri kesintisiz üç nokta teması veya görsel gerçekçilik sertifikası değildir.

Hazır temel yürüyüş/uzanma klipleri için Mixamo; nesneye özgü kapling, kemer ve numune hareketleri için Blender'da referansla hazırlanmış klipler ve uygulamada IK uygundur. Yeni klipler mevcut Nathan iskeletine yeniden hedeflenmeli. CCDIKSolver alternatif bir çözümleyicidir; sırf mevcut hataları gizlemek için çalışan analitik IK'nın yerine geçirilmemeli.

## Araştırma kaynakları

- Three.js AnimationMixer: https://threejs.org/docs/pages/AnimationMixer.html
- Three.js AnimationAction (geçiş/karışım): https://threejs.org/docs/pages/AnimationAction.html
- Three.js CCDIKSolver (eklem limitleri ve karışım): https://threejs.org/docs/pages/CCDIKSolver.html
- Adobe, Mixamo karakter animasyonu: https://helpx.adobe.com/creative-cloud/help/animate-characters-mixamo.html
- FAA AC 150/5230-4C, yakıt elleçleme ve personel eğitimi kapsamı: https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5230-4
- DOI Aviation Fuel Management Handbook, Eylül 2024; bonding/deadman kavramları için kapsamı DOI operasyonları olan referans: https://www.doi.gov/sites/default/files/documents/2024-09/doi-aviation-fuel-management-handbook-sept-2024.pdf

Doğrulama sınırı: bu oturumdaki bulut tarayıcı WebGL kullanamıyor. Gerçek GLB üzerinde otomatik geometri/iskelet testleri, TypeScript/Vite derlemesi ve deforme edilmiş gerçek ağın bağımsız yazılımsal OpenGL görüntülemesi yapıldı. Tam sahnenin tarayıcı WebGL görüntüsü ayrıca kontrol edilmelidir.
