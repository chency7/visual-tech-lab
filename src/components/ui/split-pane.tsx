'use client';

import React from 'react';
import Split from 'react-split';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftRatio?: number; // 0.1 ~ 0.9
  minLeftPx?: number;
  minRightPx?: number;
  className?: string;
}

export function SplitPane({
  left,
  right,
  initialLeftRatio = 0.4,
  minLeftPx = 240,
  minRightPx = 320,
  className = '',
}: SplitPaneProps) {
  const leftPercent = Math.min(Math.max(Math.round(initialLeftRatio * 100), 10), 90);
  const rightPercent = 100 - leftPercent;

  return (
    <Split
      sizes={[leftPercent, rightPercent]}
      minSize={[minLeftPx, minRightPx]}
      gutterSize={6}
      direction="horizontal"
      className={`flex h-full w-full ${className}`}
      gutterStyle={() => ({
        width: '6px',
        cursor: 'col-resize',
        background: 'var(--split-gutter-bg, #e5e7eb)',
      })}
    >
      <div className="relative overflow-hidden">{left}</div>
      <div className="relative overflow-hidden">{right}</div>
    </Split>
  );
}
