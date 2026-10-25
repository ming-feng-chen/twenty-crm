import { FAST_CONTACTS_OVERSCAN_ROW_COUNT } from '@/fast-contacts/constants/FastContactsOverscanRowCount';
import { FAST_CONTACTS_ROW_HEIGHT_IN_PX } from '@/fast-contacts/constants/FastContactsRowHeightInPx';

export const getFastContactsVisibleRowRange = ({
  scrollTop,
  viewportHeight,
  rowCount,
}: {
  scrollTop: number;
  viewportHeight: number;
  rowCount: number;
}) => {
  const firstVisibleRowIndex = Math.floor(
    scrollTop / FAST_CONTACTS_ROW_HEIGHT_IN_PX,
  );
  const visibleRowCount = Math.ceil(
    viewportHeight / FAST_CONTACTS_ROW_HEIGHT_IN_PX,
  );

  return {
    startRowIndex: Math.max(
      0,
      firstVisibleRowIndex - FAST_CONTACTS_OVERSCAN_ROW_COUNT,
    ),
    endRowIndex: Math.min(
      rowCount,
      firstVisibleRowIndex + visibleRowCount + FAST_CONTACTS_OVERSCAN_ROW_COUNT,
    ),
  };
};
