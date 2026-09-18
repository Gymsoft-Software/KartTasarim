import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, youtubeId, filterArticles, validateArticle, imageWidth } from '../Destek/src/core.js';

test('Image widths accept only bounded percentages, not pixel sizes or injected styles', () => {
  for (const width of ['10%', '25%', '37%', '50%', '75%', '100%']) assert.equal(imageWidth(width), width);
  for (const width of [null, '', 400, '400px', '400', '0%', '9%', '101%', '-25%', '50%;height:1px', '100% onload=alert(1)']) assert.equal(imageWidth(width), '50%');
});

test('Turkish titles produce stable shareable slugs', () => {
  assert.equal(slugify('Kullanıcı Adı ve ŞİFRE nasıl değiştirilir?'), 'kullanici-adi-ve-sifre-nasil-degistirilir');
  assert.equal(slugify('  Ödeme / Üyelik & Çıkış  '), 'odeme-uyelik-cikis');
});
test('YouTube parsing supports watch, short, embed, mobile and live URLs', () => {
  for (const url of ['https://youtu.be/abcdefghijk?t=12', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://m.youtube.com/shorts/abcdefghijk', 'https://youtube-nocookie.com/embed/abcdefghijk', 'https://youtube.com/live/abcdefghijk']) assert.equal(youtubeId(url), 'abcdefghijk');
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://example.com/watch?v=abcdefghijk', 'https://youtube.com/watch?v=bad', 'https://youtube.com/playlist?list=abcdefghijk', '']) assert.equal(youtubeId(url), null);
});
test('Search combines category, multiple Turkish words and tags', () => {
  const items = [
    { title:'Şifre değiştirme', category_id:'account', tags:['Kullanıcı'], pinned:false, updated_at:'2026-01-01' },
    { title:'Cihaz kurulumu', category_id:'devices', tags:[], pinned:true, updated_at:'2025-01-01' },
  ];
  assert.equal(filterArticles(items, {query:'sifre kullanici',category:'account'}).length, 1);
  assert.equal(filterArticles(items, {query:'sifre',category:'devices'}).length, 0);
  assert.equal(filterArticles(items)[0].title, 'Cihaz kurulumu');
});
test('Publishing rejects missing content and invalid video links', () => {
  const valid = { title:'Test', slug:'test', category_id:'x', content_text:'Birinci adım', content_html:'<p>Birinci adım</p>', status:'published', tags:[] };
  assert.equal(validateArticle(valid), valid);
  assert.throws(() => validateArticle({...valid, content_text:' '}));
  assert.throws(() => validateArticle({...valid, youtube_url:'https://evil.test/video'}));
  assert.throws(() => validateArticle({...valid, slug:'../test'}));
  assert.throws(() => validateArticle({...valid, tags:Array(9).fill('tag')}));
});
