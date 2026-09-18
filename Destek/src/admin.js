import Quill from 'quill';
import './image-format.js';
import * as repo from './repository.js';
import { slugify, validateArticle, escapeHtml as esc, filterArticles, dateLabel, youtubeId, readingMinutes, imageWidth } from './core.js';
import { sanitizeContent, hydrateContent, canonicalDelta, hydrateDelta, articleMarkup } from './content.js';

const $ = id => document.getElementById(id);
let user = null, allArticles = [], categories = [], editor = null;
let active = null, step = 1, dirty = false, saving = false, slugEdited = false;
let localTimer, toastTimer, pendingFile = null, imageSelection = 0, editorRequest = 0;
let selectedImage = null;
let recoveryMode = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
const views = ['loginView', 'dashboardView', 'editorView', 'recoveryView'];
function showView(id) { views.forEach(view => { $(view).hidden = view !== id; }); }
function message(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000); }
function errorText(error) {
  if (error.code === '23505') return 'Bu bağlantı adı veya kategori zaten kullanılıyor. Farklı bir ad seçin.';
  if (error.code === '23503') return 'Bu kategoride yazılar var. Önce yazıları başka bir kategoriye taşıyın.';
  if (error.code === '42501' || error.status === 403) return 'Bu işlem için yönetici yetkisi gerekiyor. Tekrar giriş yapın.';
  if (/fetch|network/i.test(error.message || '')) return 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';
  return error.message || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}
function draftKey() { return user ? `gymsoft-support-draft:${user.id}` : null; }
function readDraft() { try { return JSON.parse(sessionStorage.getItem(draftKey()) || 'null'); } catch { return null; } }
function clearDraft() { if (draftKey()) sessionStorage.removeItem(draftKey()); $('restoreNotice').hidden = true; }

function setupEditor() {
  if (editor) return;
  editor = new Quill('#richEditor', {
    theme: 'snow', placeholder: 'Önce ne yapılması gerektiğini anlatın…',
    formats: ['header','bold','italic','underline','strike','list','blockquote','code-block','link','image','alt','width','align','indent'],
    modules: { toolbar: {
      container: [[{ header: [2,3,false] }], ['bold','italic','underline','strike'], [{ list: 'ordered' }, { list: 'bullet' }], [{ align: [] }], ['blockquote','code-block'], ['link','image'], ['clean']],
      handlers: { image: () => chooseImage() },
    }, history: { delay: 800, maxStack: 100, userOnly: true } },
  });
  editor.root.setAttribute('aria-labelledby', 'contentLabel');
  editor.root.setAttribute('role', 'textbox'); editor.root.setAttribute('aria-multiline', 'true');
  // Clipboard images must go through Storage; arbitrary pasted image URLs are not persisted.
  editor.clipboard.addMatcher('IMG', () => new (Quill.import('delta'))());
  editor.root.addEventListener('paste', event => {
    if ([...(event.clipboardData?.files || [])].some(file => file.type.startsWith('image/'))) {
      event.preventDefault(); toast('Ekran görüntünüzü dosya olarak kaydedip Görsel ekle düğmesiyle yükleyin.');
    }
  }, true);
  editor.root.addEventListener('drop', event => { if (event.dataTransfer?.files.length) { event.preventDefault(); toast('Görselleri Görsel ekle düğmesiyle yükleyin.'); } });
  editor.root.addEventListener('click', event => selectImage(event.target.closest('img')));
  editor.on('selection-change', range => {
    if (!range) return; // Keep the selection while the size controls have focus.
    const [leaf] = editor.getLeaf(range.index);
    selectImage(range.length === 1 && leaf?.domNode?.tagName === 'IMG' ? leaf.domNode : null);
  });
  editor.on('text-change', () => { markDirty(); syncImageControls(); });
  const labels = { bold:'Kalın', italic:'İtalik', underline:'Altı çizili', strike:'Üstü çizili', blockquote:'Alıntı', 'code-block':'Kod bloğu', link:'Bağlantı ekle', image:'Görsel ekle', clean:'Biçimlendirmeyi temizle' };
  document.querySelectorAll('.ql-toolbar button').forEach(button => {
    const name = [...button.classList].find(x => x.startsWith('ql-'))?.slice(3);
    const label = labels[name] || (name === 'list' ? (button.value === 'ordered' ? 'Numaralı liste' : 'Madde işaretli liste') : 'Hizalama');
    button.title = label; button.setAttribute('aria-label', label);
  });
}

