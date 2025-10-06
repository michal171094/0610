import { NextRequest, NextResponse } from 'next/server';
import { 
  findRelevantDocuments, 
  getDocumentsForTask,
  uploadScannedDocument 
} from '@/lib/drive/scanner';

// GET - חיפוש מסמכים למשימה
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const taskTitle = searchParams.get('taskTitle');
    const taskDescription = searchParams.get('taskDescription');
    const domain = searchParams.get('domain');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // בדיקה אם יש כבר מסמכים שמורים למשימה
    const existingDocs = await getDocumentsForTask(taskId);
    
    if (existingDocs.length > 0) {
      return NextResponse.json({
        documents: existingDocs,
        fromCache: true
      });
    }

    // אם לא - חיפוש אוטומטי
    if (taskTitle && taskDescription && domain) {
      const accountId = 'default-account'; // TODO: get from user
      const result = await findRelevantDocuments(
        accountId,
        taskTitle,
        taskDescription,
        domain
      );

      return NextResponse.json({
        documents: result.insights,
        files: result.files,
        fromCache: false
      });
    }

    return NextResponse.json({
      documents: [],
      fromCache: false
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    return NextResponse.json(
      { error: 'Failed to search documents' },
      { status: 500 }
    );
  }
}

// POST - העלאת מסמך סרוק ידנית
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const taskId = formData.get('taskId') as string;
    const fileName = formData.get('fileName') as string || file.name;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    const accountId = 'default-account'; // TODO: get from user
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadScannedDocument(
      accountId,
      fileName,
      buffer,
      file.type,
      taskId
    );

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      webViewLink: result.webViewLink,
      message: 'המסמך הועלה בהצלחה והחל ניתוח אוטומטי'
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
