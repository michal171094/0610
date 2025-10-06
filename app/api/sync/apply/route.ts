/**
 * ✅ Sync Apply API - אישור הצעות
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suggestions } = body;

    // TODO: הוסף לוגיקה לאישור הצעות
    // 1. עבור על כל suggestion
    // 2. עדכן DB בהתאם
    // 3. סמן email_insights כ-processed

    return NextResponse.json({
      success: true,
      applied: 0,
    });
  } catch (error: any) {
    console.error('Apply error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
