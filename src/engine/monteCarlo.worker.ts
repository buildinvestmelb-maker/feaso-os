import { runMonteCarloSimulation } from './monteCarlo';
import type { FeasibilityInputs, MonteCarloResult } from './types';

export interface MonteCarloWorkerRequest {
  requestId: number;
  inputs: FeasibilityInputs;
}

export interface MonteCarloWorkerResponse {
  requestId: number;
  result?: MonteCarloResult;
  error?: string;
}

const workerScope = self as unknown as {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<MonteCarloWorkerRequest>) => void,
  ) => void;
  postMessage: (message: MonteCarloWorkerResponse) => void;
};

workerScope.addEventListener('message', (event) => {
  const { requestId, inputs } = event.data;
  try {
    const result = runMonteCarloSimulation(inputs);
    workerScope.postMessage({ requestId, result });
  } catch (err) {
    workerScope.postMessage({
      requestId,
      error: err instanceof Error ? err.message : 'Monte Carlo worker failed',
    });
  }
});
