# KS AVIATION — Nathan Hareket Kütüphanesi v1

Tarih: 2 Kasım 2026  
Durum: **Araştırma + bağımsız geliştirme dalında temel kod + geometri testleri. Canlı sürüm onayı DEĞİL.**  
Kod: `src/nathan-motion-contract.ts`, `src/nathan-tank-contact.ts`; test: `tests/nathan-motion-contract.test.ts`.

## Amaç

Nathan'ın kullanıcı tarafından giydirilmiş ve iskeletlendirilmiş mevcut GLB'sini koruyarak
animasyon + hareket rotası + IK temasını tek, sürüm kontrollü hareket kütüphanesinde
toplamak. Yeni internet animasyonları **doğrudan Nathan'ın üzerine eklenmeyecek**;
önce kemik eşlemesi, retarget, kök hareket ve eksenler ölçülecek.

## Kaynaklar, indirme ve izinler

| Kaynak | URL | Lisans | Kullanım kararı |
| --- | --- | --- | --- |
| Quaternius Universal Animation Library Standard | https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip | CC0 (yayıncının OpenGameArt sayfasında teyitli) | Yürüme, koşma, yön değiştirme, oturma hareketlerini Nathan GLB'ye **ayrı laboratuvarda** retarget etmek üzere indirilebilir; mevcut projenin assetleri değiştirilmedi. |
| Quaternius resmi paket + sürüm geçmişi | https://quaternius.itch.io/universal-animation-library | CC0; Standard ücretsiz, Source/Pro ücretli olabilir | FBX/GLB/Blender, root-motion ve in-place ayrımı; yeni sürüm saat/tempo kalibrasyonu gerekli. |
| Motifect Locomotion Motion Pack | https://motifect.itch.io/motifect-locomotion-motion-pack | Projede kişisel/ticari ücretsiz kullanım belirtilmiş; ham dosya yeniden dağıtım şartı ayrı teyit edilmeli | FBX/BVH merdiven çıkışı/inişi adayı; projeye veya arşive kopyalanmadı. |
| Three.js CCDIKSolver | https://threejs.org/docs/pages/CCDIKSolver.html | Three.js MIT | Halihazırda kullanılan `three@^0.186.0` paketinin eklentisi. Gerekirse analitik IK yerine deneysel seçenek; otomatik olarak entegre edilmemeli. |
| Three.js SkeletonUtils.retargetClip | https://threejs.org/docs/pages/module-SkeletonUtils | Three.js MIT | Kaynak GLB animasyonlarını Nathan'ın kemik adları ve rest pose'u ile eşleme için. |
| THREE.IK, Jordan Santell | https://github.com/jsantell/THREE.IK | MIT, copyright Jordan Santell 2018 | FABRIK ve çoklu hedef için kod kaynağı. Eski ve breaking API uyarısı var; üretime doğrudan alınmayacak. |
| IK foot locking demo | https://github.com/MULUALEM-TEKLE/IK-test | GitHub deposunda açık lisans görünmüyor (2 Kasım 2026) | **Yalnızca yöntem araştırması**; üçüncü taraf kodu/animasyonları kopyalanmadı. |

> İndirme notu: Bu oturumun uzaktaki ZIP indirme kanalı, resmi CC0 ZIP dosyasını
> alamadı. **İndirildi / projeye aktarıldı denemez.** Linkler yukarıdadır.
> Nathan'ın halihazırda depoda yer alan animasyonları çalışmaya devam eder.

## Nathan'ın mevcut dosyaları

Mevcut `model-parts/nathan/manifest.json` ana GLB dosyasını ve 16 ana klibi
bildirir: `Nathan_Original_Walk`, `Running`, `Running_Up_Stairs`,
`Climbing`, `Climbing_Ladder`, `Driving`, `Opening`, `Pulling_Lever` vb.
Ek `nathan-access-animations.json` dosyasından üç ilave klip okunur; mevcut
kontrol kodunda `Descending_Stairs` kullanılır.

Bunlar **hazır hareketlerdir**, fakat "animasyon var" = "doğru eller/ayaklar/
kafa/yürüyüş yönü var" anlamına gelmez.

## Hareket sistemi: tek sorumluluk, net sınırlar

1. **Görev yöneticisi**: Kullanıcının seçtiği hedef, başka nesne seçildiğinde
   veya kamera değiştirildiğinde kaybolmaz; yalnızca DUR/İPTAL veya güvenlik
   durumu görevi durdurur.
2. **Navigasyon**: Tesis nesnelerinin *o anki* gerçek konumundan güvenli rotayı
   hesaplar; hareketli engelde durur ve gerekirse yeniden planlar.
3. **Kök hareket**: Dünya `position`/`heading` değerinin tek sahibi
   `NathanController` ve doğrulanmış erişim geometrisidir. Kliplerdeki kök
   translasyonları Nathan'ı ters yöne yürütmemelidir.
