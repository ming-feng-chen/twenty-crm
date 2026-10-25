import { isNonEmptyString } from '@sniptt/guards';
import {
  getAbsoluteUrlOrThrow,
  getUrlHostnameOrThrow,
  isDefined,
} from 'twenty-shared/utils';

import { getFieldLinkDefinedLinks } from '@/object-record/record-field/ui/meta-types/input/utils/getFieldLinkDefinedLinks';
import { type FieldLinksValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { checkUrlType } from '@/ui/field/display/utils/checkUrlType';
import { getDisplayValueByUrlType } from '@/ui/field/display/utils/getDisplayValueByUrlType';
import { isSocialLinkType } from '@/ui/field/display/utils/isSocialLinkType';

export type FastContactsLinkDisplayValue = {
  url: string;
  label: string;
};

// Mirrors LinksDisplay and SocialLink so the grid shows the same labels.
export const getFastContactsLinkDisplayValues = (
  value: FieldLinksValue | null,
): FastContactsLinkDisplayValue[] => {
  if (!isDefined(value)) {
    return [];
  }

  return getFieldLinkDefinedLinks(value).map(({ url, label }) => {
    let absoluteUrl = '';
    let hostname = '';

    try {
      absoluteUrl = getAbsoluteUrlOrThrow(url);
      hostname = getUrlHostnameOrThrow(absoluteUrl);
    } catch {
      absoluteUrl = '';
      hostname = '';
    }

    const type = checkUrlType(absoluteUrl);

    if (isSocialLinkType(type)) {
      return {
        url: absoluteUrl,
        label: isNonEmptyString(label)
          ? label
          : (getDisplayValueByUrlType({ type, href: absoluteUrl }) ??
            absoluteUrl),
      };
    }

    return { url: absoluteUrl, label: label || hostname };
  });
};
