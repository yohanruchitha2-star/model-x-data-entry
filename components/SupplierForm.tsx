"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { db, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import { emptyToNull, toNumber } from "@/lib/money";
import type { Supplier } from "@/lib/types";

type Props = {
  supplier?: Supplier;
};

export function SupplierForm({ supplier }: Props) {
  const router = useRouter();
  const [name, setName] = useState(supplier?.name ?? "");
  const [creditDays, setCreditDays] = useState(
    supplier?.credit_days != null ? String(supplier.credit_days) : "",
  );
  const [phone1, setPhone1] = useState(supplier?.phone1 ?? "");
  const [phone2, setPhone2] = useState(supplier?.phone2 ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [related1, setRelated1] = useState(supplier?.related_company_1 ?? "");
  const [related2, setRelated2] = useState(supplier?.related_company_2 ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supplier) return;
    setName(supplier.name);
    setCreditDays(supplier.credit_days != null ? String(supplier.credit_days) : "");
    setPhone1(supplier.phone1 ?? "");
    setPhone2(supplier.phone2 ?? "");
    setEmail(supplier.email ?? "");
    setAddress(supplier.address ?? "");
    setRelated1(supplier.related_company_1 ?? "");
    setRelated2(supplier.related_company_2 ?? "");
  }, [supplier]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: name.trim(),
      credit_days: creditDays.trim() === "" ? null : Math.round(toNumber(creditDays)),
      phone1: emptyToNull(phone1),
      phone2: emptyToNull(phone2),
      email: emptyToNull(email),
      address: emptyToNull(address),
      related_company_1: emptyToNull(related1),
      related_company_2: emptyToNull(related2),
      updated_at: new Date().toISOString(),
    };
    try {
      if (supplier) {
        const { error: updateError } = await db()
          .from("suppliers")
          .update(payload)
          .eq("id", supplier.id);
        if (updateError) throw updateError;
        router.push(`/suppliers/${supplier.id}`);
        router.refresh();
      } else {
        const { data, error: insertError } = await db()
          .from("suppliers")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        router.push(`/suppliers/${data.id}`);
      }
    } catch (err) {
      setError(friendlyError(err));
      setSaving(false);
    }
  }

  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    <form onSubmit={onSubmit} className="paper p-5">
      <h1 className="text-xl font-semibold text-[#1a365d]">
        {supplier ? "Edit supplier" : "New supplier"}
      </h1>
      {error ? <p className="banner-error mt-4">{error}</p> : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Supplier name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Credit days</span>
          <input
            className="field"
            inputMode="numeric"
            value={creditDays}
            onChange={(e) => setCreditDays(e.target.value)}
            placeholder="e.g. 15"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Phone number 1</span>
          <input className="field" value={phone1} onChange={(e) => setPhone1(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Phone number 2</span>
          <input className="field" value={phone2} onChange={(e) => setPhone2(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Address</span>
          <textarea
            className="field min-h-20"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Related company 1</span>
          <input className="field" value={related1} onChange={(e) => setRelated1(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Related company 2</span>
          <input className="field" value={related2} onChange={(e) => setRelated2(e.target.value)} />
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save supplier"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => router.back()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
