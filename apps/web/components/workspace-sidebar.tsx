"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Provider Queue" },
  { href: "/sources/providers", label: "Provider Sources" },
  { href: "/sources/crm", label: "CRM Sources" },
  { href: "/sources/products", label: "Product Sources" }
];

export function WorkspaceSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col gap-6 border-r border-black bg-black p-6 text-white xl:fixed xl:left-0 xl:top-[88px] xl:h-[calc(100vh-88px)] xl:w-[280px] xl:overflow-y-auto">
      <div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Workspace</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Provider Ops</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">Internal workspace for provider review, uploaded sources, CRM context, and product material.</p>
      </div>
      <nav className="space-y-3">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block border px-4 py-3 text-sm transition ${
                isActive
                  ? "border-white bg-white text-black"
                  : "border-zinc-800 bg-black text-slate-400 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
