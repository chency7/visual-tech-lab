import localFont from 'next/font/local';

export const pacifico = localFont({
  src: [
    {
      path: '../../public/fonts/woff2/Pacifico.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-Pacifico',
  display: 'block',
  fallback: ['cursive', 'system-ui'],
});

export const lxgwWenKai = localFont({
  src: [
    {
      path: '../../public/fonts/woff2/LXGWWenKai-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-wenkai',
  display: 'block',
  fallback: ['system-ui', 'Microsoft YaHei', 'sans-serif'],
});

export const calSans = localFont({
  src: [
    {
      path: '../../public/fonts/woff2/CalSans-SemiBold.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-calsans',
  display: 'block',
  fallback: ['system-ui', 'sans-serif'],
});
