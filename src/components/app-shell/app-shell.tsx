"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthStatus } from "@/components/auth/auth-status";
import { InterstitialAd } from "@/components/billing/interstitial-ad";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "首頁", description: "家庭總覽" },
  { href: "/money/personal", label: "個人記帳", description: "帳戶與交易紀錄" },
  { href: "/money/shared-funds", label: "共用基金", description: "家庭基金餘額" },
  { href: "/tasks", label: "任務清單", description: "家務與審核" },
  { href: "/points", label: "點數", description: "點數餘額與紀錄" },
  { href: "/wishes", label: "願望清單", description: "願望與獎勵進度" },
  { href: "/reports", label: "報表", description: "家庭統計報表" },
  { href: "/notifications", label: "通知", description: "通知中心" },
  { href: "/billing", label: "方案", description: "訂閱、廣告與主題" },
  { href: "/admin", label: "管理後台", description: "監控與營運管理" }
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主選單">
        <Link href="/" className="brand" aria-label="家庭 OS 首頁">
          <span className="brand-mark">家</span>
          <span>家庭 OS</span>
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

        <AuthStatus />
      </aside>

      <main className="dashboard">{children}</main>
      <InterstitialAd />
    </div>
  );
}
