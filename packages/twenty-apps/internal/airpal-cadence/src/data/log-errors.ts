import { errorMessage } from 'src/data/api';

// Twenty records a failed run's console output but not its error, so a
// handler that throws would leave an empty log line. Log, then rethrow so the
// run still counts as failed.
export const withErrorLogging =
  <TArgs extends unknown[], TResult>(
    name: string,
    handler: (...args: TArgs) => Promise<TResult>,
  ) =>
  async (...args: TArgs): Promise<TResult> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(
        JSON.stringify({
          function: name,
          error: errorMessage(error),
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 6) : undefined,
        }),
      );
      throw error;
    }
  };
