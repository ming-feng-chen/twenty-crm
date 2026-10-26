import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';

import { type FastContactsSkippedCell } from '@/fast-contacts/types/FastContactsCellWrite';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';

const MAX_LISTED_CELLS = 5;

export const formatFastContactsSkippedCells = ({
  skippedCells,
  formatPersonName,
}: {
  skippedCells: FastContactsSkippedCell[];
  formatPersonName: (personId: string) => string;
}): string => {
  const listedCells = skippedCells
    .slice(0, MAX_LISTED_CELLS)
    .map(
      (skippedCell) =>
        `${formatPersonName(skippedCell.personId)} · ${i18n._(getFastContactsColumn(skippedCell.columnKey).label)}: ${skippedCell.reason}`,
    );
  const unlistedCount = skippedCells.length - listedCells.length;

  return [
    ...listedCells,
    ...(unlistedCount > 0 ? [t`…and ${unlistedCount} more`] : []),
  ].join('\n');
};
