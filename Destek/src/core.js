export function slugify(value) {
  return String(value).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');
}

export const DEFAULT_IMAGE_WIDTH = '50%';
export function imageWidth(value) {
  const match = /^(\d{1,3})%$/.exec(String(value ?? ''));
  return match && Number(match[1]) >= 10 && Number(match[1]) <= 100
    ? `${Number(match[1])}%` : DEFAULT_IMAGE_WIDTH;
}

export function youtubeId(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    let id;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    if (['youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v')
        : /^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}

export function normalizeSearch(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function filterArticles(items, { query = '', category = '', sort = 'newest' } = {}) {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  const result = items.filter(item => (!category || item.category_id === category) &&
    terms.every(term => normalizeSearch([item.title, item.summary, ...(item.tags || [])].join(' ')).includes(term)));
  return result.sort((a, b) => sort === 'title'
    ? a.title.localeCompare(b.title, 'tr')
    : Number(b.pinned) - Number(a.pinned) || String(b.published_at || b.updated_at).localeCompare(String(a.published_at || a.updated_at)));
}

export function validateArticle(article) {
  if (!article.title?.trim() || article.title.trim().length > 160) throw new Error('Başlık 1–160 karakter olmalı.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) || article.slug.length > 100) throw new Error('Bağlantı adı yalnızca küçük harf, rakam ve tire içermeli.');
  if (!article.category_id) throw new Error('Bir kategori seçin.');
  if (article.summary?.length > 320) throw new Error('Özet en fazla 320 karakter olmalı.');
  if (article.youtube_url && !youtubeId(article.youtube_url)) throw new Error('Geçerli bir YouTube video bağlantısı girin.');
  if (!article.content_text?.trim()) throw new Error('Yazının açıklama adımlarını ekleyin.');
  if (article.content_html?.length > 200000) throw new Error('Yazı çok uzun. İçeriği birden fazla yazıya bölün.');
  if (!['draft', 'published'].includes(article.status)) throw new Error('Geçersiz yayın durumu.');
  if (article.tags.length > 8 || article.tags.some(tag => tag.length > 32)) throw new Error('En fazla 8 etiket ekleyin; her etiket en fazla 32 karakter olmalı.');
  return article;
}

export function readingMinutes(text = '') { return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 180)); }
export function dateLabel(value) { return value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
export function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
