# KS Aviation — Nathan 2.0 Bağımsız Hareket Laboratuvarı

**Kullanıcı isteği:** Mevcut tesis, modeller ve kayıtlar silinmeden Nathan için temiz ve bağımsız yürüme/spiral merdiven sistemi kurmak.

## Şu anda çalışan kapsam

- Orijinal Nathan GLB modeli ve daha önce hazırlanmış el/ayak IK iskelet adaptörü korunur.
- **Yeni ve bağımsız hareket motoru:** `src/nathan2/engine.ts`; eski `NathanController` ve ana tesis olay yöneticisi **import edilmez**.
- Gerçek tank `tankStairLayout` geometrisiyle normal yürüyüşte spiral çıkış ve iniş.
- 1x normal yürüyüş; 2x/4x **yalnızca test hızlandırması**, animasyon değişmez.
- Hareket motorunda fiziksel basamak yüksekliğine referanslı iki ayak hedefi ve tanka uzak dış el için korkuluk IK hedefi.
- Hareketi sıfırlama, durdurma, 3D kamerayı döndürme, yandan gösterme ve temas noktası işaretleri.
- Gerçek GLB kaynaklarının root-motion tekrarını önlemek için ayrı laboratuvar dalındaki in-place temizleyici korunur.
- Yön (saat yönü/tersi), tank rotasyonu, 1x/4x ve gerçek merdiven çıkış/inişi için Node otomatik testleri.

## Deneme adresi

Ayrı Render sitesi oluşturulduysa URL'yi Render hizmetinin kaydından alın.
Kaynak GitHub dalı: `lab/nathan2-independent-20261102`
Vite çok sayfalı giriş: `/nathan2-lab.html`

## Yerel geliştirme

Bu dosyaları **KS Operations Center repo içindeki `ks-aviation-digital-twin/`** dizinine uygulayın; orijinal GLB büyük olduğundan ZIP'te **bulunmaz**. Depodaki `model-parts/nathan` + `scripts/extract-nathan.mjs` kullanılır.

```bash
cd ks-aviation-digital-twin
npm ci
npm run pretest
npm run dev
```

Tarayıcıda `http://localhost:5173/nathan2-lab.html` adresini açın.

Test:

```bash
npx esbuild tests/nathan2-engine.test.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/nathan2-engine.mjs
node node_modules/.cache/nathan2-engine.mjs
npm run build
```

## Tamamlanmış sayılmayanlar

Bu **ilk bağımsız sürümde** R14 arka dikey merdiveni, R14 kabine gerçek giriş/çıkış, vana, su monitörü ve kapı etkileşimleri **henüz uygulanmadı**. Önce gerçek karakterin spiral merdivendeki görsel doğal yürüyüşünü doğrulamak gerekir. Otomatik testin geçmesi profesyonel animasyon kalitesinin kanıtı değildir.

## Kullanılan araçların lisansı

- Three.js r186 — MIT, mevcut projenin kurulmuş bağımlılığı. Yeni bağımlılık indirmiyoruz.
- Nathan GLB — kullanıcının kendi mevcut karakteri (repo içinde zaten mevcut).
- Quaternius Universal Animation Library Standard — CC0, **araştırıldı ama otomatik indirilip içeri aktarılmadı**. Kaynak: https://quaternius.itch.io/universal-animation-library.
- Bu bağımsız hareket motorunun kodu, KS Aviation projesi için yeni yazılmıştır.

## Güvenlik

Gemini test canlısı, Supabase kayıtları ve `ks-3d-test` canlı yayın dalı bu laboratuvar tarafından değiştirilmez. Render varsa **yeni ve ayrı** statik site kullanılır.