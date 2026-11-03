'use client';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';

export default function QuickUpload({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <div className="relative">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Upload className="h-4 w-4" />
        <select
          className="cursor-pointer bg-transparent outline-none"
          defaultValue=""
          onChange={(e) => e.target.value && router.push(`/subjects/${e.target.value}`)}
        >
          <option value="" disabled>
            Tải tài liệu nhanh…
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
