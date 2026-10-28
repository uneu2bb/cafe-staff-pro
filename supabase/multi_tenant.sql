-- ============================================================
-- Cafe Staff Pro — Multi-tenant migration
-- نفّذ هذا الملف كاملاً في Supabase → SQL Editor
-- ============================================================

-- 1) جدول المقاهي (المستأجرون)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  plan TEXT NOT NULL DEFAULT 'basic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2) إضافة tenant_id للجداول
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE daily_attendance
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_withdrawals
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- system_settings: من مفتاح عام إلى إعدادات لكل مقهى
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 3) إنشاء مقهى افتراضي للبيانات الحالية (إن وُجدت)
DO $$
DECLARE
  default_tenant_id UUID;
  first_owner UUID;
BEGIN
  -- إذا ما في tenants، أنشئ واحداً افتراضياً
  IF NOT EXISTS (SELECT 1 FROM tenants LIMIT 1) THEN
    SELECT id INTO first_owner
    FROM profiles
    WHERE role IN ('owner', 'manager')
    ORDER BY created_at NULLS LAST
    LIMIT 1;

    INSERT INTO tenants (name, slug, owner_user_id, status)
    VALUES ('المقهى الافتراضي', 'default', first_owner, 'active')
    RETURNING id INTO default_tenant_id;

    -- ربط كل البيانات الحالية بهذا المقهى
    UPDATE profiles SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE daily_attendance SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE attendance_records SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE employee_withdrawals SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    -- إعدادات النظام الحالية → لهذا المقهى
    UPDATE system_settings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- 4) فهارس
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_tenant ON daily_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant ON attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_tenant ON employee_withdrawals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_tenant ON system_settings(tenant_id);

-- 5) employee_number فريد داخل كل مقهى فقط
DROP INDEX IF EXISTS profiles_employee_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_tenant_employee_number_uidx
  ON profiles (tenant_id, employee_number)
  WHERE employee_number IS NOT NULL;

-- 6) system_settings: مفتاح فريد لكل مقهى
-- (إن كان القيد القديم على key فقط، نستبدله)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'system_settings_key_key'
  ) THEN
    ALTER TABLE system_settings DROP CONSTRAINT system_settings_key_key;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS system_settings_tenant_key_uidx
  ON system_settings (tenant_id, key);

-- 7) دالة مساعدة: tenant_id للمستخدم الحالي
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 8) RLS على tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select_own ON tenants;
CREATE POLICY tenants_select_own ON tenants
  FOR SELECT USING (
    id = public.current_tenant_id()
    OR owner_user_id = auth.uid()
  );

-- 9) تحديث سياسات profiles (عزل حسب tenant)
DROP POLICY IF EXISTS profiles_select_tenant ON profiles;
CREATE POLICY profiles_select_tenant ON profiles
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS profiles_update_tenant ON profiles;
CREATE POLICY profiles_update_tenant ON profiles
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.tenant_id = profiles.tenant_id
    )
  );

-- 10) سياسات daily_attendance
DROP POLICY IF EXISTS daily_att_tenant ON daily_attendance;
CREATE POLICY daily_att_tenant ON daily_attendance
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 11) سياسات attendance_records
DROP POLICY IF EXISTS att_records_tenant ON attendance_records;
CREATE POLICY att_records_tenant ON attendance_records
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 12) سياسات employee_withdrawals
DROP POLICY IF EXISTS withdrawals_tenant ON employee_withdrawals;
CREATE POLICY withdrawals_tenant ON employee_withdrawals
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 13) سياسات system_settings
DROP POLICY IF EXISTS settings_tenant ON system_settings;
CREATE POLICY settings_tenant ON system_settings
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ملاحظة: الـ API يستخدم service_role ويتجاوز RLS،
-- لذلك نعتمد أيضاً على فلترة tenant_id في كود الـ API.
