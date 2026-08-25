# Gymsoft Raspberry Manager v10 Live

Bu sürümde Dashboard içindeki **Alarm Merkezi** ve **Son İşlemler** gerçek moda bağlanmıştır.

## Gerçek mod

- Alarm Merkezi, seçili ve doğrulanmış Raspberry'nin `/api/live-status` çıktısından yaklaşık 3,5 saniyede bir yeniden hesaplanır.
- Sıcaklık, CPU, RAM, disk, throttled, ağ, Apache, gc3.py ve Chromium durumları gerçek alarm üretir.
- Son İşlemler, `GymsoftAgent.exe` üzerinden yapılan gerçek değişiklikleri yerel audit dosyasından okur ve 5 saniyede bir yeniler.
- Parola veya GitHub token audit dosyasına yazılmaz.
- Gerçek modda örnek müşteri alarmı veya sahte işlem geçmişi gösterilmez.

## Deneyim modu

Deneyim Modu açık olduğunda örnek cihazlar, örnek alarmlar ve demo işlem geçmişi kullanılmaya devam eder. Bu veriler arayüz tanıtımı içindir ve gerçek veriden açıkça ayrılır.

## Gerekli Agent

Bu frontend'in canlı alarm ve gerçek işlem geçmişi özellikleri için `GymsoftAgent v10` kullanılmalıdır.
