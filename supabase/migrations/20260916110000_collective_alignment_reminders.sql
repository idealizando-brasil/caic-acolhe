create table if not exists public.collective_alignment_reminders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  scheduled_at timestamptz not null,
  note text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collective_alignment_note_length check (note is null or char_length(note) <= 500)
);
create index if not exists collective_alignment_school_schedule_idx on public.collective_alignment_reminders (school_id, active, scheduled_at);
alter table public.collective_alignment_reminders enable row level security;
create policy "school team can view collective alignments" on public.collective_alignment_reminders for select to authenticated using (exists (select 1 from public.school_memberships sm where sm.school_id = collective_alignment_reminders.school_id and sm.user_id = auth.uid() and sm.active = true and sm.role in ('director','coordinator','psychologist','social_worker')));
create policy "management can create collective alignments" on public.collective_alignment_reminders for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.school_memberships sm where sm.school_id = collective_alignment_reminders.school_id and sm.user_id = auth.uid() and sm.active = true and sm.role in ('director','coordinator')));
create policy "management can update collective alignments" on public.collective_alignment_reminders for update to authenticated using (exists (select 1 from public.school_memberships sm where sm.school_id = collective_alignment_reminders.school_id and sm.user_id = auth.uid() and sm.active = true and sm.role in ('director','coordinator'))) with check (exists (select 1 from public.school_memberships sm where sm.school_id = collective_alignment_reminders.school_id and sm.user_id = auth.uid() and sm.active = true and sm.role in ('director','coordinator')));
comment on table public.collective_alignment_reminders is 'Avisos institucionais de reunião e alinhamento coletivo, sem vínculo com estudantes ou atendimentos.';