function selectImage(image) {
  selectedImage?.classList.remove('selected-image');
  selectedImage = image && editor.root.contains(image) ? image : null;
  selectedImage?.classList.add('selected-image');
  syncImageControls();
}
function syncImageControls() {
  if (selectedImage && !editor.root.contains(selectedImage)) selectedImage = null;
  const width = imageWidth(selectedImage?.getAttribute('width'));
  $('imageWidth').value = Number.parseInt(width, 10);
  $('imageWidthValue').textContent = selectedImage ? `%${Number.parseInt(width, 10)}` : '—';
  $('imageSizeHint').textContent = selectedImage ? 'Yazı alanına göre genişlik. En-boy oranı korunur.' : 'Boyutlandırmak için yazıdaki bir görsele tıklayın.';
  document.querySelectorAll('#imageSizeControls input, #imageSizeControls button').forEach(control => { control.disabled = !selectedImage || saving; });
  document.querySelectorAll('[data-image-width]').forEach(button => button.setAttribute('aria-pressed', String(Boolean(selectedImage) && button.dataset.imageWidth === width)));
}
function resizeSelectedImage(width) {
  if (saving || !selectedImage || !editor.root.contains(selectedImage)) return;
  const blot = Quill.find(selectedImage);
  if (!blot) return;
  editor.formatText(editor.getIndex(blot), 1, 'width', imageWidth(width), 'user');
  syncImageControls();
}
$('imageWidth').addEventListener('input', event => resizeSelectedImage(`${event.target.value}%`));
$('imageSizeControls').addEventListener('click', event => {
  const button = event.target.closest('[data-image-width]');
  if (button) { editor.history.cutoff(); resizeSelectedImage(button.dataset.imageWidth); editor.history.cutoff(); }
});
$('imageWidth').addEventListener('pointerdown', () => editor?.history.cutoff());
$('imageWidth').addEventListener('change', () => editor?.history.cutoff());

function rawArticle() {
  return {
    id: active.id, title: $('articleTitle').value.trim(), slug: $('articleSlug').value.trim(),
    summary: $('articleSummary').value.trim(), category_id: $('articleCategory').value,
    tags: [...new Set($('articleTags').value.split(',').map(t => t.trim()).filter(Boolean))],
    youtube_url: $('youtubeUrl').value.trim(), pinned: $('articlePinned').checked,
    content_delta: editor.getContents(), content_html: editor.getSemanticHTML(), content_text: editor.getText(),
    status: active.status || 'draft', published_at: active.published_at || null,
  };
}
function writeLocalDraft() {
  if (!dirty || !user || !active || $('editorView').hidden) return;
  try {
    sessionStorage.setItem(draftKey(), JSON.stringify({ article: rawArticle(), revision: active.revision ?? null, at: Date.now() }));
    $('saveState').textContent = 'Oturumda yedeklendi · henüz sunucuya kaydedilmedi';
  } catch { $('saveState').textContent = 'Kaydedilmemiş değişiklikler · oturum yedeği alınamadı'; }
}
function markDirty() {
  if (!active || saving) return;
  dirty = true; $('saveState').textContent = 'Kaydedilmemiş değişiklikler';
  clearTimeout(localTimer); localTimer = setTimeout(writeLocalDraft, 700);
}
function fillCategorySelect(value = '') {
  $('articleCategory').innerHTML = '<option value="">Kategori seçin</option>' + categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('articleCategory').value = value;
}
function setStep(value) {
  step = Math.max(1, Math.min(3, value));
  document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.panel) !== step; });
  document.querySelectorAll('[data-step]').forEach(button => {
    const isCurrent = Number(button.dataset.step) === step; button.classList.toggle('active', isCurrent);
    if (isCurrent) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  });
  $('stepLabel').textContent = `Adım ${step} / 3`; $('previousStep').disabled = step === 1; $('nextStep').hidden = step === 3;
  if (step === 3) {
    const data = rawArticle();
    $('publishSummary').innerHTML = `<span class="eyebrow">${esc(categories.find(c => c.id === data.category_id)?.name || 'Kategori seçilmedi')}</span><h3>${esc(data.title || 'Başlık eklenmedi')}</h3><p>${esc(data.summary || 'Kısa açıklama eklenmedi.')}</p><p>${readingMinutes(data.content_text)} dk okuma · ${editor.root.querySelectorAll('img').length} görsel · ${youtubeId(data.youtube_url) ? 'Video anlatım var' : 'Video eklenmedi'}</p>`;
    $('publishArticle').textContent = active.status === 'published' ? 'Değişiklikleri yayınla →' : 'Yayınla →';
  }
}
async function openEditor(data = null, restoring = false) {
  const request = ++editorRequest;
  const draft = data || { id: crypto.randomUUID(), title:'', slug:'', summary:'', category_id:'', tags:[], status:'draft', content_delta:{ops:[{insert:'\n'}]} };
  // Finish image resolution before switching the active document.
  const delta = data ? await hydrateDelta(draft.content_delta) : draft.content_delta;
  if (request !== editorRequest || !user) return;
  setupEditor(); active = null;
  $('articleTitle').value = draft.title; $('articleSlug').value = draft.slug;
  $('articleSummary').value = draft.summary || ''; $('articleTags').value = (draft.tags || []).join(', ');
  $('youtubeUrl').value = draft.youtube_url || ''; $('articlePinned').checked = Boolean(draft.pinned);
  fillCategorySelect(draft.category_id); editor.setContents(delta, 'silent'); editor.history.clear(); selectImage(null);
  active = { ...draft }; dirty = restoring; slugEdited = Boolean(draft.slug);
  $('editorHeading').textContent = draft.revision ? 'Rehberinizi düzenleyin.' : 'Yeni bir rehber hazırlayın.';
  $('saveState').textContent = restoring ? 'Oturum yedeği geri yüklendi · henüz kaydedilmedi' : draft.revision ? 'Sunucudaki sürüm açıldı' : 'Yeni yazı';
  message('editorStatus', ''); showView('editorView'); setStep(1); window.scrollTo(0, 0);
}

