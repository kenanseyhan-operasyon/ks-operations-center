# Kabin hareketleri: ikinci video incelemesi

18 Ekim 2026. Başlangıç sürümü: `afd0b9fe82a57accf8f855497ed12912a7dc663b`.

## Nedenler ve düzeltmeler

- Eski el hatası yalnızca IK bileğini ölçüyordu. Açık parmaklar ve yanlış avuç yönü bu testi geçebiliyordu. `NathanGrasp`, mevcut Driving klibinin parmak eksenlerinden silindirik kavrama üretir; parmak eklemleri ve karşıt başparmak yayı ayrıca ayarlanır. Temas merkezi parmakların çevrelediği boşluktur. Boru teğeti el yönünü belirler. Kaynak GLB/klipler değiştirilmez.
- Direksiyonun Euler dönüş sırası `.4` radyanı eğim yerine çember içinde dönüşe çeviriyordu. Eğim artık araç ekseninde uygulanır. Tutma noktaları 450 mm dış çapın üzerindeki 24 mm kesitli borunun merkez çizgisine yerleştirilir. Birkaç direksiyon turu kolları çaprazlamaz; eller sınırlı bir yayı izler, sonra çember tutuşta kayar. Bu, tam el üstüne el manevrası değildir.
- Driving gövdesi öne kapanıyordu. Otururken pelvis/omurga/boyun nötr hizaya karıştırılır, kalça koltukta geriye alınır; ardından ayak ve el IK çözülür. Görüntülenen oturuşta başın kalçaya göre öne uzaklığı yaklaşık 25 cm'den 4,5 cm'ye indi.
- Tutamak erişimi yalnızca omuz–hedef uzaklığıyla hesaplanıyordu. Yeni kabin çözümü gerçek kavrama merkezi/bilek ofsetini kullanır. Ulaşılamayan eski tutuş bırakılır; iki el aynı noktayı seçmez. Tutuş geçişi kare sayısı yerine geçen süreyle yumuşatılır.
- Son basamaktaki eller yükselmiş klipten kalıyordu. Serbest kol pozu ve yükselen/yanal yaklaşma yayı eklendi. Kollar, yerde yön değişmeden alçalır; indirme yayı kapı ve tabandan kaçınır.
- Siyah kabin tabanı beyaz kaynak kabukla aynı düzlemdeydi. Kabuktaki örtülen iç taban parçası çıkarıldı. Taban yüksekliği, basamak yükseltileri ve dış sınır değişmedi.
- Önceki ayna menteşeleri, iç görünümde ilavelerin gizlenmesi, serbest başparmak ve önizleme ayarları düzeltmeleri korunur.

## Doğrulama

- Gerçek GLB ile 202 giriş/çıkış pozu: tavan, açık kapı ve taban çakışması sıfır.
- 30 ve 60 fps giriş/çıkış: 620 tamamlanmış kavrama ölçümü; gerçek kavrama merkezi ve boru teğeti denetlenir. Bu sayı, her parmak yüzeyinin kusursuz temas ettiği veya kesintisiz üç nokta temas sertifikası anlamına gelmez.
- Nötr oturuş, iki yönlü tam direksiyon turu, hareketli/döndürülmüş/ölçekli araç, yerde ellerin aşağıda olması, parmak kıvrımı ve kaynak tabanla çakışmama regresyonları.
- Mevcut Nathan hareket, erişim, etkileşim ve kabin boyut testleri; TypeScript ve Vite üretim derlemesi.
- Gerçek deforme ağ, yazılımsal OpenGL/EGL ile yan ve ön açılardan görüntülendi. Renkler tanısaldır; canlı sitenin dokulu WebGL sahnesinin kabul testi değildir. Bulut tarayıcıda WebGL yoktur.

## İnternet kaynakları ve varlıklar

İnceleme için projenin Three.js sürümüyle aynı `r186` kaynakları indirildi: [IK örneği](https://github.com/mrdoob/three.js/blob/r186/examples/webgl_animation_skinning_ik.html), [CCDIKSolver](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/animation/CCDIKSolver.js), [SkeletonUtils](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/utils/SkeletonUtils.js) ve [MIT lisansı](https://github.com/mrdoob/three.js/blob/r186/LICENSE). IK örneğindeki karakter/oda varlıkları projeye eklenmedi. Mevcut analitik IK korundu; kavrama ve temas sırası düzeltildi.

Yeni harici hareket paketi eklenmedi: sorunun temel nedeni klip yokluğu değil, klip sonrası temas ve poz uyarlamasıydı. Mevcut 19 hareket korunur. Bonding, hortum/kapling, deadman, numune ve kemer hareketleri ayrı tasarım belgesindeki geliştirme kapsamıdır; bu değişiklikte uygulanmış sayılmaz.
