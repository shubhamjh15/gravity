-- ============================================================================
-- GRAVITY · Demo seed data (optional)
-- Populates sample store products + categories + a featured demo community so
-- the public pages look alive in a demo. Run AFTER the schema migrations and
-- the base seed.sql. Safe to re-run (idempotent on slug/sku).
--
-- NOTE: events, registrations, results, and user-owned data require a real
-- logged-in user/organizer, so those are created through the app UI, not here.
-- This seed only fills the catalog + reference data that has no auth owner.
-- ============================================================================

-- ---- Store categories -------------------------------------------------------
insert into public.store_categories (name, slug, sort_order) values
  ('Jerseys',     'jerseys',     1),
  ('Peripherals', 'peripherals', 2),
  ('Accessories', 'accessories', 3),
  ('Passes',      'passes',      4)
on conflict (slug) do nothing;

-- ---- Store products ---------------------------------------------------------
with cat as (
  select id, slug from public.store_categories
)
insert into public.store_products (category_id, name, slug, description, mrp_paise, sale_price_paise, is_active, allow_partial)
select
  (select id from cat where slug = p.cat),
  p.name, p.slug, p.descr, p.mrp, p.sale, true, p.partial
from (values
  ('jerseys',     'GRAVITY Pro Jersey',      'gravity-pro-jersey',      'Breathable esports jersey with sublimated GRAVITY branding.', 199900, 149900, false),
  ('jerseys',     'GRAVITY Team Hoodie',     'gravity-team-hoodie',     'Heavyweight hoodie for the off-season grind.',                349900, 299900, true),
  ('peripherals', 'Apex Gaming Mouse',       'apex-gaming-mouse',       '26K DPI optical sensor, 60g ultralight shell.',              449900, 399900, true),
  ('peripherals', 'Tactile Mechanical KB',   'tactile-mechanical-kb',   'Hot-swappable switches, PBT keycaps, RGB.',                  599900, 549900, true),
  ('accessories', 'Pro Mousepad XL',         'pro-mousepad-xl',         'Stitched-edge control surface, 900x400mm.',                  129900, 99900,  false),
  ('passes',      'Season Pass — Monsoon',   'season-pass-monsoon',     'Entry credit for the Monsoon season tournaments.',           99900,  0,      false)
) as p(cat, name, slug, descr, mrp, sale, partial)
on conflict (slug) do nothing;

-- ---- Variants + inventory ---------------------------------------------------
-- One default variant per product, with stock.
insert into public.store_variants (product_id, sku, name, price_paise)
select pr.id, pr.slug || '-default', 'Default', coalesce(nullif(pr.sale_price_paise,0), pr.mrp_paise)
from public.store_products pr
on conflict (sku) do nothing;

insert into public.store_inventory (variant_id, stock, low_stock_threshold)
select v.id, 25, 5
from public.store_variants v
on conflict (variant_id) do nothing;

-- ---- A couple of public sponsors (visible on /sponsors) ---------------------
insert into public.sponsors (name, details, is_active) values
  ('Acme Energy',   'Official energy partner of GRAVITY tournaments.', true),
  ('NitroNet ISP',  'Low-latency connectivity for competitive play.',  true)
on conflict do nothing;

-- ---- About page placeholder content ----------------------------------------
insert into public.about_pages (slug, content_json)
values (
  'main',
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Our mission"}]},{"type":"paragraph","content":[{"type":"text","text":"GRAVITY exists to give every Indian gamer a real shot at competing for cash — fairly, transparently, and in one place."}]}]}'::jsonb
)
on conflict (slug) do nothing;
