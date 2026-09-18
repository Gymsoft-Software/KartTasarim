# Gymsoft Uygulama Merkezi

Müşterilere açık yardım sitesi ve yalnızca yerelde kullanılan uygulama merkezi.

## Sayfalar

- `index.html`: Müşterileri Yardım Merkezi'ne yönlendirir.
- `uygulama-merkezi.html`: Yerel uygulama merkezi; GitHub Pages'te yayınlanmaz.
- `kart-tasarim.html`: GitHub klasöründen otomatik görsel çeken kart tasarım kataloğu.
- `RaspberryManager/index.html`: Yerel GymsoftAgent üzerinden Raspberry ve turnike yönetimi; klasörün tamamı GitHub Pages yayınından çıkarılır.
- `Destek/index.html`: Müşterilere açık, kategori ve arama destekli yardım merkezi.
- `Destek/admin.html`: Tek yönetici hesabıyla yazı, görsel ve kategori yönetimi.

Yardım merkezinin Supabase kurulumu, yönetici ataması ve yayınlama adımları: [Destek kurulum kılavuzu](Destek/README.md).
Yardım merkezi paketlerini geliştirmek için Node.js 24 LTS ile `npm ci`, `npm run build` ve `npm run dev` kullanılır. Derlenmiş `Destek/assets` dosyaları repoya dahildir; GitHub Pages ek bir build adımı gerektirmez.

Yardım Merkezi'nde uygulama merkezine bağlantı bulunmaz. Raspberry Manager'ı kullanmak için `npm run dev` çalıştırıp `http://127.0.0.1:4173/uygulama-merkezi.html` adresini açın. Local Agent da çalışıyor olmalıdır. Geliştirme sunucusu yalnızca `127.0.0.1` üzerinde dinler.

## Yayın sınırı

`_config.yml`, `RaspberryManager` klasörünü (JavaScript, yapılandırma ve indirmeler dahil) ve `uygulama-merkezi.html` dosyasını Jekyll yayınından çıkarır. Genel siteye doğrudan eski yönetim adresleriyle gelenler 404 almalıdır. Bu yapılandırmayı atlayan `.nojekyll` veya repo kökünü olduğu gibi yükleyen bir Actions yayını kullanmayın. Yayından sonra `/RaspberryManager/`, `/RaspberryManager/app.js` ve `/uygulama-merkezi.html` adreslerinin 404 döndüğünü doğrulayın.

Bu sınır GitHub Pages yayını içindir. GitHub deposu herkese açık olduğu sürece kaynak dosyaları ve geçmiş sürümleri GitHub üzerinden indirilebilir; yayından çıkarmak bunları gizlemez. Kaynakların da müşterilere kapalı olması gerekiyorsa Raspberry Manager özel bir depoya taşınmalı ve mevcut açık depo/geçmiş erişimi ayrıca düzenlenmelidir. Web üzerinden özel yönetim için dosyaları sunmadan önce kullanıcıyı doğrulayan sunucu taraflı erişim koruması gerekir; tarayıcıdaki bir parola ekranı yeterli değildir.

## Yeni uygulama ekleme

Yeni uygulamanın sayfasını veya klasörünü oluşturun. `uygulama-merkezi.html` içindeki `app-grid` alanına mevcut `app-card` bağlantılarından birini kopyalayın; bağlantıyı, başlığı ve açıklamayı güncelleyin. Dahili uygulamaların klasörlerini `_config.yml` içindeki `exclude` listesine ekleyin. Aynı sayfadaki uygulama sayısını da değiştirin. Ana sayfanın stilleri `assets/home.css` dosyasındadır; build adımı gerektirmez.

## GitHub ayarı

`assets/config.js` şu repo için hazırdır:

```js
window.KATALOG_CONFIG = {
  owner: "gymsoft-software",
  repo: "KartTasarim",
  folder: "KartKatalog",
  branch: "main",
  title: "Kart Tasarım",
  logo: "assets/logo-placeholder.svg"
};
```

## Logo ekleme

Kendi logonu örneğin `assets/logo.png` olarak ekle ve `config.js` içinde:

```js
logo: "assets/logo.png"
```

olarak değiştir.

## GitHub Pages

Repo köküne bu dosyaları yükle. GitHub > Settings > Pages bölümünde `main` branch ve `/ (root)` seçili olmalı.

Site adresi:

`https://gymsoft-software.github.io/KartTasarim/`

## Desteklenen görseller

PNG, JPG, JPEG, WEBP, GIF, AVIF

## Kart oranı

Kartlar 525 × 824 px oranına göre gösterilir.
