# 🔍 Database Usage Report

**תאריך**: 6.10.2025, 5:23:09  
**קבצים שנסרקו**: 80  
**סך קריאות DB**: 137

---

## 📊 סיכום

| טבלה | שימושים | סטטוס |
|------|---------|--------|
| unified_dashboard | 56 | ✅ נכון |
| tasks | 10 | ❌ לתקן |
| אחרות | 13 טבלאות | ℹ️ |

---

## ✅ unified_dashboard Usage (הטבלה הנכונה)

### \app\api\ai-agent\compose\route.ts

- שורה 19: `[select]` ```.from('unified_dashboard')```
- שורה 45: `[select]` ```.from('unified_dashboard')```

### \app\api\ai-agent\prioritize\route.ts

- שורה 12: `[select]` ```.from('unified_dashboard')```
- שורה 25: `[select]` ```.from('unified_dashboard')```

### \app\api\supabase\sync\route.ts

- שורה 9: `[select]` ```.from('unified_dashboard')```
- שורה 70: `[select]` ```.from('unified_dashboard')```

### \app\api\tasks\apply-email-updates\route.ts

- שורה 59: `[select]` ```.from('unified_dashboard')```
- שורה 72: `[select]` ```.from('unified_dashboard')```

### \app\api\tasks\route.ts

- שורה 8: `[select]` ```.from('unified_dashboard')```
- שורה 77: `[select]` ```.from('unified_dashboard')```

### \app\api\tasks\[id]\chat\route.ts

- שורה 14: `[select]` ```.from('unified_dashboard')```
- שורה 39: `[select]` ```.from('unified_dashboard')```
- שורה 70: `[select]` ```.from('unified_dashboard')```

### \app\api\tasks\[id]\route.ts

- שורה 11: `[select]` ```.from('unified_dashboard')```
- שורה 46: `[select]` ```.from('unified_dashboard')```
- שורה 71: `[select]` ```.from('unified_dashboard')```

### \lib\agents\entity-resolver.ts

- שורה 221: `[select]` ```.from('unified_dashboard')```

### \lib\agents\monitor-agent.ts

- שורה 137: `[select]` ```.from('unified_dashboard')```
- שורה 175: `[select]` ```.from('unified_dashboard')```
- שורה 211: `[select]` ```.from('unified_dashboard')```
- שורה 265: `[select]` ```.from('unified_dashboard')```
- שורה 386: `[select]` ```.from('unified_dashboard')```

### \lib\agents\sync-agent.ts

- שורה 292: `[select]` ```.from('unified_dashboard')```
- שורה 303: `[select]` ```.from('unified_dashboard')```

### \lib\ai-agent\next-action.ts

- שורה 23: `[select]` ```.from('unified_dashboard')```
- שורה 94: `[select]` ```.from('unified_dashboard')```
- שורה 115: `[select]` ```.from('unified_dashboard')```
- שורה 127: `[select]` ```.from('unified_dashboard')```
- שורה 146: `[select]` ```.from('unified_dashboard')```
- שורה 191: `[select]` ```.from('unified_dashboard')```

### \lib\ai-agent\tools.ts

- שורה 20: `[select]` ```.from('unified_dashboard')```
- שורה 140: `[select]` ```.from('unified_dashboard')```
- שורה 185: `[select]` ```.from('unified_dashboard')```
- שורה 210: `[select]` ```.from('unified_dashboard')```
- שורה 246: `[select]` ```supabaseAdmin.from('unified_dashboard').select('*', { count: 'exact' }),```

### \lib\gmail\scanner.ts

- שורה 422: `[select]` ```.from('unified_dashboard')```

### \lib\tools\tool-registry.ts

- שורה 47: `[select]` ```let query = supabaseAdmin.from('unified_dashboard').select('*');```
- שורה 87: `[select]` ```.from('unified_dashboard')```
- שורה 132: `[select]` ```.from('unified_dashboard')```
- שורה 247: `[select]` ```supabaseAdmin.from('unified_dashboard').select('*', { count: 'exact' }),```

### \scripts\analyze-current-state.ts

- שורה 289: `[select]` ```log(`  sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${fullPath}"`, colors.white);```
- שורה 290: `[select]` ```log(`  sed -i '' 's/\\.from("tasks")/\\.from("unified_dashboard")/g' "${fullPath}"`, colors.white);```
- שורה 295: `[select]` ```log(`  find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +`, colors.white);```
- שורה 447: `[select]` ```report += `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +\n`;```

### \scripts\fix-architecture-complete.ts

- שורה 71: `[select]` ```const { data: tasks } = await supabaseAdmin.from('unified_dashboard').select('*')```
- שורה 382: `[select]` ```const { data: tasks } = await supabaseAdmin.from('unified_dashboard').select('*')```
- שורה 438: `[select]` ```.from('unified_dashboard')  // ✅ הוחלף!```
- שורה 460: `[select]` ```.from('unified_dashboard')  // ✅ הוחלף!```
- שורה 477: `[select]` ```.from('unified_dashboard')  // ✅ הוחלף!```
- שורה 496: `[select]` ```.from('unified_dashboard')  // ✅ הוחלף!```

### \scripts\scan-database-usage.ts

- שורה 55: `[select]` ```if (line.includes(".from('unified_dashboard')") ||```
- שורה 56: `[select]` ```line.includes('.from("unified_dashboard")')) {```
- שורה 179: `[select]` ```console.log(`${colors.white}sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${relPath}"${colors.reset}`);```
- שורה 183: `[select]` ```console.log(`${colors.white}find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +${colors.reset}\n`);```
- שורה 240: `[select]` ```content += `sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${relPath}"\n`;```
- שורה 246: `[select]` ```content += `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +\n`;```

---

## ❌ tasks Usage (צריך לתקן!)

**🚨 נמצאו 10 מקומות שצריך לתקן:**

### ❌ \scripts\analyze-current-state.ts

- שורה 289: `log(`  sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${fullPath}"`, colors.white);`
- שורה 290: `log(`  sed -i '' 's/\\.from("tasks")/\\.from("unified_dashboard")/g' "${fullPath}"`, colors.white);`
- שורה 295: `log(`  find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +`, colors.white);`
- שורה 447: `report += `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +\n`;`

### ❌ \scripts\scan-database-usage.ts

- שורה 65: `if (line.includes(".from('tasks')") ||`
- שורה 66: `line.includes('.from("tasks")')) {`
- שורה 179: `console.log(`${colors.white}sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${relPath}"${colors.reset}`);`
- שורה 183: `console.log(`${colors.white}find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +${colors.reset}\n`);`
- שורה 240: `content += `sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${relPath}"\n`;`
- שורה 246: `content += `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +\n`;`

### 🔧 פקודות תיקון אוטומטי:

```bash
# תקן את כל הקבצים בבת אחת:
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\.from('tasks')/\.from('unified_dashboard')/g" {} +
```

---

**הערה**: דוח זה נוצר אוטומטית על ידי `analyze-current-state.ts`
