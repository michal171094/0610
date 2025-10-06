// 📧 Gmail Accounts Manager Component
'use client';

import { useState, useEffect } from 'react';

interface GmailAccount {
  id: string;
  email: string;
  last_scanned_at?: string;
  created_at: string;
}

export default function GmailManager() {
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any>(null);

  // Load Gmail accounts
  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/gmail/accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Failed to load Gmail accounts:', error);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Connect new Gmail account
  const handleConnectGmail = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gmail/auth');
      const data = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Failed to initiate Gmail connection:', error);
      alert('שגיאה בהתחברות ל-Gmail');
    } finally {
      setLoading(false);
    }
  };

  // Remove Gmail account
  const handleRemoveAccount = async (accountId: string, email: string) => {
    if (!confirm(`האם למחוק את החשבון ${email}?`)) return;

    try {
      await fetch('/api/gmail/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      
      // Reload accounts
      loadAccounts();
    } catch (error) {
      console.error('Failed to remove Gmail account:', error);
      alert('שגיאה במחיקת החשבון');
    }
  };

  // Trigger email scan
  const handleScanEmails = async () => {
    try {
      setScanning(true);
      setScanResults(null);
      
      const response = await fetch('/api/gmail/scan', {
        method: 'POST',
      });
      
      const data = await response.json();
      setScanResults(data.results);
      
      // Reload accounts to get updated last_scanned_at
      await loadAccounts();
      
      alert(`✅ סריקה הושלמה!\n${data.results.scanned} מיילים נסרקו\n${data.results.relevant} רלוונטיים\n${data.results.tasksCreated} משימות נוצרו`);
    } catch (error) {
      console.error('Failed to scan emails:', error);
      alert('שגיאה בסריקת המיילים');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-[#96758d]">📧 חשבונות Gmail</h2>
        <button
          onClick={handleConnectGmail}
          disabled={loading}
          className="px-4 py-2 bg-[#96758d] text-white rounded-lg hover:bg-[#75968c] transition disabled:opacity-50"
        >
          {loading ? 'מתחבר...' : '➕ חבר Gmail'}
        </button>
      </div>

      {/* Connected Accounts */}
      {accounts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">אין חשבונות Gmail מחוברים</p>
          <p className="text-sm">לחצי על "חבר Gmail" כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-4 bg-[#e6d3d9] rounded-lg"
            >
              <div className="flex-1">
                <p className="font-semibold text-[#96758d]">{account.email}</p>
                <p className="text-sm text-gray-600">
                  {account.last_scanned_at
                    ? `סריקה אחרונה: ${new Date(account.last_scanned_at).toLocaleString('he-IL')}`
                    : 'טרם נסרק'}
                </p>
              </div>
              <button
                onClick={() => handleRemoveAccount(account.id, account.email)}
                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                🗑️ הסר
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Scan Button */}
      {accounts.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleScanEmails}
            disabled={scanning}
            className="w-full px-4 py-3 bg-[#75968c] text-white rounded-lg hover:bg-[#96758d] transition disabled:opacity-50 font-semibold"
          >
            {scanning ? '🔍 סורק מיילים...' : '🔍 סרוק מיילים חדשים'}
          </button>

          {scanResults && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-green-800 font-semibold">✅ סריקה הושלמה!</p>
              <div className="mt-2 text-sm text-gray-700 space-y-1">
                <p>📧 {scanResults.scanned} מיילים נסרקו</p>
                <p>⭐ {scanResults.relevant} רלוונטיים נמצאו</p>
                <p>✨ {scanResults.tasksCreated} משימות חדשות נוצרו</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
        <p className="font-semibold mb-2">ℹ️ מידע על סריקת המיילים:</p>
        <ul className="space-y-1 mr-4">
          <li>• הסריקה חכמה ומשתמשת ב-GPT-4 לזיהוי מיילים רלוונטיים</li>
          <li>• מתעלמת אוטומטית מספאם ומפרסומות</li>
          <li>• מחפשת עדכונים על חובות, ביורוקרטיה ולקוחות</li>
          <li>• יוצרת משימות אוטומטיות כשצריך</li>
          <li>• סורקת רק מיילים מ-7 הימים האחרונים</li>
        </ul>
      </div>
    </div>
  );
}
