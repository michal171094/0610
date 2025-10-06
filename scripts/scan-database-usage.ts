#!/usr/bin/env ts-node
/**
 * 🔍 Database Usage Scanner
 * 
 * סורק את כל הקבצים בפרויקט ומוצא:
 * ✅ שימוש ב-unified_dashboard (נכון)
 * ❌ שימוש ב-tasks (לא נכון)
 * 
 * Usage: npx ts-node scripts/scan-database-usage.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// צבעים לטרמינל
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  white: '\x1b[37m'
};

interface FileMatch {
  file: string;
  lineNumber: number;
  line: string;
}

interface ScanResults {
  unifiedDashboard: FileMatch[];
  tasks: FileMatch[];
}

/**
 * סורק קובץ בודד ומחפש שימוש בטבלאות
 */
function scanFile(filePath: string): ScanResults {
  const results: ScanResults = {
    unifiedDashboard: [],
    tasks: []
  };

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // חיפוש unified_dashboard
      if (line.includes(".from('unified_dashboard')") || 
          line.includes('.from("unified_dashboard")')) {
        results.unifiedDashboard.push({
          file: filePath,
          lineNumber,
          line: line.trim()
        });
      }

      // חיפוש tasks
      if (line.includes(".from('tasks')") || 
          line.includes('.from("tasks")')) {
        results.tasks.push({
          file: filePath,
          lineNumber,
          line: line.trim()
        });
      }
    });
  } catch (error) {
    // שגיאת קריאה - נדלג על הקובץ
  }

  return results;
}

/**
 * סורק תיקייה רקורסיבית
 */
function scanDirectory(dir: string, results: ScanResults): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // דלג על תיקיות מסוימות
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || 
          entry.name === '.next' || 
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === 'build') {
        continue;
      }
      scanDirectory(fullPath, results);
    } else if (entry.isFile()) {
      // סרוק רק קבצי TypeScript/JavaScript
      if (entry.name.endsWith('.ts') || 
          entry.name.endsWith('.tsx') || 
          entry.name.endsWith('.js') || 
          entry.name.endsWith('.jsx')) {
        const fileResults = scanFile(fullPath);
        results.unifiedDashboard.push(...fileResults.unifiedDashboard);
        results.tasks.push(...fileResults.tasks);
      }
    }
  }
}

/**
 * מקבץ תוצאות לפי קובץ
 */
function groupByFile(matches: FileMatch[]): Map<string, FileMatch[]> {
  const grouped = new Map<string, FileMatch[]>();
  
  for (const match of matches) {
    if (!grouped.has(match.file)) {
      grouped.set(match.file, []);
    }
    grouped.get(match.file)!.push(match);
  }
  
  return grouped;
}

/**
 * מדפיס תוצאות בצורה יפה
 */
