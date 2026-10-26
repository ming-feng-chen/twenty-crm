import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { memo, type ReactNode, type RefObject } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { LightIconButton } from 'twenty-ui/components/input';
import { IconArrowUpRight } from 'twenty-ui/icon';
import { Checkbox } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

import { FAST_CONTACTS_ROW_HEIGHT_IN_PX } from '@/fast-contacts/constants/FastContactsRowHeightInPx';
import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsCellText } from '@/fast-contacts/utils/getFastContactsCellText';

const StyledRow = styled.div`
  display: grid;
  height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  left: 0;
  position: absolute;

  &:hover [data-open-button] {
    visibility: visible;
  }
`;

const StyledCell = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  border-right: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  overflow: hidden;
  padding: 0 ${themeCssVariables.spacing[2]};
  position: relative;
  user-select: none;
  white-space: nowrap;

  &[data-frozen='true'] {
    position: sticky;
    z-index: 1;
  }

  &[data-read-only='true'] {
    color: ${themeCssVariables.font.color.tertiary};
  }

  &[data-selected='true'] {
    background: ${themeCssVariables.accent.quaternary};
  }

  &[data-active='true'] {
    box-shadow: inset 0 0 0 2px ${themeCssVariables.color.blue};
  }

  &[data-editing='true'] {
    overflow: visible;
    z-index: 3;
  }
`;

const StyledRowNumberCell = styled(StyledCell)`
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  justify-content: flex-end;
  left: 0;
  position: sticky;
  z-index: 2;

  &[data-selected='true'] {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledCellText = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledOpenButton = styled.span`
  visibility: hidden;
`;

type FastContactsGridRowProps = {
  person: FastContactsPerson;
  rowIndex: number;
  top: number;
  gridTemplateColumns: string;
  columns: FastContactsColumn[];
  frozenColumnLefts: (number | null)[];
  editableColumnKeys: Set<string>;
  activeColumnIndex: number | null;
  firstSelectedColumnIndex: number | null;
  lastSelectedColumnIndex: number | null;
  isRowSelected: boolean;
  editingColumnIndex: number | null;
  editor: ReactNode;
  editingCellRef: RefObject<HTMLDivElement | null>;
  formatContext: FastContactsCellFormatContext;
  onOpenPerson: (personId: string) => void;
  onToggleCheckbox: (personId: string, columnIndex: number) => void;
};

export const FastContactsGridRow = memo(
  ({
    person,
    rowIndex,
    top,
    gridTemplateColumns,
    columns,
    frozenColumnLefts,
    editableColumnKeys,
    activeColumnIndex,
    firstSelectedColumnIndex,
    lastSelectedColumnIndex,
    isRowSelected,
    editingColumnIndex,
    editor,
    editingCellRef,
    formatContext,
    onOpenPerson,
    onToggleCheckbox,
  }: FastContactsGridRowProps) => {
    const { t } = useLingui();

    return (
      <StyledRow style={{ top, gridTemplateColumns }} role="row">
        <StyledRowNumberCell
          role="rowheader"
          data-row-number={rowIndex}
          data-selected={isRowSelected}
        >
          {rowIndex + 1}
        </StyledRowNumberCell>
        {columns.map((column, columnIndex) => {
          const frozenLeft = frozenColumnLefts[columnIndex];
          const isEditing = columnIndex === editingColumnIndex;
          const isSelected =
            isRowSelected ||
            (isDefined(firstSelectedColumnIndex) &&
              isDefined(lastSelectedColumnIndex) &&
              columnIndex >= firstSelectedColumnIndex &&
              columnIndex <= lastSelectedColumnIndex);
          const text = getFastContactsCellText({
            person,
            columnKey: column.key,
            formatContext,
          });
          const isEditable = editableColumnKeys.has(column.key);

          return (
            <StyledCell
              key={column.key}
              ref={isEditing ? editingCellRef : undefined}
              role="gridcell"
              title={text}
              aria-readonly={!isEditable}
              data-row-index={rowIndex}
              data-column-index={columnIndex}
              data-frozen={isDefined(frozenLeft)}
              data-read-only={!isEditable}
              data-selected={isSelected && !isEditing}
              data-active={columnIndex === activeColumnIndex}
              data-editing={isEditing}
              style={isDefined(frozenLeft) ? { left: frozenLeft } : undefined}
            >
              {column.kind === 'boolean' ? (
                <Checkbox
                  size="sm"
                  checked={person[column.key] === true}
                  disabled={!isEditable}
                  aria-label={t`Toggle`}
                  onCheckedChange={() =>
                    onToggleCheckbox(person.id, columnIndex)
                  }
                />
              ) : (
                <StyledCellText>{text}</StyledCellText>
              )}
              {column.kind === 'fullName' && (
                <StyledOpenButton
                  data-open-button
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <LightIconButton
                    size="sm"
                    aria-label={t`Open contact`}
                    tooltip={t`Open contact (Ctrl+Enter)`}
                    onClick={() => onOpenPerson(person.id)}
                  >
                    <IconArrowUpRight />
                  </LightIconButton>
                </StyledOpenButton>
              )}
              {isEditing && editor}
            </StyledCell>
          );
        })}
      </StyledRow>
    );
  },
);
