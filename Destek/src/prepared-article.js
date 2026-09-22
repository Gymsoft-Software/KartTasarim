import { canonicalMedia } from './repository.js';

export const preparedSlug = 'kullanici-adi-ve-sifre-degistirme';

// Read the reviewed article and images before changing any server content.
export async function loadPreparedArticle() {
  const url = new URL(`icerikler/${preparedSlug}.html`, location.href);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Hazır yazı dosyası yüklenemedi. Site dosyalarını güncelleyip tekrar deneyin.');
  const document = new DOMParser().parseFromString(await response.text(), 'text/html');
  const body = document.querySelector('.article-body');
  const title = document.querySelector('h1')?.textContent.trim();
  const summary = document.querySelector('.article-summary')?.textContent.trim();
  if (!body || !title || !summary) throw new Error('Hazır yazının içeriği eksik.');
  body.querySelectorAll('nav').forEach(node => node.remove());
  const images = [];
  for (const img of body.querySelectorAll('img')) {
    const imageUrl = new URL(img.getAttribute('src'), url);
    if (imageUrl.origin !== url.origin || !imageUrl.pathname.endsWith('.jpg')) throw new Error('Hazır yazının görsel adresi geçersiz.');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error(`Görsel yüklenemedi: ${imageUrl.pathname.split('/').pop()}`);
    const blob = await imageResponse.blob();
    if (blob.type !== 'image/jpeg' || !blob.size || blob.size > 5 * 1024 * 1024) throw new Error('Hazır yazının görsel dosyası geçersiz.');
    images.push({ element: img, file: new File([blob], imageUrl.pathname.split('/').pop(), { type: 'image/jpeg' }) });
  }
  if (images.length !== 8) throw new Error('Hazır yazının 8 görseli de mevcut olmalıdır.');
  return { title, summary, body, images, tags: [...document.querySelectorAll('.tag-list span')].map(node => node.textContent.replace(/^#/, '')) };
}

export async function preparedDelta(source, articleId, editor, uploadImage, progress) {
  const urls = new Map();
  for (const [index, image] of source.images.entries()) {
    progress(`Görseller yükleniyor… ${index + 1} / ${source.images.length}`);
    const uploaded = await uploadImage(image.file, articleId);
    urls.set(image.element, canonicalMedia(uploaded.path));
  }
  const ops = [];
  for (const block of source.body.children) {
    if (block.tagName === 'FIGURE') {
      const img = block.querySelector('img');
      ops.push({ insert: { image: urls.get(img) }, attributes: { alt: img.alt, width: '100%' } }, { insert: '\n' });
      const caption = block.querySelector('figcaption');
      if (caption) ops.push({ insert: caption.textContent, attributes: { italic: true } }, { insert: '\n' });
    } else {
      const converted = editor.clipboard.convert({ html: block.outerHTML });
      ops.push(...converted.ops);
      // Quill removes a trailing plain newline during clipboard conversion.
      if (!String(converted.ops.at(-1)?.insert || '').endsWith('\n')) ops.push({ insert: '\n' });
    }
  }
  return { ops };
}
