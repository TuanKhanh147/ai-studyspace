import { extractUnits, UnsupportedError } from './extract';
import { chunkUnits } from './chunk';
import { embed } from '@/lib/ai/embed';

export async function processDocument(supabase: any, documentId: string) {
  const { data: doc, error } = await supabase.from('documents').select('*').eq('id', documentId).single();
  if (error || !doc) throw new Error('Không tìm thấy tài liệu (hoặc bạn không có quyền truy cập).');

  await supabase.from('documents').update({ status: 'processing', error: null }).eq('id', doc.id);
  try {
    const { data: blob, error: dErr } = await supabase.storage.from('documents').download(doc.storage_path);
    if (dErr || !blob) throw new Error('Không tải được file từ kho lưu trữ.');
    const buf = Buffer.from(await blob.arrayBuffer());

    const { units } = await extractUnits(buf, doc.name);
    const chunks = chunkUnits(units);
    if (!chunks.length) throw new UnsupportedError('Không trích xuất được nội dung chữ từ tài liệu.');

    await supabase.from('document_chunks').delete().eq('document_id', doc.id);

    let vectors: number[][] | null = null;
    try {
      vectors = await embed(chunks.map((c) => c.content));
    } catch (e) {
      console.warn('Embedding thất bại, dùng full-text:', (e as Error).message);
    }

    const rows = chunks.map((c, i) => ({
      document_id: doc.id,
      subject_id: doc.subject_id,
      chunk_index: c.index,
      content: c.content,
      location: c.location,
      page: c.page,
      chapter: c.chapter,
      embedding: vectors?.[i] ? `[${vectors[i].join(',')}]` : null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error: iErr } = await supabase.from('document_chunks').insert(rows.slice(i, i + 50));
      if (iErr) throw new Error('Lưu dữ liệu đã đọc thất bại: ' + iErr.message);
    }

    await supabase
      .from('documents')
      .update({ status: 'ready', error: null, page_count: units.length, chunk_count: chunks.length })
      .eq('id', doc.id);
    return { status: 'ready', chunks: chunks.length, embedded: !!vectors };
  } catch (e: any) {
    const status = e instanceof UnsupportedError ? 'unsupported' : 'failed';
    await supabase.from('documents').update({ status, error: e.message?.slice(0, 500) || 'Lỗi không xác định' }).eq('id', doc.id);
    return { status, error: e.message as string, chunks: 0 };
  }
}
