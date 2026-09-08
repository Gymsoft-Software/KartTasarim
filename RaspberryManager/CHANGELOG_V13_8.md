# GYMSOFT Raspberry Manager v13.8

## 1. Çoklu HDMI / Ekran Yönetimi
- Sabit `HDMI-A-1` varsayımı kaldırıldı.
- Wayland için `wlr-randr`, X11 için `xrandr`, fallback olarak `/sys/class/drm` kullanılarak ekranlar otomatik keşfedilir.
- Birden fazla HDMI çıkışı ayrı ayrı listelenir.
- Her ekran için:
  - bağlı / bağlı değil durumu
  - aktif çözünürlük
  - yenileme hızı
  - konum
  - dönüş
  - desteklenen modlar
  - veri kaynağı
  gösterilir.
- Seçili HDMI çıkışına çözünürlük ve dönüş ayarı uygulanabilir.
- Her HDMI için kalıcı ekran ayarı ayrı tutulur.
- Screenshot:
  - HDMI-A-1
  - HDMI-A-2
  - diğer bağlı çıkışlar
  - tüm masaüstü
  seçenekleriyle alınabilir.
- Ekran & Donanım sayfası açıldığında HDMI çıkışları otomatik taranır.

## 2. SSH Bağlantısı
- Ayrı `Raspberry Pi'yi Doğrula / SSH bağlantısı yap` butonu kaldırıldı.
- Cihaz işlemleri sırasında Agent SSH bağlantısını ve Raspberry kimliğini otomatik doğrular.
- `SSH CMD Aç` özelliği korunur.
- Kullanıcı adı ve parola yine SSH işlemleri için gereklidir.

## 3. Türkçe Sağlık / Arıza Sorgusu v2
- Ham log içinde kelime arayan eski yaklaşım v13.8 sağlık sorgusunda kullanılmaz.
- Raspberry üzerinde yapılandırılmış JSON sağlık verisi üretilir ve Türkçe yorum bu alanlardan yapılır.
- Böylece tanılama komutunun kendi metninden kaynaklanan:
  - yanlış `gc3.py DOSYA YOK`
  - yanlış `Chromium kapalı`
  - yanlış `Gateway HATA`
  gibi pozitifler engellenir.
- `gc3.py` event-driven çalışma mantığı doğru değerlendirilir.
- Throttled aktif/geçmiş bitleri ayrı yorumlanır.
- Core voltajın adaptör 5V voltajı olmadığı açıkça belirtilir.
- Kernel undervoltage / EXT4 / mmc / I/O / watchdog / thermal kayıtları ayrı teknik kayıtlar olarak gösterilir.

## 4. Yeni GirCik PHP Tasarım Sayfası
Sidebar'a `GirCik PHP` sayfası eklendi.

Desteklenen ayarlar:
- Arka plan rengi
- Metin rengi
- Vurgu rengi
- QR büyüklüğü `%15 - %70`
- QR konumu:
  - Üst
  - Merkez
  - Alt
- Merkez içerik:
  - Yazı
  - Logo
  - Boş
- `Kartınızı Okutun` metnini değiştirme veya kaldırma
- Merkez logo yükleme ve boyutlandırma
- Üst alan:
  - Yok
  - Yazı
  - Görsel
- Alt alan:
  - Yok
  - Yazı
  - Görsel
- Üst/alt görsellerin yüzdelik boyutu
- 1280x720 / 1024x768 / 1920x1080 canlı önizleme
- Geometrik merkez ve güvenli alan göstergeleri

QR dokunmatik işlem gerektirmez ve sürekli görünür olacak şekilde tasarlanmıştır.

## 5. GirCik Güvenliği / Yedekleme
- Tasarım değerleri `/var/www/html/turnx/inc/gircik-ui.json` içinde saklanır.
- Üretilen görünüm `/var/www/html/turnx/inc/gircik-ui.php` üzerinden yüklenir.
- Kullanıcıya serbest HTML/PHP kodu yazdırılmaz.
- Metinler escape edilir.
- Görseller en fazla 3 MB ve PNG/JPEG/WEBP/SVG olarak kabul edilir.
- Değişiklik yapılmadan önce:
  `/var/lib/gymsoft/gircik-backups/`
  altında otomatik yedek oluşturulur.
- Yedekler panelden listelenebilir ve seçili tasarım yedeği geri yüklenebilir.

## Korunan Özellikler
- v13.7 açılış / kapanış geçmişi
- Güç geçmişi
- SSH CMD Aç
- Kurulum progress
- Kurulum logu
- reboot sonrası `-1` yanlış hata düzeltmesi
- Alarm Merkezi / throttled açıklamaları
