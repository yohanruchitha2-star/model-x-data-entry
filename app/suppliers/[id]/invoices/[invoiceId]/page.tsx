"use client";

import { useParams } from "next/navigation";
import { InvoiceForm } from "@/components/InvoiceForm";

export default function EditInvoicePage() {
  const params = useParams<{ invoiceId: string }>();
  return <InvoiceForm invoiceId={params.invoiceId} />;
}
