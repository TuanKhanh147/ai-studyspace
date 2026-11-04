'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Empty, ErrorBox, Field, inputCls } from './ui';
import { LEVELS, QUESTION_TYPES } from '@/lib/constants';
import { fmtDateTime } from '@/lib/format';

export default function QuizHub({ subjectId, quizzes, attempts }: { subjectId: string; quizzes: any[]; attempts: { quiz_id: string; percent: number }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [types, setTypes] = useState<string[]>(['mcq']);
  const [levels, setLevels] = useState<string[]>(['understand']);
  const [count, setCount] = useState(10);
  const [chapters, setChapters] = useState<string[]>([]);
  const [allChapters, setAllChapters] = useState<string[]>([]);
  const [showAnswers, setShowAnswers] = useState(true);
  const [showExplanations, setShowExplanations] = useState(true);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('subject_chapters', { p_subject_id: subjectId }).then(({ data }: any) => {
      setAllChapters((data || []).map((r: any) => r.chapter).sort((a: string, b: string) => a.localeCompare(b, 'vi', { numeric: true })));
    });
  }, [subjectId, supabase]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/quiz/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subjectId, types, levels, count, chapters, showAnswers, showExplanations, title }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/subjects/${subjectId}/quiz/${j.quizId}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }
  async function remove(id: string) {
    if (!confirm('Xóa bộ câu hỏi và các lần làm bài?')) return;
    await supabase.from('quizzes').delete().eq('id', id);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <h2 className="font-semibold">Tạo bộ câu hỏi ôn tập</h2>
        <Field label="Dạng câu hỏi">
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => (
              <label key={t.value} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${types.includes(t.value) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300'}`}>
                <input type="checkbox" className="hidden" checked={types.includes(t.value)} onChange={() => toggle(types, setTypes, t.value)} /> {t.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Mức độ">
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((t) => (
              <label key={t.value} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${levels.includes(t.value) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300'}`}>
                <input type="checkbox" className="hidden" checked={levels.includes(t.value)} onChange={() => toggle(levels, setLevels, t.value)} /> {t.label}
              </label>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số lượng câu (1–40)"><input type="number" min={1} max={40} className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>
          <Field label="Tên bộ câu hỏi (tuỳ chọn)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        </div>
        <Field label={`Chương cần ôn (${allChapters.length ? 'để trống = tất cả' : 'chưa nhận diện được chương nào trong tài liệu'})`}>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {allChapters.map((c) => (
              <label key={c} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${chapters.includes(c) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300'}`}>
                <input type="checkbox" className="hidden" checked={chapters.includes(c)} onChange={() => toggle(chapters, setChapters, c)} /> {c}
              </label>
            ))}
          </div>
        </Field>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} /> Hiển thị đáp án sau khi nộp</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showExplanations} onChange={(e) => setShowExplanations(e.target.checked)} /> Hiển thị lời giải chi tiết</label>
        </div>
        <ErrorBox text={error} />
        <Button loading={loading} onClick={generate}><Sparkles className="h-4 w-4" /> Tạo câu hỏi</Button>
        {loading && <span className="ml-3 text-sm text-slate-500">AI đang soạn câu hỏi từ tài liệu…</span>}
      </Card>

      <h2 className="font-semibold">Các bộ câu hỏi đã tạo</h2>
      {quizzes.length === 0 ? (
        <Empty text="Chưa có bộ câu hỏi nào." />
      ) : (
        <div className="space-y-2">
          {quizzes.map((q) => {
            const at = attempts.filter((a) => a.quiz_id === q.id);
            const best = at.length ? Math.max(...at.map((a) => Number(a.percent))) : null;
            return (
              <div key={q.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <Link href={`/subjects/${subjectId}/quiz/${q.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium">{q.title}</div>
                  <div className="text-xs text-slate-500">{q.config?.count} câu · {fmtDateTime(q.created_at)} · {at.length} lần làm{best !== null ? ` · điểm cao nhất ${best}%` : ''}</div>
                </Link>
                <Button variant="ghost" className="!px-2 text-red-600" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
