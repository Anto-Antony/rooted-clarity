-- Roles enum
create type public.app_role as enum ('admin', 'head_staff', 'regular_staff', 'guest_staff', 'accountant', 'student');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  address text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role function
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  date_of_birth date,
  admission_date date not null default current_date,
  program text,
  status text not null default 'active',
  locked_at timestamptz,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.students enable row level security;
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create index students_user_id_idx on public.students(user_id);

-- Staff
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  designation text,
  department text,
  status text not null default 'active',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.staff enable row level security;
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();
create index staff_user_id_idx on public.staff(user_id);

-- staff_subjects
create table public.staff_subjects (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  subject text not null,
  unique (staff_id, subject)
);
alter table public.staff_subjects enable row level security;

-- Courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.courses enable row level security;
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- Classes
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  section text not null,
  academic_year text not null,
  class_teacher_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.classes enable row level security;
create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create index classes_course_id_idx on public.classes(course_id);
create index classes_teacher_idx on public.classes(class_teacher_id);

-- RLS POLICIES

-- profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Admins view all profiles" on public.profiles
  for select using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'));
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Admins update profiles" on public.profiles
  for update using (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "Users view own roles" on public.user_roles
  for select using (auth.uid() = user_id);
create policy "Admins view all roles" on public.user_roles
  for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- students
create policy "Authenticated view students" on public.students
  for select to authenticated using (true);
create policy "Admin/Head manage students" on public.students
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'));

-- staff
create policy "Authenticated view staff" on public.staff
  for select to authenticated using (true);
create policy "Admin/Head manage staff" on public.staff
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'));

-- staff_subjects
create policy "Authenticated view staff_subjects" on public.staff_subjects
  for select to authenticated using (true);
create policy "Admin/Head manage staff_subjects" on public.staff_subjects
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'));

-- courses
create policy "Authenticated view courses" on public.courses
  for select to authenticated using (true);
create policy "Admin/Head manage courses" on public.courses
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'));

-- classes
create policy "Authenticated view classes" on public.classes
  for select to authenticated using (true);
create policy "Admin/Head manage classes" on public.classes
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'head_staff'));
