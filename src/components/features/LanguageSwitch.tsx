'use client';

import React from 'react';
import { useLocale } from '@/components/providers/i18n-provider';

const options = [
  { value: 'zh', label: '中文', short: 'ZH' },
  { value: 'en', label: 'EN', short: 'EN' },
] as const;

export default function LanguageSwitch() {
  const { locale, setLocale, isPending } = useLocale();

  return (
    <div
      className="bg-white/58 relative flex items-center rounded-md border border-black/[0.05] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none"
      role="tablist"
      aria-label="Language switch"
      data-pending={isPending ? 'true' : 'false'}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-y-0.5 w-[calc(50%_-_3px)] rounded-[8px] bg-zinc-950 transition-transform duration-200 ease-out dark:bg-zinc-100 ${
          locale === 'en' ? 'translate-x-[calc(100%+2px)]' : 'translate-x-0'
        }`}
      />
      {options.map((option) => {
        const active = locale === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={option.label}
            disabled={isPending}
            onClick={() => setLocale(option.value)}
            className={`relative z-10 flex min-w-[44px] items-center justify-center rounded-[8px] px-2 py-1 text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/35 disabled:cursor-default ${
              active
                ? 'text-white dark:text-zinc-950'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            <span className="sm:hidden">{option.short}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
