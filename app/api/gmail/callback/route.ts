// ✅ Gmail OAuth - Handle callback
import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, saveGmailAccount } from '@/lib/gmail/oauth';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // userId
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=gmail_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state parameter' },
      { status: 400 }
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);
    
    console.log('✅ Received tokens:', { 
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expiry_date 
    });
    
    // Get user's email address
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
    );
    
    // Set credentials with the tokens we received
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type || 'Bearer',
      scope: tokens.scope
    });
    
    console.log('🔐 OAuth2Client credentials set');
    
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email!;
    
    console.log('📧 Got user email:', email);

    // Save account to database
    await saveGmailAccount(state, email, tokens);

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_connected=${email}`
    );
  } catch (error: any) {
    console.error('❌ Gmail callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=gmail_save_failed`
    );
  }
}
