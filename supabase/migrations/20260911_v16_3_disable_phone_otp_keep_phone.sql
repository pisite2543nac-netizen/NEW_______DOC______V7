-- DOC-FULL-NR V16.3
-- Phone OTP is permanently disabled. profiles.phone remains contact data.

create or replace function public.get_phone_otp_config()
returns jsonb
language sql
stable
security definer
set search_path='public','private','pg_temp'
as $$
  select jsonb_build_object(
    'enabled', false,
    'mode', 'disabled',
    'phone_profile_only', true
  );
$$;

create or replace function public.set_phone_otp_enforcement(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
begin
  if auth.uid() is null or not private.is_admin(auth.uid()) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,metadata)
  values(
    auth.uid(),
    'PHONE_OTP_DISABLED',
    'system',
    jsonb_build_object(
      'requested_enabled',coalesce(p_enabled,false),
      'effective_enabled',false,
      'phone_profile_only',true
    )
  );

  return jsonb_build_object(
    'ok',true,
    'enabled',false,
    'mode','disabled',
    'phone_profile_only',true
  );
end;
$$;

grant execute on function public.get_phone_otp_config() to authenticated;
grant execute on function public.set_phone_otp_enforcement(boolean) to authenticated;
