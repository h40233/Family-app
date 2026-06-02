"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ApiEnvelope<T> = {
  data?: T;
};

type AuthUser = {
  id: string;
  displayName: string;
  email: string | null;
  isChildAccount: boolean;
};

async function fetchMe(): Promise<AuthUser | null> {
  const response = await fetch("/api/v1/auth/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("無法取得登入狀態。");
  const payload = (await response.json()) as ApiEnvelope<{ user: AuthUser }>;
  return payload.data?.user ?? null;
}

export function AuthStatus() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const currentUser = await fetchMe();
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <section className="sidebar-auth">
        <small>檢查登入狀態...</small>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="sidebar-auth">
        <small>尚未登入</small>
        <Link className="sidebar-auth-link" href="/login">
          登入 / 建立帳號
        </Link>
      </section>
    );
  }

  return (
    <section className="sidebar-auth">
      <small>目前登入</small>
      <strong>{user.displayName}</strong>
      <button type="button" className="secondary-button" onClick={logout} disabled={loggingOut}>
        {loggingOut ? "登出中" : "登出"}
      </button>
    </section>
  );
}
