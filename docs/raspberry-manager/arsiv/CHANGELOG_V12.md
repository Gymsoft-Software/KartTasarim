# GYMSOFT Raspberry Manager v12 — Change Log

**Sürüm:** v12 Service Center  
**Tarih:** 25 Ağustos 2026

v12, v11'in seçili-cihaz odaklı yapısını koruyup teknik servis güvenliğini artıran bir güncellemedir. Bu changelog yalnızca v12 paketinde gerçekten uygulanan özellikleri içerir.

## 1. Kurulum Öncesi Kontrol

Raspberry kurulumu başlamadan önce yeni bir ön kontrol ekranı eklendi.

Kontrol edilen zorunlu başlıklar:

- Raspberry Pi doğrulaması
- `apt-get` kullanılabilirliği
- internet erişimi
- DNS çözümleme
- default gateway ve gateway erişimi
- boş disk alanı
- private GitHub repo erişimi (GitHub kurulumu seçiliyse)

Ayrıca Chromium ve Wayland ekran araçlarının mevcut olup olmadığı bilgi amaçlı gösterilir; eksik olmaları tek başına kurulumu engellemez çünkü kurulum scripti bunları yükleyebilir.

GitHub kurulumu seçiliyken zorunlu kontroller başarısızsa **Kurulumu Başlat** işlemi durdurulur.

`Mevcut /var/www/html` modu seçilmişse GitHub kontrolü zorunlu değildir.

## 2. Release Güncellemesi Öncesi Otomatik Yedek

GitHub Latest Release veya belirli bir GitHub Release kurulmadan önce bağlı Raspberry'nin mevcut Gymsoft web yapısı otomatik yedeklenir.

Yedekler Raspberry üzerinde:

```text
/var/lib/gymsoft/backups/
```

altında tutulur.

Yedek kapsamı:

- `/var/www/html`
- `kiosk-start.sh`
- labwc autostart
- Chromium autostart

İlk kurulumda yedeklenecek eski yapı yoksa bu adım otomatik atlanır.

## 3. Release Geçmişi

Raspberry üzerinde release işlem geçmişi tutulmaya başlandı:

```text
/var/lib/gymsoft/release-history.tsv
```

Panelde **Release Geçmişi** butonu ile son işlemler görülebilir.

Kayıtlarda:

- işlem zamanı
- işlem tipi (`backup`, `install`, `rollback`)
- release tag'i
- önceki sürüm / yedek bilgisi

bulunur.

## 4. Release Rollback

Dashboard'daki Release Durumu kartına:

```text
[ Release Geçmişi ]
[ Önceki Sürüme Dön ]
```

aksiyonları eklendi.

Rollback sırasında:

1. mevcut sistem tekrar güvenlik yedeğine alınır,
2. seçilen/son release yedeği geri yüklenir,
3. `/var/www/html` eski yedekle temiz şekilde değiştirilir,
4. release sürüm işaretçisi güncellenir,
5. Apache yeniden başlatılır,
6. rollback işlemi release geçmişine kaydedilir.

Rollback bütün işletim sistemini geri döndürmez; Gymsoft web/kiosk konfigürasyon yedeğini geri yükler.

## 5. Güvenli Statik IP Değişimi

Statik IP işlemi yeniden tasarlandı.

Yeni akış:

1. yeni IP'nin ağda kullanılıp kullanılmadığı kontrol edilir,
2. NetworkManager profilinin mevcut IPv4 ayarları geçici olarak saklanır,
3. yeni statik IP uygulanır,
4. Raspberry üzerinde **90 saniyelik rollback zamanlayıcısı** başlatılır,
5. panel yeni IP üzerinden Raspberry'ye yeniden bağlanmaya çalışır,
6. yeni bağlantı doğrulanırsa rollback iptal edilir,
7. doğrulanamazsa Raspberry eski ağ ayarını otomatik geri yükler.

Bu özellik özellikle uzaktan SSH bağlantısında IP değiştirirken bağlantının kalıcı olarak kaybolma riskini azaltmak için eklendi.

## 6. IP Kullanım / Çakışma Kontrolü

Ağ sayfasına:

```text
[ Yeni IP Boş mu Kontrol Et ]
```

butonu eklendi.

Agent, hedef IP'ye ping ve yaygın servis portları üzerinden erişim kontrolü yapar. Bir cihaz yanıt veriyorsa statik IP işlemi engellenir.

