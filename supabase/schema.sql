-- Purchase invoice & receipt data entry
-- Paste this entire file once in the Supabase SQL editor (Dashboard → SQL → New query).
-- All three teammates share this one database. There is no login: the anon key can read and write.

create extension if not exists "pgcrypto";

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credit_days integer,
  phone1 text,
  phone2 text,
  email text,
  address text,
  related_company_1 text,
  related_company_2 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  sku text,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists items_name_lower_idx on items (lower(name));

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete cascade,
  invoice_number text not null,
  invoice_date date,
  delivery_date date,
  special_discount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, invoice_number)
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  sku text,
  item_name text not null,
  quantity numeric(14, 3) not null default 0,
  mro numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete cascade,
  receipt_number text not null,
  receipt_date date,
  payment_method text not null check (payment_method in ('cash', 'cheque')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, receipt_number)
);

create table if not exists receipt_payments (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,
  invoice_id uuid not null references invoices (id) on delete restrict,
  amount numeric(14, 2) not null default 0
);

create table if not exists receipt_cheques (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,
  cheque_number text,
  bank_name text,
  cheque_date date
);

create index if not exists invoices_supplier_id_idx on invoices (supplier_id);
create index if not exists invoice_items_invoice_id_idx on invoice_items (invoice_id);
create index if not exists receipts_supplier_id_idx on receipts (supplier_id);
create index if not exists receipt_payments_receipt_id_idx on receipt_payments (receipt_id);
create index if not exists receipt_payments_invoice_id_idx on receipt_payments (invoice_id);
create index if not exists receipt_cheques_receipt_id_idx on receipt_cheques (receipt_id);
create index if not exists items_name_idx on items (name);

alter table suppliers enable row level security;
alter table items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table receipts enable row level security;
alter table receipt_payments enable row level security;
alter table receipt_cheques enable row level security;

drop policy if exists suppliers_anon_all on suppliers;
drop policy if exists items_anon_all on items;
drop policy if exists invoices_anon_all on invoices;
drop policy if exists invoice_items_anon_all on invoice_items;
drop policy if exists receipts_anon_all on receipts;
drop policy if exists receipt_payments_anon_all on receipt_payments;
drop policy if exists receipt_cheques_anon_all on receipt_cheques;

create policy suppliers_anon_all on suppliers for all to anon using (true) with check (true);
create policy items_anon_all on items for all to anon using (true) with check (true);
create policy invoices_anon_all on invoices for all to anon using (true) with check (true);
create policy invoice_items_anon_all on invoice_items for all to anon using (true) with check (true);
create policy receipts_anon_all on receipts for all to anon using (true) with check (true);
create policy receipt_payments_anon_all on receipt_payments for all to anon using (true) with check (true);
create policy receipt_cheques_anon_all on receipt_cheques for all to anon using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on table suppliers to anon, authenticated;
grant all on table items to anon, authenticated;
grant all on table invoices to anon, authenticated;
grant all on table invoice_items to anon, authenticated;
grant all on table receipts to anon, authenticated;
grant all on table receipt_payments to anon, authenticated;
grant all on table receipt_cheques to anon, authenticated;

-- Safe to run again if the tables already exist (adds bulk/special discount).
alter table invoices add column if not exists special_discount numeric(14, 2) not null default 0;
