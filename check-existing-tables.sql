-- 🔍 בדיקת טבלאות קיימות ב-Supabase

-- הצג את כל הטבלאות
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ספירה
SELECT COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public';
