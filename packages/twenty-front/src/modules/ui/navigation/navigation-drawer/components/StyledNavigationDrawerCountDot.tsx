import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';

// Stands in for the count pill when the drawer is collapsed to icons, so its
// parent must be positioned
export const StyledNavigationDrawerCountDot = styled.span`
  background: ${themeCssVariables.color.red};
  border-radius: 50%;
  height: 6px;
  position: absolute;
  right: -2px;
  top: -2px;
  width: 6px;
`;
