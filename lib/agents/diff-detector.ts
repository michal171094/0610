/**
 * Diff Detector
 * Detects changes between old and new data
 */

export interface DiffResult {
  field: string
  oldValue: any
  newValue: any
  changeType: 'added' | 'removed' | 'modified'
}

export class DiffDetector {
  detectChanges(oldData: any, newData: any): DiffResult[] {
    const diffs: DiffResult[] = []

    // Fields to check
    const fields = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])

    for (const field of fields) {
      const oldVal = oldData?.[field]
      const newVal = newData?.[field]

      if (oldVal === undefined && newVal !== undefined) {
        diffs.push({ field, oldValue: null, newValue: newVal, changeType: 'added' })
      } else if (oldVal !== undefined && newVal === undefined) {
        diffs.push({ field, oldValue: oldVal, newValue: null, changeType: 'removed' })
      } else if (oldVal !== newVal) {
        diffs.push({ field, oldValue: oldVal, newValue: newVal, changeType: 'modified' })
      }
    }

    return diffs
  }

  formatChangeSummary(diffs: DiffResult[]): string {
    if (diffs.length === 0) return 'אין שינויים'

    const parts: string[] = []

    for (const diff of diffs) {
      const fieldHebrew = this.translateField(diff.field)
      
      if (diff.changeType === 'added') {
        parts.push(`הוסף ${fieldHebrew}: ${diff.newValue}`)
      } else if (diff.changeType === 'removed') {
        parts.push(`הסר ${fieldHebrew}`)
      } else {
        parts.push(`עדכן ${fieldHebrew} מ-${diff.oldValue} ל-${diff.newValue}`)
      }
    }

    return parts.join(', ')
  }

  private translateField(field: string): string {
    const translations: Record<string, string> = {
      amount: 'סכום',
      deadline: 'תאריך יעד',
      status: 'סטטוס',
      priority: 'עדיפות',
      case_number: 'מספר תיק',
      title: 'כותרת',
      description: 'תיאור',
    }
    return translations[field] || field
  }
}

let diffDetector: DiffDetector | null = null

export function getDiffDetector(): DiffDetector {
  if (!diffDetector) {
    diffDetector = new DiffDetector()
  }
  return diffDetector
}
