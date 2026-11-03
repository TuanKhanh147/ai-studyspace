'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Empty, ErrorBox, Field, Markdown, Modal, inputCls } from './ui';
import { fmtDateTime } from '@/lib/format';

type N = { id: string; title: string; content: string | null; subject_id: string | null; updated_at: string };

export default function NotesManager({ initial, subjects, fixedSubjectId }: { initial: N[]; subjects: { id: string; name: string }[]; fixedSubjectId?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [subj, setSubj] = useState('');
  const [form, setForm] = useState<{ id: string; title: string; content: string; subject_id: string } | null>(null);
  const [view, setView] = useState<N | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string | null) => subjects.find((s) => s.id === id)?.name;

  async function save() {
    if (!form || !form.title.trim()) return setError('Vui lòng nhập tiêu đề.');
    setBusy(true);
    const payload = { title: form.title.trim(), content: form.content, subject_id: fixedSubjectId || form.subject_id || null, updated_at: new Date().toISOString() };
    const { error } = form.id ? await supabase.from('notes').update(payload).eq('id', form.id) : await supabase.from('notes').insert(payload);
    setBusy(false);
    if (error) return setError(error.message);
    setForm(null);
    router.refresh();
  }
  async function remove(n: N) {
    if (!confirm(`Xóa ghi chú "${n.title}"?`)) return;
    await supabase.from('notes').delete().eq('id', n.id);
    router.refresh();
  }

  const shown = initial.filter((n) => (!subj || n.subject_id === (subj === 'none' ? null : subj)) && (n.title + (n.content || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!fixedSubjectId ? <h1 className="text-2xl font-bold">Sổ tay cá nhân</h1> : <span />}
        <Button onClick={() => { setError(null); setForm({ id: '', title: '', content: '', subject_id: fixedSubjectId || '' }); }}><Plus className="h-4 w-4" /> Ghi chú mới</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className={inputCls + ' pl-9'} placeholder="Tìm ghi chú…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {!fixedSubjectId && (
          <select className={inputCls + ' max-w-[220px]'} value={subj} onChange={(e) => setSubj(e.target.value)}>
            <option value="">Tất cả môn</option><option value="none">Không gắn môn</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      {shown.length === 0 ? <Empty text="Chưa có ghi chú nào." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((n) => (
            <div key={n.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <button className="flex-1 text-left" onClick={() => setView(n)}>
                <div className="font-semibold">{n.title}</div>
                <div className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-slate-600">{n.content}</div>
              </button>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{nameOf(n.subject_id) || 'Chung'} · {fmtDateTime(n.updated_at)}</span>
                <span className="flex">
                  <Button variant="ghost" className="!px-2" onClick={() => { setError(null); setForm({ id: n.id, title: n.title, content: n.content || '', subject_id: n.subject_id || '' }); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" className="!px-2 text-red-600" onClick={() => remove(n)}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.title || ''} wide>{view && <Markdown>{view.content || ''}</Markdown>}</Modal>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Sửa ghi chú' : 'Ghi chú mới'} wide>
        {form && (
          <div className="space-y-3">
            <Field label="Tiêu đề *"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            {!fixedSubjectId && (
              <Field label="Môn học (tuỳ chọn)">
                <select className={inputCls} value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                  <option value="">— Không gắn môn —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Nội dung (hỗ trợ Markdown)"><textarea rows={10} className={inputCls} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
            <ErrorBox text={error} />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setForm(null)}>Hủy</Button><Button loading={busy} onClick={save}>Lưu</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
