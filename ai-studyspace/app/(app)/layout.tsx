import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: subjects }, { data: profile }] = await Promise.all([
    supabase.from('subjects').select('id,name,color,icon').eq('archived', false).order('name'),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);
  return (
    <Shell subjects={subjects || []} userName={profile?.full_name || user.email!.split('@')[0]} email={user.email!}>
      {children}
    </Shell>
  );
}
