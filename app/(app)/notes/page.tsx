import { createClient } from '@/lib/supabase/server';
import NotesManager from '@/components/NotesManager';

export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  const supabase = createClient();
  const [n, s] = await Promise.all([
    supabase.from('notes').select('*').order('updated_at', { ascending: false }),
    supabase.from('subjects').select('id,name').order('name'),
  ]);
  return <NotesManager initial={(n.data as any) || []} subjects={s.data || []} />;
}
