drop policy if exists notes_read on public.case_notes;
create policy notes_read on public.case_notes for select to authenticated using(
  (note_type='shared' and private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator','psychologist','social_worker']::public.app_role[]))
  or (note_type='confidential_psychology' and author_id=(select auth.uid()) and exists(select 1 from public.school_memberships m where m.school_id=case_notes.school_id and m.user_id=(select auth.uid()) and m.active and m.role='psychologist'))
  or (note_type='confidential_social' and author_id=(select auth.uid()) and exists(select 1 from public.school_memberships m where m.school_id=case_notes.school_id and m.user_id=(select auth.uid()) and m.active and m.role='social_worker'))
);

drop policy if exists notes_insert on public.case_notes;
create policy notes_insert on public.case_notes for insert to authenticated with check(
  author_id=(select auth.uid()) and (
    (note_type='shared' and private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator','psychologist','social_worker']::public.app_role[]))
    or (note_type='confidential_psychology' and exists(select 1 from public.school_memberships m where m.school_id=case_notes.school_id and m.user_id=(select auth.uid()) and m.active and m.role='psychologist'))
    or (note_type='confidential_social' and exists(select 1 from public.school_memberships m where m.school_id=case_notes.school_id and m.user_id=(select auth.uid()) and m.active and m.role='social_worker'))
  )
);

drop policy if exists own_notes_update on public.case_notes;
create policy own_notes_update on public.case_notes for update to authenticated using(author_id=(select auth.uid())) with check(
  author_id=(select auth.uid()) and (
    (note_type='shared' and private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator','psychologist','social_worker']::public.app_role[]))
    or (note_type='confidential_psychology' and exists(select 1 from public.school_memberships m where m.school_id=case_notes.school_id and m.user_id=(select auth.uid()) and m.active and m.role='psychologist'))
    or (note_type='confidential_social' and exists(select 1 from public.school_memberships m where m.school_id=case_notes.school_id and m.user_id=(select auth.uid()) and m.active and m.role='social_worker'))
  )
);
