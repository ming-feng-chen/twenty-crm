import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';

export const StyledNavigationDrawerCountPill = styled.span`
  align-items: center;
  background: ${themeCssVariables.color.red};
  border-radius: ${themeCssVariables.border.radius.pill};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.onAccent};
  display: inline-flex;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.xs};
  font-variant-numeric: tabular-nums;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  height: ${themeCssVariables.spacing[4]};
  justify-content: center;
  min-width: ${themeCssVariables.spacing[4]};
  padding: 0 ${themeCssVariables.spacing[1]};
`;
