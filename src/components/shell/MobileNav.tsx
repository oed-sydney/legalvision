"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Gauge, Search as SearchIcon, Megaphone, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/pacing", label: "Pacing", icon: Gauge },
  { href: "/google", label: "Google", icon: SearchIcon },
  { href: "/quality", label: "Quality", icon: BadgeCheck },
  { href: "/meta", label: "Meta", icon: Megaphone },
];

export function MobileNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search.toString();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--lv-border)] bg-white lg:hidden">
      {ITEMS.map((it) => {
        const active = pathname.startsWith(it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={qs ? `${it.href}?${qs}` : it.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
              active ? "text-primary" : "text-muted"
            )}
          >
            <Icon className="h-5 w-5" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
