import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import QuizRunner from '@/components/QuizRunner';

export const dynamic = 'force-dynamic';

export default async function QuizTake({ params }: { params: { id: string; quizId: string } }) {
  const supabase = createClient();
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', params.quizId).eq('subject_id', params.id).maybeSingle();
  if (!quiz) notFound();
  const { data: attempts } = await supabase.from('quiz_attempts').select('id,created_at,percent,result,answers').eq('quiz_id', quiz.id).order('created_at', { ascending: false });
  return <QuizRunner quiz={quiz} attempts={attempts || []} />;
}
