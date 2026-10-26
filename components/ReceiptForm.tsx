"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SetupNotice } from "@/components/SetupNotice";
import { db, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { emptyToNull, money, newKey, round2, toNumber } from "@/lib/money";
import type {
  ChequeDraft,
  Invoice,
  PaymentDraft,
  Receipt,
  Supplier,
} from "@/lib/types";

function blankPayment(): PaymentDraft {
  return { key: newKey(), invoice_id: "", amount: "" };
}

function blankCheque(): ChequeDraft {
  return { key: newKey(), cheque_number: "", bank_name: "", cheque_date: "" };
}

export function ReceiptForm({ receiptId }: { receiptId?: string }) {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paidElsewhere, setPaidElsewhere] = useState<Record<string, number>>({});
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [method, setMethod] = useState<"cash" | "cheque">("cash");
  const [payments, setPayments] = useState<PaymentDraft[]>([blankPayment()]);
  const [cheques, setCheques] = useState<ChequeDraft[]>([blankCheque()]);
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
      const [supRes, invRes] = await Promise.all([
        db().from("suppliers").select("*").eq("id", supplierId).single(),
        db()
          .from("invoices")
          .select("*")
          .eq("supplier_id", supplierId)
          .order("invoice_date", { ascending: false }),
      ]);
      if (cancelled) return;
      if (supRes.error) {
        setError(friendlyError(supRes.error));
        setLoading(false);
        return;
      }
      setSupplier(supRes.data as Supplier);
      const invoiceRows = (invRes.data ?? []) as Invoice[];
      setInvoices(invoiceRows);

      const ids = invoiceRows.map((row) => row.id);
      let paymentRows: { receipt_id: string; invoice_id: string; amount: number }[] = [];
      if (ids.length > 0) {
        const payRes = await db()
          .from("receipt_payments")
          .select("receipt_id, invoice_id, amount")
          .in("invoice_id", ids);
        if (payRes.error) {
          setError(friendlyError(payRes.error));
        } else {
          paymentRows = (payRes.data ?? []) as typeof paymentRows;
        }
      }

      const elsewhere: Record<string, number> = {};
      for (const row of paymentRows) {
        if (receiptId && row.receipt_id === receiptId) continue;
        elsewhere[row.invoice_id] = (elsewhere[row.invoice_id] ?? 0) + Number(row.amount);
      }
      setPaidElsewhere(elsewhere);

      if (receiptId) {
        const [{ data: rec, error: recError }, { data: recPays }, { data: recCheques }] =
          await Promise.all([
            db().from("receipts").select("*").eq("id", receiptId).single(),
            db().from("receipt_payments").select("*").eq("receipt_id", receiptId),
            db().from("receipt_cheques").select("*").eq("receipt_id", receiptId),
          ]);
        if (cancelled) return;
        if (recError) {
          setError(friendlyError(recError));
          setLoading(false);
          return;
        }
        const receipt = rec as Receipt;
        setReceiptNumber(receipt.receipt_number);
        setReceiptDate(receipt.receipt_date ?? "");
        setMethod(receipt.payment_method);
        const payDrafts = (recPays ?? []).map((row) => ({
          key: row.id as string,
          invoice_id: row.invoice_id as string,
          amount: String(row.amount ?? ""),
        }));
        setPayments(payDrafts.length > 0 ? payDrafts : [blankPayment()]);
        const chequeDrafts = (recCheques ?? []).map((row) => ({
          key: row.id as string,
          cheque_number: (row.cheque_number as string) ?? "",
          bank_name: (row.bank_name as string) ?? "",
          cheque_date: (row.cheque_date as string) ?? "",
        }));
        setCheques(chequeDrafts.length > 0 ? chequeDrafts : [blankCheque()]);
      }

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
  }, [receiptId, supplierId]);

  const invoiceById = useMemo(() => {
    const map: Record<string, Invoice> = {};
    for (const inv of invoices) map[inv.id] = inv;
    return map;
  }, [invoices]);

  const receiptTotal = useMemo(
    () => round2(payments.reduce((sum, row) => sum + toNumber(row.amount), 0)),
    [payments],
  );

  function outstanding(invoiceId: string, paymentKey: string): number {
    const inv = invoiceById[invoiceId];
    if (!inv) return 0;
    const otherOnThisReceipt = payments.reduce((sum, row) => {
      if (row.key === paymentKey || row.invoice_id !== invoiceId) return sum;
      return sum + toNumber(row.amount);
    }, 0);
    return round2(Number(inv.total) - (paidElsewhere[invoiceId] ?? 0) - otherOnThisReceipt);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    if (!receiptNumber.trim()) {
      setError("Receipt number is required.");
      return;
    }
    const filledPayments = payments.filter(
      (row) => row.invoice_id && toNumber(row.amount) > 0,
    );
    if (filledPayments.length === 0) {
      setError("Add at least one invoice payment.");
      return;
    }
    if (method === "cheque") {
      const filledCheques = cheques.filter((row) => row.cheque_number.trim());
      if (filledCheques.length === 0) {
        setError("Cheque payment needs at least one cheque number.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const header = {
        supplier_id: supplier.id,
        receipt_number: receiptNumber.trim(),
        receipt_date: emptyToNull(receiptDate),
        payment_method: method,
        updated_at: new Date().toISOString(),
      };
      let savedId = receiptId;
      if (receiptId) {
        const { error: updateError } = await db().from("receipts").update(header).eq("id", receiptId);
        if (updateError) throw updateError;
        const { error: delPay } = await db()
          .from("receipt_payments")
          .delete()
          .eq("receipt_id", receiptId);
        if (delPay) throw delPay;
        const { error: delChq } = await db()
          .from("receipt_cheques")
          .delete()
          .eq("receipt_id", receiptId);
        if (delChq) throw delChq;
      } else {
        const { data, error: insertError } = await db()
          .from("receipts")
          .insert(header)
          .select("id")
          .single();
        if (insertError) throw insertError;
        savedId = data.id as string;
      }
      const payRows = filledPayments.map((row) => ({
        receipt_id: savedId,
        invoice_id: row.invoice_id,
        amount: round2(toNumber(row.amount)),
      }));
      const { error: payError } = await db().from("receipt_payments").insert(payRows);
      if (payError) throw payError;
      if (method === "cheque") {
        const chequeRows = cheques
          .filter((row) => row.cheque_number.trim() || row.bank_name.trim() || row.cheque_date)
          .map((row) => ({
            receipt_id: savedId,
            cheque_number: emptyToNull(row.cheque_number),
            bank_name: emptyToNull(row.bank_name),
            cheque_date: emptyToNull(row.cheque_date),
          }));
        if (chequeRows.length > 0) {
          const { error: chqError } = await db().from("receipt_cheques").insert(chequeRows);
          if (chqError) throw chqError;
        }
      }
      router.push(`/suppliers/${supplier.id}`);
    } catch (err) {
      setError(friendlyError(err));
      setSaving(false);
    }
  }

  async function removeReceipt() {
    if (!receiptId || !supplier) return;
    if (!confirm("Delete this receipt and its payments?")) return;
    setSaving(true);
    const { error: delError } = await db().from("receipts").delete().eq("id", receiptId);
    if (delError) {
      setError(friendlyError(delError));
      setSaving(false);
      return;
    }
    router.push(`/suppliers/${supplier.id}`);
  }

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <p className="text-slate-600">Loading receipt…</p>;
  if (!supplier) return <p>Supplier not found.</p>;

  return (
    <form onSubmit={onSubmit} className="paper overflow-hidden">
      <div className="border-b-2 border-[#1a365d] bg-[#1a365d] px-5 py-3 text-white">
        <Link href={`/suppliers/${supplier.id}`} className="text-xs text-blue-100 hover:underline">
          ← {supplier.name}
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">PAYMENT RECEIPT</h1>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Receipt number
          </span>
          <input
            className="field"
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Receipt date
          </span>
          <input
            className="field"
            type="date"
            value={receiptDate}
            onChange={(e) => setReceiptDate(e.target.value)}
          />
        </label>
        <fieldset className="block">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment method
          </legend>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="method"
                checked={method === "cash"}
                onChange={() => setMethod("cash")}
              />
              Cash
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="method"
                checked={method === "cheque"}
                onChange={() => setMethod("cheque")}
              />
              Cheque
            </label>
          </div>
        </fieldset>
      </div>

      {error ? <p className="banner-error mx-5 mb-4">{error}</p> : null}

      {method === "cheque" ? (
        <div className="px-5 pb-4">
          <h2 className="mb-2 text-sm font-semibold text-[#1a365d]">Cheques</h2>
          <div className="overflow-x-auto">
            <table className="entry-table">
              <thead>
                <tr>
                  <th>Cheque number</th>
                  <th>Bank name</th>
                  <th className="w-44">Cheque date</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {cheques.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <input
                        className="cell-input"
                        value={row.cheque_number}
                        onChange={(e) =>
                          setCheques((current) =>
                            current.map((c) =>
                              c.key === row.key ? { ...c, cheque_number: e.target.value } : c,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        value={row.bank_name}
                        onChange={(e) =>
                          setCheques((current) =>
                            current.map((c) =>
                              c.key === row.key ? { ...c, bank_name: e.target.value } : c,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        type="date"
                        value={row.cheque_date}
                        onChange={(e) =>
                          setCheques((current) =>
                            current.map((c) =>
                              c.key === row.key ? { ...c, cheque_date: e.target.value } : c,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="px-2 text-slate-500 hover:text-red-700"
                        onClick={() =>
                          setCheques((current) =>
                            current.length === 1
                              ? [blankCheque()]
                              : current.filter((c) => c.key !== row.key),
                          )
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-secondary mt-3"
            onClick={() => setCheques((current) => [...current, blankCheque()])}
          >
            Add cheque
          </button>
        </div>
      ) : null}

      <div className="px-5 pb-2">
        <h2 className="mb-2 text-sm font-semibold text-[#1a365d]">
          Payment for each invoice
        </h2>
        <div className="overflow-x-auto">
          <table className="entry-table">
            <thead>
              <tr>
                <th>Invoice number</th>
                <th className="text-right">Invoice total</th>
                <th className="text-right">Outstanding</th>
                <th className="w-36">This payment</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((row) => {
                const inv = invoiceById[row.invoice_id];
                const due = row.invoice_id ? outstanding(row.invoice_id, row.key) : 0;
                return (
                  <tr key={row.key}>
                    <td>
                      <select
                        className="cell-input"
                        value={row.invoice_id}
                        onChange={(e) => {
                          const invoice_id = e.target.value;
                          setPayments((current) =>
                            current.map((p) => {
                              if (p.key !== row.key) return p;
                              const due = invoice_id ? outstanding(invoice_id, p.key) : 0;
                              return {
                                ...p,
                                invoice_id,
                                amount: p.amount.trim() === "" && due > 0 ? String(due) : p.amount,
                              };
                            }),
                          );
                        }}
                      >
                        <option value="">Select invoice</option>
                        {invoices.map((invOption) => (
                          <option key={invOption.id} value={invOption.id}>
                            {invOption.invoice_number}
                            {invOption.invoice_date ? ` · ${invOption.invoice_date}` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 text-right">{inv ? money(Number(inv.total)) : "—"}</td>
                    <td className="px-2 text-right">{inv ? money(due) : "—"}</td>
                    <td>
                      <input
                        className="cell-input text-right"
                        inputMode="decimal"
                        value={row.amount}
                        onChange={(e) =>
                          setPayments((current) =>
                            current.map((p) =>
                              p.key === row.key ? { ...p, amount: e.target.value } : p,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="px-2 text-slate-500 hover:text-red-700"
                        onClick={() =>
                          setPayments((current) =>
                            current.length === 1
                              ? [blankPayment()]
                              : current.filter((p) => p.key !== row.key),
                          )
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right">
                  Receipt total
                </td>
                <td className="px-3 py-2 text-right">{money(receiptTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Save an invoice for this supplier first, then come back to record the receipt.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-secondary mt-3"
            onClick={() => setPayments((current) => [...current, blankPayment()])}
          >
            Add invoice payment
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-200 px-5 py-4">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save receipt"}
        </button>
        <Link href={`/suppliers/${supplier.id}`} className="btn btn-secondary">
          Cancel
        </Link>
        {receiptId ? (
          <button
            type="button"
            className="btn btn-danger ml-auto"
            disabled={saving}
            onClick={removeReceipt}
          >
            Delete receipt
          </button>
        ) : null}
      </div>
    </form>
  );
}
