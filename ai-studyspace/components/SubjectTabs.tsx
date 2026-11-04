'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SubjectTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/subjects/${id}`;
  const tabs = [
    { href: base, label: '📁 Tài liệu' },
    { href: `${base}/outline`, label: '🧾 Đề cương AI' },
    { href: `${base}/quiz`, label: '❓ Câu hỏi ôn tập' },
    { href: `${base}/solve`, label: '🧮 Giải bài tập' },
    { href: `${base}/chat`, label: '💬 Hỏi đáp' },
    { href: `${base}/assignments`, label: '✏️ Bài tập của tôi' },
    { href: `${base}/notes`, label: '📝 Ghi chú' },
  ];
  return (
    <div className="no-print -mx-4 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
      <div className="flex gap-1 whitespace-nowrap">
        {tabs.map((t) => {
          const active = t.href === base ? path === base : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={`border-b-2 px-3 py-2.5 text-sm font-medium ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
