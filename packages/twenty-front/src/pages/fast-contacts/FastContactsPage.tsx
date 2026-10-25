import { useLingui } from '@lingui/react/macro';
import { IconUser } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';

import { FastContactsPageContent } from '@/fast-contacts/components/FastContactsPageContent';
import { PageCardHeader } from '@/ui/layout/page/components/PageCardHeader';
import { PageCardLayout } from '@/ui/layout/page/components/PageCardLayout';

export const FastContactsPage = () => {
  const { t } = useLingui();
  const theme = useTheme();

  return (
    <PageCardLayout
      header={
        <PageCardHeader
          icon={<IconUser size={theme.icon.size.md} />}
          title={t`Contacts`}
        />
      }
    >
      <FastContactsPageContent />
    </PageCardLayout>
  );
};
