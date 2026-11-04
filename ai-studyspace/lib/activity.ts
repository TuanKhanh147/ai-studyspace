export async function logActivity(supabase: any, subjectId: string | null, type: string, message: string) {
  try {
    await supabase.from('activities').insert({ subject_id: subjectId, type, message });
  } catch {
    /* không chặn luồng chính */
  }
}
