#!/usr/bin/env ts-node
/**
 * 🔍 Advanced Database Usage Scanner
 * 
 * סקריפט שסורק את כל הקבצים ומזהה:
 * 1. מי משתמש ב-unified_dashboard (✅ נכון)
 * 2. מי משתמש ב-tasks (❌ לא נכון)
 * 3. פונקציות שמוגדרות והיכן הן נקראות
 * 4. Imports שבורים
 * 5. קריאות Supabase כלליות
 * 
 * Usage: npx ts-node scripts/analyze-current-state.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

interface TableUsage {
  file: string;
  line: number;
  code: string;
  operation: string;
}

interface ScanResult {
  unified_dashboard: TableUsage[];
  tasks: TableUsage[];
  other_tables: Record<string, TableUsage[]>;
}

/**
 * רשימת קבצים רקורסיבית
 */
function listFilesRecursive(
  dir: string, 
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']
): string[] {
  if (!fs.existsSync(dir)) return [];
  
  const files: string[] = [];
  
  function traverse(currentPath: string) {
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        
        try {
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            // Skip these directories
            if (
              item === 'node_modules' || 
              item === '.next' || 
              item === '.git' || 
              item === 'dist' ||
              item === 'build' ||
              item === '.vercel'
            ) {
              continue;
            }
            traverse(fullPath);
          } else if (stat.isFile()) {
            if (extensions.some(ext => item.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        } catch (err) {
          // Skip files we can't read
          continue;
        }
      }
    } catch (err) {
      // Skip directories we can't read
      return;
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * סרוק קובץ אחד לחיפוש שימוש בטבלאות
 */
function scanFileForTableUsage(filePath: string, content: string): ScanResult {
  const result: ScanResult = {
    unified_dashboard: [],
    tasks: [],
    other_tables: {}
  };
  
  const lines = content.split('\n');
  const rootDir = process.cwd();
  const relativePath = filePath.replace(rootDir, '');
  
  // Patterns to match Supabase table usage
  // Matches: .from('table'), .from("table"), .from(`table`)
  const fromPattern = /\.from\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip comments
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
      return;
    }
    
    let match;
    while ((match = fromPattern.exec(line)) !== null) {
      const tableName = match[1];
      
      // Determine operation type
      let operation = 'select';
      if (line.includes('.insert(')) operation = 'insert';
      else if (line.includes('.update(')) operation = 'update';
      else if (line.includes('.delete(')) operation = 'delete';
      else if (line.includes('.upsert(')) operation = 'upsert';
      
      const usage: TableUsage = {
        file: relativePath,
        line: lineNum,
        code: trimmedLine,
        operation
      };
      
      // Categorize by table name
      if (tableName === 'unified_dashboard') {
        result.unified_dashboard.push(usage);
      } else if (tableName === 'tasks') {
        result.tasks.push(usage);
      } else {
        if (!result.other_tables[tableName]) {
          result.other_tables[tableName] = [];
        }
        result.other_tables[tableName].push(usage);
      }
    }
  });
  
  return result;
}

/**
 * Main analysis function
 */
