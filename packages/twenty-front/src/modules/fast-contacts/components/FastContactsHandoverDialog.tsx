import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useState } from 'react';
import { Radio, RadioGroup } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

import { FAST_CONTACTS_HANDOVER_DIALOG_ID } from '@/fast-contacts/constants/FastContactsHandoverDialogId';
import { type FastContactsHandoverRequest } from '@/fast-contacts/hooks/useFastContactsWriter';
import { type FastContactsOwnerChangeMode } from '@/fast-contacts/types/FastContactsCellWrite';
import { ConfirmationDialog } from '@/ui/layout/dialog/components/ConfirmationDialog';

const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  text-align: left;
`;

const StyledChoice = styled.label`
  align-items: flex-start;
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledChoiceText = styled.span`
  display: flex;
  flex-direction: column;
`;

const StyledHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledWarning = styled.div`
  color: ${themeCssVariables.color.orange};
`;

type FastContactsHandoverDialogProps = {
  request: FastContactsHandoverRequest | null;
};

// Same choice as My Day's Change owner (cadence SPEC §4), asked once per edit, paste or bulk change.
export const FastContactsHandoverDialog = ({
  request,
}: FastContactsHandoverDialogProps) => {
  const { t } = useLingui();
  const [mode, setMode] = useState<FastContactsOwnerChangeMode>('START_FRESH');

  const handoverCount = request?.handoverCount ?? 0;
  const owedReplyNames = request?.owedReplyNames ?? [];
  const owedReplyList = owedReplyNames.slice(0, 5).join(', ');

  return (
    <ConfirmationDialog
      dialogId={FAST_CONTACTS_HANDOVER_DIALOG_ID}
      title={
        handoverCount === 1
          ? t`Hand this contact over`
          : t`Hand ${handoverCount} contacts over`
      }
      confirmButtonText={t`Change owner`}
      confirmButtonColor="accent"
      onConfirmClick={() => {
        request?.resolve(mode);
        setMode('START_FRESH');
      }}
      onClose={() => {
        request?.resolve(null);
        setMode('START_FRESH');
      }}
      subtitle={
        <StyledBody>
          <RadioGroup
            aria-label={t`Handover`}
            value={mode}
            onValueChange={(value) =>
              setMode(value as FastContactsOwnerChangeMode)
            }
          >
            <StyledChoice>
              <Radio value="START_FRESH" />
              <StyledChoiceText>
                {t`Start fresh`}
                <StyledHint>
                  {t`The new owner starts the sequence again. Any owed reply is cleared.`}
                </StyledHint>
              </StyledChoiceText>
            </StyledChoice>
            <StyledChoice>
              <Radio value="KEEP_POSITION" />
              <StyledChoiceText>
                {t`Keep position`}
                <StyledHint>
                  {t`The sequence carries on where it was.`}
                </StyledHint>
              </StyledChoiceText>
            </StyledChoice>
          </RadioGroup>
          {owedReplyNames.length > 0 && (
            <StyledWarning>
              {t`Owed a reply: ${owedReplyList}`}
              {owedReplyNames.length > 5 && '…'}
            </StyledWarning>
          )}
        </StyledBody>
      }
    />
  );
};