function printResults(results: ScanResults): void {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}🔍 Database Usage Scan Results${colors.reset}`);
  console.log('='.repeat(80) + '\n');

  // סך הכל
  console.log(`${colors.bright}📊 Summary:${colors.reset}`);
  console.log(`${colors.green}✅ unified_dashboard: ${results.unifiedDashboard.length} שימושים${colors.reset}`);
  console.log(`${colors.red}❌ tasks: ${results.tasks.length} שימושים (צריך לתקן!)${colors.reset}\n`);

  // פירוט unified_dashboard
  if (results.unifiedDashboard.length > 0) {
    console.log(`${colors.bright}${colors.green}✅ UNIFIED_DASHBOARD (נכון!):${colors.reset}\n`);
    const groupedUD = groupByFile(results.unifiedDashboard);
    
    for (const [file, matches] of groupedUD.entries()) {
      const relPath = path.relative(process.cwd(), file);
      console.log(`${colors.cyan}📄 ${relPath}${colors.reset} (${matches.length} שימושים)`);
      
      for (const match of matches) {
        console.log(`   ${colors.yellow}שורה ${match.lineNumber}:${colors.reset} ${match.line.substring(0, 100)}`);
      }
      console.log();
    }
  }

  // פירוט tasks
  if (results.tasks.length > 0) {
    console.log(`${colors.bright}${colors.red}❌ TASKS (לא נכון - צריך לתקן!):${colors.reset}\n`);
    const groupedTasks = groupByFile(results.tasks);
    
    for (const [file, matches] of groupedTasks.entries()) {
      const relPath = path.relative(process.cwd(), file);
      console.log(`${colors.red}📄 ${relPath}${colors.reset} (${matches.length} שימושים)`);
      
      for (const match of matches) {
        console.log(`   ${colors.yellow}שורה ${match.lineNumber}:${colors.reset} ${match.line.substring(0, 100)}`);
      }
      console.log();
    }

    // הצעות תיקון
    console.log(`${colors.bright}${colors.yellow}🔧 פקודות תיקון:${colors.reset}\n`);
    
    for (const [file, _] of groupedTasks.entries()) {
      const relPath = path.relative(process.cwd(), file);
      console.log(`${colors.white}sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${relPath}"${colors.reset}`);
    }
    
    console.log(`\n${colors.yellow}או תיקון אוטומטי של הכל:${colors.reset}`);
    console.log(`${colors.white}find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +${colors.reset}\n`);
  } else {
    console.log(`${colors.bright}${colors.green}🎉 מעולה! אין שימוש ב-tasks, הכל נכון!${colors.reset}\n`);
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * שומר תוצאות לקובץ
 */
function saveToFile(results: ScanResults): void {
  const reportPath = path.join(process.cwd(), 'DB-USAGE-REPORT.md');
  
  let content = '# 🔍 Database Usage Report\n\n';
  content += `**תאריך**: ${new Date().toLocaleString('he-IL')}\n\n`;
  content += '## 📊 Summary\n\n';
  content += `- ✅ **unified_dashboard**: ${results.unifiedDashboard.length} שימושים (נכון!)\n`;
  content += `- ❌ **tasks**: ${results.tasks.length} שימושים (צריך לתקן!)\n\n`;

  if (results.unifiedDashboard.length > 0) {
    content += '## ✅ unified_dashboard Usage (נכון)\n\n';
    const groupedUD = groupByFile(results.unifiedDashboard);
    
    for (const [file, matches] of groupedUD.entries()) {
      const relPath = path.relative(process.cwd(), file);
      content += `### 📄 ${relPath}\n\n`;
      content += `**${matches.length} שימושים**:\n\n`;
      
      for (const match of matches) {
        content += `- שורה ${match.lineNumber}: \`${match.line.substring(0, 100)}\`\n`;
      }
      content += '\n';
    }
  }

  if (results.tasks.length > 0) {
    content += '## ❌ tasks Usage (לא נכון - צריך לתקן!)\n\n';
    const groupedTasks = groupByFile(results.tasks);
    
    for (const [file, matches] of groupedTasks.entries()) {
      const relPath = path.relative(process.cwd(), file);
      content += `### 📄 ${relPath}\n\n`;
      content += `**${matches.length} שימושים**:\n\n`;
      
      for (const match of matches) {
        content += `- שורה ${match.lineNumber}: \`${match.line.substring(0, 100)}\`\n`;
      }
      content += '\n';
    }

    content += '## 🔧 Fix Commands\n\n';
    content += 'תיקון קובץ אחר קובץ:\n\n';
    content += '```bash\n';
    
    for (const [file, _] of groupedTasks.entries()) {
      const relPath = path.relative(process.cwd(), file);
      content += `sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" "${relPath}"\n`;
    }
    
    content += '```\n\n';
    content += 'או תיקון אוטומטי של הכל:\n\n';
    content += '```bash\n';
    content += `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -exec sed -i '' "s/\\.from('tasks')/\\.from('unified_dashboard')/g" {} +\n`;
    content += '```\n\n';
  }

  fs.writeFileSync(reportPath, content, 'utf8');
  console.log(`${colors.green}✅ הדוח נשמר ב: ${reportPath}${colors.reset}\n`);
}

/**
 * Main
 */
function main(): void {
  console.log(`${colors.bright}${colors.cyan}🚀 Starting database usage scan...${colors.reset}\n`);

  const results: ScanResults = {
    unifiedDashboard: [],
    tasks: []
  };

  const projectRoot = process.cwd();
  console.log(`${colors.blue}📂 Scanning: ${projectRoot}${colors.reset}\n`);

  scanDirectory(projectRoot, results);

  printResults(results);
  saveToFile(results);

  console.log(`${colors.green}✅ Scan complete!${colors.reset}\n`);
}

// הפעלה
main();