import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(
  url.startsWith("https://") &&
    key.length > 20 &&
    !url.includes("YOUR_PROJECT_REF") &&
    !key.includes("YOUR_ANON_KEY"),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key)
  : null;

export function db(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add keys to .env.local.");
  }
  return supabase;
}

export function friendlyError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: string }).message);
    if (message.includes("duplicate key") && message.includes("invoice_number")) {
      return "That invoice number is already saved for this supplier.";
    }
    if (message.includes("duplicate key") && message.includes("receipt_number")) {
      return "That receipt number is already saved for this supplier.";
    }
    if (message.includes("receipt_payments_invoice_id_fkey")) {
      return "This invoice has payments on a receipt. Delete or edit that receipt first.";
    }
    if (message.includes("special_discount")) {
      return "Run the latest supabase/schema.sql in the SQL editor so special_discount is added to invoices.";
    }
    return message;
  }
  return "Something went wrong while saving.";
}
