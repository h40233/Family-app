DO $$
DECLARE
  table_name text;
  role_name text;
  restricted_roles text[] := ARRAY['anon', 'authenticated'];
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
    FOREACH role_name IN ARRAY restricted_roles LOOP
      IF to_regrole(role_name) IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;

  FOREACH role_name IN ARRAY restricted_roles LOOP
    IF to_regrole(role_name) IS NOT NULL THEN
      EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
