import { NextResponse } from 'next/server';
import { requireUser, handleError, HttpError, mapLimit } from '@/lib/api';
import { aiText } from '@/lib/ai/provider';
import { parseJson } from '@/lib/ai/json';
import { loadChunks, rowToSegment, sampleSegments, retrieve, hitToText } from '@/lib/ai/retrieve';
import { GROUNDING_RULES } from '@/lib/ai/prompts';

export const runtime = 'nodejs';
export const maxDuration = 300;

const TYPES = ['mcq', 'tf', 'fill', 'essay', 'calc', 'scenario'];
const LEVELS = ['recognize', 'understand', 'apply', 'advanced'];
const LEVEL_VI: Record<string, string> = { recognize: 'nhận biết', understand: 'thông hiểu', apply: 'vận dụng', advanced: 'vận dụng cao' };
const TYPE_VI: Record<string, string> = { mcq: 'trắc nghiệm 4 đáp án', tf: 'đúng/sai', fill: 'điền khuyết', essay: 'tự luận', calc: 'bài tập tính toán', scenario: 'câu hỏi tình huống' };

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

export async function POST(req: Request) {
  try {
    const { supabase } = await requireUser();
    const body = await req.json();
    const subjectId: string = body.subjectId;
    const types: string[] = (body.types || ['mcq']).filter((t: string) => TYPES.includes(t));
    const levels: string[] = (body.levels || ['understand']).filter((t: string) => LEVELS.includes(t));
    const count = Math.max(1, Math.min(40, Number(body.count) || 10));
    const chapters: string[] = body.chapters || [];
    if (!types.length || !levels.length) throw new HttpError(400, 'Hãy chọn ít nhất một dạng câu hỏi và một mức độ.');

    const { data: subject } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
    if (!subject) throw new HttpError(404, 'Không tìm thấy môn học');

    // ----- Ngữ cảnh từ tài liệu -----
    let rows = await loadChunks(supabase, subjectId, chapters.length ? chapters : undefined);
    let segs = rows.map(rowToSegment);
    if (!segs.length && chapters.length) {
      const hits = await retrieve(supabase, subjectId, chapters.join(' '), 30);
      segs = hits.map(hitToText);
    }
    if (!segs.length) throw new HttpError(400, 'Môn học chưa có nội dung tài liệu đã đọc để tạo câu hỏi.');
    segs = sampleSegments(segs, 150_000);
    const material = segs.join('\n\n');
    const chapterList = Array.from(new Set(rows.map((r) => r.chapter).filter(Boolean))) as string[];

    // ----- Kế hoạch loại câu hỏi / mức độ -----
    const plan = Array.from({ length: count }, (_, i) => ({
      type: types[i % types.length],
      level: levels[Math.floor(i / types.length) % levels.length],
    }));
    const batches: (typeof plan)[] = [];
    for (let i = 0; i < plan.length; i += 8) batches.push(plan.slice(i, i + 8));

    const system = `Bạn là giảng viên ra đề. ${GROUNDING_RULES}
Mỗi câu hỏi và đáp án phải dựa trên <tai_lieu>. Giải thích phải bám tài liệu và nêu nguồn.
Chỉ trả về MỘT đối tượng JSON hợp lệ (không kèm văn bản nào khác, không dùng markdown fence):
{"questions":[{"type":"mcq|tf|fill|essay|calc|scenario","level":"recognize|understand|apply|advanced","chapter":"...","question":"...","options":["...","...","...","..."],"answer":"...","accepted":["..."],"explanation":"...","source":"Tên file, Trang/Slide"}]}
Quy ước: mcq có đúng 4 phương án (không ghi tiền tố A/B/C/D), "answer" là chữ cái A|B|C|D; tf: "question" là một mệnh đề, "answer" là "Đúng" hoặc "Sai"; fill: "question" chứa "____", "answer" là đáp án ngắn, "accepted" là các cách viết chấp nhận được; essay/calc/scenario: "answer" là đáp án mẫu/các ý chính/lời giải từng bước. "chapter" ${chapterList.length ? 'PHẢI chọn đúng một giá trị trong danh sách: ' + JSON.stringify(chapterList) : 'là tên chương/chủ đề lấy từ tài liệu'}. Không lặp lại câu hỏi.`;

    const results = await mapLimit(batches, 3, async (b, bi) => {
      const spec = b.map((p, i) => `${i + 1}. dạng ${TYPE_VI[p.type]} (type="${p.type}"), mức ${LEVEL_VI[p.level]} (level="${p.level}")`).join('\n');
      const text = await aiText({
        system,
        json: true,
        maxTokens: 7000,
        messages: [
          {
            role: 'user',
            content: `Môn học: ${subject.name}\n${chapters.length ? 'Phạm vi: ' + chapters.join('; ') + '\n' : ''}<tai_lieu>\n${material}\n</tai_lieu>\n\nHãy tạo đúng ${b.length} câu theo danh sách:\n${spec}\n${bi > 0 ? 'Đây là lô tiếp theo, hãy khai thác các phần kiến thức khác nhau.' : ''}`,
          },
        ],
      });
      return parseJson<{ questions: any[] }>(text).questions || [];
    });

    // ----- Kiểm tra & chuẩn hoá -----
    const questions: any[] = [];
    for (const q of results.flat()) {
      if (!q || !TYPES.includes(q.type) || !q.question || q.answer === undefined || q.answer === '') continue;
      const item: any = {
        type: q.type,
        level: LEVELS.includes(q.level) ? q.level : 'understand',
        chapter: String(q.chapter || 'Chung'),
        question: String(q.question),
        answer: String(q.answer),
        explanation: String(q.explanation || ''),
        source: String(q.source || ''),
      };
      if (chapterList.length && !chapterList.includes(item.chapter)) {
        const m = chapterList.find((c) => c.toLowerCase().includes(item.chapter.toLowerCase()) || item.chapter.toLowerCase().includes(c.toLowerCase()));
        if (m) item.chapter = m;
      }
      if (q.type === 'mcq') {
        if (!Array.isArray(q.options) || q.options.length !== 4) continue;
        const idx = 'ABCD'.indexOf(String(q.answer).trim().toUpperCase().charAt(0));
        if (idx < 0) continue;
        const correct = String(q.options[idx]);
        const opts = shuffle(q.options.map(String));
        item.options = opts;
        item.answer = 'ABCD'[opts.indexOf(correct)];
      } else if (q.type === 'tf') {
        const a = String(q.answer).trim().toLowerCase();
        if (!['đúng', 'sai', 'true', 'false'].includes(a)) continue;
        item.answer = a === 'đúng' || a === 'true' ? 'Đúng' : 'Sai';
      } else if (q.type === 'fill') {
        item.accepted = Array.isArray(q.accepted) ? q.accepted.map(String) : [];
      }
      questions.push(item);
    }
    if (!questions.length) throw new HttpError(502, 'AI không tạo được câu hỏi hợp lệ. Hãy thử lại hoặc giảm số lượng.');
    const final = questions.slice(0, count).map((q, i) => ({ id: `q${i + 1}`, ...q }));

    const title = body.title?.trim() || `Bộ câu hỏi ${subject.name} – ${new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
    const config = { types, levels, count, chapters, showAnswers: body.showAnswers !== false, showExplanations: body.showExplanations !== false };
    const { data: quiz, error } = await supabase.from('quizzes').insert({ subject_id: subjectId, title, config, questions: final }).select('id').single();
    if (error) throw error;
    await supabase.from('activities').insert({ subject_id: subjectId, type: 'quiz', message: `Tạo bộ câu hỏi "${title}" (${final.length} câu)` });
    return NextResponse.json({ quizId: quiz.id, count: final.length, requested: count });
  } catch (e) {
    return handleError(e);
  }
}
