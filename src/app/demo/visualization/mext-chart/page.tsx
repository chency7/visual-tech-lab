'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useD3 } from '@/utils/web';
import { createMEXTChart, generateMockMEXTFromSmart } from './chart';
import smartMock from './chart/smartChart/mock.json';

export default function HomePage() {
  // 使用 smartChart 的 mock.json 真实数据
  const mextData = useMemo(() => generateMockMEXTFromSmart(smartMock as any), []);

  // 新的颜色阈值规范（来自用户提供 JSON）
  const colorThresholdSpec:any = {
    variableName: '光合有效辐射通量 (Flux)',
    unit: 'umol/m²/s',
    range: [0, 0.9],
    intervals: [
      { min: 0.0, max: 0.05, level: 'L0', colorHex: '#1F4E9A' },
      { min: 0.05, max: 0.1, level: 'L1', colorHex: '#2666A6' },
      { min: 0.1, max: 0.15, level: 'L2', colorHex: '#2D7EB2' },
      { min: 0.15, max: 0.2, level: 'L3', colorHex: '#3496BE' },
      { min: 0.2, max: 0.25, level: 'L4', colorHex: '#3BAECA' },
      { min: 0.25, max: 0.3, level: 'L5', colorHex: '#42C6D6' },
      { min: 0.3, max: 0.35, level: 'L6', colorHex: '#49DEE2' },
      { min: 0.35, max: 0.4, level: 'L7', colorHex: '#50F6EE' },
      { min: 0.4, max: 0.45, level: 'L8', colorHex: '#6AF4D2' },
      { min: 0.45, max: 0.5, level: 'L9', colorHex: '#84F2B6' },
      { min: 0.5, max: 0.55, level: 'L10', colorHex: '#9EF09A' },
      { min: 0.55, max: 0.6, level: 'L11', colorHex: '#B8EE7E' },
      { min: 0.6, max: 0.65, level: 'L12', colorHex: '#D2EC62' },
      { min: 0.65, max: 0.7, level: 'L13', colorHex: '#ECEA46' },
      { min: 0.7, max: 0.75, level: 'L14', colorHex: '#F2D430' },
      { min: 0.75, max: 0.8, level: 'L15', colorHex: '#F8BE1A' },
      { min: 0.8, max: 0.85, level: 'L16', colorHex: '#FE8E04' },
      { min: 0.85, max: 0.9, level: 'L17', colorHex: '#FF6E00' },
      { min: 0.9, max: 0.95, level: 'L18', colorHex: '#FF4E00' },
      { min: 0.95, max: 1.0, level: 'L19', colorHex: '#FF2E00' },
    ],
  } as const;

  const mextDraw = useMemo(
    () =>
      createMEXTChart(mextData, {
        title: '消光系数 (MBC532)',
        // 直接使用阈值规范，覆盖值域与图例
        colorThresholdSpec,
        // 渲染模式：热图 + 等值线
        renderMode: 'both',
        contourSmooth: true,
        contourStroke: true,
        contourOpacity: 0.6,
        // 图例与布局
        legendHeight: 28,
        sidebarWidth: 120,
        margin: { top: 24, right: 16, bottom: 32, left: 48 },
      }),
    [mextData]
  );
  const { ref: mextRef } = useD3(mextDraw, [mextDraw], { autoresize: true });

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">返回首页</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 ">
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h2 className="mb-3 text-xl font-semibold">消光系数热图 + 垂直剖面（D3）</h2>
              <div ref={mextRef} className="mt-2 h-[420px] w-full" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
