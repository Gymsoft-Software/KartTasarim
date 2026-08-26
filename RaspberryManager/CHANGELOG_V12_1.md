# GYMSOFT Raspberry Manager v12.1 — gc3 Event-Driven Düzeltmesi

## Kritik düzeltme
`gc3.py` sürekli çalışan bir servis değildir. Kart/geçiş olayı geldiğinde kısa süreli çalışır ve işlem tamamlandığında kapanır.

## Yapılan değişiklikler
- Dashboard: `AKTİF/KAPALI` yerine `HAZIR / GEÇİŞTE / DOSYA YOK`.
- Process bulunmaması normal kabul edilir.
- Alarm Merkezi process bulunmadığında alarm üretmez.
- Sağlık skoru process bulunmadığı için düşmez.
- Yalnızca `/var/www/html/GymsoftRM/gc3.py` dosyası yoksa alarm oluşur.
- `gc3.py Restart` kaldırıldı; `gc3.py Durumunu Kontrol Et` yapıldı.
- Hızlı Teşhis event-driven modeli gösterir.
- Kiosk açılışında gc3.py otomatik başlatma kaldırıldı.
- `Geçiş İzni Ver` gerektiğinde gc3.py'yi çalıştırmaya devam eder.
