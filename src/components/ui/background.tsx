'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function Background() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const fieldY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const fieldOpacity = useTransform(scrollYProgress, [0, 0.46, 1], [0.72, 0.48, 0.36]);
  const signalY = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const signalScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.08, 1.18]);
  const signalOpacity = useTransform(scrollYProgress, [0, 0.42, 1], [0.7, 0.52, 0.34]);
  const scanOpacity = useTransform(scrollYProgress, [0, 0.38, 1], [0.42, 0.26, 0.18]);
  const shadeOpacity = useTransform(scrollYProgress, [0, 0.34, 1], [0, 0.22, 0.34]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';
  const lineColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(24,24,27,0.08)';
  const dotColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(24,24,27,0.12)';

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#f7f6f2] dark:bg-[#090a0a]" />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(247,246,242,0.86)_36%,rgba(239,238,232,0.82))] dark:bg-[linear-gradient(180deg,rgba(14,15,15,0.96),rgba(9,10,10,0.92)_42%,rgba(18,18,16,0.88))]" />

      <motion.div
        className="absolute inset-[-18%]"
        style={shouldReduceMotion ? undefined : { y: fieldY, opacity: fieldOpacity }}
      >
        <div
          className="home-bg-field absolute inset-0 opacity-70 dark:opacity-80"
          style={{
            backgroundImage: `
              linear-gradient(${lineColor} 1px, transparent 1px),
              linear-gradient(90deg, ${lineColor} 1px, transparent 1px),
              radial-gradient(${dotColor} 0.8px, transparent 0.8px)
            `,
            backgroundSize: '84px 84px, 84px 84px, 18px 18px',
            backgroundPosition: '0 0, 0 0, 9px 9px',
          }}
        />
      </motion.div>

      <motion.div
        className="absolute inset-x-[-12%] top-[-22%] h-[62vh] min-h-[420px]"
        style={
          shouldReduceMotion
            ? undefined
            : { y: signalY, scale: signalScale, opacity: signalOpacity }
        }
      >
        <div
          className="home-bg-signal absolute inset-0 opacity-70 blur-3xl dark:opacity-55"
          style={{
            background:
              'conic-gradient(from 205deg at 52% 54%, transparent 0deg, rgba(20,184,166,0.16) 58deg, rgba(245,158,11,0.12) 104deg, transparent 154deg, transparent 360deg)',
          }}
        />
      </motion.div>

      <motion.div
        className="home-bg-scroll-shade absolute inset-0"
        style={shouldReduceMotion ? undefined : { opacity: shadeOpacity }}
      />
      <motion.div
        className="home-bg-scan absolute inset-0 opacity-[0.42] dark:opacity-[0.32]"
        style={shouldReduceMotion ? undefined : { opacity: scanOpacity }}
      />
      <div className="home-bg-vignette absolute inset-0" />
      <div className="home-bg-noise absolute inset-0 opacity-[0.055] dark:opacity-[0.075]" />
    </div>
  );
}
