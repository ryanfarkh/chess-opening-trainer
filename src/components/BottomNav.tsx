"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, Compass, Layers } from "lucide-react";

const TABS = [
  { href: "/", label: "Study", icon: Layers },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/stats", label: "Stats", icon: ChartColumn },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-3 border-t border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${
              active ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            <Icon size={18} strokeWidth={2} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
