// Embedding dùng OpenAI (Claude chưa có API embedding). Nếu không có OPENAI_API_KEY => trả về null
// và hệ thống tự động dùng tìm kiếm toàn văn (full-text) thay thế.
export async function embed(texts: string[]): Promise<number[][] | null> {
  const k = process.env.OPENAI_API_KEY;
  if (!k || !texts.length) return null;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64).map((t) => t.slice(0, 8000));
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${k}` },
      body: JSON.stringify({ model, input: batch }),
    });
    if (!res.ok) throw new Error(`Embedding lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    for (const d of data.data) out.push(d.embedding);
  }
  return out;
}