4. **Temel iskelet animasyonu**: Klipler yerinde (in-place), gerçek yol hızına
   göre eşlenmiş zamanla ve yumuşak crossfade ile oynatılır.
5. **Ayak IK**: Bir ayak gerçekten basamakta/zeminde kilitli; diğer ayak sıradaki
   basamağa yükseltilir; gövde tek basamakta kalmadan bir üst seviyeye sıçramaz.
6. **El IK / kavrama**: Spiral tank merdiveninde her zaman **tanka uzak olan el**
   dış korkuluğa (Tank nesnesi döndürülmüş olsa bile), diğer el yürüyüşte serbest.
   Dikey araç merdiveninde ise tek el kuralı yerine **3 nokta temas**.
7. **Ekipman**: Vana, kapı, direksiyon ve su monitörünün gerçek
   hareketli tutamaklarına el hedefi bağlanır. Ekipman durum değişimi kavramadan
   önce gerçekleşmez.

Güncel geometri kaynağı: `tankStairLayout`. 3D merdiven mesh'i ve
`makeNathanAccess` aynı basamakları kullanmalıdır. Korkuluğun merkez çizgisi
`makeTankAccess` üzerinden alınır. Tankın yerel koordinatı ile dünya
koordinatı **asla aynı vektör hesabında karıştırılmamalıdır**.

### Hareket aileleri

| Aile | Kaynak klip / davranış | İstenen temas |
| --- | --- | --- |
| Zeminde yürü / koş / dön | Original Walk / Running / Turn | Taban kilidi, gerçek hız, dönüş açısı |
| Spiral tank çıkış/iniş | Normal yürüyüş + gerçek basamak IK | Tanktan uzak **tek el**, basamak basamak |
| R14 arka dikey merdiven | Climbing_Ladder, inişte yönü ve animasyon zamanını doğru sür | Rung bazlı üç nokta temas |
| R14 basamakları / sürücü kabini | Climbing / Walking + sürücü iniş/biniş IK | İki farklı korkuluk, kapı, ilk/son basamak |
| Kabinde sürüş | Driving + direksiyon IK | Her iki el direksiyonla birlikte döner |
| Küresel vana | Pulling_Lever + gerçek vana kolu IK | Kol boruyla paralel=AÇIK, dik=KAPALI; 90° |
| Kapı aç/kapat | Opening + menteşeli kapı kolu IK | Kol kapı hareketinde eli takip eder |
| Su monitörü | Idle + iki el gerçek monitör kolunda | Fare azimut/eğim; su açık/kapalı, debi |

## Test etmeden yayına çıkılmayacak ölçümler

- **Tank çıkış/iniş, sağa/sola dönen merdiven**: 0°, +37°, -125° tank dönüşleri;
  baştan sona ayağın basamakta kalması, tanka bakan kolun serbest kalması.
- **Merdiven giriş ve çıkışları**: İlk basamak ve son basamakta Y=0 ışınlanması
  veya ters yöne dönme olmaması.
- **Zemin**: Ayakkabı batması, dururken ayak kayması, geri geri koşma, omuz/
  diz/dirseklerin ters dönmesi ölçülmeli.
- **Dikey R14 merdiveni**: Her aralıkta en az üç destek noktası, ellerin doğru
  korkuluk/rung üzerinde kalması ve ikisi aynı noktada olmaması.
- **Vana/kapı/monitör**: IK eli gerçekten hedef tutamağa ulaşmalı; hareket
  animasyonu tek başına başarı ölçütü sayılmaz.
- **Görev kalıcılığı**: Başka nesneye tıklama, planı 2D gösterme, kamerayı
  döndürme görevi iptal etmemeli. Engel koyulduğunda yeni rota veya güvenli DUR.
- **Performans**: 30, 60 ve 120 fps'ye yakın değişken adımlarla hareket
  sürekliliği ve aynı erişim son noktası denetlenmeli.
- **Görsel QA**: Yandan, arkadan, yukarıdan videolar. CI'de geometri/IK testinin
  geçmesi *görsel gerçekçiliği kanıtlamaz*.

## Gemini'ye teknik inceleme için iletilecek görev

Bu belge ve `src/nathan-motion-contract.ts` dosyasını inceleyerek şu soruların
yanıtını isteyin: klip retarget/rest-pose hatası, in-place/root motion ayrımı,
tank radius ve yürüme yönünden dış elin hesaplanması, üç nokta temas,
görsel Y=0 çökmesi ve 30/60/120 fps testlerinin kapsamadığı kusurlar.

**Güvenli sınır:** Gemini'deki canlı proje, Supabase verileri ve Hotmail'in
`ks-3d-test` yayın dalı bu araştırmayla değiştirilmedi.
