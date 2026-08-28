# GYMSOFT Raspberry Manager v13.2 — Üye Girişi Kaldırıldı

## Değişiklik
Raspberry Manager açılışındaki kullanıcı adı / parola oluşturma ve giriş zorunluluğu tamamen kaldırıldı.

## Yeni açılış akışı
1. Raspberry Manager linki açılır.
2. `GymsoftAgent.exe` kontrol edilir.
3. Agent açıksa panel doğrudan kullanıma açılır.
4. Agent kapalıysa `GymsoftAgent.exe İndir` popup'ı gösterilir.
5. Agent çalıştırılıp `Agent'ı Tekrar Kontrol Et` denildiğinde Dashboard doğrudan açılır.

## Kaldırılan özellikler
- İlk Yönetici Hesabını Oluştur ekranı
- Raspberry Manager kullanıcı adı / parola girişi
- Manager `auth.json` kullanımı
- PBKDF2 Manager giriş parolası
- Session token
- `sessionStorage` auth token
- Oturumu Kapat butonu
- API login zorunluluğu
- `GymsoftAgent.exe --reset-auth` ihtiyacı

## Değişmeyenler
- Raspberry SSH kullanıcı adı / parolası aynen devam eder.
- GitHub token sistemi aynen devam eder.
- Agent yalnızca `127.0.0.1` üzerinde çalışır.
- Agent kapalıysa EXE indirme popup'ı çalışmaya devam eder.
- Kritik işlem onayları korunur.
