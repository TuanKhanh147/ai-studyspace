'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, ErrorBox, Markdown, inputCls } from './ui';

type M = { id?: string; role: 'user' | 'assistant'; content: string; sources?: { file: string; location: string; chapter?: string | null }[] | null };

export default function ChatClient({ subjectId, initial }: { subjectId: string; initial: M[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState<M[]>(initial);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  async function send() {
    const message = input.trim();
    if (!message || loading) return;
    setInput('');
    setError(null);
    setMsgs((m) => [...m, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subjectId, message }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsgs((m) => [...m, { role: 'assistant', content: j.answer, sources: j.sources }]);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }
  async function clear() {
    if (!confirm('Xóa toàn bộ lịch sử hỏi đáp của môn này?')) return;
    await supabase.from('chat_messages').delete().eq('subject_id', subjectId);
    setMsgs([]);
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Chỉ trả lời dựa trên tài liệu của môn học này</span>
        <button className="flex items-center gap-1 hover:text-red-600" onClick={clear}><Trash2 className="h-3.5 w-3.5" /> Xóa lịch sử</button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="text-center text-sm text-slate-400">Ví dụ: “Giải thích giúp tôi chương 3”, “Công thức tính … là gì?”</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
              {m.role === 'user' ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <Markdown>{m.content}</Markdown>}
              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer">Nguồn tham chiếu ({m.sources.length})</summary>
                  <ul className="mt-1 list-disc pl-5">{m.sources.map((s, k) => <li key={k}>{s.file} — {s.location}{s.chapter ? ` (${s.chapter})` : ''}</li>)}</ul>
                </details>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-slate-400">AI đang tra cứu tài liệu…</div>}
        <div ref={end} />
      </div>
      <div className="space-y-2 border-t border-slate-100 p-3">
        <ErrorBox text={error} />
        <div className="flex gap-2">
          <textarea rows={2} className={inputCls} placeholder="Đặt câu hỏi về môn học… (Enter để gửi, Shift+Enter xuống dòng)" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <Button onClick={send} disabled={loading || !input.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
