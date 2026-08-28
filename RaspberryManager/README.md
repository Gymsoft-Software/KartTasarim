# v13.4 Güç Telemetrisi Notu

5V besleme, core voltaj/akım ve Acil Durum Logu eklendi. Ayrıntı için `CHANGELOG_V13_4.md`.

# Gymsoft Raspberry Manager v12 Service Center

GitHub Pages üzerinde çalışan web arayüzüdür. SSH, ağ taraması ve Raspberry işlemleri yerel bilgisayardaki `GymsoftAgent.exe` üzerinden yapılır.

## v12 öne çıkanlar

- Kurulum Öncesi Kontrol
- Release otomatik yedek / geçmiş / rollback
- Seçili cihaz sağlık skoru
- Alarm kartından Apache, gc3.py ve kiosk düzeltme aksiyonları
- Güvenli statik IP değişimi ve 90 saniyelik otomatik rollback
- Yeni IP çakışma/kullanım kontrolü
- Teknik Destek Paketi
- Agent update manifest altyapısı

## Agent otomatik güncelleme kanalı

Web klasöründeki:

```text
agent.json
downloads/GymsoftAgent.exe
```

kullanılır.

Yeni Agent sürümünü yayınlamak için yeni EXE'yi `downloads/GymsoftAgent.exe` adıyla yükleyin ve `agent.json` içindeki `version` değerini yükseltin.
