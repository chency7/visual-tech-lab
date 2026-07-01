'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Trash2, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import type { ThresholdRange } from './radarFilter';

interface RadarFilterPanelProps {
  thresholds: ThresholdRange[];
  selectedIndexes: number[];
  onSelectionChange: (selectedIndexes: number[]) => void;
  radarVisible: boolean;
  onRadarVisibleChange: (visible: boolean) => void;
}

export function RadarFilterPanel({
  thresholds,
  selectedIndexes,
  onSelectionChange,
  radarVisible,
  onRadarVisibleChange,
}: RadarFilterPanelProps) {
  const count = thresholds.length;
  const selectedSet = useMemo(() => new Set(selectedIndexes), [selectedIndexes]);

  const applySelection = useCallback(
    (nextIndexes: number[]) => {
      const normalized = Array.from(
        new Set(nextIndexes.filter((index) => index >= 0 && index < count))
      ).sort((a, b) => a - b);

      onSelectionChange(normalized);
    },
    [count, onSelectionChange]
  );

  const toggleBand = useCallback(
    (index: number) => {
      const next = selectedSet.has(index)
        ? selectedIndexes.filter((selectedIndex) => selectedIndex !== index)
        : [...selectedIndexes, index];

      applySelection(next);
    },
    [applySelection, selectedIndexes, selectedSet]
  );

  const selectedLabels = useMemo(() => {
    if (count <= 0 || selectedIndexes.length <= 0) return '未选择';
    if (selectedIndexes.length === count) return '全部色域';

    return selectedIndexes.map((index) => thresholds[index]?.label).filter(Boolean).join('、');
  }, [count, selectedIndexes, thresholds]);

  const allSelected = selectedIndexes.length === count;
  const noneSelected = selectedIndexes.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800">雷达图阈值过滤</h2>
          <p className="text-[11px] text-zinc-400">按颜色阈值区间筛选降水强度</p>
        </div>
      </div>

      {/* 雷达显隐切换 */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onRadarVisibleChange(!radarVisible)}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            radarVisible
              ? 'bg-zinc-900 text-white hover:bg-zinc-800'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          {radarVisible ? <Eye size={15} /> : <EyeOff size={15} />}
          {radarVisible ? '隐藏雷达图层' : '显示雷达图层'}
        </button>
      </div>

      {/* 已选色域摘要 */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-700">已选色域</span>
          <span className="text-zinc-400">{selectedIndexes.length}/{count}</span>
        </div>
        <div className="min-h-[28px] rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs leading-5 text-zinc-600">
          {selectedLabels}
        </div>
      </div>

      {/* 色卡网格 */}
      <div className="mt-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {thresholds.map((threshold, index) => {
            const active = selectedSet.has(index);

            return (
              <button
                key={threshold.label}
                type="button"
                aria-label={`${threshold.label} ${threshold.colorDescription}`}
                aria-pressed={active}
                className={`relative aspect-square rounded-md border transition ${
                  active
                    ? 'border-zinc-900 opacity-100 shadow-[0_0_0_2px_rgba(250,204,21,0.7)]'
                    : 'border-zinc-300/60 opacity-30 hover:opacity-65'
                }`}
                style={{ backgroundColor: threshold.hex }}
                title={`${threshold.label} ${threshold.colorDescription}`}
                onClick={() => toggleBand(index)}
              >
                {active && (
                  <span className="pointer-events-none absolute inset-0 rounded-md border-2 border-white/80 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.4)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* 数值标签 */}
        <div className="mt-1.5 grid grid-cols-8 gap-1 px-0.5">
          {thresholds.map((threshold, index) => (
            <span
              key={threshold.label}
              className={`text-center text-[9px] leading-tight ${
                selectedSet.has(index) ? 'font-medium text-zinc-700' : 'text-zinc-400'
              }`}
            >
              {threshold.min}
            </span>
          ))}
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="mt-3 border-t border-zinc-200 pt-3">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => applySelection(thresholds.map((_threshold, index) => index))}
            disabled={allSelected}
            className="flex items-center justify-center gap-1 rounded-lg bg-zinc-100 px-2 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={12} />
            全部
          </button>
          <button
            type="button"
            onClick={() => applySelection([])}
            disabled={noneSelected}
            className="flex items-center justify-center gap-1 rounded-lg bg-zinc-100 px-2 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            清空
          </button>
          <button
            type="button"
            onClick={() => applySelection([Math.max(0, count - 3), count - 1])}
            className="flex items-center justify-center gap-1 rounded-lg bg-zinc-100 px-2 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-200"
          >
            <Zap size={12} />
            强回波
          </button>
          <button
            type="button"
            onClick={() => {
              const allIndexes = thresholds.map((_threshold, index) => index);
              applySelection(allIndexes.slice(Math.floor(count / 2)));
            }}
            className="rounded-lg bg-zinc-100 px-2 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-200"
          >
            中高强度
          </button>
        </div>
      </div>
    </div>
  );
}