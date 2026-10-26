import { styled } from '@linaria/react';
import { atom, useStore } from 'jotai';
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme';

import { FastContactsCellEditor } from '@/fast-contacts/components/cell-editors/FastContactsCellEditor';
import { FastContactsNameCellEditor } from '@/fast-contacts/components/cell-editors/FastContactsNameCellEditor';
import { FastContactsGridHeader } from '@/fast-contacts/components/FastContactsGridHeader';
import { FastContactsGridRow } from '@/fast-contacts/components/FastContactsGridRow';
import { type FastContactsColumnMenuAnchor } from '@/fast-contacts/components/FastContactsColumnMenu';
import { FAST_CONTACTS_ROW_HEIGHT_IN_PX } from '@/fast-contacts/constants/FastContactsRowHeightInPx';
import { FAST_CONTACTS_ROW_NUMBER_WIDTH_IN_PX } from '@/fast-contacts/constants/FastContactsRowNumberWidthInPx';
import { type FastContactsCellPosition } from '@/fast-contacts/types/FastContactsCellPosition';
import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsCellWrite } from '@/fast-contacts/types/FastContactsCellWrite';
import {
  type FastContactsColumn,
  type FastContactsColumnKey,
} from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { type FastContactsEditingCell } from '@/fast-contacts/types/FastContactsEditingCell';
import { type FastContactsEditorMove } from '@/fast-contacts/types/FastContactsEditorMove';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { type FastContactsSelection } from '@/fast-contacts/types/FastContactsSelection';
import { type FastContactsSheetLayout } from '@/fast-contacts/types/FastContactsSheetLayout';
import {
  decodeFastContactsTsv,
  encodeFastContactsTsv,
} from '@/fast-contacts/utils/fastContactsTsv';
import { getFastContactsCellText } from '@/fast-contacts/utils/getFastContactsCellText';
import { getFastContactsSelectedCells } from '@/fast-contacts/utils/getFastContactsSelectedCells';
import { getFastContactsVisibleRowRange } from '@/fast-contacts/utils/getFastContactsVisibleRowRange';
import { getNextFastContactsCellPosition } from '@/fast-contacts/utils/getNextFastContactsCellPosition';
import { type FieldFullNameValue } from '@/object-record/record-field/ui/types/FieldMetadata';

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

const StyledDraftRow = styled.div`
  display: grid;
  height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  left: 0;
  position: absolute;
`;

const StyledDraftCell = styled.div`
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  left: ${FAST_CONTACTS_ROW_NUMBER_WIDTH_IN_PX}px;
  overflow: visible;
  position: sticky;
  z-index: 3;
`;

const getCellPositionFromTarget = (
  target: EventTarget,
): FastContactsCellPosition | null => {
  const cell = (target as HTMLElement).closest<HTMLElement>('[data-row-index]');

  if (!isDefined(cell)) {
    return null;
  }

  return {
    rowIndex: Number(cell.dataset.rowIndex),
    columnIndex: Number(cell.dataset.columnIndex),
  };
};

const getRowNumberFromTarget = (target: EventTarget): number | null => {
  const rowNumberCell = (target as HTMLElement).closest<HTMLElement>(
    '[data-row-number]',
  );

  return isDefined(rowNumberCell)
    ? Number(rowNumberCell.dataset.rowNumber)
    : null;
};

const isPrintableKey = (event: KeyboardEvent) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

