-- Psicologia e Serviço Social recebem o encaminhamento e gerenciam o agendamento.
drop policy if exists appointments_insert on public.appointments;
drop policy if exists appointments_update on public.appointments;
drop policy if exists appointments_delete on public.appointments;

create policy appointments_insert on public.appointments for insert to authenticated with check (
  referral_id is not null
  and private.has_school_role(school_id, array['psychologist','social_worker']::public.app_role[])
  and exists (select 1 from public.referrals r where r.id=referral_id and r.school_id=appointments.school_id and r.student_id=appointments.student_id and r.status <> 'completed')
  and exists (select 1 from public.school_memberships m where m.school_id=appointments.school_id and m.user_id=appointments.professional_id and m.active and m.role in ('psychologist','social_worker'))
);

create policy appointments_update on public.appointments for update to authenticated using (
  private.has_school_role(school_id, array['psychologist','social_worker']::public.app_role[])
) with check (
  referral_id is not null
  and private.has_school_role(school_id, array['psychologist','social_worker']::public.app_role[])
  and exists (select 1 from public.referrals r where r.id=referral_id and r.school_id=appointments.school_id and r.student_id=appointments.student_id)
  and exists (select 1 from public.school_memberships m where m.school_id=appointments.school_id and m.user_id=appointments.professional_id and m.active and m.role in ('psychologist','social_worker'))
);

create policy appointments_delete on public.appointments for delete to authenticated using (
  private.has_school_role(school_id, array['psychologist','social_worker']::public.app_role[])
);

create or replace function private.sync_referral_status_from_appointment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.referral_id is not null and new.status='scheduled' then
    update public.referrals
       set status='scheduled', assigned_to=coalesce(assigned_to,new.professional_id), updated_at=now()
     where id=new.referral_id and school_id=new.school_id and status <> 'completed';
  end if;
  return new;
end; $$;

drop trigger if exists sync_referral_status_after_appointment on public.appointments;
create trigger sync_referral_status_after_appointment
after insert or update of status,referral_id,professional_id on public.appointments
for each row execute function private.sync_referral_status_from_appointment();
