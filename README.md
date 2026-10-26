# Purchase Entry

A local data-entry app for typing supplier details, purchase invoices, and payment receipts into **one shared Supabase database**. Three teammates clone this folder, use the same keys, and type at the same time.

There is **no login**. Anyone who has the anon key can read and write. Do not publish the keys.

## What you type

1. **Supplier** — name, credit days, phone 1, phone 2, email, address, related company 1, related company 2
2. **Invoice** for that supplier — invoice number, invoice date, delivery date, then a table of items (SKU, item name, quantity, MRO/rate, line discount, line total), a special/bulk discount on the whole bill, and the invoice total
3. **Receipt** for that supplier — receipt number, receipt date, cash or cheque, payment amounts against one or more invoices; if cheque, cheque number, bank name, cheque date

Item names already saved on any invoice autocomplete when you type a new line.

Open on your machine at [http://localhost:3000](http://localhost:3000).

## One-time setup (one person)

### 1. Create the Supabase project

1. Sign in at [https://supabase.com](https://supabase.com) and create a free project.
2. Wait until the project is ready.
3. Open **SQL Editor → New query**.
4. Paste the whole file [`supabase/schema.sql`](supabase/schema.sql) and run it.
5. Open **Project Settings → API**.
6. Copy **Project URL** and the **anon public** key.

Send those two values to the other two teammates (chat or a password manager). Do not commit them to git.

### 2. Put this folder on GitHub

From this folder:

```bash
git remote add origin https://github.com/yohanruchitha2-star/model-x-data-entry.git
git add .
git commit -m "Purchase invoice and receipt data entry"
git push -u origin main
```

`.env.local` is gitignored. The other two people clone the repo; they do not get your keys from git.

## Every teammate (including the first)

```bash
git clone https://github.com/yohanruchitha2-star/model-x-data-entry.git
cd model-x-data-entry
copy .env.example .env.local
```

On Mac/Linux use `cp .env.example .env.local`.

Edit `.env.local` and paste the **same** URL and anon key:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Then:

```bash
npm install
npm run dev
```

Browser: [http://localhost:3000](http://localhost:3000)

## Daily use

1. Add the supplier once (credit days is the number of days the shop is given to pay).
2. Open that supplier.
3. **Add invoice** — type the paper bill. Line total is `quantity × MRO − discount`. If the bill has a bulk/special discount, type it under the items. Invoice total is the sum of lines minus that special discount. Pick a known item name from the dropdown to fill SKU.
4. **Add receipt** — type the paper receipt. One receipt can pay several invoices. Choose Cash or Cheque. Cheque adds a table for cheque number, bank, and date.

Click a saved invoice or receipt to edit it.

## If the app says it is not connected

- `.env.local` is missing, or the two values are still the example placeholders.
- After editing `.env.local`, stop the terminal (`Ctrl+C`) and run `npm run dev` again.
- Confirm `schema.sql` was run in **this** Supabase project, not a different one.
