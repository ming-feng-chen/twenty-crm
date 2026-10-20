import {
  defineApplicationRole,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  SUPPRESSION_OBJECT_UNIVERSAL_IDENTIFIER,
  TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const READ_WRITE = {
  canReadObjectRecords: true,
  canUpdateObjectRecords: true,
  canSoftDeleteObjectRecords: false,
  canDestroyObjectRecords: false,
};

const READ_WRITE_SOFT_DELETE = {
  ...READ_WRITE,
  canSoftDeleteObjectRecords: true,
};

// The engine writes with this role's own token (CoreApiClient runAs
// 'application'), so it must cover every engine write. Front components and
// routes acting for a member run with the intersection of this role and the
// member's role, so it is also the upper bound of what the UI can do: touch
// soft delete is the Undo, and cadenceStep soft delete removes a step on save.
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} function role`,
  description:
    'Reads the workspace; writes cadence fields on people, touches, cadence rules, their audit trail and the suppression list.',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToAgents: false,
  canBeAssignedToUsers: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: [
    {
      objectUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      ...READ_WRITE,
    },
    {
      objectUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember
          .universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: TOUCH_OBJECT_UNIVERSAL_IDENTIFIER,
      ...READ_WRITE_SOFT_DELETE,
    },
    {
      objectUniversalIdentifier: CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
      ...READ_WRITE,
    },
    {
      objectUniversalIdentifier: CADENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
      ...READ_WRITE_SOFT_DELETE,
    },
    {
      objectUniversalIdentifier: CADENCE_CHANGE_OBJECT_UNIVERSAL_IDENTIFIER,
      ...READ_WRITE,
    },
    {
      objectUniversalIdentifier: SUPPRESSION_OBJECT_UNIVERSAL_IDENTIFIER,
      ...READ_WRITE,
    },
  ],
  fieldPermissions: [],
  permissionFlagUniversalIdentifiers: [],
});
