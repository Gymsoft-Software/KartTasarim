# Gymsoft Yardım Merkezi

Müşteriler giriş yapmadan yayınlanan rehberleri okur. Yorum, müşteri kaydı veya müşteri konu açma özelliği yoktur. İçerikleri yalnızca atanmış tek yönetici hesabı yönetir.

Ekran görüntüleriyle günlük kullanım: [Forum / Yardım Merkezi Kullanım Rehberi](KULLANIM_REHBERI.md).

## Özellikler

- Kategoriler, Türkçe arama, etiketler, öne çıkarma ve sayfalama.
- Paylaşılabilir adresler: `Destek/?yazi=kullanici-adi-ve-sifre-degistirme`.
- Sayfanın üstünde YouTube videosu; altında adımlar ve görseller.
- Quill editörü: kalın, italik, altı/üstü çizili, başlık, listeler, hizalama, alıntı, kod, bağlantı, görsel.
- Görsele tıklayıp genişliğini %10–%100 arasında ayarlayın; %25/%50/%75/%100 kısayolları vardır. Oran yazı alanının genişliğine göredir ve en-boy oranı korunur. Yeni görseller ve daha önce boyutu belirlenmemiş görseller varsayılan olarak %50 genişlikte gösterilir. Ayar taslakta, önizlemede ve yayında korunur.
- Üç adımlı yazı hazırlama, önizleme, taslak/yayın, düzenleme ve silme.
- Eşzamanlı düzenlemelerde sürüm kontrolü: eski pencere yeni değişikliklerin üstüne yazamaz.
- Sekme açık kaldığı sürece sessionStorage'da kurtarma kopyası. Bu, sunucuya kaydetmenin yerine geçmez; sekme kapanınca kaybolabilir.
- Kategori yönetimi; yazısı bulunan kategori silinemez.

## 1. Supabase projesi

Site GitHub Pages'te kalır. Supabase kimlik doğrulama, PostgreSQL ve görsel depolamasını sağlar. Proje bağlanmadıysa müşteri sayfası hazırlık mesajı gösterir, yönetici girişi kapalı kalır. Sahte oturum veya yerel parola yoktur.

1. Kendi Supabase hesabınızda bir proje açın.
2. SQL Editor'da `supabase/schema.sql` dosyasını bir kez çalıştırın.
3. Authentication ayarlarında **Allow new users to sign up** seçeneğini kapatın. Anonim girişleri açmayın.
4. Authentication > Users > Add user bölümünden yalnızca kendi yönetici hesabınızı oluşturun. Uzun ve benzersiz parola belirleyin. E-posta doğrulamasını tamamlayın veya panelden onaylı oluşturun.
5. Kullanıcının UUID'sini kopyalayıp SQL Editor'da yönetici atamasını çalıştırın:

```sql
insert into public.support_admins (singleton, user_id)
values (true, 'BURAYA-KENDI-KULLANICI-UUID-DEGERINIZ'::uuid);
```

`singleton` ikinci yönetici satırına izin vermez. Yönetici değiştirmek gerektiğinde SQL Editor'da mevcut `user_id` değerini güncelleyin. Tarayıcıdan bu tabloya yazma yetkisi verilmez. Normal bir Supabase hesabı oluşturulsa bile içerik düzenleme yetkisi kazanamaz.

## 2. Bağlantı ayarları

Project Settings > API bölümündeki Project URL ve **publishable** anahtarını `Destek/config.js` içine yazın. Eski projelerde `anon` anahtarı da kullanılabilir.

```js
window.SUPPORT_CONFIG = {
  supabaseUrl: 'https://PROJE.supabase.co',
  supabasePublishableKey: 'sb_publishable_...',
};
```

Bu iki değer tarayıcıya açıktır. `service_role`, `sb_secret_...`, veritabanı veya yönetici parolasını repoya koymayın. Yetkileri SQL'deki RLS kuralları uygular.

