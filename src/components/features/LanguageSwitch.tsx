'use client';

import React from 'react';
import { useLocale } from '@/components/providers/i18n-provider';

export default function LanguageSwitch() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLocale('zh')}
        className={`rounded px-2 py-1 text-sm ${locale === 'zh' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}
      >
        中文
      </button>
      <button
        onClick={() => setLocale('en')}
        className={`rounded px-2 py-1 text-sm ${locale === 'en' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}
      >
        English
      </button>
    </div>
  );
}
