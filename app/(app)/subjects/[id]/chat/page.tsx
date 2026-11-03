import { createClient } from '@/lib/supabase/server';
import ChatClient from '@/components/ChatClient';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('chat_messages').select('id,role,content,sources').eq('subject_id', params.id).order('created_at').limit(200);
  return <ChatClient subjectId={params.id} initial={(data as any) || []} />;
}
