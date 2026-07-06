-- ============================================================================
-- GRAVITY · Migration 0014 — Store (e-commerce, super-admin managed)
-- Catalog + inventory + cart + orders + partial-payment installments + reviews.
-- Money in paise. Super-admin manages the catalog; users own their cart/orders.
-- Wires the deferred store_order FK on ledger_entries.
-- ============================================================================

create table public.store_categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      citext not null unique,
  parent_id uuid references public.store_categories (id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.store_products (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references public.store_categories (id) on delete set null,
  name            text not null,
  slug            citext not null unique,
  description     text,
  mrp_paise       bigint not null default 0 check (mrp_paise >= 0),
  sale_price_paise bigint not null default 0 check (sale_price_paise >= 0),
  is_active       boolean not null default true,
  allow_partial   boolean not null default false,    -- partial-payment eligible
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create trigger trg_store_products_updated_at
  before update on public.store_products for each row execute function public.set_updated_at();
create index idx_store_products_cat on public.store_products (category_id);

create table public.store_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.store_products (id) on delete cascade,
  sku         citext not null unique,
  name        text not null,                          -- e.g. "Size M / Red"
  price_paise bigint not null check (price_paise >= 0),
  created_at  timestamptz not null default now()
);
create index idx_store_variants_product on public.store_variants (product_id);

create table public.store_product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products (id) on delete cascade,
  image_path text not null,
  sort_order int not null default 0
);
create index idx_store_images_product on public.store_product_images (product_id);

create table public.store_inventory (
  id                 uuid primary key default gen_random_uuid(),
  variant_id         uuid not null unique references public.store_variants (id) on delete cascade,
  stock              int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5,
  updated_at         timestamptz not null default now()
);
create trigger trg_store_inventory_updated_at
  before update on public.store_inventory for each row execute function public.set_updated_at();

create table public.store_carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_store_carts_updated_at
  before update on public.store_carts for each row execute function public.set_updated_at();

create table public.store_cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.store_carts (id) on delete cascade,
  variant_id uuid not null references public.store_variants (id) on delete cascade,
  qty        int not null default 1 check (qty > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table public.store_orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete restrict,
  status            text not null default 'pending'
                      check (status in ('pending','paid','partially_paid','shipped','delivered','cancelled','refunded')),
  delivery_status   text not null default 'pending'
                      check (delivery_status in ('pending','processing','shipped','delivered')),
  total_paise       bigint not null check (total_paise >= 0),
  amount_paid_paise bigint not null default 0 check (amount_paid_paise >= 0),
  is_partial        boolean not null default false,
  shipping_address  jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_store_orders_updated_at
  before update on public.store_orders for each row execute function public.set_updated_at();
create index idx_store_orders_user on public.store_orders (user_id);

create table public.store_order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.store_orders (id) on delete cascade,
  variant_id      uuid not null references public.store_variants (id) on delete restrict,
  qty             int not null check (qty > 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0)
);
create index idx_store_order_items_order on public.store_order_items (order_id);

create table public.store_payment_schedule (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.store_orders (id) on delete cascade,
  due_paise  bigint not null check (due_paise >= 0),
  due_at     timestamptz,
  status     text not null default 'pending' check (status in ('pending','paid','overdue')),
  created_at timestamptz not null default now()
);
create index idx_store_schedule_order on public.store_payment_schedule (order_id);

create table public.store_payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.store_orders (id) on delete restrict,
  schedule_id         uuid references public.store_payment_schedule (id) on delete set null,
  razorpay_payment_id text,
  amount_paise        bigint not null check (amount_paise >= 0),
  status              text not null default 'pending' check (status in ('pending','captured','failed')),
  ledger_entry_id     uuid references public.ledger_entries (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index idx_store_payments_order on public.store_payments (order_id);

create table public.store_reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index idx_store_reviews_product on public.store_reviews (product_id);

-- Deferred ledger FK.
alter table public.ledger_entries
  add constraint fk_ledger_store_order
    foreign key (store_order_id) references public.store_orders (id) on delete restrict;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.store_categories     enable row level security;
alter table public.store_products        enable row level security;
alter table public.store_variants        enable row level security;
alter table public.store_product_images  enable row level security;
alter table public.store_inventory       enable row level security;
alter table public.store_carts           enable row level security;
alter table public.store_cart_items      enable row level security;
alter table public.store_orders          enable row level security;
alter table public.store_order_items     enable row level security;
alter table public.store_payment_schedule enable row level security;
alter table public.store_payments        enable row level security;
alter table public.store_reviews         enable row level security;

-- Catalog: public read; superadmin write.
do $$
declare t text;
begin
  foreach t in array array['store_categories','store_products','store_variants','store_product_images','store_inventory']
  loop
    execute format('create policy "%s: public read" on public.%I for select using (true);', t, t);
    execute format('create policy "%s: superadmin write" on public.%I for all to authenticated using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()));', t, t);
  end loop;
end $$;

-- Cart: owner only.
create policy "store_carts: owner" on public.store_carts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "store_cart_items: owner" on public.store_cart_items for all to authenticated
  using (exists (select 1 from public.store_carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.store_carts c where c.id = cart_id and c.user_id = auth.uid()));

-- Orders: owner reads own; superadmin all. Inserts via server.
create policy "store_orders: owner read" on public.store_orders for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));
create policy "store_orders: owner insert" on public.store_orders for insert to authenticated
  with check (user_id = auth.uid());
create policy "store_orders: superadmin manage" on public.store_orders for update to authenticated
  using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()));

create policy "store_order_items: read" on public.store_order_items for select to authenticated
  using (exists (select 1 from public.store_orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_superadmin(auth.uid()))));
create policy "store_order_items: insert" on public.store_order_items for insert to authenticated
  with check (exists (select 1 from public.store_orders o where o.id = order_id and o.user_id = auth.uid()));

create policy "store_schedule: read" on public.store_payment_schedule for select to authenticated
  using (exists (select 1 from public.store_orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_superadmin(auth.uid()))));
create policy "store_payments: read" on public.store_payments for select to authenticated
  using (exists (select 1 from public.store_orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_superadmin(auth.uid()))));

-- Reviews: public read; verified-purchase insert (owner of a delivered order).
create policy "store_reviews: public read" on public.store_reviews for select using (true);
create policy "store_reviews: verified purchase insert"
  on public.store_reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.store_orders o
      join public.store_order_items oi on oi.order_id = o.id
      join public.store_variants v on v.id = oi.variant_id
      where o.user_id = auth.uid()
        and o.delivery_status = 'delivered'
        and v.product_id = store_reviews.product_id
    )
  );
