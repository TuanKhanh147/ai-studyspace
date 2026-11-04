import { NextResponse } from 'next/server';
import { requireUser, handleError, HttpError, mapLimit } from '@/lib/api';
import { aiText, aiTextEx } from '@/lib/ai/provider';
import { loadChunks, rowToSegment, pack } from '@/lib/ai/retrieve';
import { MAP_SYSTEM, OUTLINE_SYSTEM } from '@/lib/ai/prompts';
import { catLabel } from '@/lib/constants';
import { fmtDateTime } from '@/lib/format';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BUDGET = 350_000; // ký tự đưa thẳng vào 1 lần gọi AI (~100k token)
const BATCH = 80_000;

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { subjectId, focus } = await req.json();
    const { data: subject } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
    if (!subject) throw new HttpError(404, 'Không tìm thấy môn học');

    const { data: docs } = await supabase.from('documents').select('id,name,category,status,error,page_count').eq('subject_id', subjectId);
    const ready = (docs || []).filter((d: any) => d.status === 'ready');
    const bad = (docs || []).filter((d: any) => d.status !== 'ready');
    if (!ready.length) throw new HttpError(400, 'Môn học chưa có tài liệu nào được hệ thống đọc thành công. Hãy tải tài liệu lên và đợi trạng thái "Đã đọc".');

    const rows = await loadChunks(supabase, subjectId);
    let segs = rows.map(rowToSegment);
    let total = segs.reduce((s, x) => s + x.length, 0);
    let levels = 0;

    // Map-reduce khi tài liệu quá lớn: trích ghi chú có cấu trúc (kèm nguồn) rồi mới tổng hợp.
    while (total > BUDGET && levels < 3) {
      const batches = pack(segs, BATCH);
      const notes = await mapLimit(batches, 4, (b) =>
        aiText({ system: MAP_SYSTEM, messages: [{ role: 'user', content: b.join('\n\n') }], maxTokens: 6000 })
      );
      segs = notes;
      total = segs.reduce((s, x) => s + x.length, 0);
      levels++;
    }
    const material = segs.join('\n\n---\n\n');

    const fileList = ready.map((d: any) => `- ${d.name} (${catLabel(d.category)})`).join('\n');
    const missing: string[] = [];
    for (const c of ['textbook', 'slide', 'assignment', 'exam']) {
      if (!ready.some((d: any) => d.category === c)) missing.push(catLabel(c));
    }

    const { text, truncated } = await aiTextEx({
      system: OUTLINE_SYSTEM,
      maxTokens: 10000,
      messages: [
        {
          role: 'user',
          content: `Môn học: ${subject.name}${subject.code ? ' (' + subject.code + ')' : ''}
Các file đã đọc:\n${fileList}
${missing.length ? `Nhóm tài liệu CHƯA có: ${missing.join(', ')}\n` : ''}${bad.length ? `File không đọc được (không được dùng): ${bad.map((d: any) => d.name).join(', ')}\n` : ''}${focus ? `Phạm vi người dùng yêu cầu: ${focus}\n` : ''}${levels ? 'Lưu ý: tài liệu rất lớn nên phần dưới là ghi chú đã trích xuất có kèm nguồn.\n' : ''}
<tai_lieu>
${material}
</tai_lieu>

Hãy biên soạn đề cương ôn tập đầy đủ theo đúng cấu trúc 10 mục.`,
        },
      ],
    });

    let header = `> Đề cương tạo lúc ${fmtDateTime(new Date())}\n\n## Phạm vi tài liệu đã sử dụng\n${fileList}\n`;
    if (missing.length) header += `\n> ⚠️ Môn học chưa có: **${missing.join(', ')}**. Các mục liên quan có thể thiếu căn cứ.\n`;
    if (bad.length)
      header += `\n> ⚠️ **${bad.length} file không đọc được** và KHÔNG được dùng: ${bad.map((d: any) => `${d.name} (${d.error || d.status})`).join('; ')}\n`;
    if (levels) header += `\n> ℹ️ Tài liệu lớn nên được xử lý theo từng phần rồi tổng hợp.\n`;
    if (truncated) header += `\n> ⚠️ Đề cương có thể bị cắt do giới hạn độ dài. Hãy tạo lại với "Phạm vi" hẹp hơn (ví dụ: từng chương).\n`;

    const content = header + '\n---\n\n' + text;
    const title = `Đề cương ${subject.name}${focus ? ' – ' + String(focus).slice(0, 40) : ''}`;
    const { data: saved, error } = await supabase.from('outlines').insert({ subject_id: subjectId, title, content }).select().single();
    if (error) throw error;
    await supabase.from('activities').insert({ subject_id: subjectId, type: 'outline', message: `Tạo đề cương "${title}"` });
    return NextResponse.json({ outline: saved });
  } catch (e) {
    return handleError(e);
  }
}
