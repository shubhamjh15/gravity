-- ============================================================================
-- GRAVITY · Migration 0017 — Store settlement (the missing half of Phase 5)
--
-- BUGS THIS FIXES:
--   1. store_payments was created in 0014 and never written by anything. There
--      was no record of a store payment beyond the ledger row.
--   2. store_payment_schedule rows were inserted at checkout and never marked
--      paid, so an installment plan could never progress.
--   3. store_orders.amount_paid_paise was never derived from captured payments
--      (ROADMAP 5.4 requires it) — it sat at 0 forever.
--   4. The webhook flipped ANY store payment to status 'paid', so paying the
--      first of two installments marked the whole order paid.
--   5. Inventory was never decremented on purchase — unlimited overselling.
--
-- The fix is one idempotent SECURITY DEFINER RPC that the webhook calls, so
-- store settlement follows the same shape as the rest of the money system:
-- one ingestion path (#5), amounts derived rather than accumulated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Idempotency key. The webhook already dedupes on razorpay_event_id, but a
-- retry with a different event id for the same payment must not double-credit
-- an order. This is the store's equivalent of the ledger's uq_ledger_rzp_payment.
-- ----------------------------------------------------------------------------
create unique index if not exists uq_store_payment_rzp
  on public.store_payments (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- Marks the moment stock was committed for an order, so a second installment
-- payment doesn't decrement inventory again.
alter table public.store_orders
  add column if not exists inventory_committed_at timestamptz;

comment on column public.store_orders.inventory_committed_at is
  'Set when stock was decremented for this order. Guards against double-decrement across installments.';

-- ----------------------------------------------------------------------------
-- settle_store_payment — record a captured store payment and derive order state.
--
-- Idempotent on p_razorpay_payment_id: a duplicate call is a no-op that returns
-- the existing payment row id. Everything downstream (amount_paid, status) is
-- RECOMPUTED from captured payments rather than incremented, so even a partial
-- failure mid-way self-heals on the retry.
-- ----------------------------------------------------------------------------
create or replace function public.settle_store_payment(
  p_order_id            uuid,
  p_razorpay_payment_id text,
  p_amount_paise        bigint,
  p_ledger_entry_id     uuid default null,
  p_schedule_id         uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id  uuid;
  v_schedule_id uuid;
  v_order       public.store_orders%rowtype;
  v_paid        bigint;
  v_status      text;
  v_item        record;
begin
  if p_order_id is null then
    raise exception 'settle_store_payment: order_id is required';
  end if;
  if p_amount_paise is null or p_amount_paise < 0 then
    raise exception 'settle_store_payment: amount_paise must be >= 0 (got %)', p_amount_paise;
  end if;

  -- Lock the order for the duration: two installments captured concurrently
  -- must not race on amount_paid/status/inventory.
  select * into v_order from public.store_orders where id = p_order_id for update;
  if not found then
    raise exception 'settle_store_payment: order % not found', p_order_id;
  end if;

  -- Idempotency: already recorded this payment?
  if p_razorpay_payment_id is not null then
    select id into v_payment_id
    from public.store_payments
    where razorpay_payment_id = p_razorpay_payment_id;

    if found then
      return v_payment_id;
    end if;
  end if;

  -- Which installment does this settle? Explicit wins; otherwise the oldest
  -- still-pending row (an overdue row is still pending money).
  v_schedule_id := p_schedule_id;
  if v_schedule_id is null then
    select id into v_schedule_id
    from public.store_payment_schedule
    where order_id = p_order_id
      and status in ('pending', 'overdue')
    order by due_at nulls first, created_at
    limit 1;
  end if;

  insert into public.store_payments (
    order_id, schedule_id, razorpay_payment_id, amount_paise, status, ledger_entry_id
  ) values (
    p_order_id, v_schedule_id, p_razorpay_payment_id, p_amount_paise, 'captured', p_ledger_entry_id
  )
  returning id into v_payment_id;

  if v_schedule_id is not null then
    update public.store_payment_schedule
    set status = 'paid'
    where id = v_schedule_id;
  end if;

  -- DERIVE, never accumulate (ROADMAP 5.4).
  select coalesce(sum(amount_paise), 0) into v_paid
  from public.store_payments
  where order_id = p_order_id and status = 'captured';

  if v_paid >= v_order.total_paise then
    v_status := 'paid';
  else
    v_status := 'partially_paid';
  end if;

  -- Commit stock exactly once, on the first captured payment. Money has already
  -- moved by the time we get here, so we clamp at zero rather than reject: an
  -- oversold line shows as 0 stock for the admin to reconcile.
  if v_order.inventory_committed_at is null then
    for v_item in
      select variant_id, qty from public.store_order_items where order_id = p_order_id
    loop
      update public.store_inventory
      set stock = greatest(stock - v_item.qty, 0)
      where variant_id = v_item.variant_id;
    end loop;

    -- Clear the purchased lines from the buyer's cart. This happens HERE, on
    -- confirmed payment, rather than at checkout — an abandoned checkout must
    -- not empty someone's cart. Scoped to the variants actually ordered so
    -- anything added since checkout survives.
    delete from public.store_cart_items ci
    using public.store_carts c
    where ci.cart_id = c.id
      and c.user_id  = v_order.user_id
      and ci.variant_id in (
        select variant_id from public.store_order_items where order_id = p_order_id
      );

    update public.store_orders
    set inventory_committed_at = now()
    where id = p_order_id;
  end if;

  update public.store_orders
  set amount_paid_paise = v_paid,
      status            = v_status
  where id = p_order_id;

  return v_payment_id;
end;
$$;

comment on function public.settle_store_payment is
  'Record a captured store payment, mark its installment paid, and DERIVE order amount_paid/status. Idempotent on razorpay_payment_id. Commits stock once.';

revoke all on function public.settle_store_payment(uuid, text, bigint, uuid, uuid) from public;
grant execute on function public.settle_store_payment(uuid, text, bigint, uuid, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- store_orders needed an owner-side UPDATE path for cancelling an unpaid order;
-- 0014 gave UPDATE to superadmin only. Owners may cancel while nothing is paid.
-- ----------------------------------------------------------------------------
create policy "store_orders: owner cancel unpaid"
  on public.store_orders for update to authenticated
  using (user_id = auth.uid() and status = 'pending' and amount_paid_paise = 0)
  with check (user_id = auth.uid() and status in ('pending', 'cancelled'));
