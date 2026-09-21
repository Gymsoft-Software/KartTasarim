# Proje Yapısı ve Dosya Yerleşimi

[← Dokümantasyon](README.md)

Bu depo birden fazla statik web uygulamasını tek GitHub Pages yayını altında tutar. Uygulamaların var olan adreslerini korumak için web giriş dosyaları taşınmaz; kaynak dosyaları ve belgeler sorumluluklarına göre gruplanır.

## Hangi dosya nereye eklenir?

| İçerik | Konum | Kural |
| --- | --- | --- |
| Ortak uygulama girişi | `uygulama-merkezi.html`, `assets/home.css` | Uygulama kartları ve ortak giriş görünümü. |
| Kart kataloğu kodu | `assets/kart-tasarim/` | `app.js`, `style.css` ve `config.js` aynı uygulamaya aittir. |
| Kart görselleri | `KartKatalog/` | Yalnızca katalogda gösterilecek görseller. Rehber ekran görüntülerini buraya koymayın. |
| Yardım Merkezi kaynakları | `Destek/src/` | Derleme gerektirir; çıktı `Destek/assets/` altındadır. |
| Yardım Merkezi veritabanı | `Destek/supabase/` | Şema ve erişim kuralları. |
| Raspberry yönetim arayüzü | `RaspberryManager/` | Cihaz paneli, Agent ayarları ve indirme dosyaları. |
| Raspberry giriş kaynakları | `RaspberryManager/src/` | Derlenen giriş kodu; çıktı `RaspberryManager/assets/` altındadır. |
| Kullanım rehberleri | `docs/<uygulama>/KULLANIM_REHBERI.md` | Görseller aynı klasördeki `gorseller/` altında tutulur. |
| Geliştirme belgeleri | `docs/` | Uygulamalar arası kurulum, test, yayın ve dosya düzeni. |
| Uygulamaya özel teknik başlangıç | Uygulama klasörünün `README.md` dosyası | Güncel giriş ve kurulum bilgisi; ayrıntılara bağlantılar. |
| Tarihsel sürüm belgeleri | `docs/raspberry-manager/arsiv/` | Eski açıklamalar korunur; güncel kullanım talimatı olarak sunulmaz. |
| Otomasyon | `scripts/` | Derleme, yerel sunucu, belge kontrolü ve ekran görüntüsü komutları. |
| Testler | `tests/`, `tests/browser/` | Birim/veritabanı ve tarayıcı kontrolleri. |

## Korunan adresler

| Dosya | Neden korunuyor? |
| --- | --- |
| `index.html` | Ana web adresi Yardım Merkezi'ne yönlenmeye devam eder. |
| `uygulama-merkezi.html` | Uygulamaların ortak giriş adresi. |
| `kart-tasarim.html` | Mevcut katalog bağlantıları değişmez. |
| `Destek/index.html`, `Destek/admin.html` | Ziyaretçi ve yönetici adresleri korunur. |
| `RaspberryManager/index.html` | Cihaz panelinin adresi korunur. |
| `KART_TASARIM_REHBERI.md`, `Destek/KULLANIM_REHBERI.md` | Eski belge bağlantılarından yeni rehberlere geçiş sağlar; asıl içerik bu dosyalarda tutulmaz. |

`assets/kart-tasarim/` dosyalarına referanslar katalog HTML'inde güncellenmiştir. `KartKatalog/` adı GitHub üzerinden yükleme yapılandırmasının parçasıdır; değiştirilecekse yapılandırma ve ekran görüntüsü betiği birlikte güncellenmelidir.

## Yeni uygulama ekleme

1. Uygulamayı kendine ait bir klasörde oluşturun. Yeni uygulamanın kodunu başka uygulamanın `assets/` klasörüne koymayın.
2. Uygulama README'sinde amacını, giriş sayfasını, yapılandırmasını ve yerel kullanımını açıklayın.
3. `uygulama-merkezi.html` içindeki `app-grid` alanına bir kart ekleyin ve uygulama sayısını güncelleyin.
4. Ana README'nin uygulamalar tablosuna ekleyin; kullanım belgelerini `docs/` dizinine bağlayın.
5. Kaynak/özel geliştirme dosyaları için `_config.yml` yayın kapsamını kontrol edin.
6. Derleme gerekiyorsa `scripts/build.mjs` içine ekleyin; bağlantıları ve uygulamanın akışını doğrulayın.

## Belge bakımı

Belgelerde görsel ve dosya bağlantıları bulundukları Markdown dosyasına göre göreli yazılır. Örneğin kullanım rehberinden görsele `gorseller/01-katalog.png`, depo köküne `../../README.md` ile ulaşılır.

Bir belgeyi taşırken bağlantılarını, ona bağlantı veren belgeleri ve ekran görüntüsü betiğinin çıktı yolunu birlikte güncelleyin. Ardından `npm run check:docs` çalıştırın. Derlenmiş JavaScript'i, test çıktısını veya kişisel notları dokümantasyon klasörüne eklemeyin.

`node_modules/`, `test-results/`, `playwright-report/` ve `.env` dosyaları `.gitignore` ile sürüm takibinin dışında tutulur. Derlenmiş web paketleri mevcut GitHub Pages düzeni gereği repoda tutulur.
