# v13 — Sizin Yapmanız Gerekenler

1. `GymsoftAgent_v13_build_source.zip` dosyasını Windows build bilgisayarında açın.
2. `build_windows.bat` çalıştırın.
3. Oluşan `dist/GymsoftAgent.exe` dosyasını test edin.
4. `raspberry_manager_pages_v13_secure.zip` içindeki `RaspberryManager` klasörünü GitHub Pages'teki mevcut klasörün yerine yükleyin.
5. Yeni oluşturduğunuz `GymsoftAgent.exe` dosyasını GitHub Pages repo yapısında `RaspberryManager/downloads/GymsoftAgent.exe` olarak ayrıca yükleyin.
6. `RaspberryManager/agent.json` dosyasındaki sürümün `v13-secure-installer` olduğunu doğrulayın.
7. GitHub Pages linkini Ctrl+F5 ile açın. Agent kapalıyken EXE indirme popup'ının geldiğini test edin.
8. EXE'yi çalıştırın ve `Agent'ı Tekrar Kontrol Et` deyin.
9. İlk kullanımda yönetici kullanıcı adı/parolası oluşturun. Bu parola teknik ekipte güvenli bir parola yöneticisinde saklanmalıdır.
10. Giriş yapmadan Ağ Tara gibi bir API'nin çalışmadığını doğrulayın.
11. Kurulum sayfasında GitHub token girip `Pi Scriptlerini Getir` butonuna basın; private repodaki `Scripts/Pi3Kurulum/*.sh` listesini doğrulayın.
12. Önce test Raspberry'de seçili bir Pi scripti ile kurulum deneyin. Etkileşimli `read` isteyen eski scriptleri üretimde kullanmadan önce otomasyon uyumluluğunu kontrol edin.

Parola unutulursa Windows CMD'de Agent'ın bulunduğu klasörde:
`GymsoftAgent.exe --reset-auth`
çalıştırın; ardından Agent'ı normal açıp yeni yönetici hesabı oluşturun.
