import { NextResponse } from 'next/server';
import { requireUser, handleError, HttpError } from '@/lib/api';
import { aiText } from '@/lib/ai/provider';
import { parseJson } from '@/lib/ai/json';

export const runtime = 'nodejs';
export const maxDuration = 120;

const norm = (s: string) => String(s || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export async function POST(req: Request) {
  try {
    const { supabase } = await requireUser();
    const { quizId, answers } = (await req.json()) as { quizId: string; answers: Record<string, string> };
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    if (!quiz) throw new HttpError(404, 'Không tìm thấy bộ câu hỏi');
    const questions: any[] = quiz.questions;

    const per: Record<string, { id: string; score: number; userAnswer: string; feedback?: string }> = {};
    const needAi: any[] = [];
    for (const q of questions) {
      const ua = String(answers?.[q.id] ?? '').trim();
      let score = 0;
      if (q.type === 'mcq') score = ua.toUpperCase() === q.answer ? 1 : 0;
      else if (q.type === 'tf') score = ua === q.answer ? 1 : 0;
      else if (q.type === 'fill') {
        const ok = [q.answer, ...(q.accepted || [])].map(norm);
        score = ua && ok.includes(norm(ua)) ? 1 : 0;
      } else if (ua) {
        needAi.push(q);
        continue;
      }
      per[q.id] = { id: q.id, score, userAnswer: ua };
    }
    // câu bỏ trống thuộc dạng tự luận
    for (const q of questions) if (!per[q.id] && !needAi.find((x) => x.id === q.id)) per[q.id] = { id: q.id, score: 0, userAnswer: '' };

    if (needAi.length) {
      const text = await aiText({
        json: true,
        maxTokens: 4000,
        system:
          'Bạn là giảng viên chấm bài. So sánh bài làm của sinh viên với đáp án mẫu (lấy từ tài liệu môn học). Cho điểm từ 0 đến 1 (bước 0.25) theo mức độ đúng và đủ ý; nhận xét ngắn gọn bằng tiếng Việt, chỉ ra ý còn thiếu/sai. Chỉ trả JSON: {"results":[{"id":"q1","score":0.75,"feedback":"..."}]}',
        messages: [
          {
            role: 'user',
            content: JSON.stringify(needAi.map((q) => ({ id: q.id, question: q.question, reference_answer: q.answer, student_answer: String(answers[q.id]).slice(0, 4000) }))),
          },
        ],
      });
      const res = parseJson<{ results: any[] }>(text).results || [];
      for (const q of needAi) {
        const r = res.find((x) => x.id === q.id);
        const s = Math.max(0, Math.min(1, Number(r?.score) || 0));
        per[q.id] = { id: q.id, score: s, userAnswer: String(answers[q.id]), feedback: r?.feedback || 'Chưa có nhận xét.' };
      }
    }

    // ----- Thống kê theo chương -----
    const byChapter: Record<string, { earned: number; total: number; wrong: string[] }> = {};
    for (const q of questions) {
      const c = q.chapter || 'Chung';
      byChapter[c] ??= { earned: 0, total: 0, wrong: [] };
      byChapter[c].total += 1;
      byChapter[c].earned += per[q.id].score;
      if (per[q.id].score < 0.75) byChapter[c].wrong.push(q.id);
    }
    const chapters = Object.entries(byChapter)
      .map(([chapter, v]) => ({ chapter, earned: v.earned, total: v.total, percent: Math.round((v.earned / v.total) * 100), wrong: v.wrong }))
      .sort((a, b) => a.percent - b.percent);
    const weak = chapters.filter((c) => c.percent < 70).map((c) => c.chapter);

    const score = Object.values(per).reduce((s, x) => s + x.score, 0);
    const total = questions.length;
    const percent = Math.round((score / total) * 100);

    // ----- Gợi ý ôn tập (bám nguồn của các câu sai) -----
    let recommendations = '';
    const wrongQs = questions.filter((q) => per[q.id].score < 0.75);
    if (wrongQs.length) {
      try {
        recommendations = await aiText({
          maxTokens: 1500,
          system:
            'Bạn là cố vấn học tập. Dựa DUY NHẤT vào các câu sinh viên làm sai/thiếu (kèm giải thích và nguồn tài liệu), hãy nêu ngắn gọn bằng tiếng Việt (Markdown, gạch đầu dòng, nhóm theo chương) những nội dung cần ôn lại, kèm nguồn (Tên file, vị trí) lấy từ trường "source". Không thêm kiến thức ngoài các dữ liệu đã cho.',
          messages: [
            { role: 'user', content: JSON.stringify(wrongQs.map((q) => ({ chapter: q.chapter, question: q.question, correct: q.answer, explanation: q.explanation, source: q.source }))).slice(0, 30000) },
          ],
        });
      } catch {
        recommendations = '';
      }
    }

    const result = { score, total, percent, perQuestion: Object.values(per), chapters, weak, recommendations };
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert({ subject_id: quiz.subject_id, quiz_id: quizId, answers, score, total, percent, result })
      .select('id,created_at')
      .single();
    if (error) throw error;
    await supabase.from('activities').insert({ subject_id: quiz.subject_id, type: 'attempt', message: `Làm bài "${quiz.title}": ${percent}%` });
    return NextResponse.json({ attemptId: attempt.id, createdAt: attempt.created_at, ...result });
  } catch (e) {
    return handleError(e);
  }
}
