begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

set local role anon;
select lives_ok(
  $$ select id, username, display_name, avatar_url, created_at from public.profiles $$,
  'anyone can read the public profile columns'
);
select throws_ok(
  $$ select role from public.profiles $$,
  '42501',
  null,
  'role is hidden from the public'
);
select throws_ok(
  $$ select privacy_accepted_at from public.profiles $$,
  '42501',
  null,
  'privacy consent time is hidden from the public'
);

reset role;
set local role authenticated;
select throws_ok(
  $$ select role from public.profiles $$,
  '42501',
  null,
  'role is hidden from signed-in users too'
);
select throws_ok(
  $$ select * from public.profiles $$,
  '42501',
  null,
  'select * is refused, so new private columns stay private'
);

select * from finish();
rollback;
