import { isBoolean, isNonEmptyString, isString } from '@sniptt/guards';
import { isDefined, isPlainObject } from 'twenty-shared/utils';

import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { type FastContactsColumnFilter } from '@/fast-contacts/types/FastContactsColumnFilter';
import {
  type FastContactsColumn,
  type FastContactsColumnKey,
} from '@/fast-contacts/types/FastContactsColumn';
import {
  type FastContactsSheetLayout,
  type FastContactsSort,
} from '@/fast-contacts/types/FastContactsSheetLayout';
import { getDefaultFastContactsSheetLayout } from '@/fast-contacts/utils/getDefaultFastContactsSheetLayout';
import {
  getFastContactsColumn,
  isFastContactsColumnKey,
} from '@/fast-contacts/utils/getFastContactsColumn';

const NAME_COLUMN_KEY: FastContactsColumnKey = 'name';

const DATE_FILTER_OPERATORS = ['before', 'after', 'between', 'isEmpty'];

const isDateOrNull = (value: unknown): value is string | null =>
  value === null || (isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value));

const normalizeFilter = (
  column: FastContactsColumn,
  filter: unknown,
): FastContactsColumnFilter | null => {
  if (!isPlainObject(filter)) {
    return null;
  }

  switch (column.kind) {
    case 'select':
    case 'owner':
    case 'company':
      return filter.type === 'values' &&
        Array.isArray(filter.values) &&
        filter.values.every((value) => value === null || isString(value))
        ? { type: 'values', values: filter.values as (string | null)[] }
        : null;
    case 'date':
    case 'dateTime':
      return filter.type === 'date' &&
        DATE_FILTER_OPERATORS.includes(filter.operator as string) &&
        isDateOrNull(filter.from) &&
        isDateOrNull(filter.to)
        ? {
            type: 'date',
            operator: filter.operator as 'before',
            from: filter.from,
            to: filter.to,
          }
        : null;
    case 'boolean':
      return filter.type === 'boolean' && isBoolean(filter.value)
        ? { type: 'boolean', value: filter.value }
        : null;
    default:
      return filter.type === 'contains' && isNonEmptyString(filter.text)
        ? { type: 'contains', text: filter.text }
        : null;
  }
};

const normalizeSort = (sort: unknown): FastContactsSort | null =>
  isPlainObject(sort) &&
  isFastContactsColumnKey(sort.columnKey) &&
  (sort.direction === 'asc' || sort.direction === 'desc')
    ? { columnKey: sort.columnKey, direction: sort.direction }
    : null;

// Layouts come from local storage and may predate columns added since, so
// anything unknown is dropped and new columns are appended with their default visibility.
export const normalizeFastContactsSheetLayout = (
  storedLayout: unknown,
): FastContactsSheetLayout => {
  const defaultLayout = getDefaultFastContactsSheetLayout();

  if (!isPlainObject(storedLayout)) {
    return defaultLayout;
  }

  const storedOrder = Array.isArray(storedLayout.columnOrder)
    ? storedLayout.columnOrder.filter(isFastContactsColumnKey)
    : [];
  const knownOrder = [...new Set(storedOrder)];
  const newColumns = FAST_CONTACTS_COLUMNS.filter(
    (column) => !knownOrder.includes(column.key),
  );

  const columnOrder = [
    NAME_COLUMN_KEY,
    ...[...knownOrder, ...newColumns.map((column) => column.key)].filter(
      (columnKey) => columnKey !== NAME_COLUMN_KEY,
    ),
  ];

  const storedHidden = Array.isArray(storedLayout.hiddenColumnKeys)
    ? storedLayout.hiddenColumnKeys.filter(isFastContactsColumnKey)
    : defaultLayout.hiddenColumnKeys;
  const hiddenColumnKeys = [
    ...new Set([
      ...storedHidden,
      ...newColumns
        .filter((column) => !column.isVisibleByDefault)
        .map((column) => column.key),
    ]),
  ].filter((columnKey) => columnKey !== NAME_COLUMN_KEY);

  const visibleColumnCount = columnOrder.length - hiddenColumnKeys.length;
  const storedFrozenCount = Number(storedLayout.frozenColumnCount);
  const frozenColumnCount = Number.isInteger(storedFrozenCount)
    ? Math.min(Math.max(storedFrozenCount, 1), visibleColumnCount)
    : 1;

  const filters: FastContactsSheetLayout['filters'] = {};

  if (isPlainObject(storedLayout.filters)) {
    for (const [columnKey, filter] of Object.entries(storedLayout.filters)) {
      if (!isFastContactsColumnKey(columnKey)) {
        continue;
      }

      const normalizedFilter = normalizeFilter(
        getFastContactsColumn(columnKey),
        filter,
      );

      if (isDefined(normalizedFilter)) {
        filters[columnKey] = normalizedFilter;
      }
    }
  }

  return {
    columnOrder,
    hiddenColumnKeys,
    frozenColumnCount,
    sort: normalizeSort(storedLayout.sort),
    filters,
  };
};
