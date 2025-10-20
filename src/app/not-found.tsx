import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="text-lg">页面未找到 (404)</div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        <Home size={18} /> 返回首页
      </Link>
    </div>
  );
}
