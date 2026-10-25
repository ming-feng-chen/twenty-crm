import { styled } from '@linaria/react';
import { memo } from 'react';
import { themeCssVariables } from 'twenty-ui/theme';

import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { FAST_CONTACTS_ROW_HEIGHT_IN_PX } from '@/fast-contacts/constants/FastContactsRowHeightInPx';
import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsCellText } from '@/fast-contacts/utils/getFastContactsCellText';

const StyledRow = styled.div`
  display: grid;
  height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  left: 0;
  position: absolute;
`;

const StyledCell = styled.div`
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  border-right: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  line-height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX - 1}px;
  overflow: hidden;
  padding: 0 ${themeCssVariables.spacing[2]};
  text-overflow: ellipsis;
  user-select: none;
  white-space: nowrap;

  &[data-frozen='true'] {
    left: 0;
    position: sticky;
    z-index: 1;
  }

  &[data-active='true'] {
    box-shadow: inset 0 0 0 2px ${themeCssVariables.color.blue};
  }
`;

type FastContactsGridRowProps = {
  person: FastContactsPerson;
  rowIndex: number;
  top: number;
  gridTemplateColumns: string;
  activeColumnIndex: number | null;
  formatContext: FastContactsCellFormatContext;
};

export const FastContactsGridRow = memo(
  ({
    person,
    rowIndex,
    top,
    gridTemplateColumns,
    activeColumnIndex,
    formatContext,
  }: FastContactsGridRowProps) => (
    <StyledRow style={{ top, gridTemplateColumns }} role="row">
      {FAST_CONTACTS_COLUMNS.map((column, columnIndex) => {
        const text = getFastContactsCellText({
          person,
          columnKey: column.key,
          formatContext,
        });

        return (
          <StyledCell
            key={column.key}
            role="gridcell"
            title={text}
            data-row-index={rowIndex}
            data-column-index={columnIndex}
            data-frozen={columnIndex === 0}
            data-active={columnIndex === activeColumnIndex}
          >
            {text}
          </StyledCell>
        );
      })}
    </StyledRow>
  ),
);
