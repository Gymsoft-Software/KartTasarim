import * as repo from './repository.js';
import { escapeHtml as esc, filterArticles, dateLabel, youtubeId } from './core.js';
import { hydrateContent, articleMarkup } from './content.js';
const $ = id => document.getElementById(id);
let items = [], categories = [], page = 1;
const params = new URLSearchParams(location.search);
let selectedCategory = params.get('kategori') || '';
$('search').value = params.get('ara') || '';
const pageSize = 8;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; setTimeout(() => { $('toast').hidden = true; }, 3500); }

function card(item) {
  const category = categories.find(c => c.id === item.category_id)?.name || 'Rehber';
  return `<a class="article-row" href="?yazi=${encodeURIComponent(item.slug)}"><span class="article-row-icon" aria-hidden="true">${youtubeId(item.youtube_url) ? '▷' : '≡'}</span><div class="article-row-body"><div class="row-labels"><span>${esc(category)}</span>${item.pinned ? '<span class="featured">ÖNE ÇIKAN</span>' : ''}${youtubeId(item.youtube_url) ? '<span>VİDEOLU</span>' : ''}</div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><small>Güncellendi · ${dateLabel(item.updated_at)}</small></div><span class="row-arrow" aria-hidden="true">↗</span></a>`;
}
function renderCategories() {
  $('categoryList').innerHTML = [{ id: '', name: 'Tüm rehberler' }, ...categories].map(category => `<button type="button" class="category-button ${category.id === selectedCategory ? 'active' : ''}" data-category="${category.id}" aria-pressed="${category.id === selectedCategory}"><span>${esc(category.name)}</span><span>${items.filter(i => !category.id || i.category_id === category.id).length}</span></button>`).join('');
}
function renderList() {
  const filtered = filterArticles(items, { query: $('search').value, category: selectedCategory, sort: $('sort').value });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); page = Math.min(page, pages);
  $('listTitle').textContent = categories.find(c => c.id === selectedCategory)?.name || 'Tüm rehberler';
  $('resultCount').textContent = `${filtered.length} rehber${$('search').value.trim() ? ' bulundu' : ' sizi bekliyor'}`;
  $('articleList').innerHTML = filtered.length ? filtered.slice((page - 1) * pageSize, page * pageSize).map(card).join('')
    : `<div class="empty-state"><span class="empty-icon" aria-hidden="true">⌕</span><h3>${items.length ? 'Aradığınız rehberi bulamadık' : 'Rehberler yakında burada'}</h3><p>${items.length ? 'Farklı bir kelime veya kategori deneyin.' : 'Yeni yardım yazıları yayınlandığında burada listelenecek.'}</p>${items.length ? '<button type="button" class="button secondary" id="clearFilters">Filtreleri temizle</button>' : ''}</div>`;
  $('pagination').innerHTML = pages > 1 ? `<button type="button" class="button secondary" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>← Önceki</button><span>${page} / ${pages}</span><button type="button" class="button secondary" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>Sonraki →</button>` : '';
  $('clearFilters')?.addEventListener('click', () => { $('search').value = ''; selectedCategory = ''; refresh(); });
}
function refresh() {
  page = 1; renderCategories(); renderList();
  const url = new URL(location.href); url.search = '';
  if ($('search').value.trim()) url.searchParams.set('ara', $('search').value.trim());
  if (selectedCategory) url.searchParams.set('kategori', selectedCategory);
  history.replaceState(null, '', url);
}
async function showArticle(slug) {
  $('listView').hidden = true; $('articleView').hidden = false;
  $('articleContent').innerHTML = '<div class="empty-state">Rehber yükleniyor…</div>';
  const article = await repo.articleBySlug(slug);
  if (!article) {
    $('breadcrumbTitle').textContent = 'Yazı bulunamadı';
    $('articleContent').innerHTML = '<div class="empty-state"><h1>Bu rehber bulunamadı</h1><p>Bağlantı değişmiş veya yazı yayından kaldırılmış olabilir.</p><a class="button primary" href="./">Tüm rehberler</a></div>';
    return;
  }
  document.title = `${article.title} | Gymsoft Yardım`;
  document.querySelector('meta[name="description"]').content = article.summary;
  $('breadcrumbTitle').textContent = article.title;
  const html = await hydrateContent(article.content_html);
  $('articleContent').innerHTML = articleMarkup(article, categories.find(c => c.id === article.category_id)?.name, html);
  const headings = [...$('articleContent').querySelectorAll('.article-body h2, .article-body h3')];
  $('toc').replaceChildren();
  headings.forEach((heading, index) => {
    heading.id = `adim-${index + 1}`;
    const link = document.createElement('a'); link.href = `#${heading.id}`; link.textContent = heading.textContent;
    $('toc').append(link);
  });
  if (!headings.length) $('toc').textContent = 'Tüm açıklamalar bu sayfada.';
  const related = items.filter(i => i.category_id === article.category_id && i.id !== article.id).slice(0, 3);
  $('relatedSection').hidden = !related.length; $('relatedArticles').innerHTML = related.map(card).join('');
}

$('searchForm').addEventListener('submit', event => { event.preventDefault(); refresh(); });
$('search').addEventListener('input', refresh);
$('sort').addEventListener('change', refresh);
$('categoryList').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (button) { selectedCategory = button.dataset.category; refresh(); } });
$('pagination').addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) { page = Number(button.dataset.page); renderList(); $('listTitle').scrollIntoView({ block: 'start' }); } });
$('copyArticle').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href.split('#')[0]); toast('Rehber bağlantısı kopyalandı.'); } catch { toast('Adres çubuğundaki bağlantıyı kopyalayabilirsiniz.'); } });
$('printArticle').addEventListener('click', () => window.print());

async function init() {
  if (!repo.configured) {
    $('resultCount').textContent = 'İçerikler hazırlanıyor';
    $('articleList').innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">✦</span><h3>Yardım merkezimiz hazırlanıyor</h3><p>Görselli rehberler ve video anlatımlar çok yakında burada olacak.</p><a class="button secondary" href="../">Uygulama merkezine dön</a></div>';
    $('search').disabled = true; $('searchForm').querySelector('button').disabled = true; $('sort').disabled = true;
    return;
  }
  try {
    [categories, items] = await Promise.all([repo.categories(), repo.articles()]);
    if (params.get('yazi')) await showArticle(params.get('yazi'));
    else { renderCategories(); renderList(); }
  } catch (error) {
    console.error(error);
    const target = $('articleView').hidden ? $('articleList') : $('articleContent');
    target.innerHTML = '<div class="empty-state"><h2>Rehberler şu anda yüklenemiyor</h2><p>Lütfen bağlantınızı kontrol edip tekrar deneyin.</p><button type="button" id="retryLoad" class="button secondary">Tekrar dene</button></div>';
    $('resultCount').textContent = 'Bağlantı kurulamadı'; $('retryLoad').addEventListener('click', () => location.reload());
  }
}
init();
