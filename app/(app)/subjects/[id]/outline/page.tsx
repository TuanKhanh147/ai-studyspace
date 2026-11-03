import { createClient } from '@/lib/supabase/server';
import OutlineClient from '@/components/OutlineClient';

export const dynamic = 'force-dynamic';

export default async function OutlinePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('outlines').select('*').eq('subject_id', params.id).order('created_at', { ascending: false });
  return <OutlineClient subjectId={params.id} initial={(data as any) || []} />;
}
