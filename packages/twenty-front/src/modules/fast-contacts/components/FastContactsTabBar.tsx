import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme';

import { FAST_CONTACTS_TABS } from '@/fast-contacts/constants/FastContactsTabs';
import { type FastContactsTabKey } from '@/fast-contacts/types/FastContactsTab';

const StyledTabBar = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  padding: 0 ${themeCssVariables.spacing[2]};
`;

const StyledTab = styled.button`
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};

  &[aria-selected='true'] {
    background: ${themeCssVariables.background.primary};
    border-bottom-color: ${themeCssVariables.color.blue};
    color: ${themeCssVariables.font.color.primary};
    font-weight: ${themeCssVariables.font.weight.medium};
  }
`;

const StyledTabCount = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  margin-left: ${themeCssVariables.spacing[1]};
`;

type FastContactsTabBarProps = {
  activeTabKey: FastContactsTabKey;
  countByTabKey: Record<FastContactsTabKey, number>;
  onTabChange: (tabKey: FastContactsTabKey) => void;
};

export const FastContactsTabBar = ({
  activeTabKey,
  countByTabKey,
  onTabChange,
}: FastContactsTabBarProps) => {
  const { i18n } = useLingui();

  return (
    <StyledTabBar role="tablist">
      {FAST_CONTACTS_TABS.map((tab) => (
        <StyledTab
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === activeTabKey}
          onClick={() => onTabChange(tab.key)}
        >
          {i18n._(tab.label)}
          <StyledTabCount>{countByTabKey[tab.key]}</StyledTabCount>
        </StyledTab>
      ))}
    </StyledTabBar>
  );
};
