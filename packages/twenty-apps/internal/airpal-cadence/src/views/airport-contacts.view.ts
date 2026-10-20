import { defineView } from 'twenty-sdk/define';

import {
  AIRPORT_CONTACTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
  AIRPORT_CONTACTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
  AIRPORT_CONTACTS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  AIRPORT_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';
import { buildGroupContactsView } from 'src/utils/organisation-group-views';

export default defineView(
  buildGroupContactsView({
    universalIdentifier: AIRPORT_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER,
    name: 'Airport contacts',
    icon: 'IconUsers',
    position: 15,
    group: 'AIRPORT',
    viewFieldIdentifiers: AIRPORT_CONTACTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
    filterUniversalIdentifier: AIRPORT_CONTACTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
    sortUniversalIdentifier: AIRPORT_CONTACTS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  }),
);
