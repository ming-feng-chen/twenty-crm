import {
  PermissionFlagType,
  SystemPermissionFlag,
} from 'twenty-shared/constants';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { WorkspaceRolesPermissionsCacheService } from 'src/engine/metadata-modules/role/services/workspace-roles-permissions-cache.service';

const compute = ({
  canAccessAllTools = false,
  canUpdateAllSettings = false,
  hasAiFlag = false,
  canUpdateObjectRecords = true,
} = {}) => {
  const service = new WorkspaceRolesPermissionsCacheService();
  return service.computeForCache({
    workspaceId: 'workspace',
    rows: {
      role: [{ id: 'role', canAccessAllTools, canUpdateAllSettings }],
      objectMetadata: [
        {
          id: 'thread',
          isSystem: true,
          universalIdentifier:
            STANDARD_OBJECTS.agentChatThread.universalIdentifier,
        },
      ],
      objectPermission: {
        byRoleId: new Map([
          ['role', [{ objectMetadataId: 'thread', canUpdateObjectRecords }]],
        ]),
      },
      rolePermissionFlag: {
        byRoleId: new Map([
          ['role', hasAiFlag ? [{ permissionFlagId: 'ai' }] : []],
        ]),
      },
      permissionFlag: [
        {
          id: 'ai',
          universalIdentifier: SystemPermissionFlag[PermissionFlagType.AI],
        },
      ],
      fieldPermission: { byRoleId: new Map() },
      rowLevelPermissionPredicate: { byRoleId: new Map() },
      rowLevelPermissionPredicateGroup: { byRoleId: new Map() },
      fieldMetadata: [],
      featureFlag: [],
      application: [],
    },
  } as never).role.thread;
};

// AirPal: AI is switched off for every role, so conversations stay out of reach.
describe('Conversation role permissions', () => {
  it.each([
    { canAccessAllTools: true },
    { hasAiFlag: true },
    { canUpdateAllSettings: true },
    { canAccessAllTools: true, canUpdateAllSettings: true, hasAiFlag: true },
  ])('denies conversation records to a role with %o', (roleAccess) => {
    expect(compute(roleAccess)).toMatchObject({
      canReadObjectRecords: false,
      canUpdateObjectRecords: false,
      canDestroyObjectRecords: false,
      canSoftDeleteObjectRecords: false,
    });
  });
});
