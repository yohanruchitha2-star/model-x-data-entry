"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import type { Supplier } from "@/lib/types";
import { SetupNotice } from "./SetupNotice";

export function SupplierList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    db()
      .from("suppliers")
      .select("*")
      .order("name")
      .then(({ data, error: queryError }) => {
        if (queryError) setError(friendlyError(queryError));
        else setSuppliers((data ?? []) as Supplier[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      const blob = [s.name, s.phone1, s.phone2, s.email, s.related_company_1, s.related_company_2]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [query, suppliers]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a365d]">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Open a supplier to add invoices and receipts.
          </p>
        </div>
        <Link href="/suppliers/new" className="btn btn-primary">
          Add supplier
        </Link>
      </div>

      <input
        className="field mb-4 max-w-md"
        placeholder="Search name, phone, or related company"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error ? <p className="banner-error mb-4">{error}</p> : null}

      <div className="paper overflow-x-auto">
        <table className="entry-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Credit days</th>
              <th>Phone 1</th>
              <th>Phone 2</th>
              <th>Related company 1</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-slate-500">
                  {suppliers.length === 0
                    ? "No suppliers yet. Add the first supplier to start typing invoices."
                    : "No suppliers match that search."}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-2 py-2">
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="font-medium text-[#1a365d] underline-offset-2 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{s.credit_days ?? "—"}</td>
                  <td className="px-2 py-2">{s.phone1 || "—"}</td>
                  <td className="px-2 py-2">{s.phone2 || "—"}</td>
                  <td className="px-2 py-2">{s.related_company_1 || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
