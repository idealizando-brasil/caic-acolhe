alter table public.students
  add column if not exists enrollment_number text,
  add column if not exists mother_name text,
  add column if not exists father_name text;

create unique index if not exists students_school_enrollment_unique
  on public.students (school_id, enrollment_number)
  where enrollment_number is not null;
