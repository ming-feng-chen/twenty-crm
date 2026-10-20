import { formatNavigationDrawerItemCount } from '@/ui/navigation/navigation-drawer/utils/formatNavigationDrawerItemCount';

describe('formatNavigationDrawerItemCount', () => {
  it('should show counts up to 99 as they are', () => {
    expect(formatNavigationDrawerItemCount(3)).toBe('3');
    expect(formatNavigationDrawerItemCount(99)).toBe('99');
  });

  it('should cap larger counts at 99+', () => {
    expect(formatNavigationDrawerItemCount(100)).toBe('99+');
  });
});
