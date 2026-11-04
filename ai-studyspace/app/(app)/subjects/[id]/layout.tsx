import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SubjectTabs from '@/components/SubjectTabs';

export default async function SubjectLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const supabase = createClient();
  const { data: s } = await supabase.from('subjects').select('*').eq('id', params.id).maybeSingle();
  if (!s) notFound();
  return (
    <div className="space-y-5">
      <div className="no-print flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: s.color + '22' }}>{s.icon}</span>
        <div>
          <h1 className="text-2xl font-bold">{s.name}</h1>
          <p className="text-sm text-slate-500">{[s.code, s.teacher && `GV: ${s.teacher}`, s.semester].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <SubjectTabs id={s.id} />
      {children}
    </div>
  );
}
