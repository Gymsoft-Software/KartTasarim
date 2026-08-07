# Kart Tasarım Kataloğu

Modern, responsive ve GitHub klasöründen otomatik görsel çeken kart katalog sitesi.

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
