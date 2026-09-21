# GYMSOFT Raspberry Manager v12 — Sizin Yapmanız Gerekenler

## 1. Mevcut v11'i saklayın

- Eski `GymsoftAgent.exe` dosyasını `GymsoftAgent-v11.exe` adıyla yedekleyin.
- GitHub'daki mevcut `RaspberryManager` klasörünün bir kopyasını alın.

## 2. GitHub Pages arayüzünü v12 ile değiştirin

`raspberry_manager_pages_v12_service_center.zip` içindeki `RaspberryManager` klasörünü:

```text
Gymsoft-Software/KartTasarim/RaspberryManager/
```

konumuna yükleyin.

Commit/push sonrası GitHub Pages deployment'ın tamamlanmasını bekleyin ve sayfayı `Ctrl+F5` ile yenileyin.

## 3. Yeni GymsoftAgent.exe oluşturun

`GymsoftAgent_v12_build_source.zip` dosyasını Windows bilgisayarda çıkarın.

```bat
build_windows.bat
```

çalıştırın.

Yeni EXE:

```text
dist\GymsoftAgent.exe
```

olacaktır.

## 4. Bir test bilgisayarında yeni EXE'yi çalıştırın

- v11 Agent'ı kapatın.
- yeni `GymsoftAgent.exe`yi çalıştırın.
- Web panelinde Agent sürümünün `v12-service-center` olduğunu kontrol edin.

## 5. Önce tek bir test Raspberry kullanın

Sırasıyla test edin:

1. Ağ Tara
2. SSH Doğrula
3. Kurulum Öncesi Kontrol
4. Release Durumu
5. Teknik Destek Paketi
6. GitHub Release kurulumu
7. Release Geçmişi
8. Rollback
9. Statik IP güvenli değişim

## 6. Rollback'i mutlaka test edin

Test Raspberry'de bir GitHub release kurulumu yaptıktan sonra **Önceki Sürüme Dön** işlemini çalıştırın.

Şunları doğrulayın:

- `gircik.php` açılıyor
- `GymsoftRM/gc3.py` mevcut
- Apache çalışıyor
- eski release sürüm bilgisi geri geliyor

Rollback test edilmeden uzaktaki müşteri cihazlarında kullanmayın.

## 7. Güvenli IP değişimini test edin

Müşteri cihazında kullanmadan önce test ağında örneğin:

```text
192.168.1.41 → 192.168.1.50
```

deneyin.

Panelin yeni IP'yi doğruladığını ve rollback'i iptal ettiğini kontrol edin.

Ayrıca bilinçli olarak erişilemeyen bir IP/yanlış gateway testinde yaklaşık 90 saniye sonra eski bağlantının geri geldiğini doğrulayın.

## 8. Agent otomatik güncelleme kanalını hazırlayın

Yeni oluşturduğunuz `GymsoftAgent.exe` dosyasını GitHub Pages'te:

```text
RaspberryManager/downloads/GymsoftAgent.exe
```

olarak yayınlayabilirsiniz.

v12 için `agent.json` zaten paket içerisinde bulunur.

Gelecekte örneğin v13 çıkınca:

1. v13 EXE'yi `downloads/GymsoftAgent.exe` olarak değiştirin.
2. `agent.json` içindeki `version` değerini `v13...` yapın.
3. v12 Agent'lar Ayarlar → Agent Güncelleme üzerinden yeni sürümü görebilir.

## 9. Teknik destek paketini kontrol edin

İlk oluşturduğunuz destek `.tar.gz` dosyasını açın ve gereken logların geldiğini kontrol edin.

`set.php` lisans/domain bilgisi içerebildiği için destek paketini müşteriye/açık ortama göndermeden önce buna dikkat edin.

## 10. Üretime geçin

Testler başarılıysa müşterilere artık v12 `GymsoftAgent.exe` dosyasını dağıtın.

Web arayüzü GitHub Pages'ten merkezi olarak güncellenmeye devam eder.