async function refreshDashboard() {
  $('newArticle').disabled = true; $('manageCategories').disabled = true;
  message('dashboardStatus', 'Yazılar yükleniyor…');
  [allArticles, categories] = await Promise.all([repo.articles(true), repo.categories()]);
  renderDashboard(); message('dashboardStatus', ''); $('restoreNotice').hidden = !readDraft();
  $('newArticle').disabled = false; $('manageCategories').disabled = false;
}
function renderDashboard() {
  $('totalStat').textContent = allArticles.length; $('publishedStat').textContent = allArticles.filter(a => a.status === 'published').length;
  $('draftStat').textContent = allArticles.filter(a => a.status === 'draft').length; $('categoryStat').textContent = categories.length;
  const filtered = filterArticles(allArticles, { query: $('adminSearch').value }).filter(a => $('statusFilter').value === 'all' || a.status === $('statusFilter').value);
  $('adminRows').innerHTML = filtered.length ? filtered.map(a => `<tr><td><strong>${esc(a.title)}</strong><small>${a.pinned ? '★ Öne çıkan · ' : ''}${esc(a.slug)}</small></td><td>${esc(categories.find(c => c.id === a.category_id)?.name || '')}</td><td><span class="status-badge ${a.status}">${a.status === 'published' ? 'Yayında' : 'Taslak'}</span></td><td>${dateLabel(a.updated_at)}</td><td><div class="row-actions"><button type="button" class="button secondary" data-edit="${a.id}" aria-label="${esc(a.title)} yazısını düzenle">Düzenle</button>${a.status === 'published' ? `<a href="./?yazi=${encodeURIComponent(a.slug)}" target="_blank" rel="noopener" class="button subtle" aria-label="${esc(a.title)} yazısını aç">↗</a>` : ''}<button type="button" class="button danger" data-delete="${a.id}" aria-label="${esc(a.title)} yazısını sil">Sil</button></div></td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><h3>Henüz burada bir yazı yok</h3><p>İlk rehberinizi oluşturun veya arama filtrenizi değiştirin.</p></div></td></tr>';
}

async function save(status) {
  if (saving) return;
  const draftLabel = $('saveDraft').textContent;
  $('editorStatus').setAttribute('tabindex', '-1');
  try {
    const data = rawArticle(); data.status = status;
    data.content_html = sanitizeContent(data.content_html); data.content_delta = canonicalDelta(data.content_delta);
    validateArticle(data);
    if (status === 'draft' && active.status === 'published' && !confirm('Bu yazı yayından kaldırılacak ve yalnızca size görünecek. Devam edilsin mi?')) return;
    writeLocalDraft();
    saving = true; setEditorBusy(true);
    $('articleForm').setAttribute('aria-busy', 'true');
    $(status === 'published' ? 'publishArticle' : 'saveDraft').textContent = status === 'published' ? 'Yayınlanıyor…' : 'Kaydediliyor…';
    message('editorStatus', 'Kaydediliyor…');
    const saved = await repo.saveArticle(data, active.revision ?? null);
    active = saved; dirty = false; clearTimeout(localTimer); clearDraft();
    $('saveState').textContent = status === 'published' ? 'Yayında · değişiklikler kaydedildi' : 'Taslak sunucuya kaydedildi';
    message('editorStatus', status === 'published' ? 'Yazı yayınlandı. Müşterileriniz yardım merkezinden okuyabilir.' : 'Taslak kaydedildi. Müşterilere görünmez.');
    setStep(3); toast(status === 'published' ? 'Rehber yayınlandı.' : 'Taslak kaydedildi.');
  } catch (error) {
    message('editorStatus', errorText(error), true);
    toast(errorText(error));
    $('editorStatus').scrollIntoView({ block: 'center' });
    $('editorStatus').focus({ preventScroll: true });
  }
  finally {
    saving = false; setEditorBusy(false);
    $('articleForm').removeAttribute('aria-busy');
    $('publishArticle').textContent = active?.status === 'published' ? 'Değişiklikleri yayınla →' : 'Yayınla →';
    $('saveDraft').textContent = draftLabel;
  }
}
function setEditorBusy(busy) {
  document.querySelectorAll('#editorView button, #editorView input, #editorView select, #editorView textarea').forEach(el => { el.disabled = busy; });
  editor?.enable(!busy); if (!busy) $('previousStep').disabled = step === 1;
  syncImageControls();
}
async function leaveEditor() {
  if (saving) return;
  if (dirty && !confirm('Kaydedilmemiş değişiklikler var. Yazılara dönülsün mü? Oturum yedeği korunacak.')) return;
  writeLocalDraft(); dirty = false; active = null; ++editorRequest; showView('dashboardView');
  try { await refreshDashboard(); } catch (error) { message('dashboardStatus', errorText(error), true); }
}

function chooseImage() {
  if (saving) return;
  imageSelection = editor.getSelection()?.index ?? editor.getLength() - 1;
  $('imageFile').value = ''; $('imageFile').click();
}
$('imageFile').addEventListener('change', () => {
  pendingFile = $('imageFile').files[0]; if (!pendingFile) return;
  $('imageName').textContent = pendingFile.name; $('imageAlt').value = ''; message('imageStatus', ''); $('imageDialog').showModal();
});
$('imageForm').addEventListener('submit', async event => {
  event.preventDefault(); if (!pendingFile || saving) return;
  const targetId = active.id;
  const targetPosition = imageSelection;
  const alt = $('imageAlt').value.trim();
  $('uploadImage').disabled = true; message('imageStatus', 'Görsel yükleniyor…');
  try {
    const result = await repo.uploadImage(pendingFile, targetId);
    if (active?.id !== targetId || !user) return;
    editor.insertEmbed(targetPosition, 'image', result.url, 'user');
    editor.formatText(targetPosition, 1, 'alt', alt, 'user');
    editor.insertText(targetPosition + 1, '\n', 'user'); editor.setSelection(targetPosition + 2, 0);
    selectImage([...editor.root.querySelectorAll('img')].find(image => image.src === result.url));
    $('imageDialog').close(); pendingFile = null; markDirty(); toast('Görsel yazıya eklendi.');
  } catch (error) { message('imageStatus', errorText(error), true); }
  finally { $('uploadImage').disabled = false; }
});
$('insertImage').addEventListener('click', chooseImage);
$('insertStep').addEventListener('click', () => {
  const number = editor.root.querySelectorAll('h2').length + 1;
  const index = editor.getLength() - 1;
  editor.insertText(index, `\n${number}. Adım: Başlığı yazın\n`, 'user');
  editor.formatLine(index + 1, 1, 'header', 2, 'user'); editor.setSelection(index + 1, 0); markDirty();
});
$('previewArticle').addEventListener('click', async () => {
  if (!active) return;
  $('previewContent').textContent = 'Önizleme hazırlanıyor…'; $('previewDialog').showModal();
  try { const data = rawArticle(); $('previewContent').innerHTML = articleMarkup(data, categories.find(c => c.id === data.category_id)?.name, await hydrateContent(data.content_html)); }
  catch (error) { $('previewContent').textContent = errorText(error); }
});
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('articleForm').addEventListener('submit', event => event.preventDefault());
$('articleForm').addEventListener('input', event => { if (!event.target.closest('.ql-editor')) markDirty(); });
$('articleTitle').addEventListener('input', () => { if (!slugEdited) $('articleSlug').value = slugify($('articleTitle').value); });
$('articleSlug').addEventListener('input', () => { slugEdited = true; });
document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => setStep(Number(button.dataset.step))));
$('nextStep').addEventListener('click', () => { setStep(step + 1); });
$('previousStep').addEventListener('click', () => setStep(step - 1));
$('saveDraft').addEventListener('click', () => save('draft'));
$('publishArticle').addEventListener('click', () => save('published'));
$('backToDashboard').addEventListener('click', leaveEditor);
$('newArticle').addEventListener('click', async () => {
  if (readDraft() && !confirm('Bu oturumda kurtarılabilir bir yazı var. Yeni yazı düzenlerseniz oturum yedeği değişir. Devam edilsin mi?')) return;
  try { await openEditor(); } catch (error) { message('dashboardStatus', errorText(error), true); }
});
$('restoreDraft').addEventListener('click', async () => {
  const draft = readDraft(); if (!draft) return;
  try { await openEditor({ ...draft.article, revision: draft.revision }, true); }
  catch (error) { message('dashboardStatus', errorText(error), true); }
});
$('discardDraft').addEventListener('click', () => { if (confirm('Kaydedilmemiş oturum kopyası silinsin mi?')) clearDraft(); });
$('adminSearch').addEventListener('input', renderDashboard); $('statusFilter').addEventListener('change', renderDashboard);
$('refreshDashboard').addEventListener('click', async () => { try { await refreshDashboard(); } catch (error) { message('dashboardStatus', errorText(error), true); } });
$('adminRows').addEventListener('click', async event => {
  const button = event.target.closest('[data-edit], [data-delete]'); if (!button || button.disabled) return;
  button.disabled = true;
  try {
    if (button.dataset.edit) {
      if (readDraft() && !confirm('Kaydedilmemiş bir oturum kopyası var. Bu yazıda değişiklik yaparsanız o kopyanın yerini alır. Devam edilsin mi?')) return;
      await openEditor(await repo.articleById(button.dataset.edit));
    } else {
      const article = allArticles.find(a => a.id === button.dataset.delete);
      if (!confirm(`“${article.title}” kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
      const result = await repo.removeArticle(article.id, article.revision);
      toast(result.mediaWarning ? 'Yazı silindi. Kalan görseller Storage üzerinden temizlenebilir.' : 'Yazı ve görselleri silindi.');
      await refreshDashboard();
    }
  } catch (error) { message('dashboardStatus', errorText(error), true); }
  finally { button.disabled = false; }
});

