import DOMPurify from 'dompurify';
import { mediaPath, signMedia, canonicalMedia } from './repository.js';
import { youtubeId, escapeHtml, readingMinutes, dateLabel } from './core.js';

export function sanitizeContent(html) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p','br','strong','b','em','i','u','s','h2','h3','h4','ol','ul','li','blockquote','pre','code','a','img','span','sub','sup'],
    ALLOWED_ATTR: ['href','src','alt','class','data-list'], ALLOW_DATA_ATTR: false,
  });
  const template = document.createElement('template');
  template.innerHTML = clean;
  template.content.querySelectorAll('[class]').forEach(el => {
    const allowed = [...el.classList].filter(c => /^ql-(?:align-(?:center|right|justify)|indent-[1-8]|syntax)$/.test(c));
    el.removeAttribute('class'); if (allowed.length) el.classList.add(...allowed);
  });
  template.content.querySelectorAll('a').forEach(link => {
    if (!/^(https?:\/\/|mailto:)/i.test(link.getAttribute('href') || '')) link.removeAttribute('href');
    else { link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener noreferrer'); }
  });
  template.content.querySelectorAll('img').forEach(img => {
    const path = mediaPath(img.getAttribute('src'));
    if (!path) { img.remove(); return; }
    img.src = canonicalMedia(path); img.alt = img.alt || 'Anlatım görseli';
    img.loading = 'lazy'; img.decoding = 'async';
  });
  return template.innerHTML;
}

export async function hydrateContent(html) {
  const template = document.createElement('template'); template.innerHTML = sanitizeContent(html);
  const images = [...template.content.querySelectorAll('img')];
  const signed = await signMedia(images.map(img => mediaPath(img.src)));
  for (const img of images) {
    const url = signed[mediaPath(img.src)];
    if (url) img.src = url;
    else { const note = document.createElement('p'); note.textContent = 'Bu görsel şu anda görüntülenemiyor.'; img.replaceWith(note); }
  }
  return template.innerHTML;
}

export function videoMarkup(url) {
  const id = youtubeId(url);
  return id ? `<section class="article-video" aria-label="Video anlatım"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Video anlatım" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></section>` : '';
}

export function articleMarkup(article, category, html) {
  return `${videoMarkup(article.youtube_url)}<div class="article-heading"><span class="eyebrow">${escapeHtml(category || 'YARDIM REHBERİ')}</span><h1>${escapeHtml(article.title)}</h1><p class="article-summary">${escapeHtml(article.summary)}</p><div class="article-meta"><span>Gymsoft Destek</span><span>Güncelleme: ${dateLabel(article.updated_at)}</span><span>${readingMinutes(article.content_text)} dk okuma</span></div></div><div class="article-body">${html}</div><div class="tag-list">${(article.tags || []).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>`;
}

export function canonicalDelta(delta) {
  return { ops: delta.ops.map(op => {
    if (!op.insert?.image) return op;
    const path = mediaPath(op.insert.image);
    if (!path) throw new Error('Görselleri editörün Görsel Ekle düğmesiyle yükleyin. Dışarıdan yapıştırılan görselleri kaldırın.');
    return { ...op, insert: { image: canonicalMedia(path) } };
  }) };
}

export async function hydrateDelta(delta) {
  const ops = delta?.ops || [{ insert: '\n' }];
  const signed = await signMedia(ops.map(op => mediaPath(op.insert?.image)));
  return { ops: ops.map(op => {
    if (!op.insert?.image) return op;
    const path = mediaPath(op.insert.image);
    return signed[path] ? { ...op, insert: { image: signed[path] } } : { insert: '[Görsel yüklenemedi]\n' };
  }) };
}
