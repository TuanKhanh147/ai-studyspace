import { createClient } from '@/lib/supabase/server';
import QuizHub from '@/components/QuizHub';

export const dynamic = 'force-dynamic';

export default async function QuizPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [q, a] = await Promise.all([
    supabase.from('quizzes').select('id,title,config,created_at').eq('subject_id', params.id).order('created_at', { ascending: false }),
    supabase.from('quiz_attempts').select('quiz_id,percent').eq('subject_id', params.id),
  ]);
  return <QuizHub subjectId={params.id} quizzes={q.data || []} attempts={(a.data as any) || []} />;
}
