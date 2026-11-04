'use client';
import { useMemo, useRef, useState } from 'react';
import { Download, Eye, FileText, Pencil, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Empty, Modal, inputCls } from './ui';
import { ALLOWED_EXT, CATEGORIES, MAX_FILE_MB, catLabel } from '@/lib/constants';
import { fmtDate, fmtSize } from '@/lib/format';
import { logActivity } from '@/lib/activity';

type Doc = { id: string; name: string; category: string; storage_path: string; mime: string | null; size: number; status: string; error: string | null; page_count: number | null; chunk_count: number | null; created_at: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ xử lý', cls: 'bg-slate-100 text-slate-600' },
  processing: { label: 'Đang đọc…', cls: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Đã đọc', cls: 'bg-green-100 text-green-700' },
  failed: { label: 'Lỗi', cls: 'bg-red-100 text-red-700' },
  unsupported: { label: 'Không đọc được', cls: 'bg-orange-100 text-orange-700' },
};

export default function DocumentsManager({ subjectId, initialDocs }: { subjectId: string; initialDocs: Doc[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [cat, setCat] = useState('textbook');
  const [q, setQ] = useState('');
  const [uploads, setUploads] = useState<{ key: string; name: string; state: string; error?: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<{ doc: Doc; url?: string; kind: 'pdf' | 'img' | 'text'; text?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const { data } = await supabase.from('documents').select('*').eq('subject_id', subjectId).order('created_at', { ascending: false });
    setDocs((data as Doc[]) || []);
  }

  async function process(id: string) {
    const res = await fetch('/api/documents/process', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ documentId: id }) });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok && j.status === 'ready', message: j.status === 'ready' ? `Hoàn tất (${j.chunks} đoạn${j.embedded ? ', có embedding' : ''})` : j.error || 'Xử lý lỗi' };
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(true);
    const items = list.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, state: 'Đang chờ…' }));
    setUploads(items);
    const set = (key: string, state: string, error = false) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, state, error } : x)));
    let okCount = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const key = items[i].key;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) { set(key, `Định dạng .${ext} không được hỗ trợ`, true); continue; }
      if (file.size > MAX_FILE_MB * 1024 * 1024) { set(key, `Vượt quá ${MAX_FILE_MB}MB`, true); continue; }
      set(key, 'Đang tải lên…');
      const path = `${user.id}/${subjectId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || undefined });
      if (upErr) { set(key, 'Tải lên lỗi: ' + upErr.message, true); continue; }
      const { data: row, error: insErr } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          name: file.name,
          category: cat,
          storage_path: path,
          // New schema fields used by this version of the app
          mime: file.type || null,
          size: file.size,
          // Legacy columns still marked NOT NULL in the existing Supabase database
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          status: 'pending',
        })
        .select()
        .single();
      if (insErr || !row) {
        await supabase.storage.from('documents').remove([path]);
        set(key, 'Lưu thông tin lỗi: ' + (insErr?.message || ''), true);
        continue;
      }
      set(key, 'Đang đọc & lập chỉ mục…');
      await reload();
      const r = await process(row.id);
      set(key, r.message, !r.ok);
      if (r.ok) okCount++;
      await reload();
    }
    if (list.length) await logActivity(supabase, subjectId, 'upload', `Tải lên ${list.length} tài liệu (${catLabel(cat)})`);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function download(d: Doc) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60, { download: d.name });
    if (error || !data) return alert('Không tạo được liên kết tải xuống.');
    window.location.href = data.signedUrl;
  }

  async function openPreview(d: Doc) {
    const ext = d.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf' || ['png', 'jpg', 'jpeg'].includes(ext)) {
      const { data } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 3600);
      if (data) return setPreview({ doc: d, url: data.signedUrl, kind: ext === 'pdf' ? 'pdf' : 'img' });
    }
    const { data } = await supabase.from('document_chunks').select('content,location').eq('document_id', d.id).order('chunk_index').limit(60);
    const text = (data || []).map((c: any) => `【${c.location}】\n${c.content}`).join('\n\n') || 'Chưa có nội dung đã đọc cho tài liệu này.';
    setPreview({ doc: d, kind: 'text', text });
  }

  async function rename(d: Doc) {
    const name = prompt('Tên mới của tài liệu:', d.name);
    if (!name || name === d.name) return;
    await supabase.from('documents').update({ name }).eq('id', d.id);
    reload();
  }
  async function changeCat(d: Doc, c: string) {
    await supabase.from('documents').update({ category: c }).eq('id', d.id);
    reload();
  }
  async function remove(d: Doc) {
    if (!confirm(`Xóa tài liệu "${d.name}"?`)) return;
    await supabase.storage.from('documents').remove([d.storage_path]);
    await supabase.from('documents').delete().eq('id', d.id);
    reload();
  }
  async function retry(d: Doc) {
    setDocs((x) => x.map((y) => (y.id === d.id ? { ...y, status: 'processing' } : y)));
    await process(d.id);
    reload();
  }

  const shown = docs.filter((d) => d.category === cat && d.name.toLowerCase().includes(q.toLowerCase()));
  const globalHits = q ? docs.filter((d) => d.category !== cat && d.name.toLowerCase().includes(q.toLowerCase())).length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const n = docs.filter((d) => d.category === c.value).length;
          return (
            <button key={c.value} onClick={() => setCat(c.value)} className={`rounded-full border px-3.5 py-1.5 text-sm ${cat === c.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
              {c.label} <span className="opacity-70">({n})</span>
            </button>
          );
        })}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-6 text-center ${drag ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'}`}
      >
        <Upload className="mx-auto h-7 w-7 text-blue-600" />
        <p className="mt-2 text-sm text-slate-600">
          Kéo thả hoặc chọn nhiều file vào thư mục <b>{catLabel(cat)}</b>
        </p>
        <p className="text-xs text-slate-400">PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, PNG, JPG, JPEG · tối đa {MAX_FILE_MB}MB/file</p>
        <input ref={fileRef} type="file" multiple className="hidden" accept={ALLOWED_EXT.map((e) => '.' + e).join(',')} onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        <Button className="mt-3" loading={busy} onClick={() => fileRef.current?.click()}>
          Chọn tài liệu
        </Button>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          {uploads.map((u) => (
            <div key={u.key} className="flex justify-between gap-3">
              <span className="truncate">{u.name}</span>
              <span className={u.error ? 'text-red-600' : 'text-slate-500'}>{u.state}</span>
            </div>
          ))}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input className={inputCls + ' pl-9'} placeholder="Tìm tài liệu theo tên…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {globalHits > 0 && <p className="text-xs text-slate-500">Còn {globalHits} kết quả ở thư mục khác.</p>}

      {shown.length === 0 ? (
        <Empty text={`Thư mục "${catLabel(cat)}" chưa có tài liệu.`} />
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {shown.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-blue-600" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.name}</div>
                <div className="text-xs text-slate-500">
                  {(d.name.split('.').pop() || '').toUpperCase()} · {fmtSize(d.size)} · {fmtDate(d.created_at)}
                  {d.chunk_count ? ` · ${d.chunk_count} đoạn` : ''}
                </div>
                {d.error && <div className="mt-0.5 text-xs text-red-600">{d.error}</div>}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[d.status]?.cls}`}>{STATUS[d.status]?.label}</span>
              <select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={d.category} onChange={(e) => changeCat(d, e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div className="flex gap-0.5">
                <Button variant="ghost" className="!px-2" title="Xem" onClick={() => openPreview(d)}><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" className="!px-2" title="Tải xuống" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" className="!px-2" title="Đổi tên" onClick={() => rename(d)}><Pencil className="h-4 w-4" /></Button>
                {(d.status === 'failed' || d.status === 'pending') && <Button variant="ghost" className="!px-2" title="Xử lý lại" onClick={() => retry(d)}><RefreshCw className="h-4 w-4" /></Button>}
                <Button variant="ghost" className="!px-2 text-red-600" title="Xóa" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.doc.name || ''} wide>
        {preview?.kind === 'pdf' && <iframe src={preview.url} className="h-[70vh] w-full rounded border" />}
        {preview?.kind === 'img' && <img src={preview.url} alt={preview.doc.name} className="mx-auto max-h-[70vh]" />}
        {preview?.kind === 'text' && (
          <>
            <p className="mb-2 text-xs text-slate-500">Nội dung văn bản hệ thống đã trích xuất (tối đa 60 đoạn đầu):</p>
            <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{preview.text}</pre>
          </>
        )}
      </Modal>
    </div>
  );
}
