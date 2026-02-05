import './global.css';
import { Metadata } from 'next';
import { inter, pacifico, lxgwWenKai, calSans } from '@/utils/fonts';
import ClientLayout from '@/components/layout/ClientLayout';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh"
      className={[lxgwWenKai.variable, pacifico.variable, calSans.variable].join(' ')}
      suppressHydrationWarning
    >
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
