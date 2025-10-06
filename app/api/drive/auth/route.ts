import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/drive/oauth';

export async function GET(request: NextRequest) {
  try {
    const userId = 'default-user'; // TODO: get from session
    const authUrl = getAuthUrl(userId);
    
    // Redirect directly to Google OAuth instead of returning JSON
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating Drive auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