Authentication > URL Configuration: Site URL'yi sitenize, Redirect URLs alanını tam yönetici adresine ayarlayın:

```text
https://gymsoft-software.github.io/KartTasarim/Destek/admin.html
```

Parola sıfırlama için Supabase Auth e-posta/SMTP ayarlarını tamamlayın. SMTP yoksa Supabase panelinden parola yenileyebilirsiniz. Yerel denemede `http://127.0.0.1:4173/Destek/admin.html` adresini izinli yönlendirmelere ekleyin.

## 3. GitHub Pages yayını

`Destek/` klasörünü ve ana sayfa değişikliğini repoya gönderin. Derlenmiş `Destek/assets/` dosyaları da gönderilmelidir. Mevcut `main` / root GitHub Pages yayını devam eder; sunucuda Node.js gerekmez.

- Müşteri: `/KartTasarim/Destek/`
- Yönetici: `/KartTasarim/Destek/admin.html`

İlk girişte **Yeni yazı oluştur** ile başlık ve kategori girin, içerik/görselleri ekleyin, önizleyip yayınlayın. Ürünün gerçek ekran görüntüleri ve kullanım adımları yönetici tarafından eklenir; örnek ürün talimatları gerçek içerik gibi yayınlanmamıştır.

## Medya ve taslaklar

`support-media` bucket'ı **private** kalmalıdır. Görseller yazının UUID klasörüne rastgele adla yüklenir. PNG/JPG/WEBP/GIF, en fazla 5 MB kabul edilir. SVG/HTML kabul edilmez. Yayındaki yazıların görselleri 1 saatlik imzalı URL ile okunur. Taslak görsellerini yalnızca yönetici okuyabilir.

Yayından kaldırılan/silinen yazılar yeni sorgularda görünmez. Önceden açılmış imzalı görsel bağlantıları süreleri dolana kadar çalışabilir. Açık sayfada bir saatten sonra görüntüler için sayfayı yenileyin. Yüklenip kaydedilmeden terk edilen veya metinden çıkarılan dosyalar Storage'da kalabilir; gerekirse bucket'tan temizleyin. Yazı silme akışı o yazının dosyalarını da temizler.

Admin oturumu ve kurtarma kopyası sessionStorage kullanır. HTML çıktısı hem kaydetmeden hem görüntülemeden önce DOMPurify ile temizlenir. Quill 2.0.3 için HTML export kaynaklı düşük önem dereceli bir npm audit uyarısı vardır (GHSA-v3m3-f69x-jf25); ham export hiçbir zaman doğrudan sayfaya yerleştirilmez. XSS senaryoları tarayıcı testlerinde kontrol edilir. Yeni Quill sürümünde bu uyarı tekrar değerlendirilmelidir.

## Geliştirme ve test

Node.js 24 LTS:

```sh
npm ci
npm run build
npm run dev
npm test
npm run test:e2e
```

Adres `http://127.0.0.1:4173`. Playwright Windows'ta kurulu Edge'i kullanır; diğer ortamlarda `npx playwright install chromium` çalıştırın. Tarayıcı testleri izole sahte API yanıtları kullanır, gerçek projenize yazmaz. Veritabanı testleri SQL'i yerel PGlite üzerinde Auth/Storage tablolarının asgari modeliyle çalıştırır. Supabase bağlandıktan sonra gerçek Auth, Storage ve RLS uçtan uca doğrulaması ayrıca yapılmalıdır.

Kaynaklar `src/` altındadır. Değişiklikten sonra `npm run build` çalıştırın, `assets/` çıktılarını birlikte yayınlayın. Sürümler `package-lock.json` ile sabittir.

Dokümanlar: [Quill](https://quilljs.com/docs/quickstart), [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage](https://supabase.com/docs/guides/storage/security/access-control), [DOMPurify](https://github.com/cure53/DOMPurify).
