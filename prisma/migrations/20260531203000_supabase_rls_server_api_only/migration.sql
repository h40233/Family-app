DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    'users',
    'families',
    'family_members',
    'resource_permissions',
    'personal_accounts',
    'personal_transactions',
    'personal_sharing_settings',
    'shared_funds',
    'fund_transactions',
    'categories',
    'budgets',
    'tasks',
    'task_assignments',
    'task_completions',
    'point_ledger',
    'point_balances',
    'wishes',
    'wish_price_proposals',
    'wish_redemptions',
    'notifications',
    'push_subscriptions',
    'audit_logs',
    'auth_sessions',
    'family_role_permissions'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END $$;

REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM anon, authenticated;
