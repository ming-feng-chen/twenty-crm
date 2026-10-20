// Array.prototype.at is ES2022; the apps compile against ES2020.
export const lastItem = <TItem>(items: readonly TItem[]): TItem | undefined =>
  items.length === 0 ? undefined : items[items.length - 1];
