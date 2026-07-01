'use client';

import React from 'react';
import Link from 'next/link';
import { Wrench, ArrowRight, Map, CloudRain, Globe2, Database } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ThemeSwitch } from '@/components/ui/theme-switch';
import LanguageSwitch from '@/components/features/LanguageSwitch';
import WebNavSection from '@/components/features/WebNavSection';
import { Background } from '@/components/ui/background';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <div className="relative min-h-screen text-zinc-950 dark:text-zinc-100">
      <Background />

      {/* ── 顶栏 ── */}
      <header className="sticky top-0 z-50 w-full px-4 py-3">
        <div className="bg-[#f7f6f2]/52 dark:bg-[#090a0a]/46 mx-auto flex max-w-6xl items-center justify-between rounded-lg border border-black/[0.055] px-3 py-2 shadow-[0_16px_60px_rgba(39,39,42,0.06)] backdrop-blur-xl dark:border-white/[0.075] dark:shadow-none">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950 text-white shadow-sm shadow-zinc-900/10 dark:bg-zinc-100 dark:text-zinc-950">
              <Wrench size={14} />
            </div>
            <span className="text-sm font-semibold">Visual Tech Lab</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-24 md:pt-32 lg:grid-cols-[1.12fr_0.88fr] lg:items-end">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="mb-5 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500"
            >
              Tech Lab
            </motion.p>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="max-w-2xl font-display text-5xl leading-[0.98] [text-wrap:balance] md:text-6xl lg:text-7xl"
            >
              {t('hero.title')}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-6 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400"
            >
              {t('hero.description')}
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/tools"
                className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 active:translate-y-0 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                {t('hero.ctaTools')}
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/demo"
                className="bg-white/52 hover:bg-white/82 inline-flex items-center gap-2 rounded-md border border-black/10 px-5 py-2.5 text-sm font-medium text-zinc-800 backdrop-blur transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40 active:translate-y-0 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/[0.1]"
              >
                {t('hero.ctaDemo')}
              </Link>
            </motion.div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/38 relative overflow-hidden rounded-lg border border-black/[0.06] p-4 shadow-[0_24px_80px_rgba(39,39,42,0.08)] backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.045] dark:shadow-none"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />
            <div className="grid grid-cols-3 gap-2">
              {['Map', 'Tools', 'Data'].map((label, index) => (
                <div
                  key={label}
                  className="rounded-md bg-zinc-950/[0.035] px-3 py-3 dark:bg-white/[0.055]"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                    {label}
                  </p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
                    <motion.div
                      className="h-full rounded-full bg-zinc-950 dark:bg-zinc-100"
                      initial={{ width: 0 }}
                      animate={{ width: `${68 + index * 9}%` }}
                      transition={{ duration: 0.9, delay: 0.45 + index * 0.08 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <div className="rounded-md bg-zinc-950/[0.035] p-4 dark:bg-white/[0.055]">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Visual pipeline</p>
                <div className="mt-5 flex items-end gap-1.5">
                  {[34, 52, 42, 68, 58, 78, 62, 84].map((height, index) => (
                    <motion.span
                      key={index}
                      className="block w-full rounded-sm bg-zinc-950/75 dark:bg-zinc-100/80"
                      initial={{ height: 10, opacity: 0.5 }}
                      animate={{ height, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.25 + index * 0.04 }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex min-w-24 flex-col justify-between rounded-md bg-zinc-950 p-4 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-60">
                  Lab
                </span>
                <span className="font-display text-3xl leading-none">04</span>
              </div>
            </div>
          </motion.aside>
        </section>

        {/* ── 核心入口 ── */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                Explore
              </p>
              <h2 className="mt-2 font-display text-3xl leading-none">功能入口</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* 在线工具 */}
            <Link
              href="/tools"
              className="bg-white/42 hover:bg-white/68 group relative overflow-hidden rounded-lg border border-black/[0.06] p-7 backdrop-blur-sm transition duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-teal-500/40 active:translate-y-0 dark:border-white/[0.08] dark:bg-white/[0.045] dark:hover:bg-white/[0.075]"
            >
              <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <Wrench size={18} />
              </div>
              <h3 className="text-lg font-semibold">{t('tools.title')}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t('tools.description')}
              </p>
              <div className="mt-7 flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-200">
                {t('tools.cta')}
                <ArrowRight size={13} />
              </div>
            </Link>

            {/* 预研案例 */}
            <Link
              href="/demo"
              className="bg-white/34 hover:bg-white/62 group relative overflow-hidden rounded-lg border border-black/[0.06] p-7 backdrop-blur-sm transition duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-teal-500/40 active:translate-y-0 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
            >
              <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950/[0.06] text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-300">
                <Map size={18} />
              </div>
              <h3 className="text-lg font-semibold">{t('demo.title')}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t('demo.description')}
              </p>
              <div className="mt-7 flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-200">
                {t('demo.cta')}
                <ArrowRight size={13} />
              </div>
            </Link>
          </div>
        </section>

        {/* ── 技术案例精选 ── */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="mb-10">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              Featured
            </p>
            <h2 className="mt-2 font-display text-3xl leading-none">精选案例</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: '/demo/map/radar-filter',
                icon: CloudRain,
                title: '雷达图阈值过滤',
                desc: 'MapLibre 栅格图层 + WebGL 实时过滤',
              },
              {
                href: '/demo/map/contour-compare',
                icon: Map,
                title: '色斑图对比',
                desc: '后端与前端 IDW 插值 + 等值面生成对比验证',
              },
              {
                href: '/demo/map/china-full',
                icon: Globe2,
                title: '全国边界预览',
                desc: '100000_full GeoJSON 省级边界渲染',
              },
              {
                href: '/demo/map/hubei-data',
                icon: Database,
                title: '数据可视化处理',
                desc: 'GeoJSON 导入导出与属性编辑',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:bg-white/66 group rounded-lg border border-black/[0.06] bg-white/40 p-5 backdrop-blur-sm transition duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-teal-500/35 active:translate-y-0 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              >
                <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950/[0.055] text-zinc-600 transition group-hover:bg-zinc-950 group-hover:text-white dark:bg-white/[0.08] dark:text-zinc-400 dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-950">
                  <item.icon size={17} />
                </div>
                <h4 className="text-sm font-semibold">{item.title}</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {item.desc}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              查看全部案例
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ── 网站导航 ── */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <WebNavSection />
        </section>
      </main>

      {/* ── 底栏 ── */}
      <footer className="border-t border-black/[0.06] bg-white/30 py-10 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.035]">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <Wrench size={12} />
              </div>
              <span className="text-xs font-medium text-zinc-500">Visual Tech Lab</span>
            </Link>

            <div className="flex items-center gap-6">
              <Link
                href="/tools"
                className="text-xs text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {t('tools.title')}
              </Link>
              <Link
                href="/demo"
                className="text-xs text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {t('demo.title')}
              </Link>
            </div>

            <p className="text-xs text-zinc-400">
              {t('footer', { year: new Date().getFullYear() })}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
