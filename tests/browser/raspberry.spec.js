import { test, expect } from '@playwright/test';
import { mockBackend, mockOrigin } from './fixtures.js';

async function enter(page) {
  await page.goto('/RaspberryManager/');
  await page.getByLabel('E-posta (kullanıcı adı)').fill('owner@example.com');
  await page.getByLabel('Parola', { exact: true }).fill('test-password-for-fixture');
  await page.locator('#managerLoginBtn').click();
}

test('manager requires login, opens without agent, restores session and signs out', async ({ page }) => {
  await mockBackend(page);
  let calls = 0;
  await page.route('http://127.0.0.1:5000/**', route => { calls++; return route.abort(); });
  await page.goto('/RaspberryManager/');
  await expect(page.locator('#managerLoginBtn')).toBeEnabled();
  await expect(page.locator('.shell')).toBeHidden();
  expect(calls).toBe(0);
  await enter(page);
  await expect(page.locator('#managerLoginGate')).toBeHidden();
  await expect(page.locator('#agentDownloadGate')).toBeVisible();
  await page.locator('#agentGateContinueBtn').click();
  await expect(page.locator('.shell')).toBeVisible();
  await page.reload();
  await expect(page.locator('#managerLoginGate')).toBeHidden();
  await page.locator('#agentGateContinueBtn').click();
  await page.locator('#managerLogoutBtn').click();
  await expect(page.locator('#managerLoginBtn')).toBeEnabled();
  await expect(page.locator('.shell')).toBeHidden();
});

test('manager rejects accounts without administrator permission', async ({ page }) => {
  await mockBackend(page, { admin: false });
  await enter(page);
  await expect(page.locator('#managerLoginStatus')).toContainText('yönetici yetkisi bulunmuyor');
  await expect(page.locator('.shell')).toBeHidden();
  expect(await page.evaluate(() => typeof window.checkGitHubPagesAgent)).toBe('undefined');
});

test('manager reports invalid password and permits retry', async ({ page }) => {
  await mockBackend(page);
  await page.route(`${mockOrigin}/auth/v1/token**`, route => route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'invalid_credentials',message:'Invalid login credentials'})}));
  await enter(page);
  await expect(page.locator('#managerLoginStatus')).toContainText('Giriş yapılamadı');
  await expect(page.locator('#managerLoginBtn')).toBeEnabled();
  await expect(page.locator('.shell')).toBeHidden();
});

test('manager fails closed when configuration is missing', async ({ page }) => {
  await page.route('**/Destek/config.js', route => route.fulfill({contentType:'text/javascript',body:'window.SUPPORT_CONFIG={};'}));
  await page.goto('/RaspberryManager/');
  await expect(page.locator('#managerLoginStatus')).toContainText('yapılandırması eksik');
  await expect(page.locator('#managerLoginBtn')).toBeDisabled();
  await expect(page.locator('.shell')).toBeHidden();
});

test('manager opens directly when agent is running', async ({ page }) => {
  await mockBackend(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://127.0.0.1:5000/**', route => route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,name:'Test Agent',version:'test',devices:[],entries:[]})}));
  await enter(page);
  await expect(page.locator('#agentState')).toContainText('Bağlı');
  await expect(page.locator('#agentDownloadGate')).toBeHidden();
  await expect(page.locator('.shell')).toBeVisible();
  expect(errors).toEqual([]);
});
