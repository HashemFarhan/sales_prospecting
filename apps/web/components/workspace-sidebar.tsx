"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Database, FolderOpen, Package } from "lucide-react";

const items = [
  { href: "/", label: "Provider Queue", icon: ClipboardList },
  { href: "/sources/providers", label: "Provider Sources", icon: FolderOpen },
  { href: "/sources/crm", label: "CRM Sources", icon: Database },
  { href: "/sources/products", label: "Product Sources", icon: Package }
];

export function WorkspaceSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col gap-8 border-r border-white/10 bg-black p-6 text-white xl:fixed xl:left-0 xl:top-[88px] xl:h-[calc(100vh-88px)] xl:w-[280px] xl:overflow-y-auto">
      <div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">Workspace</div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">Provider Ops</h2>
        <p className="mt-3 text-sm leading-7 text-white/55">Internal workspace for provider review, uploaded sources, CRM context, and product material.</p>
      </div>
      <nav className="-mx-6 border-y border-white/10">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full items-center gap-3 border-b px-6 py-4 text-sm transition last:border-b-0 ${
                isActive
                  ? "border-white/10 border-l-[3px] border-l-[#206ef3] bg-white/10 text-white"
                  : "border-white/10 bg-transparent text-white/65 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-[#206ef3]" : "text-white/55"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
