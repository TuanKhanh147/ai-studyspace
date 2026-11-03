'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Empty, ErrorBox, Field, Modal, inputCls } from './ui';
import { daysUntil, fmtDateTime } from '@/lib/format';

const KINDS = [['quiz', 'Kiểm tra'], ['midterm', 'Thi giữa kỳ'], ['final', 'Thi cuối kỳ'], ['exam', 'Khác']];

export default function ExamsManager({ exams, subjects }: { exams: any[]; subjects: { id: string; name: string; color: string }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [form, setForm] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.subject_id || !form.title.trim() || !form.date) return setError('Hãy chọn môn học, nhập tiêu đề và thời gian.');
    setBusy(true);
    const { error } = await supabase.from('exams').insert({ subject_id: form.subject_id, title: form.title.trim(), kind: form.kind, exam_date: new Date(form.date).toISOString(), location: form.location || null });
    setBusy(false);
    if (error) return setError(error.message);
    setForm(null);
    router.refresh();
  }
  async function remove(id: string) {
    if (!confirm('Xóa lịch này?')) return;
    await supabase.from('exams').delete().eq('id', id);
    router.refresh();
  }
  const upcoming = exams.filter((e) => +new Date(e.exam_date) >= Date.now());
  const past = exams.filter((e) => +new Date(e.exam_date) < Date.now()).reverse();
  const row = (e: any, isPast: boolean) => (
    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: e.subjects?.color }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{e.title} <span className="text-xs font-normal text-slate-500">({KINDS.find((k) => k[0] === e.kind)?.[1]})</span></div>
        <div className="text-xs text-slate-500">{e.subjects?.name} · {fmtDateTime(e.exam_date)}{e.location ? ` · ${e.location}` : ''}</div>
      </div>
      {!isPast && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">còn {Math.max(daysUntil(e.exam_date), 0)} ngày</span>}
      <Button variant="ghost" className="!px-2 text-red-600" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lịch thi & kiểm tra</h1>
        <Button disabled={!subjects.length} onClick={() => { setError(null); setForm({ subject_id: subjects[0]?.id, title: '', kind: 'midterm', date: '', location: '' }); }}><Plus className="h-4 w-4" /> Thêm lịch</Button>
      </div>
      {!subjects.length && <p className="text-sm text-slate-500">Hãy tạo môn học trước khi thêm lịch thi.</p>}
      <h2 className="font-semibold">Sắp tới</h2>
      {upcoming.length === 0 ? <Empty text="Không có lịch sắp tới." /> : <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{upcoming.map((e) => row(e, false))}</div>}
      {past.length > 0 && (<><h2 className="font-semibold text-slate-500">Đã qua</h2><div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white opacity-70">{past.map((e) => row(e, true))}</div></>)}
      <Modal open={!!form} onClose={() => setForm(null)} title="Thêm lịch thi / kiểm tra">
        {form && (
          <div className="space-y-3">
            <Field label="Môn học"><select className={inputCls} value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Tiêu đề"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loại"><select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Thời gian"><input type="datetime-local" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <Field label="Địa điểm (tuỳ chọn)"><input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <ErrorBox text={error} />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setForm(null)}>Hủy</Button><Button loading={busy} onClick={save}>Lưu</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
