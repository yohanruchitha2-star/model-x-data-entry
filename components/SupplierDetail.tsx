"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { money } from "@/lib/money";
import type { Invoice, Receipt, Supplier } from "@/lib/types";
import { SetupNotice } from "./SetupNotice";

export function SupplierDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [paidByInvoice, setPaidByInvoice] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      const [supRes, invRes, recRes, payRes] = await Promise.all([
        db().from("suppliers").select("*").eq("id", id).single(),
        db().from("invoices").select("*").eq("supplier_id", id).order("invoice_date", { ascending: false }),
        db().from("receipts").select("*").eq("supplier_id", id).order("receipt_date", { ascending: false }),
        db().from("receipt_payments").select("invoice_id, amount"),
      ]);
      if (cancelled) return;
      if (supRes.error) {
        setError(friendlyError(supRes.error));
        setLoading(false);
        return;
      }
      setSupplier(supRes.data as Supplier);
      if (invRes.error) setError(friendlyError(invRes.error));
      else setInvoices((invRes.data ?? []) as Invoice[]);
      if (recRes.error) setError(friendlyError(recRes.error));
      else setReceipts((recRes.data ?? []) as Receipt[]);
      const paid: Record<string, number> = {};
      for (const row of (payRes.data ?? []) as { invoice_id: string; amount: number }[]) {
        paid[row.invoice_id] = (paid[row.invoice_id] ?? 0) + Number(row.amount);
      }
      setPaidByInvoice(paid);
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
  }, [id]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <p className="text-slate-600">Loading supplier…</p>;
  if (!supplier) {
    return (
      <div className="paper p-5">
        <p>Supplier not found.</p>
        <Link href="/" className="btn btn-secondary mt-4">
          Back to suppliers
        </Link>
      </div>
    );
  }

  async function removeSupplier() {
    if (!supplier) return;
    if (!confirm(`Delete ${supplier.name} and all of this supplier's invoices and receipts?`)) {
      return;
    }
    setDeleting(true);
    const { error: delError } = await db().from("suppliers").delete().eq("id", supplier.id);
    if (delError) {
      setError(friendlyError(delError));
      setDeleting(false);
      return;
    }
    router.push("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-[#1a365d] hover:underline">
            ← All suppliers
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[#1a365d]">{supplier.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/suppliers/${supplier.id}/invoices/new`} className="btn btn-primary">
            Add invoice
          </Link>
          <Link href={`/suppliers/${supplier.id}/receipts/new`} className="btn btn-primary">
            Add receipt
          </Link>
          <Link href={`/suppliers/${supplier.id}/edit`} className="btn btn-secondary">
            Edit details
          </Link>
        </div>
      </div>

      {error ? <p className="banner-error">{error}</p> : null}

      <section className="paper p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Supplier details
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Detail label="Credit days" value={supplier.credit_days ?? "—"} />
          <Detail label="Phone 1" value={supplier.phone1} />
          <Detail label="Phone 2" value={supplier.phone2} />
          <Detail label="Email" value={supplier.email} />
          <Detail label="Related company 1" value={supplier.related_company_1} />
          <Detail label="Related company 2" value={supplier.related_company_2} />
          <div className="sm:col-span-2">
            <Detail label="Address" value={supplier.address} />
          </div>
        </dl>
      </section>

      <section className="paper overflow-x-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-[#1a365d]">Invoices</h2>
          <span className="text-sm text-slate-500">{invoices.length} saved</span>
        </div>
        <table className="entry-table">
          <thead>
            <tr>
              <th>Invoice no.</th>
              <th>Invoice date</th>
              <th>Delivery date</th>
              <th className="text-right">Total</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-5 text-slate-500">
                  No invoices yet. Add one from the paper bill.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const paid = paidByInvoice[inv.id] ?? 0;
                const balance = Number(inv.total) - paid;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2">
                      <Link
                        href={`/suppliers/${supplier.id}/invoices/${inv.id}`}
                        className="font-medium text-[#1a365d] hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{inv.invoice_date || "—"}</td>
                    <td className="px-2 py-2">{inv.delivery_date || "—"}</td>
                    <td className="px-2 py-2 text-right">{money(Number(inv.total))}</td>
                    <td className="px-2 py-2 text-right">{money(paid)}</td>
                    <td className="px-2 py-2 text-right">{money(balance)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <section className="paper overflow-x-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-[#1a365d]">Receipts</h2>
          <span className="text-sm text-slate-500">{receipts.length} saved</span>
        </div>
        <table className="entry-table">
          <thead>
            <tr>
              <th>Receipt no.</th>
              <th>Date</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-5 text-slate-500">
                  No receipts yet. Add one from the paper payment receipt.
                </td>
              </tr>
            ) : (
              receipts.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50">
                  <td className="px-2 py-2">
                    <Link
                      href={`/suppliers/${supplier.id}/receipts/${rec.id}`}
                      className="font-medium text-[#1a365d] hover:underline"
                    >
                      {rec.receipt_number}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{rec.receipt_date || "—"}</td>
                  <td className="px-2 py-2 capitalize">{rec.payment_method}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <button className="btn btn-danger" type="button" disabled={deleting} onClick={removeSupplier}>
        {deleting ? "Deleting…" : "Delete supplier"}
      </button>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap">{value || "—"}</dd>
    </div>
  );
}
