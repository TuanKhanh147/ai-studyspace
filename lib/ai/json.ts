export function parseJson<T = any>(text: string): T {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    return JSON.parse(t);
  } catch {
    throw new Error('AI trả về dữ liệu không đúng định dạng JSON. Hãy thử lại.');
  }
}
