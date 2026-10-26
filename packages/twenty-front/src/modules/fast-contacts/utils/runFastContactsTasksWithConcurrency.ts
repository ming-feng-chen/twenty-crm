// Runs every task, at most `concurrency` at once, and never rejects.
export const runFastContactsTasksWithConcurrency = async <TResult>(
  tasks: (() => Promise<TResult>)[],
  concurrency: number,
): Promise<PromiseSettledResult<TResult>[]> => {
  const results: PromiseSettledResult<TResult>[] = new Array(tasks.length);
  let nextTaskIndex = 0;

  const runNextTasks = async () => {
    while (nextTaskIndex < tasks.length) {
      const taskIndex = nextTaskIndex;

      nextTaskIndex += 1;

      try {
        results[taskIndex] = {
          status: 'fulfilled',
          value: await tasks[taskIndex](),
        };
      } catch (error) {
        results[taskIndex] = { status: 'rejected', reason: error };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, runNextTasks),
  );

  return results;
};
