'use client';

import Link from 'next/link';
import { Map, Database, Globe2, CloudRain, ArrowRight, Cpu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] },
  }),
};

const cases = [
  {
    href: '/demo/map/contour-compare',
    icon: Map,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    titleKey: 'contourCompare',
  },
  {
    href: '/demo/map/hubei-data',
    icon: Database,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    titleKey: 'hubeiData',
  },
  {
    href: '/demo/map/china-full',
    icon: Globe2,
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    titleKey: 'chinaFull',
  },
  {
    href: '/demo/map/radar-filter',
    icon: CloudRain,
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    titleKey: 'radarFilter',
  },
  {
    href: '/demo/map/webgl-colorramp',
    icon: Cpu,
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    titleKey: 'webglColorramp',
  },
] as const;

export default function DemoIndexPage() {
  const t = useTranslations('demoIndex');

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
              Case Studies
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
              href="/tools"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {t('tools')}
            </Link>
          </motion.div>
        </div>

        {/* ── 案例卡片 ── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {cases.map((item, i) => {
            const Icon = item.icon;
            const card = t.raw(`cards.${item.titleKey}`) as {
              title: string;
              description: string;
            };

            return (
              <motion.div
                key={item.href}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
              >
                <Link
                  href={item.href}
                  className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-7 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <div
                    className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${item.color}`}
                  >
                    <Icon size={22} />
                  </div>
                  <h2 className="text-lg font-semibold">{card.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {card.description}
                  </p>
                  <div className="mt-5 flex items-center gap-1 text-sm font-medium text-zinc-400 transition group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                    {t('openCase')}
                    <ArrowRight
                      size={15}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
