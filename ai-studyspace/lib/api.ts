import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, 'Chưa đăng nhập');
  return { supabase, user };
}

export function handleError(e: any) {
  const status = e instanceof HttpError ? e.status : 500;
  console.error('[API]', e);
  return NextResponse.json({ error: e?.message || 'Lỗi máy chủ' }, { status });
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        res[i] = await fn(items[i], i);
      }
    })
  );
  return res;
}
