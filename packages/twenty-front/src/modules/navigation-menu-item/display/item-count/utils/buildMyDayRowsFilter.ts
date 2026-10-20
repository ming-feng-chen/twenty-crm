import { MY_DAY_COUNT_SOURCE } from '@/navigation-menu-item/display/item-count/constants/MyDayCountSource';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import {
  CoreObjectNameSingular,
  type RecordGqlOperationFilter,
} from 'twenty-shared/types';
import {
  computeRelationGqlFieldJoinColumnName,
  isDefined,
} from 'twenty-shared/utils';

// The same rows the My Day page lists for "Me": the viewer's contacts that are due
export const buildMyDayRowsFilter = ({
  objectMetadataItems,
  workspaceMemberId,
}: {
  objectMetadataItems: EnrichedObjectMetadataItem[];
  workspaceMemberId: string;
}): RecordGqlOperationFilter | undefined => {
  const personObjectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) =>
      objectMetadataItem.nameSingular === CoreObjectNameSingular.Person,
  );

  const hasActiveField = (fieldName: string) =>
    personObjectMetadataItem?.fields.some(
      (field) => field.name === fieldName && field.isActive === true,
    ) === true;

  if (
    !isDefined(personObjectMetadataItem) ||
    !hasActiveField(MY_DAY_COUNT_SOURCE.dueFieldName) ||
    !hasActiveField(MY_DAY_COUNT_SOURCE.ownerFieldName)
  ) {
    return undefined;
  }

  return {
    [MY_DAY_COUNT_SOURCE.dueFieldName]: { eq: true },
    [computeRelationGqlFieldJoinColumnName({
      name: MY_DAY_COUNT_SOURCE.ownerFieldName,
    })]: { eq: workspaceMemberId },
  };
};
