import { createClient } from '@/lib/supabase/server';
import AssignmentsManager from '@/components/AssignmentsManager';

export const dynamic = 'force-dynamic';

export default async function AssignmentsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('assignments').select('*').eq('subject_id', params.id).order('created_at', { ascending: false });
  return <AssignmentsManager subjectId={params.id} initial={(data as any) || []} />;
}
