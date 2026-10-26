import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';

import { FAST_CONTACTS_ROW_HEIGHT_IN_PX } from '@/fast-contacts/constants/FastContactsRowHeightInPx';

export const StyledFastContactsEditorContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  box-shadow:
    inset 0 0 0 2px ${themeCssVariables.color.blue},
    ${themeCssVariables.boxShadow.strong};
  display: flex;
  left: 0;
  min-height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  min-width: 100%;
  position: absolute;
  top: 0;
  z-index: 4;
`;

export const StyledFastContactsEditorInput = styled.input`
  background: transparent;
  border: none;
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: inherit;
  height: ${FAST_CONTACTS_ROW_HEIGHT_IN_PX}px;
  min-width: 120px;
  outline: none;
  padding: 0 ${themeCssVariables.spacing[2]};
`;
