"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SetupNotice } from "@/components/SetupNotice";
import { SupplierForm } from "@/components/SupplierForm";
import { db, friendlyError, isSupabaseConfigured } from "@/lib/supabase";
import type { Supplier } from "@/lib/types";

export function SupplierEdit() {
  const params = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !params.id) {
      setLoading(false);
      return;
    }
    db()
      .from("suppliers")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data, error: queryError }) => {
        if (queryError) setError(friendlyError(queryError));
        else setSupplier(data as Supplier);
        setLoading(false);
      });
  }, [params.id]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <p className="text-slate-600">Loading supplier…</p>;
  if (error || !supplier) return <p className="banner-error">{error || "Supplier not found."}</p>;
  return <SupplierForm supplier={supplier} />;
}
