# GYMSOFT Raspberry Manager v13.7

## Turnike Açılış / Kapanış Geçmişi
Tanı & Log sayfasına kalıcı açılış/kapanış geçmişi eklendi.

Kaydedilen durumlar:
- Raspberry/turnike sistemi açıldı
- kontrollü reboot
- kontrollü shutdown/poweroff
- beklenmeyen kapanma
- düşük voltaj
- aktif throttling
- ARM frekans sınırı
- sıcaklık limiti
- durumun normale dönmesi

Beklenmeyen kapanmada son heartbeat zamanı kullanılarak yaklaşık kapanış zamanı gösterilir.
Sistem kesin nedeni kanıtlayamıyorsa “ani güç kesintisi / reset / sistem çökmesi olabilir” şeklinde olasılık belirtir.
Kapanmadan önce aktif düşük voltaj varsa güç hattı daha güçlü olası neden olarak işaretlenir.

Yeni entegre Raspberry kurulumu izleme servisini otomatik kurar.
Eski cihazlarda `İzlemeyi Etkinleştir` düğmesiyle sonradan kurulabilir.
Eski `last -x` boot/shutdown kayıtları da görüntülenebilir.

## Türkçe Hızlı Arıza Tespiti
Hızlı Arıza Tespiti ham teknik logun üstüne Türkçe teknik anlam ekler:
- KRİTİK: arıza/sorun var
- UYARI: arıza olabilir veya geçmişte sorun yaşanmış
- NORMAL: kontrol normal
- BİLGİ: açıklayıcı teknik bilgi

Özellikle:
- düşük voltaj / throttled bitleri
- sıcaklık
- Apache
- gircik.php
- Chromium
- gc3.py event-driven çalışma mantığı
- root filesystem / SD kart ihtimali
- ağ gateway
- kernel EXT4/mmc/I/O/voltage/watchdog/panic/thermal işaretleri
Türkçe açıklanır.

## SSH CMD Aç
SSH Bağlantısı paneline `SSH CMD Aç` butonu eklendi.
Windows'ta gerçek CMD açılır ve `ssh kullanici@ip` çalıştırılır.
Parola process argümanına yazılmaz; OpenSSH parolayı CMD içinde sorar.

## v13.6 özellikleri korunur
- Kurulum progress
- Kurulum sayfasındaki canlı kurulum logu
- reboot sonrası `exit status -1` yanlış hata düzeltmesi
- voltaj/throttled/Alarm Merkezi geliştirmeleri
