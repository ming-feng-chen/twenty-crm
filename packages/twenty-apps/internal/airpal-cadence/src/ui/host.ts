import {
  AppPath,
  enqueueSnackbar,
  navigate,
  openSidePanelPage,
  SidePanelPages,
} from 'twenty-sdk/front-component';

import { errorText } from 'src/ui/api';

// Calls into the Twenty page hosting the component. A host function can be
// missing in some contexts; that must never break the action that called it,
// so every call here is guarded (the page shows its own messages anyway).

export const notify = (
  variant: 'success' | 'error' | 'info' | 'warning',
  message: string,
  detailedMessage?: string,
) => {
  try {
    void enqueueSnackbar({
      message,
      variant,
      ...(detailedMessage === undefined ? {} : { detailedMessage }),
      duration: variant === 'error' ? 12_000 : 6_000,
    }).catch(() => undefined);
  } catch {
    // No snackbar here; the page shows the outcome inline.
  }
};

// The person's record page.
export const openPersonRecord = async (personId: string): Promise<void> => {
  try {
    await navigate(AppPath.RecordShowPage, {
      objectNameSingular: 'person',
      objectRecordId: personId,
    });
  } catch (error) {
    notify('error', 'Could not open the person record', errorText(error));
  }
};

// The record in the side panel, so My Day stays where it is.
export const openPersonInSidePanel = async (personId: string): Promise<void> => {
  try {
    await openSidePanelPage({
      to: AppPath.RecordShowPage,
      params: { objectNameSingular: 'person', objectRecordId: personId },
    });

    return;
  } catch {
    // Older hosts only know the purpose-built page.
  }

  try {
    await openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      recordId: personId,
      objectNameSingular: 'person',
    });
  } catch {
    await openPersonRecord(personId);
  }
};
