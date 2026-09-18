import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('RLS enforces single owner, private drafts, media access and optimistic revisions', async () => {
  const db = new PGlite();
  const admin = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const published = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const draft = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth, storage to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      insert into auth.users values ('${admin}'),('${other}');
    `);
    await db.exec(await readFile(new URL('../Destek/supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into public.support_admins(user_id) values ($1)', [admin]);
    await assert.rejects(db.query('insert into public.support_admins(user_id) values ($1)', [other]), /duplicate/);
    const category = (await db.query('select id from public.support_categories limit 1')).rows[0].id;
    const as = async (role, uid = '') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
      await db.exec(`set role ${role}`);
    };
    await as('authenticated', admin);
    assert.equal((await db.query('select public.support_is_admin() as yes')).rows[0].yes, true);
    await db.query(`insert into public.support_articles (id,title,slug,category_id,status) values ($1,'Yayın','yayin',$3,'published'),($2,'Gizli','gizli',$3,'draft')`, [published,draft,category]);
    await db.query(`insert into storage.objects(bucket_id,name) values ('support-media',$1),('support-media',$2)`, [`${published}/image.png`,`${draft}/private.png`]);
    assert.equal((await db.query('select * from public.support_articles')).rows.length, 2);
    await assert.rejects(db.query('delete from public.support_categories where id=$1', [category]), /foreign key/);
    const revision = (await db.query('update public.support_articles set title=$1 where id=$2 and revision=1 returning revision', ['Yeni başlık',published])).rows[0].revision;
    assert.equal(revision, 2);
    assert.equal((await db.query('update public.support_articles set title=$1 where id=$2 and revision=1 returning id', ['Eski pencere',published])).rows.length, 0);

    await as('anon');
    assert.equal((await db.query('select * from public.support_articles')).rows.length, 1);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    assert.equal((await db.query('select * from public.support_articles where slug=$1', ['gizli'])).rows.length, 0);
    await assert.rejects(db.query('update public.support_articles set title=$1', ['Saldırı']), /permission denied/);
    await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values ('support-media','bad.png')`), /row-level security/);

    await as('authenticated', other);
    assert.equal((await db.query('select public.support_is_admin() as yes')).rows[0].yes, false);
    assert.equal((await db.query('select * from public.support_admins')).rows.length, 0);
    assert.equal((await db.query('select * from public.support_articles')).rows.length, 1);
    assert.equal((await db.query('delete from public.support_articles returning id')).rows.length, 0);
    assert.equal((await db.query('update public.support_articles set title=$1 returning id', ['Saldırı'])).rows.length, 0);
    await assert.rejects(db.query('insert into public.support_admins(user_id) values ($1)', [other]), /permission denied/);
    await assert.rejects(db.query('insert into public.support_articles(title,slug,category_id) values ($1,$2,$3)', ['Yasak','yasak',category]), /row-level security/);
    await assert.rejects(db.query('insert into public.support_categories(name) values ($1)', ['Yasak']), /row-level security/);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);

    await as('authenticated', admin);
    await db.query("update public.support_articles set status='draft' where id=$1", [published]);
    await as('anon');
    assert.equal((await db.query('select * from public.support_articles')).rows.length, 0);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
  } finally { await db.close(); }
});
