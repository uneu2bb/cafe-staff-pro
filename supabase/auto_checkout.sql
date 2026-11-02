-- نفّذ مرة واحدة في Supabase → SQL Editor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_checkout_time TEXT;
COMMENT ON COLUMN profiles.auto_checkout_time IS 'وقت الانصراف التلقائي HH:mm (24 ساعة) مثل 22:00';
