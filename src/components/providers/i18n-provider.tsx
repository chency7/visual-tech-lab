'use client';

import React, {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { NextIntlClientProvider } from 'next-intl';
import zhMessages from '@/lib/i18n/messages/zh.json';
import enMessages from '@/lib/i18n/messages/en.json';

export type Locale = 'zh' | 'en';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  isPending: boolean;
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

function resolveClientLocale(fallback: Locale): Locale {
  const cookieLocale = readCookie('NEXT_LOCALE') as Locale | null;
  const saved = typeof window !== 'undefined' ? (localStorage.getItem('locale') as Locale) : null;

  if (cookieLocale === 'en' || cookieLocale === 'zh') return cookieLocale;
  if (saved === 'en' || saved === 'zh') return saved;
  if (typeof navigator !== 'undefined') return navigator.language.startsWith('zh') ? 'zh' : 'en';
  return fallback;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const resolvedLocale = resolveClientLocale(initialLocale);
    if (resolvedLocale !== locale) {
      setLocaleState(resolvedLocale);
    }
  }, [initialLocale]);

  useEffect(() => {
    try {
      localStorage.setItem('locale', locale);
      writeCookie('NEXT_LOCALE', locale);
    } catch {}

    document.documentElement.lang = locale;
  }, [locale]);

  const messages = useMemo(() => (locale === 'zh' ? zhMessages : enMessages), [locale]);
  const setLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;

    try {
      localStorage.setItem('locale', nextLocale);
      writeCookie('NEXT_LOCALE', nextLocale);
    } catch {}

    setIsPending(true);
    startTransition(() => {
      setLocaleState(nextLocale);
    });
  };

  useEffect(() => {
    if (isPending) {
      const id = window.requestAnimationFrame(() => setIsPending(false));
      return () => window.cancelAnimationFrame(id);
    }
  }, [isPending, locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, isPending }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Shanghai">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
