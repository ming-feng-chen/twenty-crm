import { useContext, useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { dateLocaleState } from '@/localization/states/dateLocaleState';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldDateMetadataSettings } from '@/object-record/record-field/ui/types/FieldMetadata';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { UserContext } from '@/users/contexts/UserContext';

export const useFastContactsCellFormatContext = (
  personObjectMetadataItem: EnrichedObjectMetadataItem,
): FastContactsCellFormatContext => {
  const { dateFormat, timeZone } = useContext(UserContext);
  const dateLocale = useAtomStateValue(dateLocaleState);

  return useMemo(() => {
    const getField = (fieldName: string) =>
      personObjectMetadataItem.fields.find((field) => field.name === fieldName);

    const selectOptionsByColumnKey: FastContactsCellFormatContext['selectOptionsByColumnKey'] =
      {};
    const dateSettingsByColumnKey: FastContactsCellFormatContext['dateSettingsByColumnKey'] =
      {};

    for (const column of FAST_CONTACTS_COLUMNS) {
      const field = getField(column.key);

      if (column.kind === 'select') {
        selectOptionsByColumnKey[column.key] = (field?.options ?? [])
          .filter(isDefined)
          .map((option) => ({
            value: option.value,
            label: option.label,
            position: option.position,
          }))
          .sort(
            (firstOption, secondOption) =>
              firstOption.position - secondOption.position,
          );
      }

      if (column.kind === 'date' || column.kind === 'dateTime') {
        dateSettingsByColumnKey[column.key] = field?.settings as
          | FieldDateMetadataSettings
          | undefined;
      }
    }

    return {
      dateFormat,
      localeCatalog: dateLocale.localeCatalog,
      timeZone,
      selectOptionsByColumnKey,
      dateSettingsByColumnKey,
    };
  }, [
    dateFormat,
    timeZone,
    dateLocale.localeCatalog,
    personObjectMetadataItem,
  ]);
};
