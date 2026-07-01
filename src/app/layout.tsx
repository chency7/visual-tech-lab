import './global.css';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { pacifico, lxgwWenKai, calSans } from '@/utils/fonts';
import ClientLayout from '@/components/layout/ClientLayout';
import type { Locale } from '@/components/providers/i18n-provider';

export const metadata: Metadata = {
  title: {
    default: 'Visual Tech Lab',
    template: '%s | Visual Tech Lab',
  },
  description:
    'Personal tech lab and online tools collection. Featuring experimental case studies and practical developer tools.',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    shortcut: '/favicon.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const initialLocale: Locale = cookieLocale === 'en' ? 'en' : 'zh';

  return (
    <html
      lang={initialLocale}
      className={[lxgwWenKai.variable, pacifico.variable, calSans.variable].join(' ')}
      suppressHydrationWarning
    >
      <body>
        <ClientLayout initialLocale={initialLocale}>{children}</ClientLayout>
      </body>
    </html>
  );
}
