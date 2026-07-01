import type { IdwWorkerPayload, IdwWorkerResult } from '../types';
import { computeIdwWorkerResult } from '../utils/grid';

interface IdwWorkerRequest {
  type: 'compute-idw';
  requestId: number;
  payload: IdwWorkerPayload;
}

interface IdwWorkerResponse {
  requestId: number;
  result: IdwWorkerResult;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<IdwWorkerRequest>) => void) | null;
  postMessage: (message: IdwWorkerResponse) => void;
};

workerScope.onmessage = (event: MessageEvent<IdwWorkerRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'compute-idw') return;

  const result = computeIdwWorkerResult(data.payload);
  const response: IdwWorkerResponse = {
    requestId: data.requestId,
    result,
  };

  workerScope.postMessage(response);
};
