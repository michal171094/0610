import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/drive/oauth';

export async function GET(request: NextRequest) {
  try {
    const userId = 'default-user'; // TODO: get from session
    const authUrl = getAuthUrl(userId);
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating Drive auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
