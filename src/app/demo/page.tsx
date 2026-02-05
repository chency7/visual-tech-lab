'use client';

import Link from 'next/link';
import { Map, BarChart3, Database, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function DemoIndexPage() {
  const t = useTranslations('demoIndex');

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
            href="/tools"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t('tools')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/demo/map/dual-sync"
          className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <Map size={24} />
          </div>
          <h2 className="mb-2 text-xl font-semibold">{t('cards.dualSync.title')}</h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            {t('cards.dualSync.description')}
          </p>
          <div className="flex items-center text-sm font-medium text-green-600 dark:text-green-400">
            {t('openCase')}{' '}
            <ArrowRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        <Link
          href="/demo/map/hubei-data"
          className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Database size={24} />
          </div>
          <h2 className="mb-2 text-xl font-semibold">{t('cards.hubeiData.title')}</h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            {t('cards.hubeiData.description')}
          </p>
          <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
            {t('openCase')}{' '}
            <ArrowRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        <Link
          href="/demo/visualization/mext-chart"
          className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
            <BarChart3 size={24} />
          </div>
          <h2 className="mb-2 text-xl font-semibold">{t('cards.mextChart.title')}</h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            {t('cards.mextChart.description')}
          </p>
          <div className="flex items-center text-sm font-medium text-purple-600 dark:text-purple-400">
            {t('openCase')}{' '}
            <ArrowRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </div>
    </div>
  );
}
