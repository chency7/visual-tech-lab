'use client';

import React, { useEffect } from 'react';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { usePathname } from 'next/navigation';
import { I18nProvider } from '@/components/providers/i18n-provider';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <React.Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading...</div>}>
        <I18nProvider>{children}</I18nProvider>
      </React.Suspense>
    </ThemeProvider>
  );
}