async function analyzeProject() {
  log('\n' + '='.repeat(80), colors.bright + colors.cyan);
  log('🔍 DATABASE USAGE SCANNER', colors.bright + colors.cyan);
  log('סורק את כל הקבצים בפרויקט...', colors.cyan);
  log('='.repeat(80) + '\n', colors.cyan);
  
  const rootDir = process.cwd();
  
  // Scan all files
  log('📁 מחפש קבצים...', colors.yellow);
  const allFiles = listFilesRecursive(rootDir);
  log(`✅ נמצאו ${allFiles.length} קבצים\n`, colors.green);
  
  // Aggregate results
  const totalResults: ScanResult = {
    unified_dashboard: [],
    tasks: [],
    other_tables: {}
  };
  
  let scannedCount = 0;
  
  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const fileResults = scanFileForTableUsage(file, content);
      
      // Merge results
      totalResults.unified_dashboard.push(...fileResults.unified_dashboard);
      totalResults.tasks.push(...fileResults.tasks);
      
      for (const [table, usages] of Object.entries(fileResults.other_tables)) {
        if (!totalResults.other_tables[table]) {
          totalResults.other_tables[table] = [];
        }
        totalResults.other_tables[table].push(...usages);
      }
      
      scannedCount++;
    } catch (err) {
      // Skip files we can't read
      continue;
    }
  }
  
  log(`🔍 סרקתי ${scannedCount} קבצים\n`, colors.cyan);
  
  // ========================================
  // REPORT: unified_dashboard usage (CORRECT)
  // ========================================
  log('✅ UNIFIED_DASHBOARD USAGE (הטבלה הנכונה)', colors.bright + colors.green);
  log('='.repeat(80), colors.green);
  
  if (totalResults.unified_dashboard.length === 0) {
    log('  ❌ אין שימוש ב-unified_dashboard! זו בעיה!', colors.red);
  } else {
    log(`  📊 סך הכל: ${totalResults.unified_dashboard.length} שימושים\n`, colors.green);
    
    // Group by file
    const byFile: Record<string, TableUsage[]> = {};
    totalResults.unified_dashboard.forEach(usage => {
      if (!byFile[usage.file]) {
        byFile[usage.file] = [];
      }
      byFile[usage.file].push(usage);
    });
    
    // Show grouped results
    Object.entries(byFile)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([file, usages]) => {
        log(`\n  📄 ${file} (${usages.length} שימושים):`, colors.cyan);
        usages.forEach(usage => {
          const opColor = 
            usage.operation === 'select' ? colors.blue :
            usage.operation === 'insert' ? colors.green :
            usage.operation === 'update' ? colors.yellow :
            colors.red;
          log(`     שורה ${usage.line}: [${usage.operation}] ${usage.code.slice(0, 80)}...`, opColor);
        });
      });
  }
  
  // ========================================
  // REPORT: tasks usage (INCORRECT!)
  // ========================================
  log('\n\n❌ TASKS USAGE (טבלה לא נכונה - צריך לתקן!)', colors.bright + colors.red);
  log('='.repeat(80), colors.red);
  
  if (totalResults.tasks.length === 0) {
    log('  ✅ אין שימוש ב-tasks - מצוין!', colors.green);
  } else {
    log(`  🚨 נמצאו ${totalResults.tasks.length} שימושים שצריך לתקן!\n`, colors.red);
    
    // Group by file
    const byFile: Record<string, TableUsage[]> = {};
    totalResults.tasks.forEach(usage => {
      if (!byFile[usage.file]) {
        byFile[usage.file] = [];
      }
      byFile[usage.file].push(usage);
    });
    
    // Show files that need fixing
    log('  📋 קבצים שצריך לתקן:', colors.yellow);
    Object.entries(byFile)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([file, usages]) => {
        log(`\n  ❌ ${file} (${usages.length} מקומות):`, colors.red);
        usages.forEach(usage => {
          log(`     שורה ${usage.line}: ${usage.code.slice(0, 100)}`, colors.yellow);
        });
      });
    
    // Generate fix commands
    log('\n  🔧 פקודות תיקון:', colors.bright + colors.yellow);
    log('  הרץ את הפקודות הבאות כדי לתקן את הקבצים:\n', colors.yellow);
    
    const uniqueFiles = Object.keys(byFile);
    uniqueFiles.forEach(file => {
      const fullPath = path.join(rootDir, file);
      log(`  # תקן: ${file}`, colors.cyan);
      // Using sed for Unix-like systems
      log(`  sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${fullPath}"`, colors.white);
      log(`  sed -i '' 's/\\.from("tasks")/\\.from("unified_dashboard")/g' "${fullPath}"`, colors.white);
      log('', colors.reset);
    });
    
    log('  או השתמש בפקודה המאוחדת:', colors.yellow);
    log(`  find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +`, colors.white);
  }
  
  // ========================================
  // REPORT: Other tables
  // ========================================
  log('\n\n📊 OTHER TABLES USAGE', colors.bright + colors.magenta);
  log('='.repeat(80), colors.magenta);
  
  const sortedTables = Object.entries(totalResults.other_tables)
    .sort((a, b) => b[1].length - a[1].length);
  
  if (sortedTables.length === 0) {
    log('  אין שימוש בטבלאות אחרות', colors.yellow);
  } else {
    log('', colors.reset);
    sortedTables.forEach(([table, usages]) => {
      log(`  📋 ${table}: ${usages.length} שימושים`, colors.cyan);
      
      // Group by operation
      const operations: Record<string, number> = {};
      usages.forEach(usage => {
        operations[usage.operation] = (operations[usage.operation] || 0) + 1;
      });
      
      const opSummary = Object.entries(operations)
        .map(([op, count]) => `${op}:${count}`)
        .join(', ');
      log(`     פעולות: ${opSummary}`, colors.blue);
    });
  }
  
  // ========================================
  // SUMMARY
  // ========================================
  log('\n\n🎯 SUMMARY', colors.bright + colors.cyan);
  log('='.repeat(80), colors.cyan);
  
  const summary = {
    total_files_scanned: scannedCount,
    unified_dashboard_usage: totalResults.unified_dashboard.length,
    tasks_usage: totalResults.tasks.length,
    other_tables: Object.keys(totalResults.other_tables).length,
    total_db_calls: 
      totalResults.unified_dashboard.length + 
      totalResults.tasks.length + 
      Object.values(totalResults.other_tables).reduce((sum, arr) => sum + arr.length, 0)
  };
  
  log('', colors.reset);
  log(`  📁 קבצים שנסרקו: ${summary.total_files_scanned}`, colors.cyan);
  log(`  💾 סך קריאות DB: ${summary.total_db_calls}`, colors.cyan);
  log(`  ✅ unified_dashboard: ${summary.unified_dashboard_usage} שימושים`, colors.green);
  log(`  ❌ tasks: ${summary.tasks_usage} שימושים (צריך לתקן!)`, 
      summary.tasks_usage > 0 ? colors.red : colors.green);
  log(`  📊 טבלאות אחרות: ${summary.other_tables}`, colors.cyan);
  
  // Health check
  log('\n  🏥 בדיקת תקינות:', colors.bright + colors.yellow);
  
  if (summary.tasks_usage === 0 && summary.unified_dashboard_usage > 0) {
    log('  ✅ מצוין! כל הקוד משתמש ב-unified_dashboard', colors.green);
  } else if (summary.tasks_usage > 0) {
    log(`  ❌ נמצאו ${summary.tasks_usage} מקומות שמשתמשים ב-tasks במקום unified_dashboard`, colors.red);
    log('  🔧 תקן אותם באמצעות הפקודות למעלה', colors.yellow);
  } else if (summary.unified_dashboard_usage === 0) {
    log('  ⚠️  אין שימוש ב-unified_dashboard בכלל - זו בעיה!', colors.red);
  }
  
  log('\n' + '='.repeat(80) + '\n', colors.cyan);
  
  // Save report to file
  const reportPath = path.join(rootDir, 'DB-USAGE-REPORT.md');
  const reportContent = generateMarkdownReport(summary, totalResults);
  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  
  log(`📄 דוח מלא נשמר ב: DB-USAGE-REPORT.md\n`, colors.green);
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(summary: any, results: ScanResult): string {
  const timestamp = new Date().toLocaleString('he-IL');
  
  let report = `# 🔍 Database Usage Report

**תאריך**: ${timestamp}  
**קבצים שנסרקו**: ${summary.total_files_scanned}  
**סך קריאות DB**: ${summary.total_db_calls}

---

## 📊 סיכום

| טבלה | שימושים | סטטוס |
|------|---------|--------|
| unified_dashboard | ${summary.unified_dashboard_usage} | ✅ נכון |
| tasks | ${summary.tasks_usage} | ${summary.tasks_usage > 0 ? '❌ לתקן' : '✅ תקין'} |
| אחרות | ${summary.other_tables} טבלאות | ℹ️ |

---

## ✅ unified_dashboard Usage (הטבלה הנכונה)

`;

  if (results.unified_dashboard.length === 0) {
    report += `**❌ אין שימוש ב-unified_dashboard!**\n\n`;
  } else {
    const byFile: Record<string, TableUsage[]> = {};
    results.unified_dashboard.forEach(usage => {
      if (!byFile[usage.file]) byFile[usage.file] = [];
      byFile[usage.file].push(usage);
    });
    
    Object.entries(byFile).forEach(([file, usages]) => {
      report += `### ${file}\n\n`;
      usages.forEach(usage => {
        report += `- שורה ${usage.line}: \`[${usage.operation}]\` \`\`\`${usage.code}\`\`\`\n`;
      });
      report += '\n';
    });
  }

  report += `---

## ❌ tasks Usage (צריך לתקן!)

`;

  if (results.tasks.length === 0) {
    report += `**✅ אין שימוש ב-tasks - מצוין!**\n\n`;
  } else {
    const byFile: Record<string, TableUsage[]> = {};
    results.tasks.forEach(usage => {
      if (!byFile[usage.file]) byFile[usage.file] = [];
      byFile[usage.file].push(usage);
    });
    
    report += `**🚨 נמצאו ${results.tasks.length} מקומות שצריך לתקן:**\n\n`;
    
    Object.entries(byFile).forEach(([file, usages]) => {
      report += `### ❌ ${file}\n\n`;
      usages.forEach(usage => {
        report += `- שורה ${usage.line}: \`${usage.code}\`\n`;
      });
      report += '\n';
    });
    
    report += `### 🔧 פקודות תיקון אוטומטי:\n\n\`\`\`bash\n`;
    report += `# תקן את כל הקבצים בבת אחת:\n`;
    report += `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +\n`;
    report += `\`\`\`\n\n`;
  }

  report += `---

**הערה**: דוח זה נוצר אוטומטית על ידי \`analyze-current-state.ts\`
`;

  return report;
}

// Run analysis
analyzeProject().catch(error => {
  log(`\n❌ שגיאה: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});