import { NextResponse } from 'next/server';
import { requireUser, handleError } from '@/lib/api';
import { processDocument } from '@/lib/documents/process';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { supabase } = await requireUser();
    const { documentId } = await req.json();
    if (!documentId) return NextResponse.json({ error: 'Thiếu documentId' }, { status: 400 });
    const result = await processDocument(supabase, documentId);
    return NextResponse.json(result);
  } catch (e) {
    return handleError(e);
  }
}
