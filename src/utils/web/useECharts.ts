import { useCallback, useEffect, useRef } from 'react';
import type { EChartsOption, SetOptionOpts, EChartsType } from 'echarts';

export interface UseEChartsOptions {
  theme?: string | null;
  renderer?: 'canvas' | 'svg';
  autoresize?: boolean; // default: true
  onEvents?: Record<string, (params: unknown) => void>;
}

export interface UseEChartsReturn {
  ref: React.MutableRefObject<HTMLDivElement | null>;
  instance: EChartsType | null;
  setOption: (option: EChartsOption, opts?: SetOptionOpts) => void;
  resize: () => void;
}

/**
 * SSR 安全的 ECharts Hook，支持动态导入与自动 resize。
 * - 仅在浏览器环境初始化
 * - 动态导入 `echarts`，避免服务端打包与运行时错误
 * - 支持事件绑定与主题/渲染器切换重建
 */
export function useECharts(
  option?: EChartsOption,
  opts: UseEChartsOptions = {},
  deps: unknown[] = []
): UseEChartsReturn {
  const ref = useRef<HTMLDivElement>(null);
  const instRef = useRef<EChartsType | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const eventsRef = useRef<UseEChartsOptions['onEvents']>({});
  eventsRef.current = opts.onEvents;

  const init = useCallback(async () => {
    if (typeof window === 'undefined' || !ref.current) return;

    const echarts = await import('echarts');

    // 若已存在实例，先销毁以避免主题/渲染器变更导致异常
    if (instRef.current) {
      try { instRef.current.dispose(); } catch { /* noop */ }
      instRef.current = null;
    }

    const instance = echarts.init(ref.current, opts.theme ?? undefined, {
      renderer: opts.renderer ?? 'canvas',
    });
    instRef.current = instance;

    // 绑定事件
    if (eventsRef.current) {
      for (const [evt, handler] of Object.entries(eventsRef.current)) {
        instance.on(evt as any, handler as any);
      }
    }

    // 初始设置 option
    if (option) {
      instance.setOption(option, { notMerge: true, lazyUpdate: true });
    }

    // 自动 resize：优先使用 ResizeObserver
    if (opts.autoresize !== false) {
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => instance.resize());
        ro.observe(ref.current);
        observerRef.current = ro;
      } else {
        const onResize = () => instance.resize();
        window.addEventListener('resize', onResize);
        // 通过 observerRef 记录以统一清理
        observerRef.current = {
          disconnect: () => window.removeEventListener('resize', onResize),
        } as unknown as ResizeObserver;
      }
    }
  }, [option, opts.theme, opts.renderer, opts.autoresize]);

  // 初始化与主题/渲染器变化时重建
  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await init(); })();
    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (instRef.current) {
        try { instRef.current.dispose(); } catch { /* noop */ }
        instRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init]);

  // option 改变时更新（可控依赖）
  useEffect(() => {
    if (instRef.current && option) {
      try {
        instRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
      } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option, ...deps]);

  const setOption = useCallback((opt: EChartsOption, cfg?: SetOptionOpts) => {
    if (instRef.current) {
      instRef.current.setOption(opt, cfg);
    }
  }, []);

  const resize = useCallback(() => {
    instRef.current?.resize();
  }, []);

  return { ref, instance: instRef.current, setOption, resize };
}