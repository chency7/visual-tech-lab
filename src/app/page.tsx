'use client';

import React from 'react';
import Link from 'next/link';
import { Github, Wrench, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ThemeSwitch } from '@/components/ui/theme-switch';
import LanguageSwitch from '@/components/features/LanguageSwitch';
import WebNavSection from '@/components/features/WebNavSection';
import { Background } from '@/components/ui/background';
import { FadeIn } from '@/components/ui/motion-wrapper';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <div className="relative min-h-screen text-zinc-900 dark:text-zinc-100">
      <Background />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
              <Wrench size={18} />
            </div>
            <span className="text-lg font-bold">Visual Tech Lab</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitch />
            <ThemeSwitch />
            <Link
              href="https://github.com/"
              target="_blank"
              className="text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <Github size={20} />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Hero Section */}
        <div className="mb-24 text-center">
          <FadeIn delay={0.1}>
            <h1 className="mb-6 bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent dark:from-zinc-100 dark:to-zinc-400 sm:text-6xl">
              {t('hero.title')}
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              {t('hero.description')}
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-10 flex justify-center gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-zinc-500/20 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:shadow-zinc-100/10 dark:hover:bg-zinc-200"
                >
                  {t('hero.ctaTools')}
                  <ArrowRight size={16} />
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/50 px-6 py-3 text-sm font-medium text-zinc-900 shadow-sm backdrop-blur-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {t('hero.ctaDemo')}
                </Link>
              </motion.div>
            </div>
          </FadeIn>
        </div>

        {/* Tools Section */}
        <FadeIn delay={0.4}>
          <section className="mb-8">
            <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/40 p-10 backdrop-blur-md transition-all hover:border-zinc-300 hover:bg-white/60 hover:shadow-xl hover:shadow-zinc-200/50 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60 dark:hover:shadow-black/50">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl transition-all group-hover:bg-indigo-500/20 dark:bg-indigo-500/5"></div>

              <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-2xl font-bold">{t('tools.title')}</h2>
                  <p className="mt-2 text-zinc-500 dark:text-zinc-400">{t('tools.description')}</p>
                </div>
                <Link
                  href="/tools"
                  className="shrink-0 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-zinc-700 hover:shadow-lg dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {t('tools.cta')}
                </Link>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Demo Section */}
        <FadeIn delay={0.5}>
          <section className="mb-20">
            <div className="group relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/40 p-10 backdrop-blur-md transition-all hover:border-zinc-300 hover:bg-white/60 hover:shadow-xl hover:shadow-zinc-200/50 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60 dark:hover:shadow-black/50">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl transition-all group-hover:bg-purple-500/20 dark:bg-purple-500/5"></div>

              <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-200">
                    {t('demo.title')}
                  </h2>
                  <p className="mt-2 text-zinc-500 dark:text-zinc-400">{t('demo.description')}</p>
                </div>
                <Link
                  href="/demo"
                  className="shrink-0 rounded-full border border-zinc-200 bg-white/80 px-6 py-2.5 text-sm font-medium text-zinc-900 backdrop-blur-sm transition-all hover:bg-zinc-50 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {t('demo.cta')}
                </Link>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Web Nav Section */}
        <FadeIn delay={0.6}>
          <WebNavSection />
        </FadeIn>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/50 bg-white/40 py-12 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-black/40">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>{t('footer', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}
