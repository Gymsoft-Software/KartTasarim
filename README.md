# Kart Tasarım Kataloğu

Modern, responsive ve GitHub klasöründen otomatik görsel çeken kart katalog sitesi.

## GitHub ayarı

`assets/config.js` dosyasını aç:

```js
window.KATALOG_CONFIG = {
  owner: "mesut-atakan",
  repo: "KartTasarim",
  folder: "KartKatalog",
  branch: "main",
  logo: "assets/logo-placeholder.svg"
};
```

Repo veya branch farklıysa sadece burayı değiştir.

## Logo ekleme

Kendi logonu örneğin `assets/logo.png` olarak koy ve config.js içinde:

```js
logo: "assets/logo.png"
```

olarak değiştir.

## GitHub Pages ile yayınlama

1. Bu dosyaları repo'nun yayınlanacak klasörüne yükle.
2. GitHub > Settings > Pages bölümüne gir.
3. Branch olarak `main`, klasör olarak sitenin bulunduğu kökü seç.
4. Site açıldığında katalog, GitHub API üzerinden `KartKatalog` klasöründeki görselleri otomatik listeler.

> Not: Repo private ise tarayıcı üzerinden kimliksiz GitHub API erişimi çalışmayabilir. Public repo önerilir.

## Desteklenen görseller

PNG, JPG, JPEG, WEBP, GIF, AVIF

## Kart oranı

Kartlar 525 × 824 px oranına göre gösterilir. Farklı ölçüler de çalışır; görsel `cover` olarak kutuya oturur.