function renderCategoryManager() {
  $('categoryManager').innerHTML = categories.map(c => `<div class="category-item"><div><strong>${esc(c.name)}</strong><small>${allArticles.filter(a => a.category_id === c.id).length} yazı</small></div><div><button type="button" class="button secondary" data-category-edit="${c.id}">Düzenle</button> <button type="button" class="button danger" data-category-delete="${c.id}">Sil</button></div></div>`).join('');
}
$('manageCategories').addEventListener('click', () => { renderCategoryManager(); $('categoryForm').reset(); message('categoryStatus', ''); $('categoryDialog').showModal(); });
$('resetCategory').addEventListener('click', () => { $('categoryForm').reset(); $('categoryId').value = ''; });
$('categoryForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const data = { name: $('categoryName').value.trim(), description: $('categoryDescription').value.trim() };
    if ($('categoryId').value) data.id = $('categoryId').value;
    await repo.saveCategory(data); categories = await repo.categories(); renderCategoryManager(); renderDashboard();
    $('categoryForm').reset(); $('categoryId').value = ''; message('categoryStatus', 'Kategori kaydedildi.');
  } catch (error) { message('categoryStatus', errorText(error), true); }
  finally { button.disabled = false; }
});
$('categoryManager').addEventListener('click', async event => {
  const button = event.target.closest('[data-category-edit], [data-category-delete]'); if (!button) return;
  if (button.dataset.categoryEdit) {
    const category = categories.find(c => c.id === button.dataset.categoryEdit);
    $('categoryId').value = category.id; $('categoryName').value = category.name; $('categoryDescription').value = category.description;
    $('categoryName').focus(); return;
  }
  if (!confirm('Kategori silinsin mi? İçinde yazı varsa silinmez.')) return;
  button.disabled = true;
  try { await repo.removeCategory(button.dataset.categoryDelete); categories = await repo.categories(); renderCategoryManager(); renderDashboard(); message('categoryStatus', 'Kategori silindi.'); }
  catch (error) { message('categoryStatus', errorText(error), true); }
  finally { button.disabled = false; }
});

