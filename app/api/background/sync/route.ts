/**
 * 🔁 Background Sync API - polling כל 5 דקות
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // TODO: הוסף לוגיקה של polling
    // 1. הפעל Gmail Scanner
    // 2. הפעל Sync Agent
    // 3. החזר תוצאות

    return NextResponse.json({
      success: true,
      scanned: 0,
      suggestions: 0,
    });
  } catch (error: any) {
    console.error('Background sync error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
