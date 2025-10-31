import { useEffect, useRef } from 'react';
import type { Selection } from 'd3-selection';

export interface UseD3Options {
  autoresize?: boolean; // default: true
}

export type D3Draw<T extends HTMLElement = HTMLDivElement> = (
  root: Selection<T, unknown, null, undefined>,
  d3: typeof import('d3'),
  size: { width: number; height: number }
) => void | (() => void);

export interface UseD3Return<T extends HTMLElement = HTMLDivElement> {
  ref: React.MutableRefObject<T | null>;
}

/**
 * SSR 安全的 D3 Hook：动态导入 d3，提供容器选择与自适应重绘。
 * - 仅在浏览器环境运行
 * - 使用 ResizeObserver 实现自适应渲染
 * - draw 可返回清理函数用于释放事件/资源
 */
export function useD3<T extends HTMLElement = HTMLDivElement>(
  draw: D3Draw<T>,
  deps: unknown[] = [],
  opts: UseD3Options = {}
): UseD3Return<T> {
  const ref = useRef<T | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return;

    let disposed = false;

    (async () => {
      const d3 = await import('d3');
      if (disposed || !ref.current) return;

      // 初次绘制
      const size = measure(ref.current);
      const root = d3.select(ref.current) as Selection<T, unknown, null, undefined>;
      const cleanup = draw(root, d3, size);
      cleanupRef.current = typeof cleanup === 'function' ? cleanup : null;

      // 自适应重绘
      if (opts.autoresize !== false) {
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => {
            if (!ref.current) return;
            const s = measure(ref.current);
            const r = d3.select(ref.current) as Selection<T, unknown, null, undefined>;
            const c = draw(r, d3, s);
            // 每次重绘后若返回新清理函数，替换之
            cleanupRef.current = typeof c === 'function' ? c : cleanupRef.current;
          });
          ro.observe(ref.current);
          roRef.current = ro;
        } else {
          const onResize = () => {
            if (!ref.current) return;
            const s = measure(ref.current);
            const r = d3.select(ref.current) as Selection<T, unknown, null, undefined>;
            const c = draw(r, d3, s);
            cleanupRef.current = typeof c === 'function' ? c : cleanupRef.current;
          };
          window.addEventListener('resize', onResize);
          roRef.current = {
            disconnect: () => window.removeEventListener('resize', onResize),
          } as unknown as ResizeObserver;
        }
      }
    })();

    return () => {
      disposed = true;
      roRef.current?.disconnect();
      roRef.current = null;
      if (cleanupRef.current) {
        try { cleanupRef.current(); } catch { /* noop */ }
        cleanupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref };
}

function measure(el: HTMLElement): { width: number; height: number } {
  const rect = el.getBoundingClientRect();
  const width = Math.max(0, Math.floor(rect.width || el.clientWidth));
  const height = Math.max(0, Math.floor(rect.height || el.clientHeight));
  return { width, height };
}