import { useEffect, useRef, useCallback } from 'react';
import type { FeatureCollection, Polygon, MultiPolygon, Point } from 'geojson';
import type { JsonObject } from '../types';

interface PendingRequest {
  resolve: (fc: FeatureCollection<Point>) => void;
  reject: (error: Error) => void;
}

export function usePointsGenerator() {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef<number>(0);
  const pendingRef = useRef<Map<number, PendingRequest>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL('../workers/generatePoints.worker.ts', import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as { requestId: number; fc: FeatureCollection<Point> };
      const pending = pendingRef.current.get(data.requestId);
      if (pending) {
        pendingRef.current.delete(data.requestId);
        pending.resolve(data.fc);
      }
    };

    worker.onerror = (err) => {
      pendingRef.current.forEach((p) => p.reject(new Error(err.message)));
      pendingRef.current.clear();
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  const generate = useCallback(
    (count: number, hb: FeatureCollection<Polygon | MultiPolygon>, templateProps: JsonObject | null) => {
      return new Promise<FeatureCollection<Point>>((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error('Worker not initialized'));
          return;
        }
        const requestId = ++seqRef.current;
        pendingRef.current.set(requestId, { resolve, reject });
        worker.postMessage({
          type: 'generate',
          requestId,
          payload: { hb, count, templateProps },
        });
      });
    },
    []
  );

  return { generate };
}