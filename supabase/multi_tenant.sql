-- Cafe Staff Pro Multi-tenant - paste ALL in Supabase SQL Editor and Run

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'basic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE employee_withdrawals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

INSERT INTO tenants (name, slug, owner_user_id, status)
SELECT 'المقهى الافتراضي', 'default', p.id, 'active'
FROM profiles p
WHERE p.role IN ('owner', 'manager')
  AND NOT EXISTS (SELECT 1 FROM tenants LIMIT 1)
ORDER BY p.created_at NULLS LAST
LIMIT 1;

INSERT INTO tenants (name, slug, status)
SELECT 'المقهى الافتراضي', 'default', 'active'
WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1);

UPDATE profiles SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE daily_attendance SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE attendance_records SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE employee_withdrawals SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE system_settings SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_tenant ON daily_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant ON attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_tenant ON employee_withdrawals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_tenant ON system_settings(tenant_id);

DROP INDEX IF EXISTS profiles_employee_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_tenant_employee_number_uidx
  ON profiles (tenant_id, employee_number)
  WHERE employee_number IS NOT NULL;

ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_tenant_key_uidx
  ON system_settings (tenant_id, key);

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$fn$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_select_own ON tenants;
CREATE POLICY tenants_select_own ON tenants
  FOR SELECT USING (
    id = public.current_tenant_id() OR owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS profiles_select_tenant ON profiles;
CREATE POLICY profiles_select_tenant ON profiles
  FOR SELECT USING (
    tenant_id = public.current_tenant_id() OR id = auth.uid()
  );

DROP POLICY IF EXISTS profiles_update_tenant ON profiles;
CREATE POLICY profiles_update_tenant ON profiles
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS daily_att_tenant ON daily_attendance;
CREATE POLICY daily_att_tenant ON daily_attendance
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS att_records_tenant ON attendance_records;
CREATE POLICY att_records_tenant ON attendance_records
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS withdrawals_tenant ON employee_withdrawals;
CREATE POLICY withdrawals_tenant ON employee_withdrawals
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS settings_tenant ON system_settings;
CREATE POLICY settings_tenant ON system_settings
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
