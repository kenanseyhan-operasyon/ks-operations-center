# 19 Ekim 2026 — kabin, platform ve Nathan düzenlemesi

Beş işaretli ekran görüntüsüne göre yapılan değişiklikler:

- Kapının eski teker oyuğu ve ayrı üst basamak kapağı, kapıyla birlikte açılan kavisli alt etekte birleştirildi. Siyah, sabit teker üstü kapama ve geniş üst sahanlık eklendi. Üst basamak 430 × 290 mm oldu; alt basamaklar 380 × 240 mm kaldı. Basamak yanakları inceltildi ve içeri alındı.
- İçteki eski beyaz teker tümseği temizlendi. Gösterge panelinin altı 230 mm'den 155 mm yüksekliğe inceltildi, öne alındı ve köşeleri yuvarlatıldı. Panel kabuk sınırları içinde kaldı.
- Sol el ön sabit tutamağa, sağ el arka sabit tutamağa ayrı ayrı bağlandı. El değiştirme sırasında hedef görünür kavisli boruya yeniden yansıtılıyor. Sağ tutamağın üst dönüşü koltuk arkalığına bağlandı. İniş basamaklarda kabine dönük, geri yönde sürüyor.
- Düz yaklaşma ve ayrılma artık merdiven ayağı IK'sini kullanmıyor. Orijinal yürüyüşün temposu gerçek yer değiştirmeden hesaplanıyor; yerinde dönüşte Idle kullanılıyor. İki ayak zemine geldiğinde eller serbest.
- Nathan olmadan kapıya tıklayınca ayrı aç/kapat menüsü bulunuyor. Araç panelinde iki kabin kapısı da kontrol edilebiliyor. Tekrarlanan aç/kapat komutları tersine dönmüyor; hareket hâlindeki araçta veya Nathan kapı basamaklarındayken kapatma engelleniyor.
- Alt ekipman tablasının ön kenarı 150 mm uzatıldı. Makaslar, sepet ve giriş merdiveni birlikte 150 mm öne taşındı. Arka tabla kenarı korunuyor.
- Yeşil düğme girişin karşısındaki üst korkuluğun iç yüzüne bağlı bir plakaya monte edildi. Dört köşede dört ayrı kanat temas anteni var; hepsi sepetle hareket ediyor.
- Basamak yanındaki amber lambalar 220 mm arkaya alındı ve metal bağlantı plakalarına oturtuldu.
- Büyük tambur ile bonding makarasının servis yüzleri aynı düzleme getirildi. Bonding bağlantı tabanı daraltıldı; park kaplini boşalan arka noktaya ve hortumun alt ucu yeni park yerine taşındı.
- Yeni kapı altı parçası ve sabit erişim parçaları iç görünümde gizleniyor; dış görünümde geri geliyor. Aynaların kapı menteşesine bağlı hareketi korunuyor.

## Doğrulama

Gerçek GLB geometrisi ve iskelet kullanıldı. Testler: cab-reference, cab-motion, nathan-interactions, nathan-access, nathan-movement, gemini-video; ayrıca TypeScript ve Vite derlemesi.

- 30 ve 60 FPS'te 620 kavrama örneği: her el kendi borusunda, eller gövde orta çizgisini çaprazlamıyor.
- 202 çıkış/iniş vücut pozu: kapı, tavan ve taban test hacimlerinde çakışma yok.
- 81 platform yükselme pozu: sepet ve filtre mesafesi korunuyor.
- Tam sağ/sol direksiyon konumunda ön lastik ve iki merdiven çakışmıyor.
- Platform/tabla 150 mm, dört antenin ayrı köşeleri, korkuluk–plaka–düğme bağlantısı, makaraların ortak servis düzlemi ve kaplin boşluğu gerçek mesh sınırlarıyla ölçüldü.
- Nathan olmayan sahnede iki kapı için tekrar edilen aç/kapat komutları çalıştı. Yaklaşma ve iniş sonrası yürüyüşte merdiven IK'sinin kapalı olduğu gerçek controller akışında doğrulandı.

Görsel inceleme, gerçek mesh ve deforme karakter yüzeylerini kullanan çevrimdışı OpenGL görüntüleriyle yapıldı. Bu çalışma ortamındaki tarayıcı WebGL açamadığından canlı tarayıcıda 3D görsel onay yerine model/animasyon testleri ve Render dağıtım sonucu kullanıldı.
