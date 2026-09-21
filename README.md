# Gymsoft Uygulama Merkezi

Müşterilere açık yardım sitesi ve yönetici girişli Raspberry Manager.

Ekran görüntüleriyle kart kataloğu kullanımı: [Kart Tasarım Kullanım Rehberi](KART_TASARIM_REHBERI.md).

## Sayfalar

- `index.html`: Müşterileri Yardım Merkezi'ne yönlendirir.
- `uygulama-merkezi.html`: Uygulama merkezi; Raspberry Manager giriş ekranına bağlantı içerir.
- `kart-tasarim.html`: GitHub klasöründen otomatik görsel çeken kart tasarım kataloğu.
- `RaspberryManager/index.html`: Yardım Merkezi ile aynı Supabase yönetici hesabını kullanan Raspberry ve turnike yönetimi.
- `Destek/index.html`: Müşterilere açık, kategori ve arama destekli yardım merkezi.
- `Destek/admin.html`: Tek yönetici hesabıyla yazı, görsel ve kategori yönetimi.

Yardım merkezinin Supabase kurulumu, yönetici ataması ve yayınlama adımları: [Destek kurulum kılavuzu](Destek/README.md).
Yardım merkezi paketlerini geliştirmek için Node.js 24 LTS ile `npm ci`, `npm run build` ve `npm run dev` kullanılır. Derlenmiş `Destek/assets` dosyaları repoya dahildir; GitHub Pages ek bir build adımı gerektirmez.

Yardım Merkezi'nde uygulama merkezine bağlantı bulunmaz. Raspberry Manager adresi: `https://gymsoft-software.github.io/KartTasarim/RaspberryManager/`. Yardım Merkezi için Supabase Authentication'da oluşturduğunuz e-posta ve parolayla giriş yapın. Hesabın mevcut `support_is_admin` kontrolünden geçmesi gerekir; yeni hesap veya parola oluşturulmaz.

Yerelde `npm run dev` ardından `http://127.0.0.1:4173/RaspberryManager/` adresini kullanabilirsiniz. Agent çalışmıyorsa indirme ekranındaki **Panele devam et** düğmesi paneli açar; ağ taraması ve SSH işlemleri için GymsoftAgent.exe çalışmalıdır.

## Yayın ve giriş

Raspberry Manager ve uygulama merkezi GitHub Pages'te yayınlanır. Giriş paketi `npm run build` ile üretilir ve repoya dahildir. Supabase yapılandırması `Destek/config.js` üzerinden paylaşılır. Oturum sekmenin sessionStorage alanında saklanır; parola saklanmaz. Panel kodu yalnızca oturum ve yönetici yetkisi doğrulandıktan sonra çalıştırılır.

GitHub Pages statik dosyaları herkese sunar; giriş ekranı kaynak dosyalarını veya EXE indirmesini gizlemez. Bu değişiklik yerel Agent API'sine sunucu taraflı Supabase doğrulaması eklemez. Cihaz işlemleri mevcut yerel Agent ve SSH kimlik doğrulaması üzerinden yürür.

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
