# GYMSOFT Raspberry Manager v13.5 — Voltaj/Akım ve Alarm Merkezi Düzeltmesi

## Voltaj
Dashboard, Sağlık ve üst widget voltaj değerini doğrudan:
`vcgencmd measure_volts core`
çıktısından gösterir.

Örnek:
`volt=1.3750V` → `1.3750 V`

## Akım
Akım değeri cihaz destekliyorsa PMIC üzerinden gerçek olarak okunur:
- önce `EXT5V_A`,
- yoksa `VDD_CORE_A`,
- ikisi de yoksa `N/A`.

Tahmini amper üretilmez.

## Düşük voltaj
Aktif düşük voltaj bayrağı varsa üst Voltaj widget'ı:
`⚠ DÜŞÜK VOLTAJ`
gösterir.

## Acil Durum Logu
Ayrı Acil Durum Logu kartı kaldırıldı.

Düşük voltaj, aktif throttling ve ölçülebilen kritik güç/akım olayları artık doğrudan Alarm Merkezi içerisinde görünür.

Alarm Merkezi:
- aktif uyarıları,
- son güç/throttling geçmiş kayıtlarını
aynı yerde gösterir.

Geçmiş olaylar `GEÇMİŞ KAYIT` etiketiyle ayrılır.

## Sağlık çıktısı
Sağlık çıktısı teknisyen watch formatına yaklaştırıldı:

Sıcaklık : temp=...
Frekans  : frequency(...)
Voltaj   : volt=...
Akım     : PMIC gerçek ölçümü veya N/A
Durum    : throttled=...

## Teknik not
`vcgencmd measure_volts core` CPU/SoC core voltajıdır; adaptörün doğrudan 5V çıkış voltajı değildir.
Besleme düşük voltaj alarmı için `get_throttled` düşük voltaj bayrağı kullanılmaya devam eder.
