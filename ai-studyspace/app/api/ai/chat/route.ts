import { NextResponse } from 'next/server';
import { requireUser, handleError, HttpError } from '@/lib/api';
import { aiText } from '@/lib/ai/provider';
import { retrieve, hitToText } from '@/lib/ai/retrieve';
import { GROUNDING_RULES } from '@/lib/ai/prompts';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { supabase } = await requireUser();
    const { subjectId, message } = await req.json();
    if (!message?.trim()) throw new HttpError(400, 'Câu hỏi trống');
    const { data: subject } = await supabase.from('subjects').select('id,name').eq('id', subjectId).single();
    if (!subject) throw new HttpError(404, 'Không tìm thấy môn học');

    const { data: hist } = await supabase
      .from('chat_messages')
      .select('role,content')
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
      .limit(8);
    const history = (hist || []).reverse();

    // câu hỏi ngắn/đại từ => ghép thêm câu hỏi trước để truy xuất đúng ngữ cảnh
    const lastUser = [...history].reverse().find((m: any) => m.role === 'user')?.content || '';
    const query = message.length < 40 ? `${lastUser} ${message}` : message;
    const hits = await retrieve(supabase, subjectId, query, 12);
    const ctx = hits.map(hitToText).join('\n\n') || '(không tìm thấy đoạn tài liệu nào liên quan)';

    const system = `Bạn là trợ lý học tập riêng của môn "${subject.name}". ${GROUNDING_RULES}
Trả lời tự nhiên, dễ hiểu như gia sư. Nếu <tai_lieu> không đủ thông tin, nói rõ "Tài liệu môn học không đề cập nội dung này" và chỉ khi hữu ích mới bổ sung ngắn gọn với nhãn [AI bổ sung – ngoài tài liệu].`;

    const answer = await aiText({
      system,
      maxTokens: 3000,
      messages: [
        ...history.map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user', content: `<tai_lieu>\n${ctx}\n</tai_lieu>\n\nCâu hỏi: ${message}` },
      ],
    });

    const seen = new Set<string>();
    const sources = hits
      .map((h) => ({ file: h.document_name, location: h.location, chapter: h.chapter }))
      .filter((s) => {
        const k = s.file + s.location;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

    await supabase.from('chat_messages').insert([
      { subject_id: subjectId, role: 'user', content: message },
      { subject_id: subjectId, role: 'assistant', content: answer, sources },
    ]);
    return NextResponse.json({ answer, sources });
  } catch (e) {
    return handleError(e);
  }
}
