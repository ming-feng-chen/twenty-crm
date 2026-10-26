import { useLingui } from '@lingui/react/macro';
import { IconUser } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';

import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { FastContactsPageContent } from '@/fast-contacts/components/FastContactsPageContent';
import { FAST_CONTACTS_IMPORT_CONTEXT_STORE_INSTANCE_ID } from '@/fast-contacts/constants/FastContactsImportContextStoreInstanceId';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { PageCardHeader } from '@/ui/layout/page/components/PageCardHeader';
import { PageCardLayout } from '@/ui/layout/page/components/PageCardLayout';

export const FastContactsPage = () => {
  const { t } = useLingui();
  const theme = useTheme();

  // The import dialog reads its object from a context store, which record
  // index pages fill from the URL; the page content stays on the main one.
  return (
    <PageCardLayout
      header={
        <PageCardHeader
          icon={<IconUser size={theme.icon.size.md} />}
          title={t`Contacts`}
        />
      }
    >
      <ContextStoreComponentInstanceContext.Provider
        value={{ instanceId: FAST_CONTACTS_IMPORT_CONTEXT_STORE_INSTANCE_ID }}
      >
        <SpreadsheetImportProvider>
          <ContextStoreComponentInstanceContext.Provider
            value={{ instanceId: MAIN_CONTEXT_STORE_INSTANCE_ID }}
          >
            <FastContactsPageContent />
          </ContextStoreComponentInstanceContext.Provider>
        </SpreadsheetImportProvider>
      </ContextStoreComponentInstanceContext.Provider>
    </PageCardLayout>
  );
};
