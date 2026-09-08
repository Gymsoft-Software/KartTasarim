# GYMSOFT Raspberry Manager v13.8.2 — Stabilite Düzeltmesi

## Kritik düzeltme: Sekmeler çalışmıyordu
v13.8'de Çoklu HDMI arayüzü eklenirken HTML'den kaldırılan üç eski ekran butonunun
JavaScript event listener'ları kalmıştı:

- `displayInfoBtn`
- `displayNormalBtn`
- `displayLabwcBtn`

Sayfa açılır açılmaz JavaScript `null.addEventListener(...)` hatası veriyor ve script
`initPageRouter()` aşamasına ulaşamıyordu. Bunun sonucu:

- Sidebar sekmeleri çalışmıyordu.
- Dashboard bölümleri `page-active` alamadığı için görünmüyordu.
- Dashboard sanki silinmiş gibi görünüyordu.

v13.8.2'de eksik/opsiyonel buton event'leri güvenli hale getirildi ve router,
opsiyonel Dashboard modüllerinden önce başlatılıyor.

## Dashboard geri getirildi / korundu
v13.7 Dashboard bileşenlerinin tamamının v13.8.2 HTML'inde mevcut olduğu regresyon
kontrolü ile doğrulandı. Aşağıdaki ana Dashboard öğeleri korunuyor:

- seçili Raspberry bilgisi
- sıcaklık
- CPU
- RAM
- disk
- Apache
- gc3.py
- sağlık puanı
- Alarm Merkezi
- Son İşlemler
- hızlı işlemler / canlı durum

Sorunun içerik silinmesi değil, JavaScript başlangıç hatası nedeniyle Dashboard'ın
gizli kalması olduğu doğrulandı.

## SSH butonu kaldırıldıktan sonraki eksik akış düzeltildi
v13.8'de manuel `Raspberry Pi'yi Doğrula / SSH Bağlan` butonu kaldırılmıştı fakat
Dashboard canlı durum, alarm, son işlemler ve kurulum akışlarının bazıları hâlâ
`verifiedDevices` durumunu bekliyordu.

v13.8.2 ile:

- Cihaz seçilince SSH kullanıcı/parola mevcutsa Raspberry otomatik doğrulanır.
- SSH kullanıcı adı veya parola değişince otomatik yeniden doğrulama yapılır.
- Canlı Dashboard gerekirse doğrulamayı kendisi başlatır.
- Kurulum butonu manuel doğrulama istemez; otomatik doğrular.
- Aynı anda birden fazla doğrulama isteği oluşması promise tabanlı kilitleme ile önlendi.
- `SSH CMD Aç` korunur.

## Çoklu HDMI korunuyor
v13.8 özellikleri korunur:

- Birden fazla HDMI çıkışını otomatik keşfetme
- Her HDMI için otomatik çözünürlük/mod listesi
- Her HDMI için ayrı dönüş/çözünürlük işlemi
- HDMI bazlı screenshot
- Tüm masaüstü screenshot
- Wayland / X11 / DRM fallback

Ek olarak X11 screenshot komutundaki regex/sed backslash ifadeleri Python raw f-string
haline getirildi. Böylece `\1`, `\2` gibi sed backreference değerlerinin Python
tarafından kontrol karakterine çevrilme riski kaldırıldı.

## Türkçe Sağlık Sorgusu v2 korunuyor
Structured JSON tabanlı sağlık sorgusu ve Türkçe yorum sistemi korunur.

## GirCik PHP Tasarım Editörü korunuyor
- QR boyutu ve konumu
- renkler
- merkez yazı / logo / boş
- üst/alt yazı veya görsel
- canlı preview
- otomatik yedek
- yedek geri yükleme
özellikleri korunur.

## Doğrulama
Paket üretiminde:

- Python syntax: OK
- Python SyntaxWarning: 0
- Pages JavaScript syntax: OK
- Agent JavaScript syntax: OK
- Eksik zorunlu event target: 0
- Sidebar link / page / PAGE_META eşleşmesi: OK
- Router başlangıç sırası: OK
- v13.7 Dashboard temel bileşen regresyon kontrolü: OK
