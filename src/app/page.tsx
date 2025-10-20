'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Github } from 'lucide-react';
import { ThemeSwitch } from '@/components/ui/theme-switch';
import LanguageSwitch from '@/components/features/LanguageSwitch';

export default function HomePage() {
  const t = useTranslations('home');
  const [health, setHealth] = useState<string>('');

  const checkHealth = async () => {
    const res = await fetch('/api/health');
    const data = await res.json();
    setHealth(JSON.stringify(data));
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <ThemeSwitch />
          <Link
            href="https://github.com/"
            className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Github size={18} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6">
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{t('description')}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/api/health"
            className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div className="text-sm font-medium">{t('health')}</div>
            <div className="text-xs text-zinc-500">GET /api/health</div>
          </Link>
          <Link
            href="/api/echo"
            className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div className="text-sm font-medium">{t('echo')}</div>
            <div className="text-xs text-zinc-500">POST /api/echo</div>
          </Link>
          <Link
            href="/api/users"
            className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div className="text-sm font-medium">{t('users')}</div>
            <div className="text-xs text-zinc-500">GET/POST /api/users</div>
          </Link>
        </div>

        <div className="mt-8">
          <button
            onClick={checkHealth}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t('apiExamples')}
          </button>
          {health && (
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {health}
            </pre>
          )}
        </div>
      </main>
    </div>
  );
}
