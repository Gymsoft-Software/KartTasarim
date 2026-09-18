-- Supabase SQL Editor'da bir kez çalıştırın. Yönetici ataması README'dedir.
begin;

create table public.support_admins (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.support_admins enable row level security;
revoke all on public.support_admins from anon, authenticated;
grant select on public.support_admins to authenticated;
create policy "Owner can see own membership" on public.support_admins
  for select to authenticated using (user_id = (select auth.uid()));

create function public.support_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.support_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.support_is_admin() from public;
grant execute on function public.support_is_admin() to anon, authenticated;

create table public.support_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 180),
  created_at timestamptz not null default now()
);
create table public.support_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  summary text not null default '' check (char_length(summary) <= 320),
  category_id uuid not null references public.support_categories(id) on delete restrict,
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  youtube_url text not null default '' check (char_length(youtube_url) <= 500),
  content_html text not null default '' check (char_length(content_html) <= 200000),
  content_delta jsonb not null default '{"ops":[{"insert":"\n"}]}',
  content_text text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  revision integer not null default 1
);
create index support_articles_category on public.support_articles(category_id);
create index support_articles_listing on public.support_articles(status, pinned desc, published_at desc);

create function public.support_touch_article() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if TG_OP = 'UPDATE' then
    new.revision = old.revision + 1;
    new.created_at = old.created_at;
  else
    new.revision = 1;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at = now(); end if;
  return new;
end;
$$;
create trigger support_article_updated before insert or update on public.support_articles
for each row execute function public.support_touch_article();

alter table public.support_categories enable row level security;
alter table public.support_articles enable row level security;
revoke all on public.support_categories, public.support_articles from anon, authenticated;
grant select on public.support_categories, public.support_articles to anon;
grant select, insert, update, delete on public.support_categories, public.support_articles to authenticated;
create policy "Everyone reads categories" on public.support_categories for select to anon, authenticated using (true);
create policy "Only owner manages categories" on public.support_categories for all to authenticated
  using ((select public.support_is_admin())) with check ((select public.support_is_admin()));
create policy "Readers only see published articles" on public.support_articles for select to anon, authenticated
  using (status = 'published' or (select public.support_is_admin()));
create policy "Only owner inserts articles" on public.support_articles for insert to authenticated
  with check ((select public.support_is_admin()));
create policy "Only owner updates articles" on public.support_articles for update to authenticated
  using ((select public.support_is_admin())) with check ((select public.support_is_admin()));
create policy "Only owner deletes articles" on public.support_articles for delete to authenticated
  using ((select public.support_is_admin()));

insert into public.support_categories (name, description) values
  ('Hesap & Kullanıcı', 'Kullanıcı bilgileri, parola ve hesap ayarları.'),
  ('Kurulum & Başlangıç', 'İlk kurulum ve kullanıma başlama rehberleri.'),
  ('Turnike & Cihazlar', 'Turnike, kart okuyucu ve cihaz işlemleri.'),
  ('Sık Sorulan Sorular', 'En çok merak edilen konular ve çözümleri.');

-- Görseller özeldir. Yayındaki yazıların görselleri ziyaretçilere imzalı URL ile sunulur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-media', 'support-media', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif']);
create policy "Read media for published articles or owner" on storage.objects for select to anon, authenticated
using (bucket_id = 'support-media' and (
  (select public.support_is_admin()) or exists (
    select 1 from public.support_articles a
    where a.id::text = split_part(name, '/', 1) and a.status = 'published'
  )
));
create policy "Only owner uploads support media" on storage.objects for insert to authenticated
with check (bucket_id = 'support-media' and (select public.support_is_admin()));
create policy "Only owner updates support media" on storage.objects for update to authenticated
using (bucket_id = 'support-media' and (select public.support_is_admin()))
with check (bucket_id = 'support-media' and (select public.support_is_admin()));
create policy "Only owner deletes support media" on storage.objects for delete to authenticated
using (bucket_id = 'support-media' and (select public.support_is_admin()));
commit;
