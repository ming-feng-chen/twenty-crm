import { defineView } from 'twenty-sdk/define';

import {
  PARTNER_CONTACTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
  PARTNER_CONTACTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
  PARTNER_CONTACTS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  PARTNER_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';
import { buildGroupContactsView } from 'src/utils/organisation-group-views';

export default defineView(
  buildGroupContactsView({
    universalIdentifier: PARTNER_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER,
    name: 'Partner contacts',
    icon: 'IconUsers',
    position: 14,
    group: 'PARTNER',
    viewFieldIdentifiers: PARTNER_CONTACTS_VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
    filterUniversalIdentifier: PARTNER_CONTACTS_VIEW_FILTER_UNIVERSAL_IDENTIFIER,
    sortUniversalIdentifier: PARTNER_CONTACTS_VIEW_SORT_UNIVERSAL_IDENTIFIER,
  }),
);
