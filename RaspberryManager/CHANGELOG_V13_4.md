# GYMSOFT Raspberry Manager v13.4 — Güç Telemetrisi ve Acil Durum Logu

## Yeni özellikler
- Raspberry Pi 5 üzerinde `vcgencmd pmic_read_adc` ile `EXT5V_V` 5V besleme voltajı okunur.
- `VDD_CORE_V` ve `VDD_CORE_A` ile core voltajı ve core akımı Dashboard/Health alanlarında gösterilir.
- `VDD_CORE_A` toplam Raspberry giriş akımı olarak gösterilmez; açıkça core ray akımı olarak etiketlenir.
- PMIC doğrudan toplam 5V giriş akımı vermiyorsa `Giriş Akımı: N/A` gösterilir ve kesin ölçüm için INA219/INA226 veya USB-C güç ölçer gerektiği belirtilir.
- Üst canlı durum widget'ına `Besleme` ve `Core Akım` göstergeleri eklendi.
- Aktif düşük voltajda üst widget `⚠ DÜŞÜK VOLTAJ` gösterir.
- 5V besleme < 4.63V veya throttled bit 0 aktifse kritik düşük voltaj alarmı oluşturulur.
- 4.63V–4.80V aralığı düşük besleme uyarısı olarak değerlendirilir.
- Aktif güç/throttling olayları `Acil Durum Logu`na cihaz bazlı ve tekrarları sınırlanmış şekilde kaydedilir.
- Acil Durum Logu `%LOCALAPPDATA%\Gymsoft\RaspberryManager\emergency.jsonl` dosyasında tutulur.
- Sağlık skoru aktif düşük voltaj / düşük besleme durumunu hesaba katar.
- Teknik destek paketine PMIC ADC çıktısı eklendi.

## Ölçüm notu
Raspberry Pi 5 PMIC, `EXT5V_V` ile gerçek 5V besleme voltajını ve bazı iç güç raylarının voltaj/akımlarını gösterebilir. Ancak `VDD_CORE_A`, cihazın toplam giriş amperi değildir. Toplam 5V giriş akımını kesin ölçmek için harici akım sensörü veya USB-C güç ölçer gerekir.
