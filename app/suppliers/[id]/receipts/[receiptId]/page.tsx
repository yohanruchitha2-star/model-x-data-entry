"use client";

import { useParams } from "next/navigation";
import { ReceiptForm } from "@/components/ReceiptForm";

export default function EditReceiptPage() {
  const params = useParams<{ receiptId: string }>();
  return <ReceiptForm receiptId={params.receiptId} />;
}
