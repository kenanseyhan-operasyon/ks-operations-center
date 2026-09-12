# KS 3D Atölyesi

Ayrı, sunucuda sahip hesabı doğrulanan 3D çalışma alanı. Mevcut operasyon merkezi aynı kalır.

## Çalışma
Node.js 22 veya 24. Bu dizinde npm install, npm test, npm start.
Gerekli ortam değişkenleri: OWNER_EMAIL, SUPABASE_URL, SUPABASE_ANON_KEY.
OWNER_EMAIL mevcut bulut hesabının doğrulanmış e-postası olmalı.
İsteğe bağlı HF_TOKEN: Hugging Face API/GPU erişimi için. Token yalnızca sunucuda kalır.
TRIPOSR_SPACE varsayılan stabilityai/TripoSR; uyumlu /preprocess ve /generate API uçlarını gerektirir.

## Erişim
Giriş Supabase parola akışı ve /auth/v1/user doğrulamasıyla yapılır.
Sunucu yalnızca OWNER_EMAIL ile eşleşen, e-postası doğrulanmış hesabı kabul eder.
Erişim kontrolü HTML, uygulama dosyaları ve üretim/indirme API uçlarını kapsar.
Oturum çerezi Secure, HttpOnly, SameSite=Strict. CSRF kaynak kontrolü ve giriş hız sınırı vardır.
Parolalar saklanmaz. Oturumlar ve üretilen GLB'ler bellektedir; yeniden başlatmada silinir.
Giriş yapılandırması yoksa sunucu kapalı kalır. Test kimlik doğrulayıcısı yalnızca test kodundaki createApp çağrısına enjekte edilir; üretim ortamından açılabilen test girişi yoktur.

## Düzenleyici
Gömülü verili GLB 2.0 içe aktarma, parça listesi, taşıma/döndürme/ölçekleme, renk, çoğaltma/silme,
şişirme/içeri itme/yumuşatma, yüzey boyayarak parça ayırma, geri alma/yineleme, GLB dışa aktarma.
Model koordinat birimleri korunur. Rig/morph mevcut pozda statik yüzeye dönüştürülür; animasyon düzenleyicisi değildir.
En fazla 50 MB ve 500.000 üçgen. Undo geçmişi 12 adım/128 MB hedef sınırı.
Düzenlemeler otomatik kalıcı kaydedilmez; çıkmadan önce GLB indirin.

## Fotoğraftan üretim
TripoSR'nin gerçek görüntüden mesh çıkaran modeli Gradio API ile çağrılır. Fotoğraf, kullanıcı arayüzündeki gönderim kutusu işaretlendikten sonra üçüncü taraf Hugging Face Space'e iletilir.
Ön işleme ve generate çağrılarının ardından gerçek GLB indirilir, biçimi kontrol edilir ve oturumla korunan uçtan tarayıcıya verilir.
GPU motoru Render ücretsiz CPU hizmetinin içinde çalışmaz. Halka açık Space erişimi/kotası ve HF_TOKEN gerekleri sağlayıcıya bağlıdır; sınırsız/garantili ücretsiz üretim vaat edilmez.
Üretim başarısızlığı bir örnek veya uydurma modele dönüştürülmez.
Fotoğraf 8 MB, GLB sonuç 40 MB sınırı. En fazla bir aktif üretim, iki geçici sonuç, 30 dakika saklama.
Servis yeniden başladığında geçici sonuçlar kaybolur.
engine-probe.json dağıtım sırasında yapılan gerçek üretim denemesinin sonucudur; kullanıcı kimliği doğrulanmış bir oturumu test etmez.

## Test
npm test: bozuk GLB, URL/SSRF sınırları, kimlik doğrulama, CSRF, indirme koruması, logout, UV/material koruyan ayırma, sculpt, undo/redo.
npm run test:browser: Playwright ile giriş kapısı, GLB yükleme/düzenleme/indirme/yeniden açma, mobil boyut ve çıkış.
npm run probe:engine: TripoSR resmi sandalye örneğiyle gerçek GPU üretim denemesi. Sonuç başarısızsa bunu kayıt eder; düzenleyici dağıtımını engellemez.
CI ve Render build test çıktıları ayrı değerlendirilmelidir.

## Kaynaklar / lisanslar
Three.js (MIT): https://github.com/mrdoob/three
Gradio JS client (ISC): https://github.com/gradio-app/gradio/tree/main/client/js
TripoSR (MIT): https://github.com/VAST-AI-Research/TripoSR
Sağlayıcı çalışma alanı: https://huggingface.co/spaces/stabilityai/TripoSR
