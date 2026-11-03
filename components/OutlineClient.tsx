'use client';
import { useMemo, useState } from 'react';
import { Download, Printer, Sparkles, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Empty, ErrorBox, Markdown, inputCls } from './ui';
import { fmtDateTime } from '@/lib/format';

type Outline = { id: string; title: string; content: string; created_at: string };

export default function OutlineClient({ subjectId, initial }: { subjectId: string; initial: Outline[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<Outline[]>(initial);
  const [sel, setSel] = useState<Outline | null>(initial[0] || null);
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/outline', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subjectId, focus }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Không tạo được đề cương');
      setList((l) => [j.outline, ...l]);
      setSel(j.outline);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }
  async function remove(o: Outline) {
    if (!confirm('Xóa đề cương này?')) return;
    await supabase.from('outlines').delete().eq('id', o.id);
    const next = list.filter((x) => x.id !== o.id);
    setList(next);
    if (sel?.id === o.id) setSel(next[0] || null);
  }
  function download(o: Outline) {
    const blob = new Blob([o.content], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${o.title}.md`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <Card className="no-print space-y-3">
        <div>
          <h2 className="font-semibold">Tạo đề cương ôn tập từ tài liệu của môn học</h2>
          <p className="text-sm text-slate-500">AI chỉ dựa trên tài liệu đã tải lên trong môn này, kèm nguồn (file, trang/slide). Nội dung ngoài tài liệu sẽ được gắn nhãn riêng.</p>
        </div>
        <input className={inputCls} placeholder="Phạm vi (tuỳ chọn), ví dụ: Chương 1–3. Để trống = toàn bộ môn học" value={focus} onChange={(e) => setFocus(e.target.value)} />
        <ErrorBox text={error} />
        <div className="flex items-center gap-3">
          <Button loading={loading} onClick={generate}><Sparkles className="h-4 w-4" /> Tạo đề cương</Button>
          {loading && <span className="text-sm text-slate-500">AI đang đọc và tổng hợp, có thể mất 1–5 phút với tài liệu lớn…</span>}
        </div>
      </Card>

      {list.length === 0 ? (
        <Empty text="Chưa có đề cương nào được tạo." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="no-print space-y-2">
            {list.map((o) => (
              <button key={o.id} onClick={() => setSel(o)} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${sel?.id === o.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="truncate font-medium">{o.title}</div>
                <div className="text-xs text-slate-500">{fmtDateTime(o.created_at)}</div>
              </button>
            ))}
          </div>
          {sel && (
            <Card>
              <div className="no-print mb-3 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => download(sel)}><Download className="h-4 w-4" /> Tải .md</Button>
                <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> In / Lưu PDF</Button>
                <Button variant="ghost" className="text-red-600" onClick={() => remove(sel)}><Trash2 className="h-4 w-4" /> Xóa</Button>
              </div>
              <Markdown>{sel.content}</Markdown>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
