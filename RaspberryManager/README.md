# Gymsoft Raspberry Manager v11 — Live Device Focus

Bu sürüm kullanıcı geri bildirimine göre sadeleştirildi:

- Üstteki Agent banner ve canlı cihaz çubuğu artık kaydırmada üst üste binmez.
- Cihaz tarama ve SSH doğrulama aynı **Cihazlar** sayfasındadır.
- Müşteri/Salon/Cihaz envanteri kaldırılmıştır.
- Alarm Merkezi yalnızca seçili ve doğrulanmış Raspberry'nin canlı alarmlarını gösterir.
- Son İşlemler yalnızca seçili IP için Agent audit kayıtlarını gösterir.
- Release Durumu seçili Raspberry'deki kurulu release işaretçisini private GitHub reposunun Latest Release'i ile karşılaştırır.
- Private repo karşılaştırması için GitHub token yalnızca istek sırasında kullanılır, kaydedilmez.
- v11 ile GitHub üzerinden yapılan kurulumlarda release tag Raspberry üzerinde `/var/lib/gymsoft/release-version` dosyasına kaydedilir.

> Eski kurulumlarda sürüm işaretçisi yoksa `Kurulu sürüm bilinmiyor` gösterilir. v11 ile yapılan sonraki GitHub kurulumu bunu otomatik oluşturur.
