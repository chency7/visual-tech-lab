'use client';

import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ToolsIndexPage() {
  const t = useTranslations('toolsIndex');

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {t('backHome')}
          </Link>
          <Link
            href="/demo"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t('demo')}
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
        <Wrench size={48} className="mx-auto mb-4 text-zinc-400" />
        <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">{t('building.title')}</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('building.description')}
        </p>
      </div>
    </div>
  );
}
