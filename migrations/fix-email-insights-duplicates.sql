-- 🛠️ תיקון טבלת email_insights - מניעת duplicates

-- 1. הוסף אינדקס ייחודי למניעת רשומות כפולות
CREATE UNIQUE INDEX IF NOT EXISTS email_insights_unique_email 
ON email_insights (gmail_account_id, email_id);

-- 2. נקה duplicates קיימים (אם יש)
DELETE FROM email_insights a
USING email_insights b
WHERE a.id < b.id
  AND a.gmail_account_id = b.gmail_account_id
  AND a.email_id = b.email_id;

-- הסבר:
-- האינדקס מבטיח שכל שילוב של (gmail_account_id, email_id) יכול להופיע רק פעם אחת
-- אם ננסה לשמור אותו מייל פעמיים, הDB יחזיר שגיאה והקוד ידלג עליו
