'use client';

import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';

export default function ToolsIndexPage() {
  const t = useTranslations('toolsIndex');

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        {/* ── 页头 ── */}
        <div className="mb-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-zinc-400">
              Tools
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('description')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-3"
          >
            <Link
              href="/"
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              {t('backHome')}
            </Link>
            <Link
              href="/demo"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {t('demo')}
            </Link>
          </motion.div>
        </div>

        {/* ── 建设中占位 ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-20 text-center dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <Wrench size={26} className="text-zinc-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            {t('building.title')}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t('building.description')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}