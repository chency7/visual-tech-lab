import { useEffect, useRef, useCallback } from 'react';
import type { FeatureCollection, Polygon, MultiPolygon, Point } from 'geojson';
import type { JsonObject } from '../types';

interface PendingRequest {
  resolve: (fc: FeatureCollection<Point>) => void;
  reject: (error: Error) => void;
}

export function usePointsGeneratorPool() {
  const poolRef = useRef<Worker[]>([]);
  const seqRef = useRef<number>(0);
  const pendingRef = useRef<Map<number, PendingRequest>>(new Map());

  useEffect(() => {
    const threads = Math.min((navigator as any).hardwareConcurrency || 4, 8);
    const workers: Worker[] = [];
    for (let i = 0; i < threads; i++) {
      const w = new Worker(new URL('../workers/generatePoints.worker.ts', import.meta.url));
      w.onmessage = (e: MessageEvent) => {
        const data = e.data as { requestId: number; fc: FeatureCollection<Point> };
        const pending = pendingRef.current.get(data.requestId);
        if (pending) {
          pendingRef.current.delete(data.requestId);
          pending.resolve(data.fc);
        }
      };
      w.onerror = (err) => {
        pendingRef.current.forEach((p) => p.reject(new Error(err.message)));
        pendingRef.current.clear();
      };
      workers.push(w);
    }
    poolRef.current = workers;

    return () => {
      for (const w of poolRef.current) w.terminate();
      poolRef.current = [];
      pendingRef.current.clear();
    };
  }, []);

  const dispatchTo = useCallback(
    (worker: Worker, payload: { hb: FeatureCollection<Polygon | MultiPolygon>; count: number; templateProps: JsonObject | null; idOffset: number }) => {
      return new Promise<FeatureCollection<Point>>((resolve, reject) => {
        const requestId = ++seqRef.current;
        pendingRef.current.set(requestId, { resolve, reject });
        worker.postMessage({ type: 'generate', requestId, payload });
      });
    },
    []
  );

  const generateParallel = useCallback(
    async (count: number, hb: FeatureCollection<Polygon | MultiPolygon>, templateProps: JsonObject | null) => {
      const workers = poolRef.current.length ? poolRef.current : [new Worker(new URL('../workers/generatePoints.worker.ts', import.meta.url))];
      const n = workers.length;
      const base = Math.floor(count / n);
      const remainder = count % n;
      const tasks: Promise<FeatureCollection<Point>>[] = [];
      let offset = 0;
      for (let i = 0; i < n; i++) {
        const c = base + (i < remainder ? 1 : 0);
        if (c <= 0) continue;
        const payload = { hb, count: c, templateProps, idOffset: offset };
        tasks.push(dispatchTo(workers[i], payload));
        offset += c;
      }
      const results = await Promise.all(tasks);
      const merged: FeatureCollection<Point> = {
        type: 'FeatureCollection',
        features: results.flatMap((fc) => fc.features),
      };
      return merged;
    },
    [dispatchTo]
  );

  return { generateParallel };
}