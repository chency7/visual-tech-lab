'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import zhMessages from '@/lib/i18n/messages/zh.json';
import enMessages from '@/lib/i18n/messages/en.json';

export type Locale = 'zh' | 'en';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within I18nProvider');
  return ctx;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSec = 60 * 60 * 24 * 365) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}`;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('zh');

  useEffect(() => {
    const cookieLocale = readCookie('NEXT_LOCALE') as Locale | null;
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('locale') as Locale) : null;
    if (cookieLocale === 'en' || cookieLocale === 'zh') {
      setLocale(cookieLocale);
    } else if (saved === 'en' || saved === 'zh') {
      setLocale(saved);
    } else if (typeof navigator !== 'undefined') {
      const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
      setLocale(lang as Locale);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('locale', locale);
      writeCookie('NEXT_LOCALE', locale);
    } catch {}
  }, [locale]);

  const messages = useMemo(() => (locale === 'zh' ? zhMessages : enMessages), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Shanghai">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
