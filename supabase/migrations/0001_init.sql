-- =====================================================================
-- AI StudySpace - schema, RLS, storage, hàm tìm kiếm (RAG)
-- Chạy toàn bộ file này trong Supabase -> SQL Editor (hoặc `supabase db push`)
-- =====================================================================
create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- subjects ----------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  code text, teacher text, semester text,
  color text not null default '#2563eb',
  icon text not null default '📘',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.subjects (user_id);

-- ---------- documents ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  category text not null default 'textbook'
    check (category in ('textbook','slide','reference','assignment','exam','solution','note')),
  storage_path text not null,
  mime text,
  size bigint not null default 0,
  status text not null default 'pending'
    check (status in ('pending','processing','ready','failed','unsupported')),
  error text,
  page_count int,
  chunk_count int,
  created_at timestamptz not null default now()
);
create index on public.documents (subject_id);
create index on public.documents (user_id);

-- ---------- document_chunks (RAG) ----------
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  location text,            -- "Trang 5", "Slide 12", "Phần 3", "Sheet ..."
  page int,
  chapter text,             -- "Chương 3: ..." (tự nhận diện)
  embedding vector(1536),   -- null nếu chưa cấu hình embedding
  fts tsvector generated always as (to_tsvector('simple', content)) stored
);
create index on public.document_chunks (subject_id);
create index on public.document_chunks (document_id, chunk_index);
create index on public.document_chunks using gin (fts);
-- Không tạo index vector: tìm kiếm chính xác (exact) theo từng môn học đủ nhanh và đúng hơn ANN khi có lọc.

-- ---------- assignments ----------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  content text,
  solution text,
  tips text,
  chapter text,
  done boolean not null default false,
  important boolean not null default false,
  attachment_path text,
  attachment_name text,
  created_at timestamptz not null default now()
);
create index on public.assignments (subject_id);

-- ---------- notes ----------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  title text not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- exams ----------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  kind text not null default 'exam',
  exam_date timestamptz not null,
  location text,
  created_at timestamptz not null default now()
);

-- ---------- outlines ----------
create table public.outlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------- quizzes / attempts ----------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  config jsonb not null default '{}'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score numeric not null default 0,
  total int not null default 0,
  percent numeric not null default 0,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- chat / activities ----------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);
create index on public.chat_messages (subject_id, created_at);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index on public.activities (user_id, created_at desc);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['subjects','documents','document_chunks','assignments','notes','exams',
                           'outlines','quizzes','quiz_attempts','chat_messages','activities']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own_rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;

  -- Chặn gắn dữ liệu vào môn học của người khác (policy RESTRICTIVE)
  foreach t in array array['documents','document_chunks','assignments','notes','exams',
                           'outlines','quizzes','quiz_attempts','chat_messages','activities']
  loop
    execute format('create policy "subject_owned_ins" on public.%I as restrictive for insert to authenticated with check (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid()))', t);
    execute format('create policy "subject_owned_upd" on public.%I as restrictive for update to authenticated using (true) with check (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid()))', t);
  end loop;
end $$;

-- =====================================================================
-- STORAGE: bucket riêng tư, mỗi user chỉ truy cập thư mục <user_id>/...
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

create policy "documents_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- HÀM TRUY XUẤT (SECURITY INVOKER => RLS vẫn áp dụng, luôn lọc theo môn học)
-- =====================================================================
create or replace function public.match_chunks(p_subject_id uuid, p_embedding vector(1536), p_count int default 12)
returns table (id uuid, document_id uuid, document_name text, category text, location text, chapter text, content text, score float)
language sql stable security invoker as $$
  select c.id, c.document_id, d.name, d.category, c.location, c.chapter, c.content,
         (1 - (c.embedding <=> p_embedding))::float
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.subject_id = p_subject_id and c.user_id = auth.uid() and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit p_count
$$;

create or replace function public.search_chunks(p_subject_id uuid, p_query text, p_count int default 12)
returns table (id uuid, document_id uuid, document_name text, category text, location text, chapter text, content text, score float)
language sql stable security invoker as $$
  select c.id, c.document_id, d.name, d.category, c.location, c.chapter, c.content,
         ts_rank(c.fts, q.query)::float
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  cross join (select to_tsquery('simple', p_query) as query) q
  where c.subject_id = p_subject_id and c.user_id = auth.uid() and c.fts @@ q.query
  order by ts_rank(c.fts, q.query) desc
  limit p_count
$$;

create or replace function public.subject_chapters(p_subject_id uuid)
returns table (chapter text)
language sql stable security invoker as $$
  select distinct c.chapter from public.document_chunks c
  where c.subject_id = p_subject_id and c.user_id = auth.uid() and c.chapter is not null
$$;
