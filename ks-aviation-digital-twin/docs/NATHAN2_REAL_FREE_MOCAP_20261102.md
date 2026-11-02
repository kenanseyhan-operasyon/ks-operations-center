# KS Aviation — Nathan 2.0 / Gerçek ve ücretsiz merdiven hareketleri

**Durum:** Sadece bağımsız Nathan 2.0 laboratuvarında deneme. Orijinal Nathan GLB,
Supabase ve Gemini tesisine dokunulmaz.

## Gerçek dosyalar (indirilip BU laboratuvarın geliştirme dalına kopyalandı)

| Dosya | Kaynak | Ne yapıyor | Ham kare / süre | Repo |
| --- | --- | --- | --- | --- |
| `83_34.bvh` | CMU MoCap subject 83 take 34 | **Normal yürüyüşle merdiven çıkma** | 968 / 8,06 saniye | `public/mocap/cmu/83_34.bvh` |
| `113_19.bvh` | CMU MoCap subject 113 take 19 | Aynı kayıtta merdiven **çıkma ve inme** | 804 / 6,70 saniye | `public/mocap/cmu/113_19.bvh` |
| `READMEFIRST_CMU_BVH.txt` | B. Hahne | BVH dönüşüm kullanım hakları | Orijinal metin | `public/mocap/cmu/READMEFIRST_CMU_BVH.txt` |

Orijinal dağıtım: https://github.com/una-dinosauria/cmu-mocap/tree/master/data/083
ve https://github.com/una-dinosauria/cmu-mocap/tree/master/data/113.
Mocap kaynağı: https://mocap.cs.cmu.edu/.

### Kullanım izni

CMU MoCap, araştırma ve ürünler içinde kullanımına izin verir fakat ham verinin
**ayrı ürün olarak yeniden satışını** yasaklar. Bruce Hahne, kendi 2010 BVH
dönüşümüne ayrıca kısıtlama koymamıştır. Kaynağın `READMEFIRST` belgesi
arşivde de tutulmaktadır. Kaynağı belirtmek önerilir:

> The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

**Önemli:** Araştırma lisansı / 'ticari değil' bilgisi tek başına ücretli bir
hareket paketini bedelsiz kullanma hakkı vermez. Bu çalışma ücretli Fab
paketlerini ve oturum gerektiren KIT kayıtlarını kullanmıyor.

## Teknik kullanım

- `src/nathan2/cmu-mocap.ts` içindeki `BVHLoader` kaydı okur.
- `SkeletonUtils.retargetClip`, CMU (`Hips`, `LeftUpLeg` vb.) kemiklerini
  Nathan'ın *gerçek* `rp_nathan_animated_003_walking_...` kemiklerine eşler.
- Eşleme **mevcut Nathan modelinin bir klonunda** yapılır; kayıtlı model,
  dokular ve el parmakları yeniden giydirilmez.
- CMU dosyasının ilk sahte T-poz karesi ve normal yerde yürüyüş/duruş
  bölümleri seçilen alt kliplerde kullanılmaz:
    - 83_34 normal çıkış **4,65–7,05 saniye**;
    - 113_19 çıkış **0,87–3,05 saniye**;
    - 113_19 iniş **3,60–5,35 saniye**.
- Yalnızca iskeletin **rotasyonları** yeniden hedeflenir.
  BVH'deki kök/hareket pozisyonu Nathan'ın dünya konumunu değiştirip
  ışınlanma üretmez; gerçek dairesel yörüngeyi `Nathan2Motor` belirler.
- **CMU kaydında tek elle korkuluk tutma kaydı yok.** Bu davranış,
  gerçek tankın dış korkuluk noktasına mevcut Nathan `Hand IK` kuralı ile
  eklenir. Kimseye kayıt içinde korkuluk varmış izlenimi verilmez.
- Aynı laboratuvar menüsünden üç alternatif karşılaştırılır:
    1. CMU 83 normal çıkış + CMU 113 iniş,
    2. CMU 113 çıkış ve iniş,
    3. Nathan'ın önceki yürüyüş animasyonu.

## Yalnızca geliştirici kontrolü

`tests/nathan2-cmu-mocap.test.ts`: İki gerçekten indirilen BVH'yi okur,
kareleri/düzlem ve zamanlarını kontrol eder, gerçek Nathan GLB'yi yükleyip
rotasyonları yeniden hedefler ve animasyonları karakter iskeletinde oynatır.

`tests/nathan2-skin-contact.test.ts`: dış korkuluk ve basamaklarla
**gerçek** avuç/ayak temaslarını kontrol eder.

**Sınır:** Otomatik testler insan gözüyle doğrulanmış doğal yürüyüş anlamına
gelmez. İlk canlı değerlendirmede arkadan ve yandan iskelet hareketi,
adım temposu, merdiven boyunca tek elin korkuluğa temas etmesi,
inişte doğru yüz yönü ayrı izlenmelidir.

## Duruş güvenlik kapısı (2 Kasım 2026)

Resmî CMU kataloğunda Subject 83 genel `steps` hareketleridir.
Subject 113 ise `Post pregnant woman` olarak etiketlidir. Bu bilgi
katılımcının hasta veya yaşlı olduğunu göstermez.

Ancak farklı bir teknik sorun bulduk: Orijinal Nathan'ın kalça–boyun
doğrultusu dünya dikeyine yaklaşık **0,32°** yakınken, CMU 83 hareketi
mevcut `SkeletonUtils.retargetClip` eşlemesiyle Nathan'a aktarılınca
gövde açısı ortalama **91,95°**, en fazla **95,79°** oluyor.
Bu, kaynağın kişinin duruşu değil, bizim **retargeting hatamızdır**.

Bu nedenle `src/nathan2/mocap-quality-gate.ts` tüm dış CMU hareketlerini
**canlı Nathan 2.0 sayfasında geçici olarak devre dışı bırakır**.
Ham CMU kaynakları, laboratuvar araştırma kodu ve gerçek-kemik
testleri korunur. Korkuluk eli ve ayak temasları düzeltilmiş olsa bile,
ayakta duramayan retarget kabul edilemez.

Önce 90° iskelet ekseni/kalça rotasyonu düzeltilecek; sonrasında
kalça-boyun ekseni, diz/ayak, gerçek basamak ve tek-el korkuluk tutuşu
hem otomatik hem görsel olarak doğrulanacak. Kontroller geçmeden
CMU83 veya CMU113 kullanıcıya doğal hareket diye sunulmayacak.
