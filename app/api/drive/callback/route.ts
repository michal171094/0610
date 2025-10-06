import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, saveDriveAccount } from '@/lib/drive/oauth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/?drive_error=${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state' },
        { status: 400 }
      );
    }

    // קבלת טוקנים מגוגל
    const tokens = await getTokensFromCode(code);

    // שמירת החשבון
    await saveDriveAccount(state, tokens);

    // הפניה חזרה לאפליקציה
    return NextResponse.redirect(
      new URL('/?drive_connected=true', request.url)
    );
  } catch (error) {
    console.error('Error in Drive OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/?drive_error=auth_failed', request.url)
    );
  }
}
