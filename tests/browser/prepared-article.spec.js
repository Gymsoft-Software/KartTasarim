import { test, expect } from '@playwright/test';
import { mockBackend, login } from './fixtures.js';

test('prepared article saves eight images as draft and reopens without duplication', async ({ page }) => {
  const state = await mockBackend(page);
  await login(page);
  await page.locator('#importPreparedArticle').click();
  await expect(page.locator('#editorStatus')).toContainText('8 görseliyle taslak olarak kaydedildi');
  const article = state.articles.find(item => item.slug === 'kullanici-adi-ve-sifre-degistirme');
  expect(article.status).toBe('draft');
  expect(state.uploaded).toHaveLength(8);
  expect(article.content_delta.ops.filter(op => op.insert?.image)).toHaveLength(8);
  expect(article.content_html.match(/<img /g)).toHaveLength(8);
  expect(article.content_html).toContain('<h2>');
  expect(article.content_html).toContain('<strong>');
  expect(article.content_html).not.toContain('Screenshot_');
  expect(article.content_text).toContain('gizlilik gereği');
  expect(state.categories.filter(item => item.name === 'İnsan Kaynakları')).toHaveLength(1);
  await page.locator('#previewArticle').click();
  await expect(page.locator('#previewContent img')).toHaveCount(8);
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.locator('#backToDashboard').click();
  await page.locator('#importPreparedArticle').click();
  await expect(page.locator('#editorView')).toBeVisible();
  expect(state.articles.filter(item => item.slug === article.slug)).toHaveLength(1);
  expect(state.uploaded).toHaveLength(8);
  await page.locator('[data-step="3"]').click();
  await page.locator('#publishArticle').click();
  await expect(page.locator('#editorStatus')).toContainText('Yazı yayınlandı');
  expect(article.status).toBe('published');
});

test('missing prepared image makes no server changes and permits retry', async ({ page }) => {
  const state = await mockBackend(page);
  await page.route('**/Screenshot_10.jpg', route => route.fulfill({ status: 404, body: 'Not found' }));
  await login(page);
  await page.locator('#importPreparedArticle').click();
  await expect(page.locator('#dashboardStatus')).toContainText('Görsel yüklenemedi');
  await expect(page.locator('#importPreparedArticle')).toBeEnabled();
  expect(state.articles).toHaveLength(3);
  expect(state.categories).toHaveLength(2);
  expect(state.uploaded).toHaveLength(0);
  await page.unroute('**/Screenshot_10.jpg');
  await page.locator('#importPreparedArticle').click();
  await expect(page.locator('#editorStatus')).toContainText('taslak olarak kaydedildi');
});
