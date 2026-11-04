import { embed } from './embed';
import { CAT_ORDER, catLabel } from '@/lib/constants';
import { pack } from './pack';

export type Hit = { id: string; document_name: string; category: string; location: string; chapter: string | null; content: string };

const STOP = new Set(['và', 'là', 'của', 'các', 'một', 'những', 'có', 'trong', 'cho', 'được', 'với', 'này', 'khi', 'để', 'không', 'tôi', 'em', 'bạn', 'hãy', 'giúp', 'nào', 'gì', 'sao', 'như', 'thế', 'về', 'the', 'and', 'of', 'to', 'is', 'in', 'what', 'how']);

// Truy xuất theo MÔN HỌC (luôn lọc subject_id + RLS). Ưu tiên vector, bổ sung full-text.
export async function retrieve(supabase: any, subjectId: string, query: string, k = 12): Promise<Hit[]> {
  const seen = new Set<string>();
  const out: Hit[] = [];
  const add = (rows: any[] | null) => {
    for (const r of rows || []) {
      if (!seen.has(r.id) && out.length < k) {
        seen.add(r.id);
        out.push(r);
      }
    }
  };
  try {
    const v = await embed([query]);
    if (v) {
      const { data } = await supabase.rpc('match_chunks', { p_subject_id: subjectId, p_embedding: `[${v[0].join(',')}]`, p_count: k });
      add(data);
    }
  } catch (e) {
    console.warn('Vector search lỗi, dùng full-text:', (e as Error).message);
  }
  const tokens = Array.from(new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2 && !STOP.has(t)))).slice(0, 16);
  if (tokens.length && out.length < k) {
    const { data } = await supabase.rpc('search_chunks', { p_subject_id: subjectId, p_query: tokens.join(' | '), p_count: k });
    add(data);
  }
  return out;
}

export const hitToText = (h: Hit, i: number) =>
  `[#${i + 1}] FILE: ${h.document_name} | ${h.location}${h.chapter ? ' | ' + h.chapter : ''}\n${h.content}`;

// Tải toàn bộ nội dung đã đọc của môn học (có phân trang vì giới hạn 1000 dòng/lần)
export async function loadChunks(supabase: any, subjectId: string, chapters?: string[]) {
  const rows: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = supabase
      .from('document_chunks')
      .select('document_id,chunk_index,content,location,chapter,documents!inner(name,category)')
      .eq('subject_id', subjectId)
      .order('document_id')
      .order('chunk_index')
      .range(from, from + size - 1);
    if (chapters?.length) q = q.in('chapter', chapters);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < size) break;
  }
  rows.sort(
    (a, b) =>
      (CAT_ORDER[a.documents.category] ?? 99) - (CAT_ORDER[b.documents.category] ?? 99) ||
      a.documents.name.localeCompare(b.documents.name) ||
      a.chunk_index - b.chunk_index
  );
  return rows;
}

export const rowToSegment = (r: any) =>
  `[FILE: ${r.documents.name} (${catLabel(r.documents.category)}) | ${r.location}${r.chapter ? ' | ' + r.chapter : ''}]\n${r.content}`;

export function sampleSegments(segs: string[], maxChars: number) {
  const total = segs.reduce((s, x) => s + x.length + 2, 0);
  if (total <= maxChars) return segs;
  const ratio = maxChars / total;
  return segs.filter((_, i) => Math.floor((i + 1) * ratio) !== Math.floor(i * ratio));
}

export { pack };
