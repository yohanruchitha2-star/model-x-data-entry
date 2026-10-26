export type Supplier = {
  id: string;
  name: string;
  credit_days: number | null;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  address: string | null;
  related_company_1: string | null;
  related_company_2: string | null;
  created_at: string;
  updated_at: string;
};

export type Item = {
  id: string;
  sku: string | null;
  name: string;
};

export type Invoice = {
  id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string | null;
  delivery_date: string | null;
  special_discount: number;
  total: number;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  sku: string | null;
  item_name: string;
  quantity: number;
  mro: number;
  discount: number;
  line_total: number;
  sort_order: number;
};

export type Receipt = {
  id: string;
  supplier_id: string;
  receipt_number: string;
  receipt_date: string | null;
  payment_method: "cash" | "cheque";
  created_at: string;
  updated_at: string;
};

export type ReceiptPayment = {
  id: string;
  receipt_id: string;
  invoice_id: string;
  amount: number;
};

export type ReceiptCheque = {
  id: string;
  receipt_id: string;
  cheque_number: string | null;
  bank_name: string | null;
  cheque_date: string | null;
};

export type InvoiceLineDraft = {
  key: string;
  sku: string;
  item_name: string;
  quantity: string;
  mro: string;
  discount: string;
  line_total: string;
};

export type PaymentDraft = {
  key: string;
  invoice_id: string;
  amount: string;
};

export type ChequeDraft = {
  key: string;
  cheque_number: string;
  bank_name: string;
  cheque_date: string;
};
