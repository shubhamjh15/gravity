"use client";

/**
 * Store catalog manager — create/edit products, manage their variants and
 * stock. The console was read-only before this; ROADMAP 5.2 needs real CRUD.
 *
 * Prices are entered and displayed in RUPEES here because that is what a human
 * types. Conversion to paise happens once, server-side, via lib/money — this
 * component never multiplies by 100 (#1).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package, Plus, Pencil, Archive, Boxes, TriangleAlert } from "lucide-react";
import {
  upsertProduct,
  upsertVariant,
  archiveProduct,
  setStock,
} from "@/app/(admin)/admin/store/actions";
import { formatPaise, paise, paiseToRupees } from "@/lib/money";
import { FieldError } from "@/components/gravity/profile/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type VariantView = {
  id: string;
  sku: string;
  name: string;
  price_paise: number;
  stock: number;
  low_stock_threshold: number;
};

export type ProductView = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  mrp_paise: number;
  sale_price_paise: number;
  is_active: boolean;
  allow_partial: boolean;
  variants: VariantView[];
};

export function ProductManager({ products }: { products: ProductView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductView | null>(null);
  const [creating, setCreating] = useState(false);
  const [variantFor, setVariantFor] = useState<ProductView | null>(null);

  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
            Products ({products.length})
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Catalog, pricing and stock.
          </p>
        </div>
        <Button variant="glow" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          New product
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line py-14 text-center">
          <Package className="size-7 text-text-dim" />
          <p className="text-sm text-text-muted">
            No products yet. Create one to open the store.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => setEditing(p)}
              onAddVariant={() => setVariantFor(p)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}

      <ProductDialog
        open={creating || editing !== null}
        product={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          router.refresh();
        }}
      />

      <VariantDialog
        product={variantFor}
        onClose={() => setVariantFor(null)}
        onSaved={() => {
          setVariantFor(null);
          router.refresh();
        }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------

function ProductCard({
  product,
  onEdit,
  onAddVariant,
  onChanged,
}: {
  product: ProductView;
  onEdit: () => void;
  onAddVariant: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      const res = await archiveProduct({ product_id: product.id });
      if (res.success) {
        toast.success(res.message);
        onChanged();
      } else {
        toast.error(res.message);
      }
    });
  }

  const discounted = product.sale_price_paise < product.mrp_paise;

  return (
    <div className="rounded-xl border border-line bg-surface/40 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{product.name}</p>
            {!product.is_active ? (
              <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-text-dim">
                Inactive
              </span>
            ) : null}
            {product.allow_partial ? (
              <span className="rounded-full border border-crimson-700/40 bg-crimson-500/10 px-2 py-0.5 text-[10px] text-crimson-300">
                Part-payable
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-text-dim">/{product.slug}</p>
        </div>

        <div className="text-right">
          <p className="font-mono font-semibold">
            {formatPaise(paise(product.sale_price_paise), { compactWhole: true })}
          </p>
          {discounted ? (
            <p className="font-mono text-xs text-text-dim line-through">
              {formatPaise(paise(product.mrp_paise), { compactWhole: true })}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={onEdit}>
            <Pencil className="size-3" />
            Edit
          </Button>
          <Button size="xs" variant="ghost" disabled={pending} onClick={archive}>
            <Archive className="size-3" />
            Archive
          </Button>
        </div>
      </div>

      <div className="mt-4 border-t border-line/60 pt-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
            Variants ({product.variants.length})
          </p>
          <Button size="xs" variant="ghost" onClick={onAddVariant}>
            <Plus className="size-3" />
            Add variant
          </Button>
        </div>

        {product.variants.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            No variants — a product needs at least one before it can be bought.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {product.variants.map((v) => (
              <VariantRow key={v.id} variant={v} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VariantRow({
  variant,
  onChanged,
}: {
  variant: VariantView;
  onChanged: () => void;
}) {
  const [stock, setStockValue] = useState(String(variant.stock));
  const [pending, startTransition] = useTransition();

  const low = variant.stock <= variant.low_stock_threshold;
  const dirty = stock !== String(variant.stock);

  function save() {
    const next = Number.parseInt(stock, 10);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Stock must be zero or more.");
      return;
    }
    startTransition(async () => {
      const res = await setStock({ variant_id: variant.id, stock: next });
      if (res.success) {
        toast.success(res.message);
        onChanged();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-line/70 bg-void/40 px-3 py-2">
      <Boxes className="size-3.5 shrink-0 text-text-dim" />
      <span className="min-w-0 flex-1 truncate text-sm">{variant.name}</span>
      <span className="font-mono text-[11px] text-text-dim">{variant.sku}</span>
      <span className="font-mono text-sm">
        {formatPaise(paise(variant.price_paise), { compactWhole: true })}
      </span>

      <div className="flex items-center gap-1.5">
        {low ? (
          <TriangleAlert
            className="size-3.5 text-warning"
            aria-label={`Low stock: ${variant.stock} left`}
          />
        ) : null}
        <Label htmlFor={`stock-${variant.id}`} className="sr-only">
          Stock for {variant.name}
        </Label>
        <Input
          id={`stock-${variant.id}`}
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStockValue(e.target.value)}
          className={cn("h-7 w-20 text-sm", low && "border-warning/50")}
        />
        <Button
          size="xs"
          variant={dirty ? "glow" : "ghost"}
          disabled={pending || !dirty}
          onClick={save}
        >
          Save
        </Button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------

function ProductDialog({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: ProductView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "");
    const payload = {
      id: product?.id,
      name,
      slug: String(formData.get("slug") ?? "").trim(),
      description: String(formData.get("description") ?? "") || undefined,
      mrp_rupees: Number(formData.get("mrp_rupees") ?? 0),
      sale_price_rupees: Number(formData.get("sale_price_rupees") ?? 0),
      is_active: formData.get("is_active") === "on",
      allow_partial: formData.get("allow_partial") === "on",
    };

    startTransition(async () => {
      const res = await upsertProduct(payload);
      if (res.success) {
        setErrors({});
        toast.success(res.message);
        onSaved();
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Prices are in rupees. Stock lives on each variant.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              name="name"
              required
              defaultValue={product?.name ?? ""}
              placeholder="GRAVITY Jersey 2026"
            />
            <FieldError message={errors.name} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-slug">Slug</Label>
            <Input
              id="p-slug"
              name="slug"
              required
              defaultValue={product?.slug ?? ""}
              placeholder="gravity-jersey-2026"
            />
            <FieldError message={errors.slug} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              name="description"
              rows={3}
              defaultValue={product?.description ?? ""}
            />
            <FieldError message={errors.description} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-mrp">MRP (₹)</Label>
              <Input
                id="p-mrp"
                name="mrp_rupees"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={product ? paiseToRupees(paise(product.mrp_paise)) : ""}
              />
              <FieldError message={errors.mrp_rupees} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-price">Sale price (₹)</Label>
              <Input
                id="p-price"
                name="sale_price_rupees"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={
                  product ? paiseToRupees(paise(product.sale_price_paise)) : ""
                }
              />
              <FieldError message={errors.sale_price_rupees} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={product?.is_active ?? true}
                className="size-4 accent-crimson-500"
              />
              Visible in the store
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="allow_partial"
                defaultChecked={product?.allow_partial ?? false}
                className="size-4 accent-crimson-500"
              />
              Allow partial payment (two installments)
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={pending}>
              {pending ? "Saving…" : product ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VariantDialog({
  product,
  onClose,
  onSaved,
}: {
  product: ProductView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    if (!product) return;
    const payload = {
      product_id: product.id,
      sku: String(formData.get("sku") ?? "").trim(),
      name: String(formData.get("name") ?? ""),
      price_rupees: Number(formData.get("price_rupees") ?? 0),
      stock: Number(formData.get("stock") ?? 0),
      low_stock_threshold: Number(formData.get("low_stock_threshold") ?? 5),
    };

    startTransition(async () => {
      const res = await upsertVariant(payload);
      if (res.success) {
        setErrors({});
        toast.success(res.message);
        onSaved();
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={product !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a variant</DialogTitle>
          <DialogDescription>
            {product ? product.name : ""} — size, colour, or edition.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-name">Variant name</Label>
            <Input id="v-name" name="name" required placeholder="Size M / Crimson" />
            <FieldError message={errors.name} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-sku">SKU</Label>
            <Input id="v-sku" name="sku" required placeholder="GV-JRSY-26-M" />
            <FieldError message={errors.sku} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-price">Price (₹)</Label>
              <Input
                id="v-price"
                name="price_rupees"
                type="number"
                min={0}
                step="0.01"
                required
              />
              <FieldError message={errors.price_rupees} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-stock">Stock</Label>
              <Input
                id="v-stock"
                name="stock"
                type="number"
                min={0}
                required
                defaultValue={0}
              />
              <FieldError message={errors.stock} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-low">Low at</Label>
              <Input
                id="v-low"
                name="low_stock_threshold"
                type="number"
                min={0}
                defaultValue={5}
              />
              <FieldError message={errors.low_stock_threshold} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={pending}>
              {pending ? "Saving…" : "Add variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
