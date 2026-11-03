'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button, Card, ErrorBox, Markdown, inputCls } from './ui';
import { levelLabel, typeLabel } from '@/lib/constants';
import { fmtDateTime } from '@/lib/format';

type Result = { score: number; total: number; percent: number; perQuestion: { id: string; score: number; userAnswer: string; feedback?: string }[]; chapters: { chapter: string; earned: number; total: number; percent: number }[]; weak: string[]; recommendations: string };

export default function QuizRunner({ quiz, attempts }: { quiz: any; attempts: any[] }) {
  const router = useRouter();
  const qs: any[] = quiz.questions;
  const cfg = quiz.config || {};
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState(attempts);
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));
  const answered = Object.values(answers).filter((v) => String(v || '').trim()).length;

  async function submit() {
    if (answered < qs.length && !confirm(`Bạn mới trả lời ${answered}/${qs.length} câu. Vẫn nộp bài?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/quiz/grade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quizId: quiz.id, answers }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setResult(j);
      setPast((p) => [{ id: j.attemptId, created_at: j.createdAt, percent: j.percent, result: j, answers }, ...p]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function supplement() {
    if (!result) return;
    setGenLoading(true);
    setError(null);
    try {
      const types = Array.from(new Set(qs.map((q) => q.type)));
      const res = await fetch('/api/ai/quiz/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subjectId: quiz.subject_id, types, levels: ['understand', 'apply'], count: Math.max(6, result.weak.length * 3), chapters: result.weak, title: `Ôn bổ sung – ${quiz.title}`, showAnswers: true, showExplanations: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/subjects/${quiz.subject_id}/quiz/${j.quizId}`);
    } catch (e: any) {
      setError(e.message);
      setGenLoading(false);
    }
  }

  const reviewing = !!result;
  const per = (id: string) => result?.perQuestion.find((p) => p.id === id);
  const ansText = (q: any) => (q.type === 'mcq' ? `${q.answer}. ${q.options?.['ABCD'.indexOf(q.answer)] ?? ''}` : q.answer);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/subjects/${quiz.subject_id}/quiz`} className="text-sm text-blue-600 hover:underline">← Danh sách bộ câu hỏi</Link>
          <h2 className="text-xl font-bold">{quiz.title}</h2>
        </div>
        {reviewing && <Button variant="secondary" onClick={() => { setResult(null); setAnswers({}); }}>Làm lại</Button>}
      </div>

      {result && (
        <Card className="space-y-4 border-blue-200 bg-blue-50/40">
          <div className="flex flex-wrap items-end gap-4">
            <div className="text-4xl font-bold text-blue-700">{result.percent}%</div>
            <div className="text-sm text-slate-600">Điểm: {result.score.toFixed(2).replace(/\.?0+$/, '')}/{result.total} câu</div>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Thống kê theo chương/chủ đề</h3>
            <div className="space-y-2">
              {result.chapters.map((c) => (
                <div key={c.chapter}>
                  <div className="flex justify-between text-sm"><span>{c.chapter}</span><span className={c.percent < 70 ? 'font-medium text-red-600' : 'text-slate-500'}>{c.percent}% ({c.total} câu)</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white"><div className={`h-full ${c.percent < 70 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${c.percent}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          {result.recommendations && (<div><h3 className="mb-1 font-semibold">Nội dung cần ôn lại</h3><Markdown>{result.recommendations}</Markdown></div>)}
          {result.weak.length > 0 && (
            <Button loading={genLoading} onClick={supplement}><Sparkles className="h-4 w-4" /> Tạo bộ câu hỏi bổ sung cho phần còn yếu</Button>
          )}
        </Card>
      )}
      <ErrorBox text={error} />

      <div className="space-y-4">
        {qs.map((q, i) => {
          const p = per(q.id);
          const ok = p && p.score >= 0.999;
          return (
            <Card key={q.id} className={reviewing ? (ok ? 'border-green-300' : p && p.score > 0 ? 'border-amber-300' : 'border-red-300') : ''}>
              <div className="mb-1 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Câu {i + 1}</span><span>· {typeLabel(q.type)}</span><span>· {levelLabel(q.level)}</span><span>· {q.chapter}</span>
              </div>
              <p className="whitespace-pre-wrap font-medium">{q.question}</p>
              <div className="mt-3">
                {q.type === 'mcq' && q.options.map((o: string, k: number) => (
                  <label key={k} className={`mb-1.5 flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${answers[q.id] === 'ABCD'[k] ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                    <input type="radio" disabled={reviewing} name={q.id} checked={answers[q.id] === 'ABCD'[k]} onChange={() => set(q.id, 'ABCD'[k])} className="mt-1" />
                    <span><b>{'ABCD'[k]}.</b> {o}</span>
                  </label>
                ))}
                {q.type === 'tf' && ['Đúng', 'Sai'].map((o) => (
                  <label key={o} className={`mr-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm ${answers[q.id] === o ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                    <input type="radio" disabled={reviewing} name={q.id} checked={answers[q.id] === o} onChange={() => set(q.id, o)} /> {o}
                  </label>
                ))}
                {q.type === 'fill' && <input disabled={reviewing} className={inputCls} placeholder="Nhập đáp án" value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />}
                {['essay', 'calc', 'scenario'].includes(q.type) && <textarea disabled={reviewing} rows={5} className={inputCls} placeholder="Nhập bài làm của bạn…" value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />}
              </div>
              {reviewing && p && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                  <div className={ok ? 'font-semibold text-green-700' : p.score > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-red-700'}>
                    {ok ? '✓ Đúng' : p.score > 0 ? `◐ Đúng một phần (${Math.round(p.score * 100)}%)` : p.userAnswer ? '✗ Sai' : '— Chưa trả lời'}
                  </div>
                  {p.feedback && <div><b>Nhận xét:</b> {p.feedback}</div>}
                  {cfg.showAnswers !== false && <div><b>Đáp án:</b> <span className="whitespace-pre-wrap">{ansText(q)}</span></div>}
                  {cfg.showExplanations !== false && q.explanation && <div><b>Giải thích:</b> <span className="whitespace-pre-wrap">{q.explanation}</span></div>}
                  {q.source && <div className="text-xs text-slate-500">Nguồn: {q.source}</div>}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {!reviewing && (
        <div className="sticky bottom-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <span className="text-sm text-slate-600">Đã trả lời {answered}/{qs.length}</span>
          <Button loading={loading} onClick={submit}>Nộp bài & chấm điểm</Button>
        </div>
      )}

      {past.length > 0 && (
        <Card>
          <h3 className="mb-2 font-semibold">Lịch sử làm bài</h3>
          <div className="space-y-1">
            {past.map((a) => (
              <button key={a.id} className="flex w-full justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => { setResult(a.result); setAnswers(a.answers || {}); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <span>{fmtDateTime(a.created_at)}</span><span className="font-medium">{Math.round(Number(a.percent))}%</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
