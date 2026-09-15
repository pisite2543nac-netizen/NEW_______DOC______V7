-- DOC-FULL-NR V17 master flow health wrapper
create or replace function public.admin_system_health_v17()
returns jsonb
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select public.admin_system_health_v1610()
    || jsonb_build_object('version','V17-MASTER-FLOW','frontend_router_contract','single-owner');
$$;
revoke all on function public.admin_system_health_v17() from public,anon;
grant execute on function public.admin_system_health_v17() to authenticated;
notify pgrst,'reload schema';
