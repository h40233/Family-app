"use client";

import { useEffect, useState } from "react";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api-client";

export type AuthUser = {
  id: string;
  displayName: string;
  email: string | null;
  isChildAccount: boolean;
};

export type Family = {
  id: string;
  name: string;
  plan: "free" | "paid";
  createdAt: string;
  updatedAt: string;
};

type AuthMeResponse = { user: AuthUser };
type FamiliesResponse = { families: Family[] };

export type ActiveFamilyState =
  | { status: "loading" }
  | { status: "auth"; message: string }
  | { status: "empty"; user: AuthUser; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; user: AuthUser; family: Family };

export function useActiveFamily() {
  const [state, setState] = useState<ActiveFamilyState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadActiveFamily() {
      try {
        const [meResponse, familiesResponse] = await Promise.all([
          apiRequest<AuthMeResponse>("/api/v1/auth/me"),
          apiRequest<FamiliesResponse>("/api/v1/families")
        ]);
        const family = familiesResponse.families[0];

        if (!family) {
          if (!cancelled) {
            setState({
              status: "empty",
              user: meResponse.user,
              message: "目前帳號還沒有加入任何家庭。"
            });
          }
          return;
        }

        if (!cancelled) {
          setState({ status: "ready", user: meResponse.user, family });
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiClientError && error.status === 401) {
          setState({ status: "auth", message: "登入後才會顯示家庭資料。" });
          return;
        }
        setState({ status: "error", message: errorMessage(error) });
      }
    }

    void loadActiveFamily();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
