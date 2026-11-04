-- AI StudySpace: sửa quyền RLS cho bảng subjects
-- Chạy trong Supabase Dashboard > SQL Editor của đúng project đang được website sử dụng.
-- Chính sách chỉ cho phép người dùng đã đăng nhập thao tác trên môn học của chính họ.

alter table public.subjects enable row level security;

-- Xóa các policy cũ có thể bị cấu hình sai / thiếu quyền INSERT.
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'subjects'
  loop
    execute format('drop policy if exists %I on public.subjects', p.policyname);
  end loop;
end $$;

create policy subjects_select_own
on public.subjects
for select
to authenticated
using (user_id = (select auth.uid()));

create policy subjects_insert_own
on public.subjects
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy subjects_update_own
on public.subjects
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy subjects_delete_own
on public.subjects
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Đảm bảo user_id tự nhận UUID của người đang đăng nhập nếu client không truyền.
alter table public.subjects
  alter column user_id set default auth.uid();

-- Kiểm tra nhanh: bảng phải bật RLS và có đủ 4 policy ở trên.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'subjects';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'subjects'
order by policyname;
