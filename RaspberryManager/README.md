# Raspberry Manager

[← Gymsoft Web Uygulamaları](../README.md) · [Paneli aç](https://gymsoft-software.github.io/KartTasarim/RaspberryManager/)

Raspberry Pi ve turnikeler için cihaz yönetim arayüzü. Ağ taraması, SSH, kurulum, izleme ve bakım işlemleri aynı bilgisayarda çalışan `GymsoftAgent.exe` üzerinden yapılır.

## Giriş ve bağlantı

1. Paneli açın. Yerel geliştirmede `npm run dev` sonrasında `http://127.0.0.1:4173/RaspberryManager/` adresini kullanın.
2. Yardım Merkezi için oluşturduğunuz yönetici hesabının **e-posta adresi ve parolasıyla** giriş yapın.
3. Hesap `support_is_admin` kontrolünden geçmelidir. Yönetici ataması için [Supabase kurulum kılavuzuna](../Destek/README.md) bakın.
4. Cihaz işlemleri için aynı bilgisayarda Local Agent'ı çalıştırın. Varsayılan bağlantı `http://127.0.0.1:5000`'dir.
5. Raspberry cihazına bağlanırken cihazın **SSH kullanıcı adı ve parolasını** girin; bunlar panel giriş bilgilerinden ayrıdır.

Agent kapalıysa indirme ve tekrar deneme ekranı gösterilir. **Panele devam et** ile arayüzü açabilirsiniz; gerçek cihaz işlemleri için Agent bağlantısı yine gereklidir.

## Dosyalar

| Dosya / klasör | İşlev |
| --- | --- |
| [index.html](index.html) | Giriş ekranı ve panel. |
| [app.js](app.js), [app.css](app.css) | Cihaz yönetimi davranışı ve görünümü. |
| [config.js](config.js) | Agent adresi ve indirme yolu. |
| [src/auth.js](src/auth.js) | Supabase oturum ve yönetici kontrolü. |
| `assets/auth.js` | `npm run build` ile üretilen giriş paketi. |
| [agent.json](agent.json) | Agent güncelleme bildirimi. |
| [downloads/](downloads/) | Local Agent çalıştırıcısı. |

Supabase ayarları [Destek/config.js](../Destek/config.js) üzerinden paylaşılır. Derleme ve yayın adımları [geliştirme kılavuzundadır](../docs/GELISTIRME.md).

## Agent güncellemesi

Yeni Agent sürümünde `downloads/GymsoftAgent.exe` dosyasını güncelleyin ve `agent.json` içindeki `version` değerini yükseltin. İndirme adresi mevcut yapılandırmada bu klasöre bağlıdır.

## Sürüm geçmişi

Eski değişiklik listeleri ve planlar [sürüm arşivine taşındı](../docs/raspberry-manager/README.md). Arşivdeki “giriş kaldırıldı” gibi açıklamalar ilgili eski sürümü anlatır; güncel Supabase giriş akışını bu README açıklar.