type FastContactsGridProps = {
  viewportRef: RefObject<HTMLDivElement | null>;
  rows: FastContactsPerson[];
  columns: FastContactsColumn[];
  columnWidths: Record<FastContactsColumnKey, number>;
  layout: FastContactsSheetLayout;
  editContext: FastContactsEditContext;
  editableColumnKeys: Set<string>;
  selection: FastContactsSelection;
  openMenuColumnKey: FastContactsColumnKey | null;
  isDraftRowVisible: boolean;
  pendingEditingCell: FastContactsEditingCell | null;
  onSelectionChange: (selection: FastContactsSelection) => void;
  onPendingEditingCellUsed: () => void;
  onWriteCells: (
    writes: FastContactsCellWrite[],
    isSingleCellEdit: boolean,
  ) => void;
  onWriteTexts: (
    inputs: { personId: string; column: FastContactsColumn; text: string }[],
    isSingleCellEdit: boolean,
  ) => void;
  onPasteValues: (values: string[][]) => void;
  onClearSelectedCells: () => void;
  onUndo: () => void;
  onOpenPerson: (personId: string) => void;
  onCreateCompanyForPerson: (personId: string, companyName: string) => void;
  onDraftCommit: (name: FieldFullNameValue) => void;
  onDraftCancel: () => void;
  onSortClick: (columnKey: FastContactsColumnKey) => void;
  onOpenColumnMenu: (
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

export const FastContactsGrid = ({
  viewportRef,
  rows,
  columns,
  columnWidths,
  layout,
  editContext,
  editableColumnKeys,
  selection,
  openMenuColumnKey,
  isDraftRowVisible,
  pendingEditingCell,
  onSelectionChange,
  onPendingEditingCellUsed,
  onWriteCells,
  onWriteTexts,
  onPasteValues,
  onClearSelectedCells,
  onUndo,
  onOpenPerson,
  onCreateCompanyForPerson,
  onDraftCommit,
  onDraftCancel,
  onSortClick,
  onOpenColumnMenu,
  onMoveColumn,
  onColumnResizeChange,
  onColumnResizeEnd,
}: FastContactsGridProps) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [editingCellState, setEditingCell] =
    useState<FastContactsEditingCell | null>(null);
  const editingCellRef = useRef<HTMLDivElement>(null);
  const store = useStore();
  const [isDraggingSelectionAtom] = useState(() => atom(false));
  const [lastClickedRowIndexAtom] = useState(() => atom<number | null>(null));

  const formatContext = editContext.formatContext;
  const rowIds = rows.map((row) => row.id);
  // The edited contact can leave the rows (deleted elsewhere); then nothing is being edited.
  const editingCell =
    isDefined(editingCellState) && rowIds.includes(editingCellState.personId)
      ? editingCellState
      : null;
  const lastRowIndex = rows.length - 1;
  const rowOffset = isDraftRowVisible ? 1 : 0;

  const gridTemplateColumns = [
    `${FAST_CONTACTS_ROW_NUMBER_WIDTH_IN_PX}px`,
    ...columns.map((column) => `${columnWidths[column.key]}px`),
  ].join(' ');

  const columnLefts = columns.reduce<number[]>(
    (lefts, column, columnIndex) => [
      ...lefts,
      columnIndex === 0
        ? FAST_CONTACTS_ROW_NUMBER_WIDTH_IN_PX
        : lefts[columnIndex - 1] + columnWidths[columns[columnIndex - 1].key],
    ],
    [],
  );
  const frozenColumnLefts = columnLefts.map((left, columnIndex) =>
    columnIndex < layout.frozenColumnCount ? left : null,
  );
  const frozenWidth =
    columns
      .slice(0, layout.frozenColumnCount)
      .reduce((width, column) => width + columnWidths[column.key], 0) +
    FAST_CONTACTS_ROW_NUMBER_WIDTH_IN_PX;
  const totalWidth =
    FAST_CONTACTS_ROW_NUMBER_WIDTH_IN_PX +
    columns.reduce((width, column) => width + columnWidths[column.key], 0);

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

  // A drag that ends outside the grid must still end the selection drag.
  useEffect(() => {
    const handleMouseUp = () => store.set(isDraggingSelectionAtom, false);

    window.addEventListener('mouseup', handleMouseUp);

    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDraggingSelectionAtom, store]);

  const { startRowIndex, endRowIndex } = getFastContactsVisibleRowRange({
    scrollTop: Math.max(
      0,
      scrollTop - rowOffset * FAST_CONTACTS_ROW_HEIGHT_IN_PX,
    ),
    viewportHeight,
    rowCount: rows.length,
  });

  const clampPosition = (position: FastContactsCellPosition) => ({
    rowIndex: Math.min(
      Math.max(position.rowIndex, 0),
      Math.max(lastRowIndex, 0),
    ),
    columnIndex: Math.min(
      Math.max(position.columnIndex, 0),
      Math.max(columns.length - 1, 0),
    ),
  });

  const focus = clampPosition(selection.focus);
  const anchor = clampPosition(selection.anchor);
  const selectedRowIdSet = new Set(selection.selectedRowIds ?? []);
  const isRangeSelection = !isDefined(selection.selectedRowIds);
  const firstSelectedRowIndex = Math.min(anchor.rowIndex, focus.rowIndex);
  const lastSelectedRowIndex = Math.max(anchor.rowIndex, focus.rowIndex);
  const firstSelectedColumnIndex = Math.min(
    anchor.columnIndex,
    focus.columnIndex,
  );
  const lastSelectedColumnIndex = Math.max(
    anchor.columnIndex,
    focus.columnIndex,
  );
  const isMultiCellRange =
    firstSelectedRowIndex !== lastSelectedRowIndex ||
    firstSelectedColumnIndex !== lastSelectedColumnIndex;

  const focusViewport = () =>
    viewportRef.current?.focus({ preventScroll: true });

  const scrollCellIntoView = ({
    rowIndex,
    columnIndex,
  }: FastContactsCellPosition) => {
    const viewport = viewportRef.current;

    if (!isDefined(viewport)) {
      return;
    }

    const rowTop = (rowIndex + rowOffset) * FAST_CONTACTS_ROW_HEIGHT_IN_PX;
    const rowBottom = rowTop + 2 * FAST_CONTACTS_ROW_HEIGHT_IN_PX;

    if (rowTop < viewport.scrollTop) {
      viewport.scrollTop = rowTop;
    } else if (rowBottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = rowBottom - viewport.clientHeight;
    }

    if (columnIndex < layout.frozenColumnCount) {
      return;
    }

    const columnLeft = columnLefts[columnIndex];
    const columnRight = columnLeft + columnWidths[columns[columnIndex].key];

    if (columnLeft - frozenWidth < viewport.scrollLeft) {
      viewport.scrollLeft = columnLeft - frozenWidth;
    } else if (columnRight > viewport.scrollLeft + viewport.clientWidth) {
      viewport.scrollLeft = columnRight - viewport.clientWidth;
    }
  };

  const selectCell = (position: FastContactsCellPosition, extend = false) => {
    const nextFocus = clampPosition(position);

    onSelectionChange({
      anchor: extend ? anchor : nextFocus,
      focus: nextFocus,
      selectedRowIds: null,
    });
    scrollCellIntoView(nextFocus);
  };

  const startEditing = (
    position: FastContactsCellPosition,
    initialText: string | null,
  ) => {
    const person = rows[position.rowIndex];
    const column = columns[position.columnIndex];

    if (!isDefined(person) || !isDefined(column)) {
      return;
    }

    if (!editableColumnKeys.has(column.key)) {
      return;
    }

    if (column.kind === 'boolean') {
      onWriteCells(
        [
          {
            personId: person.id,
            columnKey: column.key,
            value: person[column.key] !== true,
          },
        ],
        true,
      );

      return;
    }

    onSelectionChange({
      anchor: position,
      focus: position,
      selectedRowIds: null,
    });
    setEditingCell({ personId: person.id, columnKey: column.key, initialText });
  };

  // A new contact only appears in the rows after it is saved; then its Company cell opens.
  useEffect(() => {
    if (!isDefined(pendingEditingCell)) {
      return;
    }

    const pendingRowIndex = rows.findIndex(
      (row) => row.id === pendingEditingCell.personId,
    );
    const pendingColumnIndex = columns.findIndex(
      (column) => column.key === pendingEditingCell.columnKey,
    );

    if (pendingRowIndex < 0) {
      return;
    }

    onPendingEditingCellUsed();

    const position = {
      rowIndex: pendingRowIndex,
      columnIndex: Math.max(pendingColumnIndex, 0),
    };

    onSelectionChange({
      anchor: position,
      focus: position,
      selectedRowIds: null,
    });

    if (pendingColumnIndex >= 0) {
      setEditingCell({ ...pendingEditingCell, initialText: null });
    } else {
      viewportRef.current?.focus({ preventScroll: true });
    }
  }, [
    pendingEditingCell,
    rows,
    columns,
    onPendingEditingCellUsed,
    onSelectionChange,
    viewportRef,
  ]);

  const finishEditing = (move: FastContactsEditorMove) => {
    setEditingCell(null);
    focusViewport();

    if (move === 'none') {
      return;
    }

    const nextPosition = getNextFastContactsCellPosition({
      key:
        move === 'down'
          ? 'ArrowDown'
          : move === 'right'
            ? 'ArrowRight'
            : 'ArrowLeft',
      cellPosition: focus,
      rowCount: rows.length,
      columnCount: columns.length,
    });

    if (isDefined(nextPosition)) {
      selectCell(nextPosition);
    }
  };

  const handleCommitText = (text: string, move: FastContactsEditorMove) => {
    if (!isDefined(editingCell)) {
      return;
    }

    const column = columns.find(
      (candidate) => candidate.key === editingCell.columnKey,
    );

    if (isDefined(column)) {
      onWriteTexts([{ personId: editingCell.personId, column, text }], true);
    }

    finishEditing(move);
  };

  const handleCommitValue = (
    value: FastContactsCellValue,
    move: FastContactsEditorMove,
  ) => {
    if (!isDefined(editingCell)) {
      return;
    }

    onWriteCells(
      [
        {
          personId: editingCell.personId,
          columnKey: editingCell.columnKey,
          value,
        },
      ],
      true,
    );
    finishEditing(move);
  };

  const handleCancelEditing = () => {
    setEditingCell(null);
    focusViewport();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isDefined(editingCell) || event.target !== event.currentTarget) {
      return;
    }

    const isCommand = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (isCommand && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      onUndo();

      return;
    }

    if (isCommand && key === 'a') {
      event.preventDefault();
      onSelectionChange({ anchor, focus, selectedRowIds: rowIds });

      return;
    }

    if (lastRowIndex < 0) {
      return;
    }

    if (isCommand && event.key === 'Enter') {
      event.preventDefault();
      onOpenPerson(rows[focus.rowIndex].id);

      return;
    }

    if (isCommand || event.altKey) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onSelectionChange({ anchor: focus, focus, selectedRowIds: null });

      return;
    }

    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      startEditing(focus, null);

      return;
    }

    if (event.key === ' ' && columns[focus.columnIndex]?.kind === 'boolean') {
      event.preventDefault();
      startEditing(focus, null);

      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onClearSelectedCells();

      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      selectCell({
        rowIndex: focus.rowIndex,
        columnIndex: focus.columnIndex + (event.shiftKey ? -1 : 1),
      });

      return;
    }

    const nextPosition = getNextFastContactsCellPosition({
      key: event.key,
      cellPosition: focus,
      rowCount: rows.length,
      columnCount: columns.length,
    });

    if (isDefined(nextPosition)) {
      event.preventDefault();
      selectCell(nextPosition, event.shiftKey);

      return;
    }

    if (isPrintableKey(event)) {
      event.preventDefault();
      startEditing(focus, event.key);
    }
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isDefined(editingCell)) {
      return;
    }

    const rowNumber = getRowNumberFromTarget(event.target);

    if (isDefined(rowNumber)) {
      event.preventDefault();
      focusViewport();

      const rowId = rowIds[rowNumber];
      const lastClickedRowIndex = store.get(lastClickedRowIndexAtom);
      const currentRowIds = selection.selectedRowIds ?? [];
      let nextRowIds: string[];

      if (event.shiftKey && isDefined(lastClickedRowIndex)) {
        const from = Math.min(lastClickedRowIndex, rowNumber);
        const to = Math.max(lastClickedRowIndex, rowNumber);

        nextRowIds = rowIds.slice(from, to + 1);
      } else if (event.ctrlKey || event.metaKey) {
        nextRowIds = currentRowIds.includes(rowId)
          ? currentRowIds.filter((selectedRowId) => selectedRowId !== rowId)
          : [...currentRowIds, rowId];
        store.set(lastClickedRowIndexAtom, rowNumber);
      } else {
        nextRowIds = [rowId];
        store.set(lastClickedRowIndexAtom, rowNumber);
      }

      const rowPosition = { rowIndex: rowNumber, columnIndex: 0 };

      onSelectionChange({
        anchor: rowPosition,
        focus: rowPosition,
        selectedRowIds: nextRowIds.length > 0 ? nextRowIds : null,
      });

      return;
    }

    const cellPosition = getCellPositionFromTarget(event.target);

    if (!isDefined(cellPosition)) {
      return;
    }

    store.set(isDraggingSelectionAtom, true);
    selectCell(cellPosition, event.shiftKey);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!store.get(isDraggingSelectionAtom) || event.buttons !== 1) {
      return;
    }

    const cellPosition = getCellPositionFromTarget(event.target);

    if (
      isDefined(cellPosition) &&
      (cellPosition.rowIndex !== focus.rowIndex ||
        cellPosition.columnIndex !== focus.columnIndex)
    ) {
      onSelectionChange({ anchor, focus: cellPosition, selectedRowIds: null });
    }
  };

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const cellPosition = getCellPositionFromTarget(event.target);

    if (isDefined(cellPosition) && !isDefined(editingCell)) {
      startEditing(cellPosition, null);
    }
  };

  const isGridFocused = () =>
    !isDefined(editingCell) && document.activeElement === viewportRef.current;

  const handleCopy = (event: ClipboardEvent) => {
    if (!isGridFocused() || !isDefined(event.clipboardData)) {
      return;
    }

    const { personIds, columns: selectedColumns } =
      getFastContactsSelectedCells({
        selection,
        rowIds,
        visibleColumns: columns,
      });
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    event.preventDefault();
    event.clipboardData.setData(
      'text/plain',
      encodeFastContactsTsv(
        personIds.map((personId) =>
          selectedColumns.map((column) => {
            const person = rowsById.get(personId);

            return isDefined(person)
              ? getFastContactsCellText({
                  person,
                  columnKey: column.key,
                  formatContext,
                  purpose: 'clipboard',
                })
              : '';
          }),
        ),
      ),
    );
  };

  const handlePaste = (event: ClipboardEvent) => {
    if (!isGridFocused() || !isDefined(event.clipboardData)) {
      return;
    }

    event.preventDefault();

    const text = event.clipboardData.getData('text/plain');

    if (text !== '') {
      onPasteValues(decodeFastContactsTsv(text));
    }
  };

  // A focused grid that is not a text field does not reliably receive copy
  // and paste events, so they are caught on the document while it has focus.
  useEffect(() => {
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  });

  const toggleCheckbox = (personId: string, columnIndex: number) => {
    const rowIndex = rowIds.indexOf(personId);

    if (rowIndex >= 0) {
      selectCell({ rowIndex, columnIndex });
      startEditing({ rowIndex, columnIndex }, null);
      focusViewport();
    }
  };

  const renderEditor = (person: FastContactsPerson) => {
    if (!isDefined(editingCell) || editingCell.personId !== person.id) {
      return null;
    }

    const column = columns.find(
      (candidate) => candidate.key === editingCell.columnKey,
    );

    if (!isDefined(column)) {
      return null;
    }

    return (
      <FastContactsCellEditor
        person={person}
        column={column}
        initialText={editingCell.initialText}
        editContext={editContext}
        cellRef={editingCellRef}
        onCommitText={handleCommitText}
        onCommitValue={handleCommitValue}
        onCreateCompany={(companyName) => {
          onCreateCompanyForPerson(person.id, companyName);
          finishEditing('none');
        }}
        onCancel={handleCancelEditing}
      />
    );
  };

  return (
    <StyledViewport
      ref={viewportRef}
      role="grid"
      aria-rowcount={rows.length}
      aria-multiselectable
      tabIndex={0}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onDoubleClick={handleDoubleClick}
    >
      <StyledCanvas
        style={{
          height:
            (rows.length + rowOffset + 1) * FAST_CONTACTS_ROW_HEIGHT_IN_PX,
          width: totalWidth,
        }}
      >
        <FastContactsGridHeader
          columns={columns}
          columnWidths={columnWidths}
          gridTemplateColumns={gridTemplateColumns}
          frozenColumnLefts={frozenColumnLefts}
          layout={layout}
          openMenuColumnKey={openMenuColumnKey}
          areAllRowsSelected={
            rows.length > 0 && selectedRowIdSet.size === rows.length
          }
          onSelectAllRows={() => {
            focusViewport();
            onSelectionChange({
              anchor,
              focus,
              selectedRowIds:
                selectedRowIdSet.size === rows.length ? null : rowIds,
            });
          }}
          onSortClick={onSortClick}
          onOpenMenu={onOpenColumnMenu}
          onMoveColumn={onMoveColumn}
          onColumnResizeChange={onColumnResizeChange}
          onColumnResizeEnd={onColumnResizeEnd}
        />
        {isDraftRowVisible && (
          <StyledDraftRow
            style={{ top: FAST_CONTACTS_ROW_HEIGHT_IN_PX, gridTemplateColumns }}
          >
            <span />
            <StyledDraftCell>
              <FastContactsNameCellEditor
                initialName={{ firstName: '', lastName: '' }}
                onCommit={(name) => onDraftCommit(name)}
                onCancel={onDraftCancel}
              />
            </StyledDraftCell>
          </StyledDraftRow>
        )}
        {rows.slice(startRowIndex, endRowIndex).map((person, offset) => {
          const rowIndex = startRowIndex + offset;
          const isInRange =
            isRangeSelection &&
            rowIndex >= firstSelectedRowIndex &&
            rowIndex <= lastSelectedRowIndex;
          const isEditingRow = editingCell?.personId === person.id;

          return (
            <FastContactsGridRow
              key={person.id}
              person={person}
              rowIndex={rowIndex}
              top={(rowIndex + rowOffset + 1) * FAST_CONTACTS_ROW_HEIGHT_IN_PX}
              gridTemplateColumns={gridTemplateColumns}
              columns={columns}
              frozenColumnLefts={frozenColumnLefts}
              editableColumnKeys={editableColumnKeys}
              activeColumnIndex={
                rowIndex === focus.rowIndex ? focus.columnIndex : null
              }
              firstSelectedColumnIndex={
                isInRange && isMultiCellRange ? firstSelectedColumnIndex : null
              }
              lastSelectedColumnIndex={
                isInRange && isMultiCellRange ? lastSelectedColumnIndex : null
              }
              isRowSelected={selectedRowIdSet.has(person.id)}
              editingColumnIndex={
                isEditingRow
                  ? columns.findIndex(
                      (column) => column.key === editingCell?.columnKey,
                    )
                  : null
              }
              editor={isEditingRow ? renderEditor(person) : null}
              editingCellRef={editingCellRef}
              formatContext={formatContext}
              onOpenPerson={onOpenPerson}
              onToggleCheckbox={toggleCheckbox}
            />
          );
        })}
      </StyledCanvas>
    </StyledViewport>
  );
};