async function acceptSession(session) {
  if (!session) { user = null; showView('loginView'); $('signOut').hidden = true; return; }
  if (!await repo.isAdmin()) {
    await repo.client.auth.signOut(); user = null; showView('loginView');
    message('loginStatus', 'Bu hesabın içerik yönetimi yetkisi yok.', true); return;
  }
  user = session.user; $('signOut').hidden = false;
  if (recoveryMode) { showView('recoveryView'); return; }
  showView('dashboardView');
  try { await refreshDashboard(); } catch (error) { message('dashboardStatus', errorText(error), true); }
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); if (!repo.configured) return;
  $('loginButton').disabled = true; message('loginStatus', 'Giriş yapılıyor…');
  try {
    const { data, error } = await repo.client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (error) throw new Error('Giriş yapılamadı. E-posta ve parolanızı kontrol edin; çok sayıda denemeden sonra bir süre bekleyin.');
    $('password').value = ''; message('loginStatus', ''); await acceptSession(data.session);
  } catch (error) { message('loginStatus', errorText(error), true); }
  finally { $('loginButton').disabled = false; }
});
$('signOut').addEventListener('click', async () => {
  if (saving) return;
  if (dirty && !confirm('Kaydedilmemiş değişikliklerle çıkış yapılsın mı? Oturum yedeğiniz bu sekmede korunacak.')) return;
  writeLocalDraft(); $('signOut').disabled = true;
  try { const { error } = await repo.client.auth.signOut(); if (error) throw error; dirty = false; active = null; user = null; showView('loginView'); $('signOut').hidden = true; message('loginStatus', 'Çıkış yapıldı.'); }
  catch (error) { toast(errorText(error)); }
  finally { $('signOut').disabled = false; }
});
$('forgotPassword').addEventListener('click', async () => {
  if (!repo.configured) return;
  if (!$('email').value || !$('email').reportValidity()) { message('loginStatus', 'Önce yönetici e-posta adresinizi girin.', true); return; }
  $('forgotPassword').disabled = true;
  try {
    const redirectTo = new URL('admin.html', location.href).href;
    const { error } = await repo.client.auth.resetPasswordForEmail($('email').value.trim(), { redirectTo });
    if (error) throw error;
    message('loginStatus', 'Hesabınız uygunsa parola yenileme bağlantısı e-postanıza gönderildi.');
  } catch { message('loginStatus', 'E-posta gönderilemedi. Bir süre sonra tekrar deneyin veya Supabase üzerinden parola yenileyin.', true); }
  finally { $('forgotPassword').disabled = false; }
});
$('recoveryForm').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('recoveryPassword').value !== $('recoveryConfirm').value) { message('recoveryStatus', 'Parolalar eşleşmiyor.', true); return; }
  event.submitter.disabled = true;
  try {
    const { error } = await repo.client.auth.updateUser({ password: $('recoveryPassword').value }); if (error) throw error;
    recoveryMode = false; $('recoveryForm').reset(); history.replaceState(null, '', location.pathname);
    toast('Parolanız güncellendi.'); showView('dashboardView'); await refreshDashboard();
  } catch (error) { message('recoveryStatus', errorText(error), true); }
  finally { event.submitter.disabled = false; }
});
window.addEventListener('beforeunload', event => { if (dirty || saving) { writeLocalDraft(); event.preventDefault(); event.returnValue = ''; } });

async function init() {
  if (!repo.configured) {
    $('setupNotice').hidden = false;
    $('loginForm').querySelectorAll('input,button').forEach(el => { el.disabled = true; }); return;
  }
  repo.client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryMode = true;
      setTimeout(() => acceptSession(session).catch(error => message('loginStatus', errorText(error), true)), 0);
    }
    if (event === 'SIGNED_OUT') {
      writeLocalDraft(); dirty = false; user = null; active = null; ++editorRequest;
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      showView('loginView'); $('signOut').hidden = true;
    }
  });
  try { const { data, error } = await repo.client.auth.getSession(); if (error) throw error; await acceptSession(data.session); }
  catch (error) { message('loginStatus', errorText(error), true); }
}
init();
