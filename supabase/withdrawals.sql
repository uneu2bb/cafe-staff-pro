-- نفّذ هذا في Supabase → SQL Editor مرة واحدة
CREATE TABLE IF NOT EXISTS employee_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'SYP', 'TRY')),
  note TEXT,
  withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_employee ON employee_withdrawals(employee_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_date ON employee_withdrawals(withdrawn_at);

ALTER TABLE employee_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawals_admin_all ON employee_withdrawals;
CREATE POLICY withdrawals_admin_all ON employee_withdrawals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager', 'accountant')
    )
  );

-- أسعار الصرف الافتراضية (كم وحدة من العملة = 1 دولار)
INSERT INTO system_settings (key, value, description)
VALUES
  ('rate_syp_per_usd', '15000', 'كم ليرة سورية مقابل 1 دولار'),
  ('rate_try_per_usd', '34', 'كم ليرة تركية مقابل 1 دولار'),
  ('admin_panel_password', '0000', 'كلمة مرور لوحة التحكم المخفية')
ON CONFLICT (key) DO NOTHING;
