// 📋 Gmail Accounts - List and manage connected accounts
import { NextRequest, NextResponse } from 'next/server';
import { getGmailAccounts, removeGmailAccount } from '@/lib/gmail/oauth';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get actual user ID from session
    const userId = 'michal-user-id';
    
    const accounts = await getGmailAccounts(userId);
    
    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error('❌ Error fetching Gmail accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Gmail accounts', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing accountId' },
        { status: 400 }
      );
    }
    
    await removeGmailAccount(accountId);
    
    return NextResponse.json({ 
      success: true,
      message: 'Gmail account removed successfully'
    });
  } catch (error: any) {
    console.error('❌ Error removing Gmail account:', error);
    return NextResponse.json(
      { error: 'Failed to remove Gmail account', details: error.message },
      { status: 500 }
    );
  }
}
