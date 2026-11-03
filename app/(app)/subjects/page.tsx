import { createClient } from '@/lib/supabase/server';
import SubjectsManager from '@/components/SubjectsManager';

export const dynamic = 'force-dynamic';

export default async function SubjectsPage({ searchParams }: { searchParams: { new?: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('subjects').select('*, documents(count), assignments(count)').order('created_at', { ascending: false });
  return <SubjectsManager initial={(data as any) || []} openNew={searchParams.new === '1'} />;
}
