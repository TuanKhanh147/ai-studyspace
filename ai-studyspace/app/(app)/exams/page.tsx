import { createClient } from '@/lib/supabase/server';
import ExamsManager from '@/components/ExamsManager';

export const dynamic = 'force-dynamic';

export default async function ExamsPage() {
  const supabase = createClient();
  const [e, s] = await Promise.all([
    supabase.from('exams').select('*, subjects(name,color)').order('exam_date'),
    supabase.from('subjects').select('id,name,color').eq('archived', false).order('name'),
  ]);
  return <ExamsManager exams={e.data || []} subjects={s.data || []} />;
}
