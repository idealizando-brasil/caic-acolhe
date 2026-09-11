drop policy if exists teacher_requests_read on public.teacher_requests;
create policy teacher_requests_read on public.teacher_requests for select to authenticated using(
  teacher_id=(select auth.uid())
  or private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator']::public.app_role[])
);

drop policy if exists staff_requests_manage on public.teacher_requests;
create policy staff_requests_manage on public.teacher_requests for all to authenticated using(
  private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator']::public.app_role[])
) with check(
  private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator']::public.app_role[])
);

drop policy if exists reports_read on public.teacher_reports;
create policy reports_read on public.teacher_reports for select to authenticated using(
  teacher_id=(select auth.uid())
  or private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator']::public.app_role[])
);
