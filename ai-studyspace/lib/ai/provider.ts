// Lớp trừu tượng nhà cung cấp AI. Đổi nhà cung cấp bằng biến môi trường AI_PROVIDER (anthropic | openai).
export type Msg = { role: 'user' | 'assistant'; content: string };

const provider = () => (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
const model = () => process.env.AI_MODEL || (provider() === 'openai' ? 'gpt-4.1' : 'claude-sonnet-5-5');

function key() {
  const k = provider() === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (!k) {
    throw new Error(
      `Chưa cấu hình ${provider() === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} trên máy chủ (file .env.local hoặc biến môi trường Vercel).`
    );
  }
  return k;
}

async function postJson(url: string, headers: Record<string, string>, body: any, tries = 3) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const t = await res.text();
    lastErr = new Error(`AI API lỗi ${res.status}: ${t.slice(0, 300)}`);
    if (![429, 500, 502, 503, 529].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw lastErr;
}

export async function aiTextEx(opts: {
  system?: string;
  messages: Msg[];
  maxTokens?: number;
  json?: boolean;
}): Promise<{ text: string; truncated: boolean }> {
  const maxTokens = opts.maxTokens ?? 4096;
  if (provider() === 'openai') {
    const data = await postJson(
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${key()}` },
      {
        model: model(),
        max_completion_tokens: maxTokens,
        messages: [...(opts.system ? [{ role: 'system', content: opts.system }] : []), ...opts.messages],
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }
    );
    const c = data.choices?.[0];
    return { text: c?.message?.content || '', truncated: c?.finish_reason === 'length' };
  }
  const data = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key(), 'anthropic-version': '2023-06-01' },
    { model: model(), max_tokens: maxTokens, system: opts.system, messages: opts.messages }
  );
  const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  return { text, truncated: data.stop_reason === 'max_tokens' };
}

export async function aiText(opts: Parameters<typeof aiTextEx>[0]): Promise<string> {
  return (await aiTextEx(opts)).text;
}

export async function aiVision(base64: string, mime: string, prompt: string, maxTokens = 4000): Promise<string> {
  if (provider() === 'openai') {
    const data = await postJson(
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${key()}` },
      {
        model: model(),
        max_completion_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }
    );
    return data.choices?.[0]?.message?.content || '';
  }
  const data = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key(), 'anthropic-version': '2023-06-01' },
    {
      model: model(),
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }
  );
  return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
}
