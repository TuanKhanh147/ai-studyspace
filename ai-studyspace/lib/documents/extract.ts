import { aiVision } from '@/lib/ai/provider';

export type Unit = { label: string; page: number | null; text: string };

export class UnsupportedError extends Error {}

const clean = (s: string) => s.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function groupText(text: string, size = 3000, prefix = 'Phần'): Unit[] {
  const paras = clean(text).split(/\n\s*\n/);
  const units: Unit[] = [];
  let cur = '';
  for (const p of paras) {
    if (cur.length + p.length > size && cur) {
      units.push({ label: `${prefix} ${units.length + 1}`, page: null, text: cur });
      cur = '';
    }
    cur += (cur ? '\n\n' : '') + p;
  }
  if (cur.trim()) units.push({ label: `${prefix} ${units.length + 1}`, page: null, text: cur });
  return units;
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function imageMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : 'image/jpeg';
}

export async function extractUnits(buf: Buffer, name: string): Promise<{ units: Unit[] }> {
  const ext = (name.split('.').pop() || '').toLowerCase();

  if (ext === 'pdf') {
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = (text as unknown as string[]).map((t, i) => ({ label: `Trang ${i + 1}`, page: i + 1, text: clean(t) }));
    const units = pages.filter((p) => p.text.length > 0);
    const total = units.reduce((s, u) => s + u.text.length, 0);
    if (!units.length || total < pages.length * 8) {
      throw new UnsupportedError(
        'PDF này có vẻ là bản scan (ảnh) nên không có lớp chữ để đọc. Hãy dùng bản PDF có thể chọn/copy chữ, hoặc chụp từng trang thành ảnh JPG/PNG để hệ thống OCR.'
      );
    }
    return { units };
  }

  if (ext === 'docx') {
    const mammoth: any = await import('mammoth');
    const r = await (mammoth.extractRawText || mammoth.default.extractRawText)({ buffer: buf });
    return { units: groupText(r.value || '') };
  }

  if (ext === 'pptx') {
    const JSZip: any = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files)
      .map((f) => ({ f, m: f.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
      .filter((x) => x.m)
      .sort((a, b) => Number(a.m![1]) - Number(b.m![1]));
    const units: Unit[] = [];
    for (const s of slides) {
      const xml: string = await zip.files[s.f].async('string');
      const text = xml
        .split('</a:p>')
        .map((p) => Array.from(p.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => decodeXml(m[1])).join(''))
        .filter((l) => l.trim())
        .join('\n');
      const n = Number(s.m![1]);
      // ghi chú diễn giả (nếu có)
      const notes = zip.files[`ppt/notesSlides/notesSlide${n}.xml`];
      let noteText = '';
      if (notes) {
        const nx: string = await notes.async('string');
        noteText = Array.from(nx.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => decodeXml(m[1])).join(' ').trim();
      }
      const full = clean(text + (noteText ? `\n[Ghi chú slide] ${noteText}` : ''));
      if (full) units.push({ label: `Slide ${n}`, page: n, text: full });
    }
    return { units };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX: any = await import('xlsx');
    const wb = (XLSX.read || XLSX.default.read)(buf, { type: 'buffer' });
    const utils = XLSX.utils || XLSX.default.utils;
    const units: Unit[] = [];
    for (const sn of wb.SheetNames) {
      const csv = utils.sheet_to_csv(wb.Sheets[sn]);
      if (csv.trim()) units.push({ label: `Sheet "${sn}"`, page: null, text: clean(csv) });
    }
    return { units };
  }

  if (ext === 'txt') {
    return { units: groupText(buf.toString('utf8')) };
  }

  if (['png', 'jpg', 'jpeg'].includes(ext)) {
    const text = await aiVision(
      buf.toString('base64'),
      imageMime(name),
      'Chép lại CHÍNH XÁC toàn bộ chữ, công thức, bảng biểu trong ảnh này (dạng văn bản, giữ nguyên ngôn ngữ gốc). Không thêm nhận xét hay giải thích. Nếu không có chữ, trả lời đúng một dòng: (ảnh không có chữ).',
      4000
    );
    if (!text.trim() || /không có chữ/i.test(text.slice(0, 60))) {
      throw new UnsupportedError('Không đọc được chữ trong ảnh này.');
    }
    return { units: [{ label: 'Ảnh', page: null, text: clean(text) }] };
  }

  if (ext === 'doc' || ext === 'ppt') {
    throw new UnsupportedError(
      `Định dạng .${ext} (Office đời cũ) được lưu trữ nhưng chưa thể đọc nội dung. Hãy mở bằng Word/PowerPoint rồi "Lưu thành" .${ext}x và tải lại.`
    );
  }
  throw new UnsupportedError(`Định dạng .${ext} không được hỗ trợ.`);
}
