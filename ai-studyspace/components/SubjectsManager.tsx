'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Empty, ErrorBox, Field, Modal, inputCls } from './ui';
import { SUBJECT_COLORS, SUBJECT_ICONS } from '@/lib/constants';
import { logActivity } from '@/lib/activity';

type Subject = { id: string; name: string; code: string | null; teacher: string | null; semester: string | null; color: string; icon: string; archived: boolean; documents: { count: number }[]; assignments: { count: number }[] };
const blank = { id: '', name: '', code: '', teacher: '', semester: '', color: SUBJECT_COLORS[0], icon: SUBJECT_ICONS[0] };

export default function SubjectsManager({ initial, openNew }: { initial: Subject[]; openNew?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<typeof blank | null>(openNew ? { ...blank } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = initial.filter((s) => s.archived === showArchived && (s.name + (s.code || '') + (s.teacher || '')).toLowerCase().includes(q.toLowerCase()));

  async function save() {
    if (!form || !form.name.trim()) return setError('Vui lòng nhập tên môn học.');
    setBusy(true);
    setError(null);
    // Xác nhận phiên đăng nhập trước khi ghi dữ liệu. Không dựa riêng vào
    // DEFAULT auth.uid() vì một số cấu hình client có thể gửi request chưa có session.
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) {
      setBusy(false);
      return setError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng xuất rồi đăng nhập lại.');
    }

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      code: form.code.trim() || null,
      teacher: form.teacher.trim() || null,
      semester: form.semester.trim() || null,
      color: form.color,
      icon: form.icon,
    };

    const result = form.id
      ? await supabase.from('subjects').update(payload).eq('id', form.id).eq('user_id', user.id)
      : await supabase.from('subjects').insert(payload);

    setBusy(false);
    if (result.error) {
      const message = result.error.code === '42501'
        ? 'Supabase đang chặn thao tác bởi Row Level Security (RLS). Hãy chạy file supabase/fix_subjects_rls.sql trong SQL Editor của đúng project Supabase.'
        : result.error.message;
      return setError(message);
    }
    if (!form.id) await logActivity(supabase, null, 'subject', `Tạo môn học "${payload.name}"`);
    setForm(null);
    router.refresh();
  }

  async function toggleArchive(s: Subject) {
    await supabase.from('subjects').update({ archived: !s.archived }).eq('id', s.id);
    router.refresh();
  }

  async function remove(s: Subject) {
    if (!confirm(`Xóa vĩnh viễn môn "${s.name}" cùng toàn bộ tài liệu, bài tập, câu hỏi, ghi chú? Không thể hoàn tác.\n(Nếu chỉ muốn ẩn đi, hãy dùng "Lưu trữ".)`)) return;
    const [{ data: docs }, { data: as }] = await Promise.all([
      supabase.from('documents').select('storage_path').eq('subject_id', s.id),
      supabase.from('assignments').select('attachment_path').eq('subject_id', s.id).not('attachment_path', 'is', null),
    ]);
    const paths = [...(docs || []).map((d: any) => d.storage_path), ...(as || []).map((a: any) => a.attachment_path)];
    if (paths.length) await supabase.storage.from('documents').remove(paths);
    const { error } = await supabase.from('subjects').delete().eq('id', s.id);
    if (error) alert(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Môn học</h1>
        <Button onClick={() => { setError(null); setForm({ ...blank }); }}>
          <Plus className="h-4 w-4" /> Tạo môn học
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={inputCls + ' pl-9'} placeholder="Tìm môn học, mã môn, giảng viên…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Xem môn đã lưu trữ
        </label>
      </div>

      {list.length === 0 ? (
        <Empty text={showArchived ? 'Không có môn học nào được lưu trữ.' : 'Chưa có môn học nào. Bấm "Tạo môn học" để bắt đầu.'} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <Card key={s.id} className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: s.color }} />
              <Link href={`/subjects/${s.id}`} className="block pt-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl" style={{ background: s.color + '22' }}>{s.icon}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{s.name}</div>
                    <div className="truncate text-xs text-slate-500">{[s.code, s.semester].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-600">GV: {s.teacher || '—'}</div>
                <div className="mt-2 flex gap-4 text-sm text-slate-500">
                  <span>📄 {s.documents?.[0]?.count ?? 0} tài liệu</span>
                  <span>✏️ {s.assignments?.[0]?.count ?? 0} bài tập</span>
                </div>
              </Link>
              <div className="mt-3 flex gap-1 border-t border-slate-100 pt-2">
                <Button variant="ghost" className="!px-2" onClick={() => { setError(null); setForm({ id: s.id, name: s.name, code: s.code || '', teacher: s.teacher || '', semester: s.semester || '', color: s.color, icon: s.icon }); }}>
                  <Pencil className="h-4 w-4" /> Sửa
                </Button>
                <Button variant="ghost" className="!px-2" onClick={() => toggleArchive(s)}>
                  {s.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {s.archived ? 'Khôi phục' : 'Lưu trữ'}
                </Button>
                <Button variant="ghost" className="!px-2 text-red-600" onClick={() => remove(s)}>
                  <Trash2 className="h-4 w-4" /> Xóa
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Chỉnh sửa môn học' : 'Tạo môn học mới'}>
        {form && (
          <div className="space-y-3">
            <Field label="Tên môn học *"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mã môn"><input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Học kỳ"><input className={inputCls} placeholder="VD: HK1 2025-2026" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} /></Field>
            </div>
            <Field label="Giảng viên"><input className={inputCls} value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} /></Field>
            <Field label="Màu sắc">
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`h-7 w-7 rounded-full ring-offset-2 ${form.color === c ? 'ring-2 ring-slate-700' : ''}`} style={{ background: c }} />
                ))}
              </div>
            </Field>
            <Field label="Biểu tượng">
              <div className="flex flex-wrap gap-2">
                {SUBJECT_ICONS.map((i) => (
                  <button key={i} type="button" onClick={() => setForm({ ...form, icon: i })} className={`h-9 w-9 rounded-lg border text-xl ${form.icon === i ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>{i}</button>
                ))}
              </div>
            </Field>
            <ErrorBox text={error} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Hủy</Button>
              <Button loading={busy} onClick={save}>Lưu</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
