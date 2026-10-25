import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { type PointerEvent, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme';

import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { FAST_CONTACTS_MIN_COLUMN_WIDTH_IN_PX } from '@/fast-contacts/constants/FastContactsMinColumnWidthInPx';
import { FAST_CONTACTS_ROW_HEIGHT_IN_PX } from '@/fast-contacts/constants/FastContactsRowHeightInPx';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';

const StyledHeaderRow = styled.div`
  display: grid;
  height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  position: sticky;
  top: 0;
  z-index: 2;
`;

const StyledHeaderCell = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  border-right: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.secondary};
  font-weight: ${themeCssVariables.font.weight.medium};
  line-height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX - 1}px;
  overflow: hidden;
  padding: 0 ${themeCssVariables.spacing[2]};
  position: relative;
  text-overflow: ellipsis;
  user-select: none;
  white-space: nowrap;

  &[data-frozen='true'] {
    left: 0;
    position: sticky;
    z-index: 1;
  }
`;

const StyledResizeHandle = styled.div`
  bottom: 0;
  cursor: col-resize;
  position: absolute;
  right: 0;
  top: 0;
  width: 6px;

  &:hover,
  &[data-resizing='true'] {
    background: ${themeCssVariables.color.blue};
  }
`;

type ColumnResize = {
  columnKey: FastContactsColumnKey;
  startClientX: number;
  startWidth: number;
  width: number;
};

type FastContactsGridHeaderProps = {
  columnWidths: Record<FastContactsColumnKey, number>;
  onColumnResizeChange: (
    columnKey: FastContactsColumnKey,
    width: number,
  ) => void;
  onColumnResizeEnd: (columnKey: FastContactsColumnKey, width: number) => void;
};

export const FastContactsGridHeader = ({
  columnWidths,
  onColumnResizeChange,
  onColumnResizeEnd,
}: FastContactsGridHeaderProps) => {
  const { i18n } = useLingui();
  const [columnResize, setColumnResize] = useState<ColumnResize | null>(null);

  const gridTemplateColumns = FAST_CONTACTS_COLUMNS.map(
    (column) => `${columnWidths[column.key]}px`,
  ).join(' ');

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    columnKey: FastContactsColumnKey,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    setColumnResize({
      columnKey,
      startClientX: event.clientX,
      startWidth: columnWidths[columnKey],
      width: columnWidths[columnKey],
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDefined(columnResize)) {
      return;
    }

    const width = Math.max(
      FAST_CONTACTS_MIN_COLUMN_WIDTH_IN_PX,
      Math.round(
        columnResize.startWidth + event.clientX - columnResize.startClientX,
      ),
    );

    setColumnResize({ ...columnResize, width });
    onColumnResizeChange(columnResize.columnKey, width);
  };

  const handlePointerUp = () => {
    if (!isDefined(columnResize)) {
      return;
    }

    onColumnResizeEnd(columnResize.columnKey, columnResize.width);
    setColumnResize(null);
  };

  return (
    <StyledHeaderRow style={{ gridTemplateColumns }} role="row">
      {FAST_CONTACTS_COLUMNS.map((column, columnIndex) => (
        <StyledHeaderCell
          key={column.key}
          role="columnheader"
          data-frozen={columnIndex === 0}
        >
          {i18n._(column.label)}
          <StyledResizeHandle
            data-resizing={columnResize?.columnKey === column.key}
            onPointerDown={(event) => handlePointerDown(event, column.key)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </StyledHeaderCell>
      ))}
    </StyledHeaderRow>
  );
};
