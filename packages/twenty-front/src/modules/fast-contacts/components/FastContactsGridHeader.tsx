import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import {
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  useState,
} from 'react';
import { isDefined } from 'twenty-shared/utils';
import { LightIconButton } from 'twenty-ui/components/input';
import {
  IconChevronDown,
  IconFilter,
  IconSortAscending,
  IconSortDescending,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

import { FAST_CONTACTS_MIN_COLUMN_WIDTH_IN_PX } from '@/fast-contacts/constants/FastContactsMinColumnWidthInPx';
import { FAST_CONTACTS_ROW_HEIGHT_IN_PX } from '@/fast-contacts/constants/FastContactsRowHeightInPx';
import { type FastContactsColumnMenuAnchor } from '@/fast-contacts/components/FastContactsColumnMenu';
import {
  type FastContactsColumn,
  type FastContactsColumnKey,
} from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsSheetLayout } from '@/fast-contacts/types/FastContactsSheetLayout';

const StyledHeaderRow = styled.div`
  display: grid;
  height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  position: sticky;
  top: 0;
  z-index: 5;

  &:hover [data-menu-button] {
    visibility: visible;
  }
`;

const StyledHeaderCell = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  border-right: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  overflow: hidden;
  padding: 0 0 0 ${themeCssVariables.spacing[2]};
  position: relative;
  user-select: none;
  white-space: nowrap;

  &[data-frozen='true'] {
    position: sticky;
    z-index: 1;
  }

  &[data-drop-target='true'] {
    box-shadow: inset 2px 0 0 ${themeCssVariables.color.blue};
  }
`;

const StyledCornerCell = styled(StyledHeaderCell)`
  cursor: pointer;
  left: 0;
  position: sticky;
  z-index: 2;
`;

const StyledLabel = styled.span`
  cursor: pointer;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledIndicator = styled.span`
  color: ${themeCssVariables.color.blue};
  display: flex;
`;

const StyledMenuButton = styled.span`
  visibility: hidden;

  &[data-open='true'] {
    visibility: visible;
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
  columns: FastContactsColumn[];
  columnWidths: Record<FastContactsColumnKey, number>;
  gridTemplateColumns: string;
  frozenColumnLefts: (number | null)[];
  layout: FastContactsSheetLayout;
  openMenuColumnKey: FastContactsColumnKey | null;
  areAllRowsSelected: boolean;
  onSelectAllRows: () => void;
  onSortClick: (columnKey: FastContactsColumnKey) => void;
  onOpenMenu: (
    columnKey: FastContactsColumnKey,
    anchor: FastContactsColumnMenuAnchor,
  ) => void;
  onMoveColumn: (
    columnKey: FastContactsColumnKey,
    beforeColumnKey: FastContactsColumnKey,
  ) => void;
  onColumnResizeChange: (
    columnKey: FastContactsColumnKey,
    width: number,
  ) => void;
  onColumnResizeEnd: (columnKey: FastContactsColumnKey, width: number) => void;
};

export const FastContactsGridHeader = ({
  columns,
  columnWidths,
  gridTemplateColumns,
  frozenColumnLefts,
  layout,
  openMenuColumnKey,
  areAllRowsSelected,
  onSelectAllRows,
  onSortClick,
  onOpenMenu,
  onMoveColumn,
  onColumnResizeChange,
  onColumnResizeEnd,
}: FastContactsGridHeaderProps) => {
  const { t, i18n } = useLingui();
  const [columnResize, setColumnResize] = useState<ColumnResize | null>(null);
  const [draggedColumnKey, setDraggedColumnKey] =
    useState<FastContactsColumnKey | null>(null);
  const [dropTargetColumnKey, setDropTargetColumnKey] =
    useState<FastContactsColumnKey | null>(null);

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    columnKey: FastContactsColumnKey,
  ) => {
    event.preventDefault();
    event.stopPropagation();
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

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    columnKey: FastContactsColumnKey,
  ) => {
    if (
      !isDefined(draggedColumnKey) ||
      columnKey === 'name' ||
      columnKey === draggedColumnKey
    ) {
      return;
    }

    event.preventDefault();
    setDropTargetColumnKey(columnKey);
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    columnKey: FastContactsColumnKey,
  ) => {
    event.preventDefault();

    if (isDefined(draggedColumnKey)) {
      onMoveColumn(draggedColumnKey, columnKey);
    }

    setDraggedColumnKey(null);
    setDropTargetColumnKey(null);
  };

  const handleContextMenu = (
    event: MouseEvent<HTMLDivElement>,
    columnKey: FastContactsColumnKey,
  ) => {
    event.preventDefault();

    const point = { x: event.clientX, y: event.clientY };

    onOpenMenu(columnKey, {
      getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0),
    });
  };

  return (
    <StyledHeaderRow style={{ gridTemplateColumns }} role="row">
      <StyledCornerCell
        role="columnheader"
        aria-label={areAllRowsSelected ? t`Unselect all` : t`Select all`}
        title={t`Select all rows`}
        onClick={onSelectAllRows}
      />
      {columns.map((column, columnIndex) => {
        const frozenLeft = frozenColumnLefts[columnIndex];
        const sortDirection =
          layout.sort?.columnKey === column.key ? layout.sort.direction : null;
        const isFiltered = isDefined(layout.filters[column.key]);
        const label = i18n._(column.label);

        return (
          <StyledHeaderCell
            key={column.key}
            role="columnheader"
            aria-sort={
              sortDirection === 'asc'
                ? 'ascending'
                : sortDirection === 'desc'
                  ? 'descending'
                  : undefined
            }
            data-frozen={isDefined(frozenLeft)}
            data-drop-target={dropTargetColumnKey === column.key}
            style={isDefined(frozenLeft) ? { left: frozenLeft } : undefined}
            onContextMenu={(event) => handleContextMenu(event, column.key)}
            onDragOver={(event) => handleDragOver(event, column.key)}
            onDragLeave={() => setDropTargetColumnKey(null)}
            onDrop={(event) => handleDrop(event, column.key)}
          >
            <StyledLabel
              draggable={column.key !== 'name'}
              title={t`Click to sort, drag to move`}
              onClick={() => onSortClick(column.key)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                setDraggedColumnKey(column.key);
              }}
              onDragEnd={() => {
                setDraggedColumnKey(null);
                setDropTargetColumnKey(null);
              }}
            >
              {label}
            </StyledLabel>
            {isFiltered && (
              <StyledIndicator title={t`Filtered`}>
                <IconFilter size={14} />
              </StyledIndicator>
            )}
            {sortDirection === 'asc' && (
              <StyledIndicator title={t`Sorted A to Z`}>
                <IconSortAscending size={14} />
              </StyledIndicator>
            )}
            {sortDirection === 'desc' && (
              <StyledIndicator title={t`Sorted Z to A`}>
                <IconSortDescending size={14} />
              </StyledIndicator>
            )}
            <StyledMenuButton
              data-menu-button
              data-open={openMenuColumnKey === column.key}
            >
              <LightIconButton
                size="sm"
                aria-label={t`${label} column menu`}
                onClick={(event) =>
                  onOpenMenu(
                    column.key,
                    (event.currentTarget.closest(
                      '[role="columnheader"]',
                    ) as HTMLElement | null) ?? event.currentTarget,
                  )
                }
              >
                <IconChevronDown />
              </LightIconButton>
            </StyledMenuButton>
            <StyledResizeHandle
              data-resizing={columnResize?.columnKey === column.key}
              onPointerDown={(event) => handlePointerDown(event, column.key)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </StyledHeaderCell>
        );
      })}
    </StyledHeaderRow>
  );
};
