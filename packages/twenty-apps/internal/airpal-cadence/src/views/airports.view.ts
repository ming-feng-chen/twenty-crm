import { defineView } from 'twenty-sdk/define';

import {
  AIRPORTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
  AIRPORTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
  AIRPORTS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  AIRPORTS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';
import { buildOrganisationGroupView } from 'src/utils/organisation-group-views';

export default defineView(
  buildOrganisationGroupView({
    universalIdentifier: AIRPORTS_VIEW_UNIVERSAL_IDENTIFIER,
    name: 'Airports',
    icon: 'IconPlaneDeparture',
    position: 13,
    group: 'AIRPORT',
    viewFieldIdentifiers: AIRPORTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
    filterUniversalIdentifier: AIRPORTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
    sortUniversalIdentifier: AIRPORTS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  }),
);
