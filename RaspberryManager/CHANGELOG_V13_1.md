# GYMSOFT Raspberry Manager v13.1 — SSH Password Verification Fix

## Kritik hata düzeltmesi

Raspberry parola değiştirme işleminde `chpasswd` girdisine gerçek satır sonu yerine
literal `\\n` karakterleri gönderiliyordu. Bu yüzden kullanıcı `admin123!` girse bile
hesap parolasının sonuna istemeden `\\n` eklenebiliyordu.

## Yeni güvenli akış

1. Parola gerçek newline kullanılarak değiştirilir.
2. Mevcut SSH oturumu açık tutulur.
3. Agent yeni parola ile ikinci bir SSH bağlantısı açar.
4. Yeni parola gerçekten çalışıyorsa işlem başarılı sayılır.
5. Doğrulama başarısız olursa mevcut açık SSH oturumu üzerinden eski parola otomatik geri yüklenmeye çalışılır.
6. Panel yalnızca yeni parola doğrulandığında “başarılı” gösterir.

## Etkilenen alan

- Ayarlar → Raspberry Pi Parola Değiştirme
- GymsoftAgent backend
