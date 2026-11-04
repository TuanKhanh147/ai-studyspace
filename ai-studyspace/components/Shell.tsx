'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, CalendarClock, Download, GraduationCap, LayoutDashboard, LogOut, Menu, NotebookPen, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type S = { id: string; name: string; color: string; icon: string };

export default function Shell({ subjects, userName, email, children }: { subjects: S[]; userName: string; email: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = [
    { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/subjects', label: 'Môn học', icon: BookOpen },
    { href: '/exams', label: 'Lịch thi', icon: CalendarClock },
    { href: '/notes', label: 'Sổ tay', icon: NotebookPen },
  ];
  async function logout() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }
  const link = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-4 text-lg font-bold text-blue-700">
        <GraduationCap className="h-6 w-6" /> AI StudySpace
      </Link>
      <nav className="space-y-1 px-3" onClick={() => setOpen(false)}>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={link(path === n.href || (n.href !== '/dashboard' && path.startsWith(n.href) && n.href !== '/subjects'))}>
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-5 flex-1 overflow-y-auto px-3" onClick={() => setOpen(false)}>
        <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Môn học của tôi</div>
        {subjects.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Chưa có môn học</div>}
        {subjects.map((s) => (
          <Link key={s.id} href={`/subjects/${s.id}`} className={link(path.startsWith(`/subjects/${s.id}`))}>
            <span className="text-base">{s.icon}</span>
            <span className="truncate">{s.name}</span>
            <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
          </Link>
        ))}
      </div>
      <div className="border-t border-slate-200 p-3">
        <a href="/api/export" className={link(false)}>
          <Download className="h-4 w-4" /> Sao lưu dữ liệu (JSON)
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1 lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <button className="rounded p-1.5 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-medium">{userName}</div>
              <div className="text-xs text-slate-500">{email}</div>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
