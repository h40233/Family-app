"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { InterstitialAd } from "@/components/billing/interstitial-ad";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Home", description: "Household dashboard" },
  { href: "/money/personal", label: "Personal Money", description: "Accounts and transactions" },
  { href: "/money/shared-funds", label: "Shared Funds", description: "Family fund balances" },
  { href: "/tasks", label: "Tasks", description: "Chores and reviews" },
  { href: "/points", label: "Points", description: "Balances and ledger" },
  { href: "/wishes", label: "Wishes", description: "Family wish progress" },
  { href: "/reports", label: "Reports", description: "Household reporting" },
  { href: "/notifications", label: "Notifications", description: "Notification center" },
  { href: "/billing", label: "Billing", description: "Plan, ads, and themes" },
  { href: "/admin", label: "Admin", description: "Monitoring and operations" }
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand" aria-label="Family OS home">
          <span className="brand-mark">F</span>
          <span>Family OS</span>
        </Link>

        <nav className="nav-list">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
                title={item.description}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="dashboard">{children}</main>
      <InterstitialAd />
    </div>
  );
}
