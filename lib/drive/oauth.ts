import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';

const SCOPES = [
  'https://www.googleapis.com/auth/drive', // Full access to all Drive files for complete cloud upload
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_APP_URL + '/api/drive/callback'
  );
}

export function getAuthUrl(userId: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: userId,
    prompt: 'consent'
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function saveDriveAccount(userId: string, tokens: any) {
  const expiresAt = tokens.expiry_date 
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('drive_accounts')
    .upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      last_scanned_at: null
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDriveAccounts(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('drive_accounts')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

export async function removeDriveAccount(accountId: string) {
  const { error } = await supabaseAdmin
    .from('drive_accounts')
    .delete()
    .eq('id', accountId);

  if (error) throw error;
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export async function getValidAccessToken(accountId: string) {
  const { data: account, error } = await supabaseAdmin
    .from('drive_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error || !account) throw new Error('Drive account not found');

  const expiresAt = new Date(account.expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt < fiveMinutesFromNow) {
    console.log('Access token expired or expiring soon, refreshing...');
    const newTokens = await refreshAccessToken(account.refresh_token);
    
    const newExpiresAt = newTokens.expiry_date 
      ? new Date(newTokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    await supabaseAdmin
      .from('drive_accounts')
      .update({
        access_token: newTokens.access_token,
        expires_at: newExpiresAt
      })
      .eq('id', accountId);

    return newTokens.access_token;
  }

  return account.access_token;
}
