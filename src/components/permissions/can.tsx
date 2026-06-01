"use client";

import type { ReactNode } from "react";
import { useEffectivePermissions } from "./use-effective-permissions";

type CanProps = {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useEffectivePermissions();

  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
