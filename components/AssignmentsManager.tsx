'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Paperclip, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Empty, ErrorBox, Field, Markdown, Modal, inputCls } from './ui';
import { logActivity } from '@/lib/activity';

type A = { id: string; title: string; content: string | null; solution: string | null; tips: string | null; chapter: string | null; done: boolean; important: boolean; attachment_path: string | null; attachment_name: string | null };
const blank = { id: '', title: '', content: '', solution: '', tips: '', chapter: '', important: false };
const OK = ['png', 'jpg', 'jpeg', 'pdf', 'docx', 'txt', 'pptx', 'xlsx'];

export default function AssignmentsManager({ subjectId, initial }: { subjectId: string; initial: A[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [list, setList] = useState<A[]>(initial);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done' | 'important'>('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<typeof blank | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [view, setView] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function reload() {
    const { data } = await supabase.from('assignments').select('*').eq('subject_id', subjectId).order('created_at', { ascending: false });
    setList((data as A[]) || []);
    router.refresh();
  }

  async function save() {
    if (!form || !form.title.trim()) return setError('Vui lòng nhập tiêu đề.');
    setBusy(true);
    setError(null);
    const payload: any = { title: form.title.trim(), content: form.content || null, solution: form.solution || null, tips: form.tips || null, chapter: form.chapter || null, important: form.important };
    if (file) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!OK.includes(ext) || file.size > 20 * 1024 * 1024) { setBusy(false); return setError('File đính kèm không hợp lệ (định dạng hỗ trợ: ảnh, PDF, DOCX, TXT, PPTX, XLSX; tối đa 20MB).'); }
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user!.id}/${subjectId}/a-${crypto.randomUUID()}.${ext}`;
      const { error: e } = await supabase.storage.from('documents').upload(path, file);
      if (e) { setBusy(false); return setError(e.message); }
      const old = list.find((x) => x.id === form.id)?.attachment_path;
      if (old) await supabase.storage.from('documents').remove([old]);
      payload.attachment_path = path;
      payload.attachment_name = file.name;
    }
    const { error: e } = form.id ? await supabase.from('assignments').update(payload).eq('id', form.id) : await supabase.from('assignments').insert({ ...payload, subject_id: subjectId });
    setBusy(false);
    if (e) return setError(e.message);
    if (!form.id) await logActivity(supabase, subjectId, 'assignment', `Thêm bài tập "${payload.title}"`);
    setForm(null);
    setFile(null);
    reload();
  }

  async function toggleDone(a: A) {
    await supabase.from('assignments').update({ done: !a.done }).eq('id', a.id);
    if (!a.done) await logActivity(supabase, subjectId, 'assignment', `Hoàn thành bài tập "${a.title}"`);
    reload();
  }
  async function toggleStar(a: A) {
    await supabase.from('assignments').update({ important: !a.important }).eq('id', a.id);
    reload();
  }
  async function remove(a: A) {
    if (!confirm(`Xóa bài tập "${a.title}"?`)) return;
    if (a.attachment_path) await supabase.storage.from('documents').remove([a.attachment_path]);
    await supabase.from('assignments').delete().eq('id', a.id);
    setView(null);
    reload();
  }
  async function openAttachment(a: A) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(a.attachment_path!, 300);
    if (data) window.open(data.signedUrl, '_blank');
  }

  const shown = list.filter((a) => (filter === 'all' || (filter === 'todo' && !a.done) || (filter === 'done' && a.done) || (filter === 'important' && a.important)) && (a.title + (a.content || '') + (a.chapter || '')).toLowerCase().includes(q.toLowerCase()));
  const doneN = list.filter((a) => a.done).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">Đã hoàn thành <b>{doneN}/{list.length}</b> bài tập</div>
        <Button onClick={() => { setError(null); setFile(null); setForm({ ...blank }); }}><Plus className="h-4 w-4" /> Thêm bài tập</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {([['all', 'Tất cả'], ['todo', 'Chưa xong'], ['done', 'Đã xong'], ['important', 'Quan trọng']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`rounded-full border px-3 py-1 text-sm ${filter === v ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'}`}>{l}</button>
        ))}
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={inputCls + ' pl-9'} placeholder="Tìm bài tập / chương…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty text="Chưa có bài tập phù hợp." />
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {shown.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggleDone(a)} title="Đánh dấu hoàn thành">{a.done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-slate-300" />}</button>
              <button className="min-w-0 flex-1 text-left" onClick={() => setView(a)}>
                <div className={`truncate text-sm font-medium ${a.done ? 'text-slate-400 line-through' : ''}`}>{a.title}</div>
                <div className="text-xs text-slate-500">{a.chapter || 'Chưa gắn chương'}{a.attachment_name ? ' · 📎 ' + a.attachment_name : ''}{a.solution ? ' · có lời giải' : ''}</div>
              </button>
              <button onClick={() => toggleStar(a)} title="Quan trọng"><Star className={`h-5 w-5 ${a.important ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>
              <Button variant="ghost" className="!px-2" onClick={() => { setError(null); setFile(null); setForm({ id: a.id, title: a.title, content: a.content || '', solution: a.solution || '', tips: a.tips || '', chapter: a.chapter || '', important: a.important }); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" className="!px-2 text-red-600" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!view} onClose={() => setView(null)} title={view?.title || ''} wide>
        {view && (
          <div className="space-y-4">
            {view.chapter && <div className="text-sm text-slate-500">Chương: {view.chapter}</div>}
            {view.attachment_path && <Button variant="secondary" onClick={() => openAttachment(view)}><Paperclip className="h-4 w-4" /> Mở {view.attachment_name}</Button>}
            {view.content && <div><h4 className="mb-1 font-semibold">Đề bài</h4><Markdown>{view.content}</Markdown></div>}
            {view.solution && <div><h4 className="mb-1 font-semibold">Lời giải</h4><Markdown>{view.solution}</Markdown></div>}
            {view.tips && <div><h4 className="mb-1 font-semibold">Kinh nghiệm giải bài</h4><Markdown>{view.tips}</Markdown></div>}
          </div>
        )}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Sửa bài tập' : 'Thêm bài tập'} wide>
        {form && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tiêu đề *"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Chương"><input className={inputCls} placeholder="VD: Chương 3" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} /></Field>
            </div>
            <Field label="Đề bài"><textarea rows={4} className={inputCls} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
            <Field label="Lời giải"><textarea rows={5} className={inputCls} value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} /></Field>
            <Field label="Kinh nghiệm / lưu ý khi giải"><textarea rows={3} className={inputCls} value={form.tips} onChange={(e) => setForm({ ...form, tips: e.target.value })} /></Field>
            <div className="flex flex-wrap items-center gap-4">
              <input ref={ref} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Button variant="secondary" onClick={() => ref.current?.click()}><Paperclip className="h-4 w-4" /> Đính kèm ảnh/file đề</Button>
              {file && <span className="text-sm">{file.name}</span>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.important} onChange={(e) => setForm({ ...form, important: e.target.checked })} /> Bài quan trọng</label>
            </div>
            <ErrorBox text={error} />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setForm(null)}>Hủy</Button><Button loading={busy} onClick={save}>Lưu</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
