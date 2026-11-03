import { NextResponse } from 'next/server';
import { requireUser, handleError, HttpError } from '@/lib/api';
import { aiText, aiVision } from '@/lib/ai/provider';
import { retrieve, hitToText } from '@/lib/ai/retrieve';
import { extractUnits, imageMime } from '@/lib/documents/extract';
import { GROUNDING_RULES } from '@/lib/ai/prompts';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const { supabase } = await requireUser();
    const form = await req.formData();
    const subjectId = String(form.get('subjectId') || '');
    let problem = String(form.get('text') || '').trim();
    const file = form.get('file') as File | null;

    const { data: subject } = await supabase.from('subjects').select('id,name').eq('id', subjectId).single();
    if (!subject) throw new HttpError(404, 'Không tìm thấy môn học');

    if (file && file.size > 0) {
      if (file.size > 4 * 1024 * 1024) throw new HttpError(400, 'File đề bài tối đa 4MB.');
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let extracted = '';
      if (['png', 'jpg', 'jpeg'].includes(ext)) {
        extracted = await aiVision(
          buf.toString('base64'),
          imageMime(file.name),
          'Chép lại CHÍNH XÁC toàn bộ đề bài trong ảnh (giữ nguyên số liệu, công thức, ký hiệu, các ý a/b/c). Chỉ trả về nội dung đề, không giải.',
          3000
        );
      } else {
        const { units } = await extractUnits(buf, file.name);
        extracted = units.map((u) => u.text).join('\n\n').slice(0, 20000);
      }
      problem = [problem, extracted].filter(Boolean).join('\n\n');
    }
    if (!problem) throw new HttpError(400, 'Hãy nhập đề bài, tải file hoặc chụp ảnh đề.');

    const hits = await retrieve(supabase, subjectId, problem.slice(0, 1500), 10);
    const ctx = hits.map(hitToText).join('\n\n') || '(không tìm thấy đoạn tài liệu liên quan)';

    const answer = await aiText({
      maxTokens: 4000,
      system: `Bạn là gia sư giải bài tập môn "${subject.name}". ${GROUNDING_RULES}
Cách trình bày:
## Đề bài (chép lại gọn)
## Công thức / kiến thức áp dụng (kèm nguồn trong tài liệu)
## Lời giải từng bước (đánh số, giải thích vì sao làm vậy)
## Kết quả
## Lưu ý / lỗi hay gặp
Ưu tiên phương pháp, ký hiệu và cách trình bày giống giáo trình/slide/bài mẫu trong <tai_lieu>. Nếu tài liệu không có phương pháp tương ứng, giải bằng kiến thức chuẩn và ghi rõ "[AI bổ sung – ngoài tài liệu]". Nếu đề thiếu dữ kiện hoặc không đọc rõ, hãy nêu rõ thay vì tự đoán.`,
      messages: [{ role: 'user', content: `<tai_lieu>\n${ctx}\n</tai_lieu>\n\nĐỀ BÀI:\n${problem}` }],
    });

    await supabase.from('activities').insert({ subject_id: subjectId, type: 'solve', message: 'Dùng AI giải bài tập' });
    return NextResponse.json({ problem, answer, sources: hits.map((h) => ({ file: h.document_name, location: h.location })) });
  } catch (e) {
    return handleError(e);
  }
}
