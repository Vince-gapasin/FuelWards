-- Live prices on a private Realtime channel. On a public channel any client could also broadcast,
-- so someone could push fake "price verified" messages to every open app. On the private channel,
-- signed-in users may only receive (no insert policy), and only the database sends.
create or replace function public.broadcast_verified_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    -- A failed broadcast must never undo the verification (and the points that come with it).
    begin
      perform realtime.send(public.price_broadcast_payload(new), 'price_verified', 'prices', true);
    exception when others then
      raise warning 'price broadcast failed: %', sqlerrm;
    end;
  end if;
  return null;
end;
$$;

revoke execute on function public.broadcast_verified_price() from public, anon, authenticated;

create policy "signed-in users receive live prices" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'prices' and realtime.messages.extension = 'broadcast');
