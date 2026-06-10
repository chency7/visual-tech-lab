'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, Filter, RotateCcw, Trash2, Zap } from 'lucide-react';
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
  const [collapsed, setCollapsed] = useState(false);
  const count = thresholds.length;
  const selectedSet = useMemo(() => new Set(selectedIndexes), [selectedIndexes]);

  // 所有入口最终都走这里，统一去重、过滤非法 index，并保持色带从低到高排序。
  const applySelection = useCallback(
    (nextIndexes: number[]) => {
      const normalized = Array.from(
        new Set(nextIndexes.filter((index) => index >= 0 && index < count))
      ).sort((a, b) => a - b);

      onSelectionChange(normalized);
    },
    [count, onSelectionChange]
  );

  // 色卡是多选模式：点击已选色域会取消，点击未选色域会追加。
  const toggleBand = useCallback(
    (index: number) => {
      const next = selectedSet.has(index)
        ? selectedIndexes.filter((selectedIndex) => selectedIndex !== index)
        : [...selectedIndexes, index];

      applySelection(next);
    },
    [applySelection, selectedIndexes, selectedSet]
  );

  // 面板顶部展示当前选择，避免用户只看色块时难以判断已经选了哪些区间。
  const selectedLabels = useMemo(() => {
    if (count <= 0 || selectedIndexes.length <= 0) return '未选择';
    if (selectedIndexes.length === count) return '全部色域';

    return selectedIndexes.map((index) => thresholds[index]?.label).filter(Boolean).join('、');
  }, [count, selectedIndexes, thresholds]);

  return (
    <div className="pointer-events-auto">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 rounded bg-white/90 px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow backdrop-blur hover:bg-white"
      >
        <Filter size={14} />
        雷达过滤
        <span className="text-zinc-400">{collapsed ? '\u25B8' : '\u25BE'}</span>
      </button>

      {!collapsed && (
        <div className="mt-1.5 w-64 rounded bg-white/90 p-3 shadow backdrop-blur">
          <button
            type="button"
            onClick={() => onRadarVisibleChange(!radarVisible)}
            className={`mb-3 flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${
              radarVisible
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {radarVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            {radarVisible ? '隐藏雷达图层' : '显示雷达图层'}
          </button>

          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-700">
            <span className="font-medium">已选色域</span>
            <span className="text-zinc-500">
              {selectedIndexes.length}/{count}
            </span>
          </div>

          <div className="mb-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs leading-5 text-zinc-700">
            {selectedLabels}
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {thresholds.map((threshold, index) => {
              const active = selectedSet.has(index);

              return (
                <button
                  key={threshold.label}
                  type="button"
                  aria-label={`${threshold.label} ${threshold.colorDescription}`}
                  aria-pressed={active}
                  className={`relative h-9 rounded border transition ${
                    active
                      ? 'border-zinc-900 opacity-100 shadow-[0_0_0_2px_rgba(250,204,21,0.8)]'
                      : 'border-white/70 opacity-35 hover:opacity-70'
                  }`}
                  style={{ backgroundColor: threshold.hex }}
                  title={`${threshold.label} ${threshold.colorDescription}`}
                  onClick={() => toggleBand(index)}
                >
                  {active && (
                    <span className="pointer-events-none absolute inset-0 rounded border-2 border-white shadow-[inset_0_0_0_1px_rgba(24,24,27,0.45)]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mb-3 grid grid-cols-7 gap-1 px-0.5">
            {thresholds.map((threshold, index) => (
              <span
                key={threshold.label}
                className={`text-center text-[9px] leading-tight ${
                  selectedSet.has(index) ? 'font-medium text-zinc-800' : 'text-zinc-400'
                }`}
              >
                {threshold.min}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => applySelection(thresholds.map((_threshold, index) => index))}
              className="flex items-center justify-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
            >
              <RotateCcw size={12} />
              全部
            </button>
            <button
              type="button"
              onClick={() => applySelection([])}
              className="flex items-center justify-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
            >
              <Trash2 size={12} />
              清空
            </button>
            <button
              type="button"
              onClick={() => applySelection([Math.max(0, count - 2), count - 1])}
              className="flex items-center justify-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
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
              className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
            >
              中高强度
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
