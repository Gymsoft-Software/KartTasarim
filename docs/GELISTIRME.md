# Geliştirme ve Yayın

[← Dokümantasyon](README.md) · [Dosya düzeni](PROJE_YAPISI.md)

## Yerel kurulum

Node.js 24 ve npm kullanın. Komutları depo kökünde çalıştırın:

```sh
npm ci
npm run build
npm run dev
```

| Sayfa | Yerel adres |
| --- | --- |
| Uygulama Merkezi | http://127.0.0.1:4173/uygulama-merkezi.html |
| Yardım Merkezi | http://127.0.0.1:4173/Destek/ |
| Yazı Yönetimi | http://127.0.0.1:4173/Destek/admin.html |
| Kart Kataloğu | http://127.0.0.1:4173/kart-tasarim.html |
| Raspberry Manager | http://127.0.0.1:4173/RaspberryManager/ |

Yerel sunucu yalnızca `127.0.0.1:4173` üzerinde dinler. Sayfaları `file://` üzerinden açmak yerine sunucuyu kullanın.

## Yapılandırma

| Dosya | Sorumluluk |
| --- | --- |
| [Destek/config.js](../Destek/config.js) | Yardım Merkezi ve Raspberry Manager için paylaşılan Supabase bağlantısı. |
| [assets/kart-tasarim/config.js](../assets/kart-tasarim/config.js) | Kataloğun GitHub deposu, dalı, görsel klasörü ve logosu. |
| [RaspberryManager/config.js](../RaspberryManager/config.js) | Local Agent API adresi ve indirme bağlantısı. |

Supabase kurulumu ve `support_admins` üzerinden yönetici ataması için [teknik kurulum kılavuzunu](../Destek/README.md) kullanın. Yalnızca Auth kullanıcısı oluşturmak yönetim yetkisi vermez. Oturumlar sekmenin `sessionStorage` alanında tutulur; uygulama parolayı saklamaz. Tarayıcıya sunulan ayarlara `service_role`, gizli anahtar veya yönetici parolası eklemeyin.

Kart kataloğunun varsayılan kaynağı `gymsoft-software/KartTasarim`, dalı `main`, klasörü `KartKatalog`'dur. Katalog dosya adları üzerinden arar. Logo değiştirmek için görseli `assets/` altına ekleyip katalog yapılandırmasındaki `logo` değerini güncelleyin. Bu yol katalog HTML sayfasına göre çözülür; örneğin `assets/logo.png`.

Raspberry Manager'ın varsayılan Agent adresi `http://127.0.0.1:5000`'dir. [Bağlantı ve giriş adımları](../RaspberryManager/README.md).

## Derleme

```sh
npm run build
```

| Kaynak | Çıktı |
| --- | --- |
| `Destek/src/public.js` ve `Destek/src/admin.js` | `Destek/assets/` altındaki paketler ve ortak parçalar. |
| `RaspberryManager/src/auth.js` | `RaspberryManager/assets/auth.js`. |

Derlenmiş dosyaları elle düzenlemeyin. Kaynakları değiştirdikten sonra derleyin ve çıktıları kaynaklarla birlikte yayınlayın. `Destek/assets/` altına Quill stilleri ve üçüncü taraf lisans bilgileri de kopyalanır.

Kart kataloğu dosyaları, Uygulama Merkezi ve Raspberry Manager'ın `app.js` / `app.css` dosyaları doğrudan kullanılır; bunlar için ayrıca paketleme yapılmaz.

## Kontroller

```sh
npm run check:docs
npm test
npm run test:e2e
```

- Belge kontrolü güncel Markdown belgelerindeki yerel dosya ve görsel bağlantılarını doğrular. Geçmiş sürüm arşivi kontrolün dışındadır.
- Birim ve veritabanı testleri Node.js ve yerel PGlite kullanır.
- Tarayıcı testleri Playwright ile izole API yanıtları üzerinde çalışır; canlı Supabase verisini değiştirmez.

Windows'ta kurulu Microsoft Edge kullanılır. Diğer sistemlerde `npx playwright install chromium` ile tarayıcıyı hazırlayın. Gerçek Supabase Auth, Storage ve RLS doğrulaması testlerdeki örnek yanıtların kapsamı dışındadır.

## Rehber ekran görüntülerini yenileme

```sh
node scripts/capture-help-guide.mjs
node scripts/capture-card-guide.mjs
```

İlk komut `docs/yardim-merkezi/gorseller/`, ikincisi `docs/kart-tasarim/gorseller/` altındaki PNG dosyalarını yeniler. Yardım Merkezi örnek verilerle, katalog depodaki kartlarla açılır. Canlı veriye yazılmaz. Kart rehberi akışı `alpagu ön.png` ve `alpagu arka.png` dosyalarını kullanır.

Görselleri yeniledikten sonra ilgili kullanım rehberindeki metinlerin ve ekran görüntüsü tarihinin güncel olduğunu kontrol edin.

## Yayın ve erişim

Mevcut düzen GitHub Pages / Jekyll ile **`main` dalı, depo kökü (`/`)** yayını için hazırlanmıştır.

1. Kaynak değişiklikleri için `npm run build` çalıştırın.
2. Belge bağlantılarını ve değişiklikle ilgili testleri kontrol edin.
3. Kaynakları, derlenmiş çıktıları ve değişen rehber görsellerini birlikte repoya gönderin.
4. GitHub Pages yayını tamamlandığında etkilenen sayfaları ve giriş akışını kontrol edin.

Yayın adresi: https://gymsoft-software.github.io/KartTasarim/

Sunucuda Node.js gerekmez; derlenmiş çıktılar repoda bulunur. `_config.yml` geliştirme kaynaklarını, testleri ve tarihsel arşivleri yayından çıkarır. Üç uygulama ve Uygulama Merkezi yayın kapsamındadır. `.nojekyll` eklemek veya filtrelenmemiş depo yüklemesine geçmek dışlama kurallarını devre dışı bırakır.

GitHub Pages statik dosyaları herkese sunar; Raspberry Manager giriş ekranı kaynakları ve EXE indirmesini gizlemez. Supabase kontrolü panelin başlatılmasını yönetir; yerel Agent API'sine sunucu taraflı Supabase doğrulaması eklemez. Cihaz işlemleri Local Agent ve SSH kimlik doğrulaması üzerinden yürür. Yardım Merkezi veri ve medya erişimini Supabase kuralları uygular.
