# KS Aviation — Gemini Nathan Hareket Raporu / Teknik Karşılaştırma

Tarih: 2 Kasım 2026. Kapsam: Nathan 3D hareketleri, Three.js r186, R14 ve ADB tesis.
**Durum:** Analiz ve test laboratuvarı; canlı site veya Gemini/Supabase değiştirilmedi.
Kaynak: kullanıcının paylaştığı Gemini "Dairesel / Spiral Merdiven, Araç ve Vana" raporu.

## Ortak doğru bulgular

- Nathan GLB'de kök kemiğin `position` izleri bulunuyor. Gerçek ham GLB
  denetimi (`scripts/audit-nathan-clips.mjs`):
  `Nathan_Original_Walk` için root Y +289,01 ham kaynak birimi,
  `Running` için Y -281,64, `Running_Up_Stairs` için
  Y +53,57 / Z -48,79. **Bu sayılar metre değildir.**
- Dünya rotası ve görsel in-place klip ayrı tutulmalı. Laboratuvarda
  `src/nathan-motion-sanitize.ts` yalnızca controller'ın hareket
  ettirdiği animasyonlarda `rp_nathan_animated_003_walking_root.position`
  kanalını temizler; orijinal GLB'yi değiştirmez.
- Spiral merdivende yatay bakış yönü gerçek rota teğetini takip etmeli.
  Ayaklar gerçek basamaklara kilitlenmeli; inerken yüz gidiş yönüne dönmeli.
- Tank tarafındaki el **serbest**, tanka uzak el **dış korkulukta** olmalı.
  R14 arka dikey merdiveninde bunun yerine üç nokta teması gerekir.
- Vana, kapı, direksiyon, su monitörü hareketli pivot ve tutamak noktalarını
  hedef almalı; bir animasyonu başlatmak tek başına kavrama değildir.

## Gemini örnek kodundaki üretim engelleri

1. **Yanlış kemik isimleri.** Gerçekte `rp_nathan_animated_003_walking_root`,
   `..._hip`, `..._upperleg_l`, `..._lowerleg_r`, `..._foot_l`,
   `..._hand_r` vb. var. `Mixamorig:Hips` / `Mixamorig:LeftFoot`
   bu GLB'de doğrudan kullanılamaz; retarget isim haritası gerekir.
2. **World/local karışımı.** `getWorldPosition` ile ölçülen farkın
   `footBone.position.y += ...` ile doğrudan yerel uzva eklenmesi
   doğru IK değildir. `handBone.position.copy(worldTarget)` de
   yanlıştır. `NathanContactRig.solveLimb` ve `worldToLocal`/el IK
   kullanılır; kemik hiyerarşisi korunur.
3. **Tüm merdivene kör raycast.** Işınlar korkuluğu, yan taşıyıcıyı veya
   üst sahanlığı basamak diye seçebilir. Kaynak `tankStairLayout` içindeki
   gerçek `piece.y1` kotlarına ve etiketli yürünebilir yüzeylere
   öncelik ver; raycast yalnızca aday yüzeyleri doğrulasın.
4. **Zaten var olan IK atlanmış.** `src/nathan-contact.ts`
   ayak/eller için gerçek iki kemikli IK, silindirik kavrama ve temas
   durumu tutar. Sıfırdan farklı bir sistem kurmak hata riski yaratır.
5. **`mixer.timeScale=2/4` genel ayar.** Aynı Nathan mixer'ındaki bütün
   eylemleri etkiler. Yalnızca test hızını ve rota ilerlemesini eş zamanlı
   ölçekleyen ayrı görev ayarı kullan; gerçek operasyon varsayılanı 1x.
6. **Sabit 0,4 s dönüş ve otomatik `slerp`.** Bunlar tek başına
   doğal dönüş sağlamaz. Hız/açı sınırlaması, yürüyüş evresi, ayak
   planted state ve ara basamakta tutuş geçişi birlikte doğrulanmalı.
7. **Mixamo & ActorCore adlandırmaları/izinleri.** Hazır hareket isimleri ve
   ticari kullanım hakları her asset için bağımsız doğrulanmalı;
   kaynağın kendi license ve FBX/BVH kemik profili olmadan
   proje içine animasyon kopyalanmamalı.

## Mevcut uygulama durumu

- Canlı Hotmail: `ks-3d-test` (SHA `39947968...`), bu araştırma
  dalının kodlarını **henüz içermiyor**.
- Ayrı dal: `fix/nathan-outside-rail-20261102`.
- `src/nathan-motion-contract.ts`: 18 hareket/etkileşim sözleşmesi.
- `src/nathan-tank-contact.ts`: dönüşü/heading'i esas alan
  `outsideRailHand` ile dinamik tek el seçimi; gerçek basamak ayak hedefleri.
- `src/nathan-motion-sanitize.ts`: controller-driven animasyonların
  kök konum izinin ayrılması.
- Otomatik QA: `KS Nathan Motion Lab` 41427858629 başarılı (kod,
  gerçek GLB hareket, el/ayak, yapı derleme).
- **Görsel WebGL kalite testinin tamamı yapılmadı; bu test başarılı
  diye Nathan doğal yürüyor denilemez.**

## Eksikler / net tamamlanma ölçütleri

A. **Spiral merdiven öncelikli:** Normal yürüme (koşu yok),
   1x varsayılan, isteğe bağlı test 2x/4x; kesintisiz rota,
   dış korkuluk tek el, ters yönlü inişte doğru el, ayak batması
   ve Y=0 sıçraması yok. 30/60/120 fps varyasyonları.
B. **Arka dikey araç merdiveni:** gerçek 3 nokta temas, rungal basış,
   ayrı inme/çıkma evreleri ve giriş/çıkış kalitesi.
C. **Kabin:** ayak, iki ayrı tutamak, menteşe kapısı, koltuk,
   direksiyon tutuşu, son basamakta doğru bırakma.
D. **Ekipman:** küresel vana 90° ve gerçek el hedefi,
   monitör 2 el + fare kumandası + açık/kapalı su/durum.
E. **Süreklilik:** başka nesne/panele tıklama görevi iptal etmez;
   değişen engel güvenli alternatif rota veya DUR üretir.

## Teknik referanslar

- Three.js Object3D world/local:
  https://threejs.org/docs/pages/Object3D.html
- Three.js Raycaster:
  https://threejs.org/docs/pages/Raycaster.html
- Three.js SkeletonUtils.retargetClip:
  https://threejs.org/docs/pages/module-SkeletonUtils
- Adobe Mixamo FAQ:
  https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html

Canlıya alma kararı yalnızca bütün otomatik QA ve ayrıca görsel gerçek
hareket kontrolünden sonra verilecek. Gemini canlısı ve Supabase verisi
aynen bırakılacak.
