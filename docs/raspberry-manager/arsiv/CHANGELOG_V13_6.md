# GYMSOFT Raspberry Manager v13.6 — Kurulum Progress + Inline Log + Reboot Fix

## 1. Kurulum Progress eklendi

Kurulum sayfasında `Kurulumu Başlat` butonunun hemen altında canlı progress bar bulunur.

Gösterilen bilgiler:
- yüzde (`0% → 100%`)
- o anki kurulum aşaması
- durum (`Bekliyor / Çalışıyor / Tamamlandı / Hata`)

Başlıca aşamalar:
- SSH bağlantısı
- Raspberry doğrulama
- yedek
- kurulum dosyalarının aktarılması
- GitHub / Release işlemleri
- web dosyaları
- PHP / servis ayarları
- Labwc / kiosk / Chromium
- tamamlanma ve reboot

Private repodaki eski/farklı Pi scriptlerinde bütün standart log mesajları bulunmasa bile
`[GYMSOFT]` logları ilerlemeyi kademeli olarak artırır.

## 2. Kurulum Logu Kurulum sayfasına taşındı

Eski:
`Tanı & Log → Kurulum Logu`

Yeni:
`Kurulum → Progress → Kurulum Logu`

Progress ve log artık kurulum seçeneklerinin hemen altında, aynı kart içerisinde bulunur.

`Logu Temizle` butonu eklendi.

## 3. Reboot sonrası yanlış "Hata kodu -1" düzeltildi

Önceki davranış:
- script `Kurulum tamamlandı`
- script `Sistem yeniden başlatılacak`
- Raspberry reboot eder
- SSH kapanır
- Paramiko exit status `-1`
- panel yanlışlıkla `Hata` gösterirdi

v13.6 davranışı:
- kurulum tamamlanma markerı görüldüyse,
- reboot kullanıcı tarafından seçildiyse,
- SSH reboot nedeniyle kapanırsa,

işlem:
`BAŞARILI · Raspberry yeniden başlatılıyor`
olarak sonuçlanır.

Log:
`Raspberry yeniden başlatıldığı için SSH bağlantısı kapandı. Bu beklenen bir durumdur.`

şeklinde açıklama gösterir.

## 4. Job API genişletildi

Kurulum işlerinde artık:
- `progress`
- `phase`
- `rebooting`
- `exit_code`

bilgileri tutulur.

Frontend progress bar bu gerçek job durumu üzerinden güncellenir.
