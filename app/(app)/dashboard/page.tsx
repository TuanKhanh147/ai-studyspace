import Link from 'next/link';
import { BookOpen, CheckCircle2, FileText, Plus, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, Empty } from '@/components/ui';
import QuickUpload from '@/components/QuickUpload';
import { subjectProgress } from '@/lib/progress';
import { daysUntil, fmtDateTime, hourVN } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [profile, subjectsR, docsR, assignR, attemptsR, examsR, actsR] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user!.id).maybeSingle(),
    supabase.from('subjects').select('id,name,code,color,icon').eq('archived', false).order('name'),
    supabase.from('documents').select('id', { count: 'exact', head: true }),
    supabase.from('assignments').select('id,subject_id,done'),
    supabase.from('quiz_attempts').select('subject_id,percent,created_at').order('created_at', { ascending: false }).limit(300),
    supabase.from('exams').select('id,title,kind,exam_date,subjects(name,color)').gte('exam_date', new Date().toISOString()).order('exam_date').limit(5),
    supabase.from('activities').select('id,type,message,created_at,subjects(name)').order('created_at', { ascending: false }).limit(8),
  ]);
  const subjects = subjectsR.data || [];
  const assignments = assignR.data || [];
  const attempts = attemptsR.data || [];
  const exams: any[] = examsR.data || [];
  const acts: any[] = actsR.data || [];

  const progress = subjects.map((s) => ({
    ...s,
    progress: subjectProgress(assignments.filter((a) => a.subject_id === s.id), attempts.filter((a) => a.subject_id === s.id)),
    hasData: assignments.some((a) => a.subject_id === s.id) || attempts.some((a) => a.subject_id === s.id),
  }));
  const withData = progress.filter((p) => p.hasData);
  const overall = withData.length ? Math.round(withData.reduce((s, p) => s + p.progress, 0) / withData.length) : 0;
  const doneCount = assignments.filter((a) => a.done).length;
  const h = hourVN();
  const greet = h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const name = profile.data?.full_name || user!.email!.split('@')[0];

  // Môn cần ôn tập: có kỳ thi trong 14 ngày tới hoặc tiến độ thấp
  const examSoon = new Map<string, number>();
  for (const e of exams) {
    const d = daysUntil(e.exam_date);
    if (d <= 14 && e.subjects?.name) examSoon.set(e.subjects.name, Math.min(d, examSoon.get(e.subjects.name) ?? 99));
  }
  const needReview = progress
    .map((p) => ({ ...p, exam: examSoon.get(p.name) }))
    .filter((p) => p.exam !== undefined || (p.hasData && p.progress < 60))
    .sort((a, b) => (a.exam ?? 99) - (b.exam ?? 99) || a.progress - b.progress)
    .slice(0, 4);

  const stat = [
    { label: 'Môn học', value: subjects.length, icon: BookOpen },
    { label: 'Tài liệu đã tải lên', value: docsR.count || 0, icon: FileText },
    { label: 'Bài tập hoàn thành', value: `${doneCount}/${assignments.length}`, icon: CheckCircle2 },
    { label: 'Tiến độ tổng thể', value: `${overall}%`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {greet}, {name} 👋
          </h1>
          <p className="text-sm text-slate-500">Hôm nay bạn muốn ôn tập môn nào?</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickUpload subjects={subjects} />
          <Link href="/subjects?new=1" className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Tạo môn học mới
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat.map((s) => (
          <Card key={s.label}>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm">{s.label}</span>
              <s.icon className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Tiến độ theo môn học</h2>
          {progress.length === 0 ? (
            <Empty text="Chưa có môn học. Hãy tạo môn học đầu tiên." />
          ) : (
            <div className="space-y-3">
              {progress.map((p) => (
                <Link key={p.id} href={`/subjects/${p.id}`} className="block">
                  <div className="mb-1 flex justify-between text-sm">
                    <span>
                      {p.icon} {p.name}
                    </span>
                    <span className="text-slate-500">{p.hasData ? `${p.progress}%` : 'Chưa có dữ liệu'}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: p.color }} />
                  </div>
                </Link>
              ))}
              <p className="pt-1 text-xs text-slate-400">Tiến độ = trung bình (% bài tập hoàn thành, điểm trung bình 5 lần làm bài gần nhất).</p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Lịch thi & kiểm tra sắp tới</h2>
          {exams.length === 0 ? (
            <p className="text-sm text-slate-500">
              Chưa có lịch. <Link href="/exams" className="text-blue-600 hover:underline">Thêm lịch thi</Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {exams.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.subjects?.color || '#2563eb' }} />
                  <div className="text-sm">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-slate-500">
                      {e.subjects?.name} · {fmtDateTime(e.exam_date)} · còn {Math.max(daysUntil(e.exam_date), 0)} ngày
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Môn học đang cần ôn tập</h2>
          {needReview.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có môn nào cần ưu tiên (có kỳ thi trong 14 ngày hoặc tiến độ dưới 60%).</p>
          ) : (
            <ul className="space-y-2">
              {needReview.map((p) => (
                <li key={p.id}>
                  <Link href={`/subjects/${p.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    <span>
                      {p.icon} {p.name}
                    </span>
                    <span className="text-xs text-slate-500">{p.exam !== undefined ? `Thi sau ${Math.max(p.exam, 0)} ngày` : `Tiến độ ${p.progress}%`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Hoạt động gần đây</h2>
          {acts.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có hoạt động nào.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {acts.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>
                    {a.message}
                    {a.subjects?.name && <span className="text-slate-400"> · {a.subjects.name}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
