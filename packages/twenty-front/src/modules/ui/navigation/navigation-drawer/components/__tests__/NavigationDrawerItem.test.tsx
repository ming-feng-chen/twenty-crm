import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { useIsNavigationDrawerContentExpanded } from '@/ui/navigation/navigation-drawer/hooks/useIsNavigationDrawerContentExpanded';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';

jest.mock(
  '@/ui/navigation/navigation-drawer/hooks/useIsNavigationDrawerContentExpanded',
);

const TestProviders = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>
    <JotaiProvider store={jotaiStore}>
      <MemoryRouter>{children}</MemoryRouter>
    </JotaiProvider>
  </I18nProvider>
);

const renderTasksItem = (count?: number) => {
  resetJotaiStore();

  return render(
    <NavigationDrawerItem label="Tasks" to="/tasks" count={count} />,
    {
      wrapper: TestProviders,
    },
  );
};

describe('NavigationDrawerItem', () => {
  beforeEach(() => {
    jest.mocked(useIsNavigationDrawerContentExpanded).mockReturnValue(true);
  });

  it('shows how many items need attention next to the label', () => {
    renderTasksItem(3);

    expect(screen.getByRole('link')).toHaveTextContent('Tasks3');
  });

  it('caps the count at 99+', () => {
    renderTasksItem(120);

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('shows no count when there is nothing to do', () => {
    renderTasksItem(0);

    expect(screen.getByRole('link')).toHaveTextContent(/^Tasks$/);
  });
});
