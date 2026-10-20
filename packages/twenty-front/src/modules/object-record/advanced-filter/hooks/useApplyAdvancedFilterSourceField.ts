import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getJunctionFilterRelationTargetFieldMetadataId } from '@/object-record/record-filter/utils/getJunctionFilterRelationTargetFieldMetadataId';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { getDefaultAdvancedFilterOperand } from '@/object-record/advanced-filter/utils/getDefaultAdvancedFilterOperand';
import { useGetInitialFilterValue } from '@/object-record/object-filter-dropdown/hooks/useGetInitialFilterValue';
import { fieldMetadataItemIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemIdUsedInDropdownComponentState';
import { objectFilterDropdownCurrentRecordFilterComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownCurrentRecordFilterComponentState';
import { objectFilterDropdownSearchInputComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownSearchInputComponentState';
import { relationTargetFieldMetadataIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/relationTargetFieldMetadataIdUsedInDropdownComponentState';
import { selectedOperandInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/selectedOperandInDropdownComponentState';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { useUpsertRecordFilter } from '@/object-record/record-filter/hooks/useUpsertRecordFilter';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { getFilterTypeFromFieldType, isDefined } from 'twenty-shared/utils';
import { doNotTranslate } from 'twenty-shared/i18n';

type ApplyAdvancedFilterSourceFieldParams = {
  sourceFieldMetadataItem: FieldMetadataItem;
  recordFilterId: string;
};

export const useApplyAdvancedFilterSourceField = () => {
  const setSelectedOperandInDropdown = useSetAtomComponentState(
    selectedOperandInDropdownComponentState,
  );

  const setFieldMetadataItemIdUsedInDropdown = useSetAtomComponentState(
    fieldMetadataItemIdUsedInDropdownComponentState,
  );

  const setObjectFilterDropdownSearchInput = useSetAtomComponentState(
    objectFilterDropdownSearchInputComponentState,
  );

  const setSubFieldNameUsedInDropdown = useSetAtomComponentState(
    subFieldNameUsedInDropdownComponentState,
  );

  const setRelationTargetFieldMetadataIdUsedInDropdown =
    useSetAtomComponentState(
      relationTargetFieldMetadataIdUsedInDropdownComponentState,
    );

  const setObjectFilterDropdownCurrentRecordFilter = useSetAtomComponentState(
    objectFilterDropdownCurrentRecordFilterComponentState,
  );

  const currentRecordFilters = useAtomComponentStateValue(
    currentRecordFiltersComponentState,
  );

  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);

  const { upsertRecordFilter } = useUpsertRecordFilter();
  const { getInitialFilterValue } = useGetInitialFilterValue();

  const applyAdvancedFilterSourceField = ({
    sourceFieldMetadataItem,
    recordFilterId,
  }: ApplyAdvancedFilterSourceFieldParams) => {
    setFieldMetadataItemIdUsedInDropdown(sourceFieldMetadataItem.id);

    const filterType = getFilterTypeFromFieldType(sourceFieldMetadataItem.type);

    const defaultOperand = getDefaultAdvancedFilterOperand({
      filterType,
      subFieldName: null,
    });

    if (!isDefined(defaultOperand)) {
      throw new Error(
        doNotTranslate(`No valid operand found for filter type: ${filterType}`),
      );
    }

    setSelectedOperandInDropdown(defaultOperand);

    const { value, displayValue } = getInitialFilterValue(
      filterType,
      defaultOperand,
    );

    const existingRecordFilter = currentRecordFilters.find(
      (recordFilter) => recordFilter.id === recordFilterId,
    );

    const relationTargetFieldMetadataId =
      getJunctionFilterRelationTargetFieldMetadataId({
        fieldMetadataItem: sourceFieldMetadataItem,
        objectMetadataItems,
      });

    const newAdvancedFilter = {
      id: recordFilterId,
      fieldMetadataId: sourceFieldMetadataItem.id,
      displayValue,
      operand: defaultOperand,
      value,
      recordFilterGroupId: existingRecordFilter?.recordFilterGroupId,
      positionInRecordFilterGroup:
        existingRecordFilter?.positionInRecordFilterGroup,
      type: filterType,
      label: sourceFieldMetadataItem.label,
      subFieldName: null,
      relationTargetFieldMetadataId,
    } satisfies RecordFilter;

    setSubFieldNameUsedInDropdown(null);
    setRelationTargetFieldMetadataIdUsedInDropdown(
      relationTargetFieldMetadataId,
    );

    setObjectFilterDropdownSearchInput('');

    setObjectFilterDropdownCurrentRecordFilter(newAdvancedFilter);
    upsertRecordFilter(newAdvancedFilter);
  };

  return {
    applyAdvancedFilterSourceField,
  };
};
