# GYMSOFT Raspberry Manager v13.3 — Throttled Açıklama Logu

## Yeni özellik
Raspberry Pi `vcgencmd get_throttled` çıktısı artık yalnızca `0x...` olarak gösterilmiyor. Sistem bit maskesini çözüp Türkçe açıklama ve log üretiyor.

## Desteklenen bitler

| Bit | Hex | Anlam |
|---:|---:|---|
| 0 | 0x1 | Düşük voltaj şu anda algılanıyor |
| 1 | 0x2 | ARM frekansı şu anda sınırlandırılmış |
| 2 | 0x4 | Sistem şu anda throttling uyguluyor |
| 3 | 0x8 | Soft sıcaklık limiti şu anda aktif |
| 16 | 0x10000 | Geçmişte düşük voltaj yaşandı |
| 17 | 0x20000 | Geçmişte ARM frekansı sınırlandırıldı |
| 18 | 0x40000 | Geçmişte throttling yaşandı |
| 19 | 0x80000 | Geçmişte soft sıcaklık limiti aktif oldu |

## Örnekler

### `0x0`
`NORMAL — güç/ısı kaynaklı throttling bayrağı yok.`

### `0x50000`
Bit 16 + bit 18:
`Şu anda aktif sorun yok; geçmişte düşük voltaj ve throttling yaşanmış.`

### `0x50005`
Bit 0 + bit 2 + bit 16 + bit 18:
`AKTİF UYARI — şu anda düşük voltaj ve throttling var; geçmişte de aynı olaylar yaşanmış.`

### `0x80000`
`Şu anda aktif sorun yok; geçmişte soft sıcaklık limiti devreye girmiş.`

## UI değişiklikleri
- Sağlık sayfasına `Throttled Açıklaması` alanı eklendi.
- Dashboard sıcaklık kartında ham hex yerine açıklayıcı özet gösteriliyor.
- Üst görev çubuğundaki Throttled değerinin üzerine gelince açıklama tooltip'i görülüyor.
- Sağlık logu ayrıntılı bit rehberi içeriyor.
- Hızlı teşhis çıktısı throttled değerinin kısa Türkçe açıklamasını ekliyor.

## Alarm/sağlık mantığı düzeltmesi
- Yalnızca geçmiş bitleri (`16-19`) set ise sistem bunu **aktif throttling** gibi değerlendirmez.
- Aktif bitler (`0-3`) set ise Alarm Merkezi uyarı üretir.
- Sadece geçmiş kayıt varsa sağlık skoruna küçük geçmiş uyarısı olarak yansır; aktif sorunla aynı ağırlıkta değerlendirilmez.

Bit anlamları Raspberry Pi resmi `get_throttled` dokümantasyonundaki tanımlara göre uygulanmıştır.
