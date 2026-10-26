import type { ReactNode } from "react";
import Link from "next/link";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="bg-[#1a365d] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-semibold tracking-wide">
            Purchase Entry
          </Link>
          <p className="hidden text-sm text-blue-100 sm:block">
            Type suppliers, invoices, and receipts into the shared database
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
