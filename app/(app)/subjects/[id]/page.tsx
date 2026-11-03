import { createClient } from '@/lib/supabase/server';
import DocumentsManager from '@/components/DocumentsManager';

export const dynamic = 'force-dynamic';

export default async function SubjectDocs({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('documents').select('*').eq('subject_id', params.id).order('created_at', { ascending: false });
  return <DocumentsManager subjectId={params.id} initialDocs={(data as any) || []} />;
}
