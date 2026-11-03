export function pack(segs: string[], max: number): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const s of segs) {
    if (len + s.length > max && cur.length) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(s);
    len += s.length + 2;
  }
  if (cur.length) out.push(cur);
  return out;
}
