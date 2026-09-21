import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';

const output = 'docs/kart-tasarim/gorseller';
await mkdir(output, { recursive: true });
const files = (await readdir('KartKatalog')).filter(name => /\.(png|jpe?g|webp|gif|avif)$/i.test(name));
const server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'ignore', windowsHide: true });
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch('http://127.0.0.1:4173/kart-tasarim.html')).ok) break; } catch {}
    if (attempt > 40) throw new Error('Yerel sunucu başlatılamadı.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'msedge' : undefined });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 1365, height: 1050 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.route('https://api.github.com/repos/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(files.map(name => ({
    type: 'file', name, download_url: `http://127.0.0.1:4173/KartKatalog/${encodeURIComponent(name)}`, html_url: `https://github.com/Gymsoft-Software/KartTasarim/blob/main/KartKatalog/${encodeURIComponent(name)}`,
  }))) }));
  const shot = async (name, fullPage = false) => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].filter(img => img.getBoundingClientRect().top < innerHeight).map(img => img.decode().catch(() => {})));
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    await page.screenshot({ path: `${output}/${name}.png`, fullPage, animations: 'disabled' });
    console.log(`Captured ${name}`);
  };
  await page.goto('/kart-tasarim.html');
  await expect(page.locator('.design-card')).toHaveCount(files.length);
  await shot('01-katalog');
  await page.locator('#searchInput').fill('alpagu');
  await expect(page.locator('.design-card')).toHaveCount(2);
  await shot('02-tasarim-arama');
  await page.getByRole('button', { name: 'alpagu ön.png tasarımını büyüt', exact: true }).click();
  await expect(page.locator('#previewModal')).toBeVisible();
  await shot('03-onizleme');
  await page.locator('#copyName').click();
  await expect(page.locator('#copyName')).toHaveText('Kopyalandı ✓');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('alpagu ön.png');
  await shot('04-dosya-adi-kopyalama');
  const original = page.waitForEvent('popup');
  await page.locator('#openOriginal').click();
  const originalPage = await original;
  await originalPage.waitForLoadState();
  if (!decodeURIComponent(originalPage.url()).endsWith('/KartKatalog/alpagu ön.png')) throw new Error('Orijinal görsel bağlantısı hatalı.');
  await originalPage.close();
  await page.locator('#closeModal').click();
  await page.locator('#searchInput').fill('olmayan-tasarim');
  await expect(page.locator('#emptyState')).toBeVisible();
  await shot('05-sonuc-bulunamadi');
  await page.locator('#searchInput').fill('alpagu');
  await page.locator('#refreshBtn').click();
  await expect(page.locator('.design-card')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('06-mobil-katalog', true);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('6 ekran görüntüsü hazır. Arama, önizleme, kopyalama, orijinali açma ve yenileme doğrulandı.');
} finally {
  await browser?.close();
  server.kill();
}
