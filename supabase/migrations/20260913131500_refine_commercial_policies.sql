drop policy plans_platform_manage on public.subscription_plans;
drop policy subscriptions_platform_manage on public.school_subscriptions;
drop policy payments_platform_manage on public.subscription_payments;

create policy plans_platform_insert on public.subscription_plans
for insert to authenticated with check (private.is_platform_admin());
create policy plans_platform_update on public.subscription_plans
for update to authenticated using (private.is_platform_admin())
with check (private.is_platform_admin());
create policy plans_platform_delete on public.subscription_plans
for delete to authenticated using (private.is_platform_admin());

create policy subscriptions_platform_insert on public.school_subscriptions
for insert to authenticated with check (private.is_platform_admin());
create policy subscriptions_platform_update on public.school_subscriptions
for update to authenticated using (private.is_platform_admin())
with check (private.is_platform_admin());
create policy subscriptions_platform_delete on public.school_subscriptions
for delete to authenticated using (private.is_platform_admin());

create policy payments_platform_insert on public.subscription_payments
for insert to authenticated with check (private.is_platform_admin());
create policy payments_platform_update on public.subscription_payments
for update to authenticated using (private.is_platform_admin())
with check (private.is_platform_admin());
create policy payments_platform_delete on public.subscription_payments
for delete to authenticated using (private.is_platform_admin());

create index school_applications_plan_idx
on public.school_applications(plan_code);
create index school_applications_school_idx
on public.school_applications(school_id)
where school_id is not null;
create index school_subscriptions_plan_idx
on public.school_subscriptions(plan_code);
