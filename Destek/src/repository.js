import { createClient } from '@supabase/supabase-js';
const config = window.SUPPORT_CONFIG || {};
export const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
export const client = configured ? createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: true, storage: window.sessionStorage, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
const bucket = 'support-media';
const listColumns = 'id,title,slug,summary,category_id,tags,youtube_url,status,pinned,created_at,updated_at,published_at,revision';

function checked({ data, error }) { if (error) throw error; return data; }
export async function categories() { return checked(await client.from('support_categories').select('*').order('name')); }
export async function articles(admin = false) {
  let all = [], start = 0;
  while (true) {
    let query = client.from('support_articles').select(listColumns).order('created_at', { ascending: false }).order('id');
    if (!admin) query = query.eq('status', 'published');
    const page = checked(await query.range(start, start + 199));
    all.push(...page);
    if (page.length < 200) return all;
    start += 200;
  }
}
export async function articleBySlug(slug) { return checked(await client.from('support_articles').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()); }
export async function articleById(id) { return checked(await client.from('support_articles').select('*').eq('id', id).single()); }
export async function isAdmin() { return Boolean(checked(await client.rpc('support_is_admin'))); }
export async function saveArticle(article, revision = null) {
  const query = revision === null ? client.from('support_articles').insert(article)
    : client.from('support_articles').update(article).eq('id', article.id).eq('revision', revision);
  const data = checked(await query.select().maybeSingle());
  if (!data) throw new Error('Bu yazı başka bir pencerede değiştirildi veya yetkiniz sona erdi. İçeriğinizi kopyalayıp yazıyı yeniden açın.');
  return data;
}
export async function removeArticle(id, revision) {
  const rows = checked(await client.from('support_articles').delete().eq('id', id).eq('revision', revision).select('id'));
  if (!rows.length) throw new Error('Yazı değişmiş veya yetkiniz sona ermiş. Listeyi yenileyin.');
  // Kalan medya temizliği ayrı yapılır; yazı silindikten sonra müşteriler dosyalara erişemez.
  let mediaWarning = false;
  try {
    while (true) {
      const files = checked(await client.storage.from(bucket).list(id, { limit: 100 }));
      if (!files.length) break;
      checked(await client.storage.from(bucket).remove(files.map(file => `${id}/${file.name}`)));
    }
  } catch { mediaWarning = true; }
  return { mediaWarning };
}
export async function saveCategory(category) {
  return checked(await (category.id ? client.from('support_categories').update(category).eq('id', category.id)
    : client.from('support_categories').insert(category)).select().single());
}
export async function removeCategory(id) { checked(await client.from('support_categories').delete().eq('id', id)); }
export function mediaPath(value) {
  try {
    const url = new URL(value), base = new URL(config.supabaseUrl);
    if (url.origin !== base.origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:authenticated|sign)\/support-media\/([a-f0-9-]{36}\/[a-f0-9-]{36}\.(?:png|jpg|webp|gif))$/i);
    return match?.[1] || null;
  } catch { return null; }
}
export function canonicalMedia(path) { return `${config.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/authenticated/${bucket}/${path}`; }
export async function signMedia(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const data = checked(await client.storage.from(bucket).createSignedUrls(unique, 3600));
  return Object.fromEntries(data.filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
}
export async function uploadImage(file, articleId) {
  const types = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  if (!types[file.type]) throw new Error('PNG, JPG, WEBP veya GIF görseli seçin.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Görsel en fazla 5 MB olabilir.');
  if (!file.size) throw new Error('Görsel dosyası boş.');
  const path = `${articleId}/${crypto.randomUUID()}.${types[file.type]}`;
  checked(await client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false }));
  const signed = await signMedia([path]);
  if (!signed[path]) throw new Error('Görsel yüklendi ancak önizleme açılamadı.');
  return { path, url: signed[path] };
}
