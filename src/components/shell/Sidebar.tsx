"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Gauge,
  Search as SearchIcon,
  Megaphone,
  Target,
  ClipboardList,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview", label: "Executive Overview", icon: LayoutDashboard },
  { href: "/pacing", label: "Budget Pacing", icon: Gauge },
  { href: "/google", label: "Google Ads", icon: SearchIcon },
  { href: "/meta", label: "Meta Ads", icon: Megaphone },
  { href: "/leads", label: "Lead Quality", icon: Target },
  { href: "/plan", label: "90-Day Plan", icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search.toString();
  const withQs = (href: string) => (qs && href !== "/admin" ? `${href}?${qs}` : href);

  return (
    // h-dvh (not h-screen): Safari's 100vh extends behind its browser chrome and clips the sidebar footer
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col bg-[var(--lv-sidebar)] text-white lg:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Link href={withQs("/overview")} className="flex h-7 items-center" aria-label="LegalVision — Overview">
          <Image
            src="/brand/lv-logo-white.svg"
            alt="LegalVision"
            width={150}
            height={19}
            priority
            style={{ height: 19, width: "auto" }}
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Primary">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={withQs(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
                active
                  ? "bg-[var(--lv-sidebar-active)] text-white"
                  : "text-white/70 hover:bg-[var(--lv-sidebar-hover)] hover:text-white"
              )}
            >
              {active && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-r bg-[var(--lv-accent)]" />}
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-[var(--lv-accent)]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/admin"
          className={cn(
            "relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
            pathname.startsWith("/admin")
              ? "bg-[var(--lv-sidebar-active)] text-white"
              : "text-white/70 hover:bg-[var(--lv-sidebar-hover)] hover:text-white"
          )}
        >
          {pathname.startsWith("/admin") && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-r bg-[var(--lv-accent)]" />}
          <Settings className={cn("h-4 w-4", pathname.startsWith("/admin") && "text-[var(--lv-accent)]")} />
          Admin
        </Link>
        <div className="mt-2 border-t border-white/10 px-3 pb-2 pt-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
            Managed by
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/oneegg-logo-light.svg"
            alt="OneEgg"
            style={{ height: 28, width: "auto" }}
          />
        </div>
      </div>
    </aside>
  );
}
