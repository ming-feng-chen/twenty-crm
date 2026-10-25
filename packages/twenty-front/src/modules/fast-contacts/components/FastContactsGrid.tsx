import { styled } from '@linaria/react';
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme';

import { FastContactsGridHeader } from '@/fast-contacts/components/FastContactsGridHeader';
import { FastContactsGridRow } from '@/fast-contacts/components/FastContactsGridRow';
import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { FAST_CONTACTS_ROW_HEIGHT_IN_PX } from '@/fast-contacts/constants/FastContactsRowHeightInPx';
import { fastContactsColumnWidthsState } from '@/fast-contacts/states/fastContactsColumnWidthsState';
import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsCellPosition } from '@/fast-contacts/types/FastContactsCellPosition';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsVisibleRowRange } from '@/fast-contacts/utils/getFastContactsVisibleRowRange';
import { getNextFastContactsCellPosition } from '@/fast-contacts/utils/getNextFastContactsCellPosition';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

const StyledViewport = styled.div`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  min-height: 0;
  outline: none;
  overflow: auto;
  position: relative;
`;

const StyledCanvas = styled.div`
  position: relative;
`;

type ColumnWidthOverride = {
  columnKey: FastContactsColumnKey;
  width: number;
};

type FastContactsGridProps = {
  viewportRef: RefObject<HTMLDivElement | null>;
  people: FastContactsPerson[];
  formatContext: FastContactsCellFormatContext;
  onOpenPerson: (personId: string) => void;
};

const getCellPositionFromEvent = (
  event: MouseEvent<HTMLElement>,
): FastContactsCellPosition | null => {
  const cell = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-row-index]',
  );

  if (!isDefined(cell)) {
    return null;
  }

  return {
    rowIndex: Number(cell.dataset.rowIndex),
    columnIndex: Number(cell.dataset.columnIndex),
  };
};

export const FastContactsGrid = ({
  viewportRef,
  people,
  formatContext,
  onOpenPerson,
}: FastContactsGridProps) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [activeCellPosition, setActiveCellPosition] =
    useState<FastContactsCellPosition>({ rowIndex: 0, columnIndex: 0 });
  const [fastContactsColumnWidths, setFastContactsColumnWidths] = useAtomState(
    fastContactsColumnWidthsState,
  );
  const [columnWidthOverride, setColumnWidthOverride] =
    useState<ColumnWidthOverride | null>(null);

  const columnWidths = useMemo(
    () =>
      Object.fromEntries(
        FAST_CONTACTS_COLUMNS.map((column) => [
          column.key,
          columnWidthOverride?.columnKey === column.key
            ? columnWidthOverride.width
            : (fastContactsColumnWidths[column.key] ?? column.defaultWidth),
        ]),
      ) as Record<FastContactsColumnKey, number>,
    [columnWidthOverride, fastContactsColumnWidths],
  );

  const gridTemplateColumns = FAST_CONTACTS_COLUMNS.map(
    (column) => `${columnWidths[column.key]}px`,
  ).join(' ');

  const totalWidth = FAST_CONTACTS_COLUMNS.reduce(
    (width, column) => width + columnWidths[column.key],
    0,
  );

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!isDefined(viewport)) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setViewportHeight(entry.contentRect.height);
    });

    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, [viewportRef]);

  const lastRowIndex = people.length - 1;
  const activeRowIndex = Math.min(activeCellPosition.rowIndex, lastRowIndex);

  const { startRowIndex, endRowIndex } = getFastContactsVisibleRowRange({
    scrollTop,
    viewportHeight,
    rowCount: people.length,
  });

  const scrollCellIntoView = ({
    rowIndex,
    columnIndex,
  }: FastContactsCellPosition) => {
    const viewport = viewportRef.current;

    if (!isDefined(viewport)) {
      return;
    }

    const rowTop = rowIndex * FAST_CONTACTS_ROW_HEIGHT_IN_PX;
    const rowBottom = rowTop + 2 * FAST_CONTACTS_ROW_HEIGHT_IN_PX;

    if (rowTop < viewport.scrollTop) {
      viewport.scrollTop = rowTop;
    } else if (rowBottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = rowBottom - viewport.clientHeight;
    }

    if (columnIndex === 0) {
      return;
    }

    const frozenColumnWidth = columnWidths[FAST_CONTACTS_COLUMNS[0].key];
    const columnLeft = FAST_CONTACTS_COLUMNS.slice(0, columnIndex).reduce(
      (left, column) => left + columnWidths[column.key],
      0,
    );
    const columnRight =
      columnLeft + columnWidths[FAST_CONTACTS_COLUMNS[columnIndex].key];

    if (columnLeft - frozenColumnWidth < viewport.scrollLeft) {
      viewport.scrollLeft = columnLeft - frozenColumnWidth;
    } else if (columnRight > viewport.scrollLeft + viewport.clientWidth) {
      viewport.scrollLeft = columnRight - viewport.clientWidth;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      lastRowIndex < 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onOpenPerson(people[activeRowIndex].id);

      return;
    }

    const nextCellPosition = getNextFastContactsCellPosition({
      key: event.key,
      cellPosition: { ...activeCellPosition, rowIndex: activeRowIndex },
      rowCount: people.length,
      columnCount: FAST_CONTACTS_COLUMNS.length,
    });

    if (!isDefined(nextCellPosition)) {
      return;
    }

    event.preventDefault();
    setActiveCellPosition(nextCellPosition);
    scrollCellIntoView(nextCellPosition);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const cellPosition = getCellPositionFromEvent(event);

    if (isDefined(cellPosition)) {
      setActiveCellPosition(cellPosition);
    }
  };

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const cellPosition = getCellPositionFromEvent(event);

    if (isDefined(cellPosition)) {
      onOpenPerson(people[cellPosition.rowIndex].id);
    }
  };

  const handleColumnResizeChange = useCallback(
    (columnKey: FastContactsColumnKey, width: number) =>
      setColumnWidthOverride({ columnKey, width }),
    [],
  );

  const handleColumnResizeEnd = (
    columnKey: FastContactsColumnKey,
    width: number,
  ) => {
    setFastContactsColumnWidths({
      ...fastContactsColumnWidths,
      [columnKey]: width,
    });
    setColumnWidthOverride(null);
  };

  return (
    <StyledViewport
      ref={viewportRef}
      role="grid"
      aria-rowcount={people.length}
      tabIndex={0}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <StyledCanvas
        style={{
          height: (people.length + 1) * FAST_CONTACTS_ROW_HEIGHT_IN_PX,
          width: totalWidth,
        }}
      >
        <FastContactsGridHeader
          columnWidths={columnWidths}
          onColumnResizeChange={handleColumnResizeChange}
          onColumnResizeEnd={handleColumnResizeEnd}
        />
        {people.slice(startRowIndex, endRowIndex).map((person, offset) => {
          const rowIndex = startRowIndex + offset;

          return (
            <FastContactsGridRow
              key={person.id}
              person={person}
              rowIndex={rowIndex}
              top={(rowIndex + 1) * FAST_CONTACTS_ROW_HEIGHT_IN_PX}
              gridTemplateColumns={gridTemplateColumns}
              activeColumnIndex={
                rowIndex === activeRowIndex
                  ? activeCellPosition.columnIndex
                  : null
              }
              formatContext={formatContext}
            />
          );
        })}
      </StyledCanvas>
    </StyledViewport>
  );
};
