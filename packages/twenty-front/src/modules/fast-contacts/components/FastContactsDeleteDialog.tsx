import { useLingui } from '@lingui/react/macro';

import { FAST_CONTACTS_DELETE_DIALOG_ID } from '@/fast-contacts/constants/FastContactsDeleteDialogId';
import { ConfirmationDialog } from '@/ui/layout/dialog/components/ConfirmationDialog';

type FastContactsDeleteDialogProps = {
  personNames: string[];
  onConfirm: () => void;
};

export const FastContactsDeleteDialog = ({
  personNames,
  onConfirm,
}: FastContactsDeleteDialogProps) => {
  const { t } = useLingui();
  const count = personNames.length;
  const shownNames = personNames.slice(0, 5).join(', ');
  const otherCount = count - 5;

  return (
    <ConfirmationDialog
      dialogId={FAST_CONTACTS_DELETE_DIALOG_ID}
      title={
        count === 1 ? t`Delete this contact?` : t`Delete ${count} contacts?`
      }
      subtitle={
        <>
          {otherCount > 0
            ? t`${shownNames} and ${otherCount} more.`
            : shownNames}{' '}
          {t`You can undo with Ctrl+Z or restore them from the Deleted sheet.`}
        </>
      }
      confirmButtonText={t`Delete`}
      confirmButtonColor="danger"
      onConfirmClick={onConfirm}
    />
  );
};
