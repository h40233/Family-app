"use client";

export type EffectivePermissions = {
  permissions: string[];
  can: (permission: string) => boolean;
};

const defaultPermissions = [
  "personal.transactions.create",
  "personal.accounts.view",
  "funds.create",
  "funds.view",
  "tasks.create",
  "tasks.view",
  "points.adjust",
  "points.view",
  "wishes.create",
  "wishes.view",
  "reports.export",
  "reports.view",
  "notifications.update",
  "notifications.view",
  "billing.checkout",
  "billing.view"
];

export function useEffectivePermissions(): EffectivePermissions {
  return {
    permissions: defaultPermissions,
    can(permission: string) {
      return defaultPermissions.includes(permission);
    }
  };
}
