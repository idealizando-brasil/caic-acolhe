-- Atendimento multiprofissional: dois campos com níveis de acesso distintos.
-- A Escuta Ativa/Demanda fica em tabela separada para impedir que RLS exponha
-- o conteúdo sigiloso junto com a parte compartilhada do atendimento.

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  referral_id uuid references public.referrals(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  author_id uuid not null references public.profiles(id),
  guidance_referrals text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_private_demands (
  attendance_id uuid primary key references public.attendances(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  demand text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendances enable row level security;
alter table public.attendance_private_demands enable row level security;

-- Somente Direção, Coordenação, Psicologia e Assistência Social participam do módulo.
create policy attendances_read on public.attendances for select to authenticated using (
  exists (
    select 1 from public.school_memberships m
    where m.school_id=attendances.school_id and m.user_id=(select auth.uid()) and m.active
      and m.role in ('director','coordinator','psychologist','social_worker')
  )
);

create policy attendances_insert on public.attendances for insert to authenticated with check (
  author_id=(select auth.uid()) and exists (
    select 1 from public.school_memberships m
    where m.school_id=attendances.school_id and m.user_id=(select auth.uid()) and m.active
      and m.role in ('director','coordinator','psychologist','social_worker')
  )
);

create policy attendances_update_own on public.attendances for update to authenticated
using (author_id=(select auth.uid()))
with check (
  author_id=(select auth.uid()) and exists (
    select 1 from public.school_memberships m
    where m.school_id=attendances.school_id and m.user_id=(select auth.uid()) and m.active
      and m.role in ('director','coordinator','psychologist','social_worker')
  )
);

-- Escuta/Demanda: exclusivamente o autor do atendimento. Nem direção, matriz ou
-- outro membro da equipe consegue selecionar o texto de outro profissional.
create policy private_demands_read_own on public.attendance_private_demands for select to authenticated
using (author_id=(select auth.uid()));

create policy private_demands_insert_own on public.attendance_private_demands for insert to authenticated
with check (
  author_id=(select auth.uid()) and exists (
    select 1 from public.attendances a
    where a.id=attendance_private_demands.attendance_id
      and a.school_id=attendance_private_demands.school_id
      and a.author_id=(select auth.uid())
  )
);

create policy private_demands_update_own on public.attendance_private_demands for update to authenticated
using (author_id=(select auth.uid()))
with check (author_id=(select auth.uid()));

create index if not exists attendances_school_created_idx on public.attendances(school_id,created_at desc);
create index if not exists attendances_student_created_idx on public.attendances(student_id,created_at desc);
