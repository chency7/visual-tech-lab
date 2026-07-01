import { useCallback, useEffect, useRef } from 'react';
import type { IdwWorkerPayload, IdwWorkerResult } from '../types';

interface PendingRequest {
  resolve: (result: IdwWorkerResult) => void;
  reject: (error: Error) => void;
}

export function useIdwWorker() {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  const pendingRef = useRef<Map<number, PendingRequest>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL('../workers/idw.worker.ts', import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { requestId: number; result: IdwWorkerResult };
      const pending = pendingRef.current.get(data.requestId);
      if (!pending) return;
      pendingRef.current.delete(data.requestId);
      pending.resolve(data.result);
    };

    worker.onerror = (error) => {
      pendingRef.current.forEach((pending) => pending.reject(new Error(error.message)));
      pendingRef.current.clear();
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  const compute = useCallback((payload: IdwWorkerPayload) => {
    return new Promise<IdwWorkerResult>((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error('IDW worker not initialized'));
        return;
      }

      const requestId = ++seqRef.current;
      pendingRef.current.set(requestId, { resolve, reject });
      worker.postMessage({
        type: 'compute-idw',
        requestId,
        payload,
      });
    });
  }, []);

  return { compute };
}
