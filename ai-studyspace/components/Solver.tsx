'use client';
import { useMemo, useRef, useState } from 'react';
import { Camera, Save, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, ErrorBox, Markdown, inputCls } from './ui';
import { logActivity } from '@/lib/activity';

export default function Solver({ subjectId }: { subjectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ problem: string; answer: string; sources: { file: string; location: string }[] } | null>(null);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function solve() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const fd = new FormData();
      fd.set('subjectId', subjectId);
      fd.set('text', text);
      if (file) fd.set('file', file);
      const r = await fetch('/api/ai/solve', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRes(j);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }
  async function save() {
    if (!res) return;
    const title = res.problem.split('\n')[0].slice(0, 80) || 'Bài tập (AI giải)';
    const { error } = await supabase.from('assignments').insert({ subject_id: subjectId, title, content: res.problem, solution: res.answer });
    if (error) return setError(error.message);
    await logActivity(supabase, subjectId, 'assignment', `Lưu lời giải AI: ${title}`);
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-semibold">Giải bài tập theo cách giảng dạy của môn học</h2>
        <textarea rows={5} className={inputCls} placeholder="Nhập đề bài… (hoặc tải file / chụp ảnh đề bên dưới)" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <input ref={ref} type="file" className="hidden" accept="image/*,.pdf,.docx,.txt,.xlsx,.pptx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button variant="secondary" onClick={() => ref.current?.click()}><Camera className="h-4 w-4" /> Ảnh / file đề bài</Button>
          {file && <span className="text-sm text-slate-600">{file.name} <button className="ml-1 text-red-600" onClick={() => { setFile(null); if (ref.current) ref.current.value = ''; }}>✕</button></span>}
          <span className="text-xs text-slate-400">Tối đa 4MB</span>
        </div>
        <ErrorBox text={error} />
        <Button loading={loading} onClick={solve}><Sparkles className="h-4 w-4" /> Giải bài</Button>
      </Card>
      {res && (
        <Card>
          <Markdown>{res.answer}</Markdown>
          {res.sources.length > 0 && (
            <details className="mt-3 text-xs text-slate-500">
              <summary className="cursor-pointer">Tài liệu đã tham chiếu ({res.sources.length})</summary>
              <ul className="mt-1 list-disc pl-5">{res.sources.map((s, i) => <li key={i}>{s.file} — {s.location}</li>)}</ul>
            </details>
          )}
          <div className="mt-4"><Button variant="secondary" disabled={saved} onClick={save}><Save className="h-4 w-4" /> {saved ? 'Đã lưu vào Bài tập' : 'Lưu vào Bài tập của tôi'}</Button></div>
        </Card>
      )}
    </div>
  );
}
