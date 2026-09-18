# Gymsoft Uygulama Merkezi

Gymsoft uygulamalarına tek sayfadan erişim sağlayan statik web sitesi.

## Sayfalar

- `index.html`: Uygulama merkezi / ana sayfa.
- `kart-tasarim.html`: GitHub klasöründen otomatik görsel çeken kart tasarım kataloğu.
- `RaspberryManager/index.html`: Yerel GymsoftAgent üzerinden Raspberry ve turnike yönetimi.
- `Destek/index.html`: Müşterilere açık, kategori ve arama destekli yardım merkezi.
- `Destek/admin.html`: Tek yönetici hesabıyla yazı, görsel ve kategori yönetimi.

Yardım merkezinin Supabase kurulumu, yönetici ataması ve yayınlama adımları: [Destek kurulum kılavuzu](Destek/README.md).
Yardım merkezi paketlerini geliştirmek için Node.js 24 LTS ile `npm ci`, `npm run build` ve `npm run dev` kullanılır. Derlenmiş `Destek/assets` dosyaları repoya dahildir; GitHub Pages ek bir build adımı gerektirmez.

Her iki uygulamadaki sol üst marka bağlantısı ana sayfaya döner. Raspberry Manager, Local Agent çalışırken kullanılabilir.

## Yeni uygulama ekleme

Yeni uygulamanın sayfasını veya klasörünü oluşturun. `index.html` içindeki `app-grid` alanına mevcut `app-card` bağlantılarından birini kopyalayın; bağlantıyı, başlığı ve açıklamayı güncelleyin. Aynı sayfadaki uygulama sayısını da değiştirin. Ana sayfanın stilleri `assets/home.css` dosyasındadır; build adımı gerektirmez.

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
