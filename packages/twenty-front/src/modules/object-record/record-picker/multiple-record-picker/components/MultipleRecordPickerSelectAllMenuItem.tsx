import { t } from '@lingui/core/macro';
import { useStore } from 'jotai';
import { ListItemButton } from 'twenty-ui/components/navigation';
import { IconUsers } from 'twenty-ui/icon';

import { multipleRecordPickerPickableMorphItemsComponentState } from '@/object-record/record-picker/multiple-record-picker/states/multipleRecordPickerPickableMorphItemsComponentState';
import { multipleRecordPickerSearchFilterComponentState } from '@/object-record/record-picker/multiple-record-picker/states/multipleRecordPickerSearchFilterComponentState';
import { type MultipleRecordPickerSelectAllOption } from '@/object-record/record-picker/multiple-record-picker/types/MultipleRecordPickerSelectAllOption';
import {
  isEveryRecordSelected,
  toggleAllPickableMorphItems,
} from '@/object-record/record-picker/multiple-record-picker/utils/toggleAllPickableMorphItems';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

type MultipleRecordPickerSelectAllMenuItemProps = {
  componentInstanceId: string;
  selectAllOption: MultipleRecordPickerSelectAllOption;
};

export const MultipleRecordPickerSelectAllMenuItem = ({
  componentInstanceId,
  selectAllOption,
}: MultipleRecordPickerSelectAllMenuItemProps) => {
  const store = useStore();

  const multipleRecordPickerPickableMorphItems = useAtomComponentStateValue(
    multipleRecordPickerPickableMorphItemsComponentState,
    componentInstanceId,
  );

  const multipleRecordPickerPickableMorphItemsCallbackState =
    useAtomComponentStateCallbackState(
      multipleRecordPickerPickableMorphItemsComponentState,
      componentInstanceId,
    );

  const multipleRecordPickerSearchFilter = useAtomComponentStateValue(
    multipleRecordPickerSearchFilterComponentState,
    componentInstanceId,
  );

  if (
    multipleRecordPickerSearchFilter.trim() !== '' ||
    selectAllOption.recordIds.length === 0
  ) {
    return null;
  }

  const isAllSelected = isEveryRecordSelected({
    pickableMorphItems: multipleRecordPickerPickableMorphItems,
    recordIds: selectAllOption.recordIds,
  });

  const handleClick = () => {
    const { nextPickableMorphItems, changedMorphItems } =
      toggleAllPickableMorphItems({
        pickableMorphItems: store.get(
          multipleRecordPickerPickableMorphItemsCallbackState,
        ),
        recordIds: selectAllOption.recordIds,
        objectMetadataId: selectAllOption.objectMetadataId,
      });

    store.set(
      multipleRecordPickerPickableMorphItemsCallbackState,
      nextPickableMorphItems,
    );

    if (changedMorphItems.length > 0) {
      selectAllOption.onChange(changedMorphItems);
    }
  };

  return (
    <DropdownMenuItemsContainer isMultiSelect scrollable={false}>
      <ListItemButton
        role="option"
        aria-selected={isAllSelected}
        selected={isAllSelected}
        indicator="checkbox"
        onClick={handleClick}
        startIcon={<IconUsers size="16" />}
      >
        {t`All`}
      </ListItemButton>
    </DropdownMenuItemsContainer>
  );
};
