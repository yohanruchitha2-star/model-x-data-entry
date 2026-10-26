"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ItemAutocomplete } from "@/components/ItemAutocomplete";
import { SetupNotice } from "@/components/SetupNotice";
import { db, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import {
  emptyToNull,
  lineTotal,
  money,
  newKey,
  round2,
  round3,
  toNumber,
} from "@/lib/money";
import type { InvoiceLineDraft, Item, Supplier } from "@/lib/types";
import { useItems } from "@/lib/useItems";

function blankLine(): InvoiceLineDraft {
  return {
    key: newKey(),
    sku: "",
    item_name: "",
    quantity: "",
    mro: "",
    discount: "",
    line_total: "",
  };
}

export function InvoiceForm({ invoiceId }: { invoiceId?: string }) {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const router = useRouter();
  const { items, remember } = useItems();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [specialDiscount, setSpecialDiscount] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([blankLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supplierId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      const { data: sup, error: supError } = await db()
        .from("suppliers")
        .select("*")
        .eq("id", supplierId)
        .single();
      if (cancelled) return;
      if (supError) {
        setError(friendlyError(supError));
        setLoading(false);
        return;
      }
      setSupplier(sup as Supplier);
      if (!invoiceId) {
        setLoading(false);
        return;
      }
      const [{ data: inv, error: invError }, { data: itemRows, error: itemError }] =
        await Promise.all([
          db().from("invoices").select("*").eq("id", invoiceId).single(),
          db().from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
        ]);
      if (cancelled) return;
      if (invError) {
        setError(friendlyError(invError));
        setLoading(false);
        return;
      }
      if (itemError) setError(friendlyError(itemError));
      setInvoiceNumber(inv.invoice_number ?? "");
      setInvoiceDate(inv.invoice_date ?? "");
      setDeliveryDate(inv.delivery_date ?? "");
      setSpecialDiscount(
        inv.special_discount == null || Number(inv.special_discount) === 0
          ? ""
          : String(inv.special_discount),
      );
      const loaded = (itemRows ?? []).map((row) => ({
        key: row.id as string,
        sku: (row.sku as string) ?? "",
        item_name: (row.item_name as string) ?? "",
        quantity: row.quantity == null ? "" : String(row.quantity),
        mro: row.mro == null ? "" : String(row.mro),
        discount: row.discount == null ? "" : String(row.discount),
        line_total: row.line_total == null ? "" : String(row.line_total),
      }));
      setLines(loaded.length > 0 ? loaded : [blankLine()]);
      setLoading(false);
    }
    load().catch((err) => {
      if (!cancelled) {
        setError(friendlyError(err));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, supplierId]);

  const itemsSubtotal = useMemo(
    () => round2(lines.reduce((sum, line) => sum + toNumber(line.line_total), 0)),
    [lines],
  );
  const invoiceTotal = round2(itemsSubtotal - toNumber(specialDiscount));

  function updateLine(key: string, patch: Partial<InvoiceLineDraft>, recalc = false) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (recalc) {
          next.line_total = String(
            lineTotal(toNumber(next.quantity), toNumber(next.mro), toNumber(next.discount)),
          );
        }
        return next;
      }),
    );
  }

  function pickItem(key: string, item: Item) {
    updateLine(
      key,
      {
        item_name: item.name,
        sku: item.sku ?? "",
      },
      false,
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    if (!invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }
    const filled = lines.filter((line) => line.item_name.trim());
    if (filled.length === 0) {
      setError("Add at least one item with a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const header = {
        supplier_id: supplier.id,
        invoice_number: invoiceNumber.trim(),
        invoice_date: emptyToNull(invoiceDate),
        delivery_date: emptyToNull(deliveryDate),
        special_discount: round2(toNumber(specialDiscount)),
        total: invoiceTotal,
        updated_at: new Date().toISOString(),
      };
      let savedId = invoiceId;
      if (invoiceId) {
        const { error: updateError } = await db().from("invoices").update(header).eq("id", invoiceId);
        if (updateError) throw updateError;
        const { error: deleteError } = await db()
          .from("invoice_items")
          .delete()
          .eq("invoice_id", invoiceId);
        if (deleteError) throw deleteError;
      } else {
        const { data, error: insertError } = await db()
          .from("invoices")
          .insert(header)
          .select("id")
          .single();
        if (insertError) throw insertError;
        savedId = data.id as string;
      }
      const rows = filled.map((line, index) => ({
        invoice_id: savedId,
        sku: emptyToNull(line.sku),
        item_name: line.item_name.trim(),
        quantity: round3(toNumber(line.quantity)),
        mro: round2(toNumber(line.mro)),
        discount: round2(toNumber(line.discount)),
        line_total: round2(toNumber(line.line_total)),
        sort_order: index,
      }));
      const { error: itemsError } = await db().from("invoice_items").insert(rows);
      if (itemsError) throw itemsError;
      for (const line of filled) {
        await remember(line.item_name, line.sku);
      }
      router.push(`/suppliers/${supplier.id}`);
    } catch (err) {
      setError(friendlyError(err));
      setSaving(false);
    }
  }

  async function removeInvoice() {
    if (!invoiceId || !supplier) return;
    if (!confirm("Delete this invoice and its item lines?")) return;
    setSaving(true);
    const { error: delError } = await db().from("invoices").delete().eq("id", invoiceId);
    if (delError) {
      setError(friendlyError(delError));
      setSaving(false);
      return;
    }
    router.push(`/suppliers/${supplier.id}`);
  }

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <p className="text-slate-600">Loading invoice…</p>;
  if (!supplier) {
    return <p>Supplier not found.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="paper overflow-hidden">
      <div className="border-b-2 border-[#1a365d] bg-[#1a365d] px-5 py-3 text-white">
        <Link href={`/suppliers/${supplier.id}`} className="text-xs text-blue-100 hover:underline">
          ← {supplier.name}
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">PURCHASE INVOICE</h1>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Invoice number
          </span>
          <input
            className="field"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Invoice date
          </span>
          <input
            className="field"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Delivery date
          </span>
          <input
            className="field"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="banner-error mx-5 mb-4">{error}</p> : null}

      <div className="overflow-x-auto px-5 pb-2">
        <table className="entry-table">
          <thead>
            <tr>
              <th className="w-28">Item SKU</th>
              <th>Item name</th>
              <th className="w-24">Qty</th>
              <th className="w-28">MRO</th>
              <th className="w-28">Discount</th>
              <th className="w-32">Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.key}>
                <td>
                  <ItemAutocomplete
                    kind="sku"
                    value={line.sku}
                    items={items}
                    placeholder="SKU"
                    onChange={(value) => updateLine(line.key, { sku: value })}
                    onPick={(item) => pickItem(line.key, item)}
                  />
                </td>
                <td>
                  <ItemAutocomplete
                    kind="name"
                    value={line.item_name}
                    items={items}
                    placeholder="Item name"
                    onChange={(value) => updateLine(line.key, { item_name: value })}
                    onPick={(item) => pickItem(line.key, item)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input text-right"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value }, true)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input text-right"
                    inputMode="decimal"
                    value={line.mro}
                    onChange={(e) => updateLine(line.key, { mro: e.target.value }, true)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input text-right"
                    inputMode="decimal"
                    value={line.discount}
                    onChange={(e) => updateLine(line.key, { discount: e.target.value }, true)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input field-readonly text-right"
                    readOnly
                    value={line.line_total === "" ? "" : money(toNumber(line.line_total))}
                    tabIndex={-1}
                  />
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    className="px-2 text-slate-500 hover:text-red-700"
                    onClick={() =>
                      setLines((current) =>
                        current.length === 1
                          ? [blankLine()]
                          : current.filter((row) => row.key !== line.key),
                      )
                    }
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right font-medium">
                Items subtotal
              </td>
              <td className="px-3 py-2 text-right">{money(itemsSubtotal)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right font-medium">
                Special / bulk discount
              </td>
              <td>
                <input
                  className="cell-input text-right"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={specialDiscount}
                  onChange={(e) => setSpecialDiscount(e.target.value)}
                />
              </td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right">
                Invoice total
              </td>
              <td className="px-3 py-2 text-right">{money(invoiceTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <button
          type="button"
          className="btn btn-secondary mt-3"
          onClick={() => setLines((current) => [...current, blankLine()])}
        >
          Add item row
        </button>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-200 px-5 py-4">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save invoice"}
        </button>
        <Link href={`/suppliers/${supplier.id}`} className="btn btn-secondary">
          Cancel
        </Link>
        {invoiceId ? (
          <button
            type="button"
            className="btn btn-danger ml-auto"
            disabled={saving}
            onClick={removeInvoice}
          >
            Delete invoice
          </button>
        ) : null}
      </div>
    </form>
  );
}
