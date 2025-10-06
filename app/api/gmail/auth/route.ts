// 🔐 Gmail OAuth - Start authentication
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail/oauth';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get actual user ID from session
    const userId = 'michal-user-id'; // Replace with actual user auth
    
    const authUrl = getAuthUrl(userId);
    
    return NextResponse.json({ 
      authUrl,
      message: 'Redirect user to this URL to authorize Gmail access'
    });
  } catch (error: any) {
    console.error('❌ Gmail auth error:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL', details: error.message },
      { status: 500 }
    );
  }
}
