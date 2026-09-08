# GYMSOFT Raspberry Manager v13.8.3

## GirCik animasyonu düzeltildi

v13.8 / v13.8.2 GirCik Designer tarafından üretilen overlay artık mevcut GirCik
arka plan animasyonunu varsayılan olarak değiştirmez veya kapatmaz.

Yeni varsayılan:

- `Animasyon Davranışı = Varsayılan animasyonu koru`
- `Animasyon Hızı = 100%`
- Mevcut GirCik animasyonu olduğu gibi çalışmaya devam eder.
- Designer overlay arka planı şeffaftır.
- `body` için yalnızca fallback arka plan rengi verilir; animasyon katmanı kaldırılmaz.

Eski `gircik-ui.json` dosyalarında animasyon alanı yoksa otomatik olarak
`keep / 100%` kabul edilir.

## Yeni animasyon seçenekleri

GirCik PHP > Arka Plan Animasyonu:

1. `Varsayılan animasyonu koru`
   - önerilen ve varsayılan seçim
   - mevcut animasyona müdahale edilmez

2. `Animasyonu açık tut · hızını ayarla`
   - %25 ile %200 arasında hız
   - %25: çok yavaş
   - %100: normal
   - %200: 2× hızlı
   - CSS/Web Animations API ve HTML5 video playback rate üzerinden uygulanır

3. `Animasyonu kapat`
   - CSS animasyonları duraklatılır
   - transition süreleri kapatılır
   - HTML5 videolar durdurulur

Bilinmeyen uygulamaya özel `requestAnimationFrame/canvas` koduna güvenlik nedeniyle
zorla müdahale edilmez.

## Detaylı GirCik önizleme

Eski basit preview yerine daha ayrıntılı turnike ekranı simülasyonu eklendi:

- cihaz çerçevesi
- çözünürlük ve aspect ratio
- geometrik merkez crosshair
- üst / alt alan sınırları
- güvenli alan göstergeleri
- QR konumu
- QR boyutu yüzdesi
- yaklaşık QR piksel boyutu
- merkez içerik tipi
- üst / alt içerik özeti
- animasyon modu ve hız göstergesi
- kılavuzları aç / kapat
- 1280×720
- 1024×768
- 1920×1080

Preview içerisindeki hareketli arka plan gerçek animasyonun kendisi değildir;
seçilen animasyon davranışını anlaşılır biçimde temsil eder.

## Gerçek Raspberry önizlemesi

GirCik sayfasına `Gerçek Raspberry Önizlemesi` bölümü eklendi.

- bağlı HDMI çıkışlarını otomatik listeler
- HDMI-A-1 / HDMI-A-2 gibi ekranlar seçilebilir
- seçilen HDMI'nın gerçek screenshot'ı GirCik Designer içinde gösterilir
- `Tüm Masaüstü` seçeneği de bulunur

Bu sayede tasarım Raspberry'ye uygulandıktan sonra ayrı bir sayfaya gitmeden gerçek
sonuç kontrol edilebilir.

## Korunan özellikler

v13.8.2 stabilite düzeltmeleri ve v13.8 özellikleri korunur:

- çalışan sidebar sekmeleri
- Dashboard
- otomatik SSH doğrulama
- çoklu HDMI
- ekran bazlı screenshot
- structured Türkçe Sağlık Sorgusu
- GirCik renk / QR / logo / üst / alt alan düzenleme
- GirCik otomatik yedek / geri yükleme
- açılış / kapanış geçmişi
- SSH CMD Aç
