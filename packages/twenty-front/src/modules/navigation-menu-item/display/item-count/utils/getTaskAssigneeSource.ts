import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getForwardJunctionTargetField } from '@/object-record/record-field/ui/utils/junction/getForwardJunctionTargetField';
import { type JunctionObjectMetadataItem } from '@/object-record/record-field/ui/utils/junction/types/JunctionObjectMetadataItem';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import {
  computeRelationGqlFieldJoinColumnName,
  isDefined,
} from 'twenty-shared/utils';
import { RelationType } from '~/generated-metadata/graphql';

export type TaskAssigneeSource =
  | {
      type: 'junction';
      fieldName: string;
      junctionObjectMetadata: JunctionObjectMetadataItem;
      workspaceMemberJoinColumnName: string;
    }
  | {
      type: 'direct';
      workspaceMemberJoinColumnName: string;
    };

const isWorkspaceMemberRelation = (field: FieldMetadataItem) =>
  field.relation?.targetObjectMetadata.nameSingular ===
  CoreObjectNameSingular.WorkspaceMember;

// A multi-assignee junction replaces the standard single assignee when both
// are active, since the single one is deactivated once data is copied across.
export const getTaskAssigneeSource = (
  objectMetadataItems: EnrichedObjectMetadataItem[],
): TaskAssigneeSource | undefined => {
  const taskObjectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) =>
      objectMetadataItem.nameSingular === CoreObjectNameSingular.Task,
  );

  if (!isDefined(taskObjectMetadataItem)) {
    return undefined;
  }

  const activeFields = taskObjectMetadataItem.fields.filter(
    (field) => field.isActive === true,
  );

  for (const field of activeFields) {
    const junctionTarget = getForwardJunctionTargetField({
      fieldMetadataItem: field,
      objectMetadataItems,
    });

    if (
      isDefined(junctionTarget) &&
      isWorkspaceMemberRelation(junctionTarget.targetField)
    ) {
      return {
        type: 'junction',
        fieldName: field.name,
        junctionObjectMetadata: junctionTarget.junctionObjectMetadata,
        workspaceMemberJoinColumnName: computeRelationGqlFieldJoinColumnName({
          name: junctionTarget.targetField.name,
        }),
      };
    }
  }

  const assigneeField = activeFields.find(
    (field) =>
      field.name === 'assignee' &&
      field.relation?.type === RelationType.MANY_TO_ONE &&
      isWorkspaceMemberRelation(field),
  );

  if (!isDefined(assigneeField)) {
    return undefined;
  }

  return {
    type: 'direct',
    workspaceMemberJoinColumnName: computeRelationGqlFieldJoinColumnName({
      name: assigneeField.name,
    }),
  };
};
