import { useMemo } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersState';
import { isUsableJunctionConfig } from '@/object-record/record-field/ui/utils/junction/isUsableJunctionConfig';
import { type JunctionConfig } from '@/object-record/record-field/ui/utils/junction/types/JunctionConfig';
import { type MultipleRecordPickerSelectAllOption } from '@/object-record/record-picker/multiple-record-picker/types/MultipleRecordPickerSelectAllOption';
import { type RecordPickerPickableMorphItem } from '@/object-record/record-picker/types/RecordPickerPickableMorphItem';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

// Offered only for junctions onto workspace members (e.g. task assignees),
// where "everyone" is a small, fully loaded list.
export const useWorkspaceMemberJunctionSelectAllOption = ({
  junctionConfig,
  onChange,
}: {
  junctionConfig: Pick<
    JunctionConfig,
    'isValid' | 'isMorphRelation' | 'targetFields'
  > | null;
  onChange: (changedMorphItems: RecordPickerPickableMorphItem[]) => void;
}): MultipleRecordPickerSelectAllOption | undefined => {
  const currentWorkspaceMembers = useAtomStateValue(
    currentWorkspaceMembersState,
  );

  const targetObjectMetadata =
    isUsableJunctionConfig(junctionConfig) &&
    !junctionConfig.isMorphRelation &&
    junctionConfig.targetFields.length === 1
      ? junctionConfig.targetFields[0].relation?.targetObjectMetadata
      : undefined;

  const workspaceMemberObjectMetadataId =
    targetObjectMetadata?.nameSingular ===
    CoreObjectNameSingular.WorkspaceMember
      ? targetObjectMetadata.id
      : undefined;

  const recordIds = useMemo(
    () => currentWorkspaceMembers.map(({ id }) => id),
    [currentWorkspaceMembers],
  );

  if (!isDefined(workspaceMemberObjectMetadataId)) {
    return undefined;
  }

  return {
    recordIds,
    objectMetadataId: workspaceMemberObjectMetadataId,
    onChange,
  };
};
