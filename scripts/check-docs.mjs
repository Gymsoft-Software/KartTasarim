import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';

const root = resolve('.');
const skip = new Set(['.git', 'node_modules', 'test-results', 'playwright-report', 'arsiv']);
async function markdownFiles(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(item.name)) continue;
    const path = resolve(dir, item.name);
    if (item.isDirectory()) files.push(...await markdownFiles(path));
    else if (item.name.endsWith('.md')) files.push(path);
  }
  return files;
}
let checked = 0;
const errors = [];
const files = await markdownFiles(root);
for (const file of files) {
  const text = (await readFile(file, 'utf8')).replace(/```[\s\S]*?```/g, '');
  const targets = [...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(match => match[1]);
  targets.push(...[...text.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]));
  for (const target of targets) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
    const path = decodeURIComponent(target.split(/[?#]/)[0]);
    if (!path) continue;
    checked++;
    try { await access(resolve(dirname(file), path)); }
    catch { errors.push(`${relative(root, file)}: ${target}`); }
  }
}
if (errors.length) {
  console.error('Eksik belge bağlantıları:\n' + errors.join('\n'));
  process.exitCode = 1;
} else console.log(`${files.length} Markdown dosyasında ${checked} yerel bağlantı doğrulandı.`);
