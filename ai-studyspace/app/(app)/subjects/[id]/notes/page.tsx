import { createClient } from '@/lib/supabase/server';
import NotesManager from '@/components/NotesManager';

export const dynamic = 'force-dynamic';

export default async function SubjectNotes({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('notes').select('*').eq('subject_id', params.id).order('updated_at', { ascending: false });
  return <NotesManager initial={(data as any) || []} subjects={[]} fixedSubjectId={params.id} />;
}
