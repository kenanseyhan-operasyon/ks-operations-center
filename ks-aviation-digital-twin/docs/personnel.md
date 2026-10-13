# İkmal personeli

Kitaplık: **Uçak / araç / personel kitaplığı → İkmal personeli → Haritada yerleştir**.
Personeli seçip **Personel** düğmesini açın. Ad, boy (1,50–2,05 m), üniforma rengi, yelek rengi ve ten tonu tasarımcı hesabıyla değiştirilebilir. Sahnenin normal **Kaydet** işlemi personeli ve araç/merdiven bağlantısını saklar. Modül mevcut bulut sahnesine kendiliğinden nesne eklemez veya kayıt göndermez.

- W/A/S/D veya dokunmatik oklar: yürü / dön. C: çömel; B: eğil.
- Gözünden, arkadan, önden ve üstten görünüm: düğmeler veya 1–4. Sürükleyerek bakış değişir; Serbest ile sahne kamerasına dönülür.
- Noktaya yürü: 65 m içindeki açık bir zemin noktası seçilir. Bina, tank, araç, çit ve kapalı kapı ayak izleri etrafından yol aranır.
- Etkileşim hedefinden hat vanası, tesis kapısı, bekçi mobosu veya A320 ikmal paneli seçilerek aç/kapat uygulanır. Vana mevcut su/köpük deneme ağına bağlıdır; tasarımın başlangıç vana değeri değiştirilmez.
- Tank merdiveni ve hareketli tesis merdivenleri için Merdiven çık; ikmal aracı için Araç platformuna çık veya Araç üstüne çık kullanılır. Araç erişim noktaları gerçek GLB basamaklarından hesaplanır. Platformdaki personel hareketli döşemeyi izler. Aşağı in düğmesi ters yolu kullanır; platform önce alçaltılmalıdır.
- Sürücü koltuğuna geç mevcut araç sürüş panelini açar. Motor/sürüş/güzergâh sistemi korunur. Personel koltukta araçla birlikte hareket eder; hareketli araçtan inilmez. Platform/araç üstündeki personel, tırmanış ve bağlı hortum araç hareketini engeller.
- A320/B737 ikmal bağlantısı ve bir ikmal aracı seçildiğinde, el erişimi ve hortum mesafesi uygunsa hortum bağlanır. Deadman basılı tutulurken hareket denemesi sürer; bırakınca durur. Bu sürüm yakıt miktarını veya tank seviyelerini değiştirmez.
- İş ayakkabısı, reflektif yelek ve koruyucu kep modele dahildir. Gözlük gündüz koyu, gece şeffaftır. Gece reflektif bantlar hafif belirginleşir.

Karakter, eklemli ve sadeleştirilmiş 3D çalışma modelidir. Hareket yolları model geometrisi üzerinden çalışır; fizik motoru, düşme simülasyonu veya eksiksiz operasyon/prosedür doğrulaması değildir. Bütün kapı türleri için evrensel etkileşim henüz yoktur; yukarıdaki parçalar desteklenir.

## Doğrulama

`npm run test:personnel`: gerçek GLB merdiven/platform noktaları, gündüz/gece ekipmanları, kamera ve eklem dönüşümleri, engel çevresinden yol, odak kaybında durma, vana/kapı etkileri, çıkış/iniş, koltuk takibi, hareket kilitleri, deadman, kayıt dönüşümü ve düzenleme yetkisi.

Personel testi `npm test` akışına dahildir. Önceki 18 test grubu ile tesis, köprü ve detay testleri de geçirilmiştir. Model pozları SVGRenderer ile ayrıca incelenmiştir. Bu geliştirme oturumunda tarayıcı otomasyonu bulunmadığından canlı masaüstü/telefon WebGL arayüz testi yapılmamıştır.
