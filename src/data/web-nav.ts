import type { LucideIcon } from 'lucide-react';
import { Globe, Layout, Wrench, Code2, Database, Palette } from 'lucide-react';

export type I18nText = {
  zh: string;
  en: string;
};

export interface WebNavLink {
  title: string;
  url: string;
  description: I18nText;
  icon?: LucideIcon;
}

export interface WebNavCategory {
  category: I18nText;
  icon: LucideIcon;
  items: WebNavLink[];
}

export const webNavData: WebNavCategory[] = [
  {
    category: { zh: '常用框架', en: 'Frameworks' },
    icon: Layout,
    items: [
      {
        title: 'Next.js',
        url: 'https://nextjs.org',
        description: { zh: '面向 Web 的 React 框架', en: 'The React Framework for the Web' },
        icon: Globe,
      },
      {
        title: 'React',
        url: 'https://react.dev',
        description: {
          zh: '用于构建 Web 与原生 UI 的库',
          en: 'The library for web and native user interfaces',
        },
        icon: Code2,
      },
      {
        title: 'Vue.js',
        url: 'https://vuejs.org',
        description: { zh: '渐进式 JavaScript 框架', en: 'The Progressive JavaScript Framework' },
        icon: Code2,
      },
    ],
  },
  {
    category: { zh: 'UI & 样式', en: 'UI & Styling' },
    icon: Palette,
    items: [
      {
        title: 'Tailwind CSS',
        url: 'https://tailwindcss.com',
        description: {
          zh: '快速构建现代化界面，提升开发效率',
          en: 'Rapidly build modern websites without ever leaving your HTML',
        },
        icon: Code2,
      },
      {
        title: 'shadcn/ui',
        url: 'https://ui.shadcn.com',
        description: {
          zh: '可复制粘贴的高质量组件集合',
          en: 'Beautifully designed components that you can copy and paste',
        },
        icon: Layout,
      },
      {
        title: 'Lucide Icons',
        url: 'https://lucide.dev',
        description: { zh: '简洁一致的图标库', en: 'Beautiful & consistent icon toolkit' },
        icon: Palette,
      },
    ],
  },
  {
    category: { zh: '开发工具', en: 'Developer Tools' },
    icon: Wrench,
    items: [
      {
        title: 'TypeScript',
        url: 'https://www.typescriptlang.org',
        description: { zh: '带类型系统的 JavaScript', en: 'JavaScript with syntax for types' },
        icon: Code2,
      },
      {
        title: 'MDN Web Docs',
        url: 'https://developer.mozilla.org',
        description: { zh: '开发者资源文档库', en: 'Resources for developers, by developers' },
        icon: Globe,
      },
      {
        title: 'Can I Use',
        url: 'https://caniuse.com',
        description: {
          zh: '现代 Web 特性的浏览器兼容性查询',
          en: 'Browser support tables for modern web technologies',
        },
        icon: Database,
      },
    ],
  },
];
