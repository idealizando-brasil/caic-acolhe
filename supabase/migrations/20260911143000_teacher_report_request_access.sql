drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated using(
  private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator','psychologist','social_worker']::public.app_role[])
  or private.is_teacher_for_student(id)
  or exists(select 1 from public.teacher_requests request where request.student_id=students.id and request.teacher_id=(select auth.uid()))
);

drop policy if exists teacher_reports_insert on public.teacher_reports;
create policy teacher_reports_insert on public.teacher_reports for insert to authenticated with check(
  teacher_id=(select auth.uid()) and (
    private.is_teacher_for_student(student_id)
    or exists(select 1 from public.teacher_requests request where request.id=teacher_reports.request_id and request.student_id=teacher_reports.student_id and request.teacher_id=(select auth.uid()))
  )
);
