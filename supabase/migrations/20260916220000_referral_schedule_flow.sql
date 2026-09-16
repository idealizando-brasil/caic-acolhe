-- Fluxo institucional: Direção/Coordenação encaminham; Equipe Multiprofissional agenda e acompanha.

-- Encaminhamentos: leitura para equipe autorizada, criação somente Direção/Coordenação.
drop policy if exists staff_referrals on public.referrals;
drop policy if exists referrals_read on public.referrals;
drop policy if exists referrals_insert on public.referrals;
drop policy if exists referrals_update on public.referrals;
drop policy if exists referrals_delete on public.referrals;

create policy referrals_read on public.referrals
for select to authenticated
using (private.has_school_role(school_id, array['director','coordinator','psychologist','social_worker']::public.app_role[]));

create policy referrals_insert on public.referrals
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.has_school_role(school_id, array['director','coordinator']::public.app_role[])
);

create policy referrals_update on public.referrals
for update to authenticated
using (private.has_school_role(school_id, array['director','coordinator','psychologist','social_worker']::public.app_role[]))
with check (private.has_school_role(school_id, array['director','coordinator','psychologist','social_worker']::public.app_role[]));

create policy referrals_delete on public.referrals
for delete to authenticated
using (private.has_school_role(school_id, array['director','coordinator']::public.app_role[]));

-- Todo novo agendamento precisa nascer de um encaminhamento válido do mesmo aluno/escola.
drop policy if exists staff_appointments on public.appointments;
drop policy if exists appointments_read on public.appointments;
drop policy if exists appointments_insert on public.appointments;
drop policy if exists appointments_update on public.appointments;
drop policy if exists appointments_delete on public.appointments;

create policy appointments_read on public.appointments
for select to authenticated
using (private.has_school_role(school_id, array['director','coordinator','psychologist','social_worker']::public.app_role[]));

create policy appointments_insert on public.appointments
for insert to authenticated
with check (
  referral_id is not null
  and private.has_school_role(school_id, array['director','coordinator','psychologist','social_worker']::public.app_role[])
  and exists (
    select 1 from public.referrals r
    where r.id = referral_id
      and r.school_id = appointments.school_id
      and r.student_id = appointments.student_id
      and r.status <> 'completed'
  )
);

create policy appointments_update on public.appointments
for update to authenticated
using (private.has_school_role(school_id, array['director','coordinator','psychologist','social_worker']::public.app_role[]))
with check (
  referral_id is not null
  and private.has_school_role(school_id, array['director','coordinator','psychologist','social_worker']::public.app_role[])
  and exists (
    select 1 from public.referrals r
    where r.id = referral_id
      and r.school_id = appointments.school_id
      and r.student_id = appointments.student_id
  )
);

create policy appointments_delete on public.appointments
for delete to authenticated
using (private.has_school_role(school_id, array['director','coordinator','psychologist','social_worker']::public.app_role[]));
