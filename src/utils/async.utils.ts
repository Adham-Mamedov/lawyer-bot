export const wait = async (time: number) =>
  new Promise((r) => setTimeout(r, time));

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
      console.error('Error during polling:', error);
    }

    attempts++;
  }

  console.error('Polling reached maximum attempts without success.');
  return null;
}
