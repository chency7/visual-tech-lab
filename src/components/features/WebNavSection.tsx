'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { webNavData, WebNavLink } from '@/data/web-nav';
import { useLocale } from '@/components/providers/i18n-provider';
import { useTranslations } from 'next-intl';

const WebNavCard = ({
  item,
  pick,
}: {
  item: WebNavLink;
  pick: (value: { zh: string; en: string }) => string;
}) => {
  const [iconError, setIconError] = useState(false);
  const ItemIcon = item.icon;

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  };

  const domain = getDomain(item.url);
  // 使用 Google Favicon 服务 (sz=128 获取高清图)
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  return (
    <Link
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white/50 p-4 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:hover:border-indigo-700"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-indigo-900/30 dark:group-hover:text-indigo-400">
          {!iconError && domain ? (
            <Image
              src={faviconUrl}
              alt={item.title}
              width={24}
              height={24}
              className="rounded-sm opacity-90 transition-opacity group-hover:opacity-100"
              onError={() => setIconError(true)}
              unoptimized // Google favicons are already optimized
            />
          ) : (
            ItemIcon && <ItemIcon size={20} />
          )}
        </div>
        <ExternalLink
          size={14}
          className="text-zinc-300 transition-colors group-hover:text-indigo-400 dark:text-zinc-700"
        />
      </div>

      <div>
        <h4 className="font-medium text-zinc-900 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
          {item.title}
        </h4>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {pick(item.description)}
        </p>
      </div>
    </Link>
  );
};

export default function WebNavSection() {
  const { locale } = useLocale();
  const t = useTranslations('webNav');

  const pick = (value: { zh: string; en: string }) => (locale === 'zh' ? value.zh : value.en);

  return (
    <section id="web-nav" className="mb-20">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('title')}</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t('description')}</p>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
          {t('badge')}
        </span>
      </div>

      <div className="space-y-10">
        {webNavData.map((category, idx) => {
          const Icon = category.icon;
          return (
            <div key={idx}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  <Icon size={18} />
                </div>
                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                  {pick(category.category)}
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {category.items.map((item, itemIdx) => (
                  <WebNavCard key={itemIdx} item={item} pick={pick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
