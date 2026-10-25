import { useContext, useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { dateLocaleState } from '@/localization/states/dateLocaleState';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldDateMetadataSettings } from '@/object-record/record-field/ui/types/FieldMetadata';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { UserContext } from '@/users/contexts/UserContext';

export const useFastContactsCellFormatContext = (
  personObjectMetadataItem: EnrichedObjectMetadataItem,
): FastContactsCellFormatContext => {
  const { dateFormat } = useContext(UserContext);
  const dateLocale = useAtomStateValue(dateLocaleState);

  return useMemo(() => {
    const getField = (fieldName: string) =>
      personObjectMetadataItem.fields.find((field) => field.name === fieldName);

    const stageOptions = getField('cadenceStage')?.options ?? [];

    return {
      dateFormat,
      localeCatalog: dateLocale.localeCatalog,
      stageLabelByValue: new Map(
        stageOptions
          .filter((option) => isDefined(option))
          .map((option) => [option.value, option.label]),
      ),
      nextActionDateSettings: getField('nextActionDate')?.settings as
        | FieldDateMetadataSettings
        | undefined,
      lastTouchOnSettings: getField('lastTouchOn')?.settings as
        | FieldDateMetadataSettings
        | undefined,
    };
  }, [dateFormat, dateLocale.localeCatalog, personObjectMetadataItem]);
};