Not: Ağ cihazlarının ping/port yanıtlarını kapatabilmesi nedeniyle sonuç "boş görünüyor" olarak değerlendirilmelidir; mutlak ARP otoritesi değildir.

## 7. Teknik Destek Paketi

Tanı & Log sayfasına:

```text
[ Teknik Destek Paketi Oluştur ]
```

aksiyonu eklendi.

Agent bağlı Raspberry'den tek bir `.tar.gz` paketinde şu bilgileri toplar:

- Raspberry modeli / OS / kernel
- IP, route, gateway ve DNS
- sıcaklık, voltaj, throttled, uptime
- RAM ve disk bilgileri
- Apache / Chromium / gc3.py servis bilgileri
- Apache journal çıktısı
- Chromium kiosk logu
- gc3 logu
- son kernel/dmesg çıktısı
- ekran bilgisi
- `gc3.py`, `daySet.php`, `set.php`, `renk.php` konfigürasyon kopyaları

SSH parolası ve GitHub token bu pakete yazılmaz.

## 8. Sağlık Skoru

Dashboard'a seçili Raspberry için **0–100 Sağlık Skoru** eklendi.

Skoru etkileyen durumlar:

- ağ/default route kaybı
- Apache kapalı
- gc3.py kapalı
- Chromium/kiosk kapalı
- yüksek/kritik sıcaklık
- yüksek CPU
- yüksek RAM
- yüksek disk kullanımı
- throttled bayrağı

Dashboard sağlık etiketi artık örneğin:

```text
NORMAL · 96/100
DİKKAT · 78/100
KRİTİK · 52/100
```

şeklinde görünür.

## 9. Alarm Üzerinden Hızlı Sorun Çözme

Canlı Alarm Merkezi'nde aşağıdaki servis sorunlarında doğrudan çözüm butonu gösterilir:

- Apache kapalı → **Apache Başlat / Restart**
- gc3.py kapalı → **gc3.py Restart**
- Chromium/kiosk kapalı → **Kiosk Başlat / Restart**

İşlem tamamlandıktan sonra canlı durum yeniden okunur.

Alarm Merkezi v11'de olduğu gibi yalnızca **seçili ve doğrulanmış Raspberry'nin** gerçek durumlarını gösterir.

## 10. Cihaz Bazlı Son İşlemler Korundu

Son İşlemler alanı yalnızca seçili IP'ye ait Agent işlem geçmişini göstermeye devam eder.

Başka Raspberry'lerde yapılan işlemler seçili cihazın listesine karışmaz.

## 11. Release Durumu Karşılaştırması Korundu

Kurulu sürüm:

```text
/var/lib/gymsoft/release-version
```

üzerinden okunur ve private GitHub reposundaki **Latest Release** ile karşılaştırılır.

Örnek:

```text
Kurulu: v22.2
Latest: v22.2
GÜNCEL
```

veya:

```text
Kurulu: v22.2
Latest: v23.0
GÜNCEL DEĞİL
```

## 12. Agent Güncelleme Altyapısı

Ayarlar sayfasına Agent güncelleme kontrolü eklendi.

Agent şu manifesti kontrol eder:

```text
RaspberryManager/agent.json
```

Yeni sürüm varsa ve `download_url` tanımlıysa Windows'ta çalışan derlenmiş `GymsoftAgent.exe` yeni EXE'yi indirip kendisini değiştirebilir ve yeniden başlatabilir.

Yayın kanalı için GitHub Pages klasöründe:

```text
RaspberryManager/downloads/GymsoftAgent.exe
```

kullanılır.

Bu özelliğin çalışması için yeni Agent EXE'nin bu adrese ayrıca yüklenmesi gerekir.

## 13. Komut Paleti Güncellemesi

`Ctrl+K` komut paletine yeni kısayollar eklendi:

- Kurulum ön kontrolü
- Teknik destek paketi
- Release geçmişi

## Güvenlik Notları

- SSH parolası kalıcı dosyalara kaydedilmez.
- GitHub token activity/audit log'a yazılmaz.
- Rollback öncesi mevcut sistem yeniden yedeklenir.
- Statik IP değişikliğinde 90 saniyelik otomatik geri dönüş kullanılır.
- Agent yalnızca `127.0.0.1` üzerinde dinlemeye devam eder.
- Teknik destek paketi parola/token içermez; ancak Gymsoft PHP konfigürasyon dosyaları lisans/domain bilgisi içerebilir.
