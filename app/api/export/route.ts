import { NextResponse } from 'next/server';
import { requireUser, handleError } from '@/lib/api';

export const runtime = 'nodejs';

// Sao lưu dữ liệu cá nhân (không gồm file gốc – file nằm trong Supabase Storage).
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const tables = ['subjects', 'documents', 'assignments', 'notes', 'exams', 'outlines', 'quizzes', 'quiz_attempts', 'chat_messages', 'activities'];
    const out: Record<string, any> = { exported_at: new Date().toISOString(), user_id: user.id };
    for (const t of tables) {
      const { data } = await supabase.from(t).select('*');
      out[t] = data || [];
    }
    return new NextResponse(JSON.stringify(out, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="studyspace-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
