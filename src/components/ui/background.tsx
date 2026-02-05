'use client';

import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function Background() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* 基础背景色 */}
      <div className="absolute inset-0 bg-zinc-50 dark:bg-black" />

      {/* 点阵网格 - 使用 SVG */}
      <div
        className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] dark:opacity-[0.1]"
        style={{
          backgroundImage: `radial-gradient(${theme === 'dark' ? '#ffffff' : '#000000'} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* 动态光晕 1 - 左上 */}
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -left-[20%] -top-[20%] h-[800px] w-[800px] rounded-full bg-indigo-500/20 opacity-30 blur-[100px] dark:bg-indigo-500/10"
      />

      {/* 动态光晕 2 - 右下 */}
      <motion.div
        animate={{
          x: [0, -100, 0],
          y: [0, -50, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute -bottom-[20%] -right-[20%] h-[600px] w-[600px] rounded-full bg-purple-500/20 opacity-30 blur-[100px] dark:bg-purple-500/10"
      />
      
      {/* 动态光晕 3 - 中间游走 */}
      <motion.div
        animate={{
          x: [-50, 50, -50],
          y: [-50, 50, -50],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 5,
        }}
        className="absolute left-[50%] top-[50%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/10 opacity-20 blur-[80px] dark:bg-blue-400/5"
      />
    </div>
  );
}
