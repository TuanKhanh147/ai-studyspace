import type { Unit } from './extract';

export type Chunk = { index: number; content: string; location: string; page: number | null; chapter: string | null };

const CHAPTER_RE = /^\s*(?:ch[uư]ơng|chapter)\s+(?:\d+|[ivxl]+)\b[^\n]{0,90}/im;

function split(text: string, size = 1200, overlap = 150): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start + size - 250, end);
      const nl = window.lastIndexOf('\n');
      const dot = window.lastIndexOf('. ');
      const cut = Math.max(nl, dot);
      if (cut > 0) end = start + size - 250 + cut + 1;
    }
    out.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out.filter(Boolean);
}

export function chunkUnits(units: Unit[]): Chunk[] {
  let chapter: string | null = null;
  const chunks: Chunk[] = [];
  for (const u of units) {
    const m = u.text.match(CHAPTER_RE);
    if (m) chapter = m[0].trim().replace(/\s+/g, ' ').slice(0, 100);
    for (const part of split(u.text)) {
      chunks.push({ index: chunks.length, content: part, location: u.label, page: u.page, chapter });
    }
  }
  return chunks;
}
