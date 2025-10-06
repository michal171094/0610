// 📧 Gmail OAuth Authentication
// Handles multi-account Google login for Gmail API

import { google } from 'googleapis';
import { supabaseAdmin } from '../supabase';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email', // Need this to get user email
];

export interface GmailAccount {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  created_at: string;
}

// 🔑 Create OAuth2 client
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
  );
}

// 🔗 Generate authorization URL
export function getAuthUrl(userId: string): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: userId, // Pass user ID for later identification
    prompt: 'consent', // Force consent screen to get refresh_token
  });
}

// 🎫 Exchange code for tokens
export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// 💾 Save Gmail account to database
export async function saveGmailAccount(
  userId: string,
  email: string,
  tokens: any
): Promise<void> {
  const expiresAt = tokens.expiry_date || Date.now() + 3600 * 1000;

  const { error } = await supabaseAdmin.from('gmail_accounts').upsert({
    user_id: userId,
    email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(expiresAt).toISOString(),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,email'
  });

  if (error) {
    console.error('❌ Failed to save Gmail account:', error);
    throw error;
  }

  console.log('✅ Gmail account saved:', email);
}

// 📋 Get all Gmail accounts for user
export async function getGmailAccounts(userId: string): Promise<GmailAccount[]> {
  const { data, error } = await supabaseAdmin
    .from('gmail_accounts')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('❌ Failed to get Gmail accounts:', error);
    return [];
  }

  return data as GmailAccount[];
}

// 🔄 Refresh access token if expired
export async function refreshAccessToken(account: GmailAccount): Promise<string> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: account.refresh_token,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  // Update token in database
  await supabaseAdmin
    .from('gmail_accounts')
    .update({
      access_token: credentials.access_token,
      expires_at: new Date(credentials.expiry_date || Date.now() + 3600000).toISOString(),
    })
    .eq('id', account.id);

  return credentials.access_token!;
}

// 🎯 Get valid access token (refresh if needed)
export async function getValidAccessToken(account: GmailAccount): Promise<string> {
  const now = Date.now();
  const expiresAt = new Date(account.expires_at).getTime();

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt - now < 5 * 60 * 1000) {
    console.log('🔄 Refreshing access token for:', account.email);
    return await refreshAccessToken(account);
  }

  return account.access_token;
}

// 🗑️ Remove Gmail account
export async function removeGmailAccount(accountId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('gmail_accounts')
    .delete()
    .eq('id', accountId);

  if (error) {
    console.error('❌ Failed to remove Gmail account:', error);
    throw error;
  }

  console.log('✅ Gmail account removed:', accountId);
}
