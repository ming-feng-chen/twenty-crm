import { defineView } from 'twenty-sdk/define';

import {
  PARTNERS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
  PARTNERS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
  PARTNERS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  PARTNERS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';
import { buildOrganisationGroupView } from 'src/utils/organisation-group-views';

export default defineView(
  buildOrganisationGroupView({
    universalIdentifier: PARTNERS_VIEW_UNIVERSAL_IDENTIFIER,
    name: 'Partners',
    icon: 'IconBuildingStore',
    position: 12,
    group: 'PARTNER',
    viewFieldIdentifiers: PARTNERS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
    filterUniversalIdentifier: PARTNERS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
    sortUniversalIdentifier: PARTNERS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  }),
);
