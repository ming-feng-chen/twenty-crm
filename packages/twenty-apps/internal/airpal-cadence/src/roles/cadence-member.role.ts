import { defineRole } from 'twenty-sdk/define';

import {
  CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_MEMBER_ROLE_UNIVERSAL_IDENTIFIER,
  CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  SUPPRESSION_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const READ_ONLY = {
  canReadObjectRecords: true,
  canUpdateObjectRecords: false,
  canSoftDeleteObjectRecords: false,
  canDestroyObjectRecords: false,
};

// SPEC §7: members work people and touches; the rules, their audit trail and
// the suppression list are read-only. Twenty grants create and update as one
// permission, so members cannot create suppression entries directly either:
// the app creates them with its own role when a member opts someone out
// because they asked us to stop. No field-level read-only permissions: the
// engine-written person fields are protected by isUIEditable instead.
export default defineRole({
  universalIdentifier: CADENCE_MEMBER_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Cadence Member',
  description:
    'Works the daily cadence: people and touches. Cadence rules, their history and the suppression list are read-only.',
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
  ].map((objectUniversalIdentifier) => ({
    objectUniversalIdentifier,
    ...READ_ONLY,
  })),
  fieldPermissions: [],
});
