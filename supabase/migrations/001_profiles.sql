-- profiles 테이블: 사용자 프로필 (auth.users와 1:1)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nickname text not null,
  birth_date date not null,
  created_at timestamptz default now()
);

-- RLS(Row Level Security) 활성화: 본인 데이터만 접근 가능
alter table public.profiles enable row level security;

-- 본인만 읽기
create policy "본인 프로필 읽기" on public.profiles
  for select using (auth.uid() = id);

-- 본인만 생성
create policy "본인 프로필 생성" on public.profiles
  for insert with check (auth.uid() = id);

-- 본인만 수정
create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = id);
