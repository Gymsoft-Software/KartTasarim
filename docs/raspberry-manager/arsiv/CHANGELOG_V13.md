# GYMSOFT Raspberry Manager v13 — Secure Access & Pi Script Selector

## Güvenli giriş zorunluluğu
- Site ilk açıldığında Local Agent kontrol edilir.
- Agent çalışmıyorsa bütün arayüz kilitlenir ve `GymsoftAgent.exe İndir` popup'ı açılır.
- Agent çalışıyorsa yönetici girişi zorunludur; giriş yapılmadan hiçbir Agent API işlemi çalıştırılamaz.
- İlk kullanımda `İlk Yönetici Hesabı Oluştur` ekranı gelir.
- Sonraki kullanımlarda kullanıcı adı + parola istenir.
- Parola düz metin veya geri çözülebilir şifreleme ile saklanmaz; `%LOCALAPPDATA%/Gymsoft/RaspberryManager/auth.json` içinde salt + PBKDF2-SHA256 hash tutulur.
- Başarılı girişte tarayıcı yalnızca 8 saat geçerli rastgele bearer oturum tokenı alır. Token `sessionStorage` içinde tutulur ve tarayıcı sekmesi kapanınca silinir.
- 5 hatalı girişten sonra 60 saniyelik geçici kilit uygulanır.
- Girişsiz API istekleri HTTP 401 ile reddedilir.
- `GymsoftAgent.exe --reset-auth` komutu yerel yönetici hesabını sıfırlayabilir.

## Agent indirme popup'ı
- GitHub Pages linkine girildiğinde `127.0.0.1:5000` Agent bulunamazsa indirme ekranı açılır.
- İndirme hedefi: `RaspberryManager/downloads/GymsoftAgent.exe`.
- EXE çalıştırıldıktan sonra `Agent'ı Tekrar Kontrol Et` ile giriş ekranına geçilir.

## Private GitHub Pi kurulum scriptleri
- Kurulum sayfasına `Raspberry Pi Kurulum Scripti` seçici eklendi.
- Token ile private `Gymsoft-Software/Turnike` reposundaki `Scripts/Pi3Kurulum` klasörü okunur.
- `.sh` dosyaları sürüm numarasına göre listelenir.
- Kullanıcı `gymsoft_pi3_kurulum_v2.sh`, `v3`, `v4`, `v5`, `v6`, `v7` vb. istediği scripti seçebilir.
- Seçili script Agent tarafından GitHub API üzerinden belleğe alınır, Raspberry'ye `/tmp` altında aktarılır ve root bash ile çalıştırılır.
- GitHub token diske kaydedilmez.
- Seçim yapılmazsa v13 entegre kurulum scripti kullanılır.
- Etkileşimli eski scriptler web ortamında `read` girdisi alamayabileceği için arayüz uyarı gösterir.

## Ek düzeltmeler
- `gc3.py` event-driven çalışma modeli korunur.
- gc3 process'inin beklemede olması alarm değildir.
- Kiosk alarmı `gc3.py` dosya kontrolünden bağımsız hale getirildi.
