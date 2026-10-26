import { defineRole } from 'twenty-sdk/define';

import {
  CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_MEMBER_ROLE_UNIVERSAL_IDENTIFIER,
  CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  SUPPRESSION_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { TAG_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/tags-identifiers';

const READ_ONLY = {
  canReadObjectRecords: true,
  canUpdateObjectRecords: false,
  canSoftDeleteObjectRecords: false,
  canDestroyObjectRecords: false,
};

// SPEC §7. Twenty grants create and update as one permission, so suppression
// entries and tags stay read-only here and the app creates them with its own
// role (opt-out, create-tag route); only Admins rename or delete tags.
// Engine-written person fields are protected by isUIEditable, not field permissions.
export default defineRole({
  universalIdentifier: CADENCE_MEMBER_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Cadence Member',
  description:
    'Works the daily cadence: people, touches and contact tags. Cadence rules, their history, the suppression list and tag names are read-only.',
  icon: 'IconUserCheck',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canAccessAllTools: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: [
    CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
    CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
    CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
    SUPPRESSION_OBJECT_UNIVERSAL_IDENTIFIER,
    TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  ].map((objectUniversalIdentifier) => ({
    objectUniversalIdentifier,
    ...READ_ONLY,
  })),
  fieldPermissions: [],
});
