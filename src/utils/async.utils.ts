import { Logger } from '@src/main';

export const wait = async (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PollingOptions<T> {
  pollingInterval: number | number[];
  maxAttempts: number;
  pollingFunction: () => Promise<T>;
  isSuccessCondition?: (data: T) => boolean;
}

export async function poll<T>(options: PollingOptions<T>): Promise<T | null> {
  const { maxAttempts, pollingFunction, pollingInterval, isSuccessCondition } =
    options;
  let attempts = 0;

  const interval = Array.isArray(pollingInterval)
    ? pollingInterval[attempts]
    : pollingInterval;

  while (attempts < maxAttempts) {
    try {
      const result = await pollingFunction();

      if (isSuccessCondition && isSuccessCondition(result)) {
        return result;
      } else if (!isSuccessCondition && result) {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (error) {
      Logger.error(error, '[Polling]: Error during polling');
    }

    attempts++;
  }

  Logger.error(`Polling failed after ${maxAttempts} attempts`, '[Polling]');
  return null;
}
