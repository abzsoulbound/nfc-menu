-- Trigger to notify cart updates by sessionId.

-- CartItem table in Prisma maps to "CartItem".
-- cartId -> SessionCart.id, which is referenced by cartId.
-- We use sessionId from SessionCart for routing notifications.

create or replace function cart_item_session_id(cart_id text) returns text as $$
  select "sessionId" from "SessionCart" where id = cart_id;
$$ language sql stable;

create or replace function notify_cart_updates() returns trigger as $$
declare
  v_cart_id text;
  v_session_id text;
begin
  if (tg_op = 'DELETE') then
    v_cart_id := old."cartId";
  else
    v_cart_id := new."cartId";
  end if;

  v_session_id := cart_item_session_id(v_cart_id);
  if v_session_id is null then
    return null;
  end if;

  perform pg_notify(
    'cart_updates',
    json_build_object(
      'sessionId', v_session_id,
      'updatedAt', now()
    )::text
  );

  return null;
end;
$$ language plpgsql;

drop trigger if exists cart_item_notify on "CartItem";

create trigger cart_item_notify
  after insert or update or delete on "CartItem"
  for each row
  execute function notify_cart_updates();

-- Optional: If you want sessionId per cart item, update the function to join
-- via cart_item_session_id(new."cartId") and include that in pg_notify.
