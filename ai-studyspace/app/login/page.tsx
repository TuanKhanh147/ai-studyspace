'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, ErrorBox, Field, inputCls } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message === 'Invalid login credentials' ? 'Sai email hoặc mật khẩu.' : error.message);
      else {
        router.replace('/dashboard');
        router.refresh();
      }
    } else {
      if (password.length < 8) {
        setError('Mật khẩu cần ít nhất 8 ký tự.');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else if (data.session) {
        router.replace('/dashboard');
        router.refresh();
      } else setInfo('Đăng ký thành công. Hãy mở email để xác nhận tài khoản, sau đó đăng nhập.');
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-blue-600" />
          <h1 className="mt-2 text-2xl font-bold text-blue-700">AI StudySpace</h1>
          <p className="text-sm text-slate-500">Hệ thống học tập cá nhân hóa bằng AI</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <Field label="Họ và tên">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          )}
          <Field label="Email">
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Mật khẩu">
            <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <ErrorBox text={error} />
          {info && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{info}</div>}
          <Button type="submit" loading={loading} className="w-full">
            {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </Button>
        </form>
        <button className="mt-4 w-full text-center text-sm text-blue-600 hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setInfo(null); }}>
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </div>
    </div>
  );
}
