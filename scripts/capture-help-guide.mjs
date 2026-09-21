import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { mockBackend, login, mockOrigin } from '../tests/browser/fixtures.js';

const output = 'docs/yardim-merkezi/gorseller';
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'ignore', windowsHide: true });
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch('http://127.0.0.1:4173/Destek/')).ok) break; } catch {}
    if (attempt > 40) throw new Error('Yerel sunucu başlatılamadı.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'msedge' : undefined });
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 1365, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Every external request is intercepted; the capture cannot modify live data.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const state = await mockBackend(page);
  state.articles[0].youtube_url = '';
  const shot = async name => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
    console.log(`Captured ${name}`);
  };
  await page.goto('/Destek/');
  await page.locator('.article-row').first().waitFor();
  await shot('01-rehber-listesi');
  const screen = await readFile(`${output}/01-rehber-listesi.png`);
  await page.route(`${mockOrigin}/storage/v1/object/sign/support-media/**`, route => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'image/png', body: screen }) : route.fallback());
  state.articles[0].title = 'Yardım merkezinde rehber nasıl bulunur?';
  state.articles[0].summary = 'Arama, kategori seçimi ve rehber bağlantısını paylaşma adımları.';
  state.articles[0].content_html = state.articles[0].content_html.replace(/<h2>1\..*?<\/p>/, '<h2>1. Konuyu arayın</h2><p>Arama alanına anahtar kelime yazın. Örneğin <strong>şifre</strong> yazarak ilgili rehberleri bulun.</p>').replace(/<h2>2\..*$/, '<h2>2. Kategoriyle daraltın</h2><p>İlgili kategoriyi seçin ve okumak istediğiniz rehbere tıklayın.</p><h2>3. Bağlantıyı paylaşın</h2><p>Sağdaki Bağlantıyı kopyala düğmesiyle bu rehberin adresini paylaşabilirsiniz.</p>').replace('alt="Hesap ayarları"', 'alt="Yardım Merkezi rehber listesi"');
  await page.goto('/Destek/?yazi=kullanici-adi-ve-sifre');
  await page.locator('#articleContent h1').waitFor();
  await page.locator('.article-body img').evaluate(img => img.decode());
  await shot('02-rehber-okuma');
  await page.goto('/Destek/admin.html');
  await page.locator('#loginButton:not([disabled])').waitFor();
  await shot('03-yonetici-girisi');
  await login(page);
  await page.locator('#adminRows tr').first().waitFor();
  await shot('04-yonetim-paneli');
  await page.locator('#manageCategories').click();
  await page.locator('#categoryName').fill('Sık Sorulan Sorular');
  await page.locator('#categoryDescription').fill('En sık karşılaşılan sorular ve kısa yanıtları.');
  await shot('05-kategoriler');
  await page.locator('#categoryDialog [data-close-dialog]').click();
  await page.locator('#newArticle').click();
  await page.locator('#articleTitle').fill('Yardım merkezinde arama nasıl yapılır?');
  await page.locator('#articleCategory').selectOption({ label: 'Kurulum & Başlangıç' });
  await page.locator('#articleSummary').fill('Aradığınız bilgiye anahtar kelime ve kategori kullanarak ulaşın.');
  await page.locator('#articleTags').fill('arama, rehber, başlangıç');
  await shot('06-baslik-kategori');
  await page.locator('#nextStep').click();
  await page.locator('.ql-editor').fill('Arama alanına öğrenmek istediğiniz konuyu yazın. Örneğin şifre yazarak hesap rehberlerini bulabilirsiniz.\nSonuçları daraltmak için soldaki kategorilerden birini seçin.');
  await page.locator('.ql-editor').press('ControlOrMeta+End');
  await page.locator('#insertImage').click();
  await page.locator('#imageFile').setInputFiles({ name: 'yardim-merkezi.png', mimeType: 'image/png', buffer: screen });
  await page.locator('#imageAlt').fill('Yardım Merkezi arama alanı ve kategori listesi');
  await shot('07-gorsel-yukleme');
  await page.locator('#uploadImage').click();
  await page.locator('.ql-editor img').waitFor();
  await page.locator('.ql-editor img').evaluate(img => img.decode());
  await page.locator('[data-image-width="75%"]') .click();
  await shot('08-icerik-gorsel-boyutu');
  await page.locator('#nextStep').click();
  await page.locator('#articlePinned').check();
  await page.locator('#saveDraft').click();
  await page.locator('#editorStatus').filter({ hasText: 'Taslak kaydedildi' }).waitFor();
  await shot('09-kontrol-yayin');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('9 ekran görüntüsü hazır; canlı veriye erişilmedi.');
} finally {
  await browser?.close();
  server.kill();
}
