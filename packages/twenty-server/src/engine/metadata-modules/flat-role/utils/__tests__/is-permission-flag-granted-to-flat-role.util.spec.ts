import {
  PermissionFlagType,
  SystemPermissionFlag,
} from 'twenty-shared/constants';

import { type FlatRolePermissionFlagMaps } from 'src/engine/metadata-modules/flat-role-permission-flag/types/flat-role-permission-flag-maps.type';
import { type FlatRole } from 'src/engine/metadata-modules/flat-role/types/flat-role.type';
import { isPermissionFlagGrantedToFlatRole } from 'src/engine/metadata-modules/flat-role/utils/is-permission-flag-granted-to-flat-role.util';

const FULL_ACCESS_ROLE = {
  canAccessAllTools: true,
  canUpdateAllSettings: true,
  rolePermissionFlagIds: ['ai-flag-assignment'],
} as unknown as FlatRole;

const AI_FLAG_ASSIGNED_MAPS = {
  universalIdentifierById: { 'ai-flag-assignment': 'ai-flag-assignment' },
  byUniversalIdentifier: {
    'ai-flag-assignment': {
      permissionFlagUniversalIdentifier:
        SystemPermissionFlag[PermissionFlagType.AI],
    },
  },
} as unknown as FlatRolePermissionFlagMaps;

const isGranted = (permissionFlag: PermissionFlagType) =>
  isPermissionFlagGrantedToFlatRole({
    flatRole: FULL_ACCESS_ROLE,
    permissionFlag,
    flatRolePermissionFlagMaps: AI_FLAG_ASSIGNED_MAPS,
  });

describe('isPermissionFlagGrantedToFlatRole', () => {
  it('never grants the AI flags, even to a role with every access', () => {
    expect(isGranted(PermissionFlagType.AI)).toBe(false);
    expect(isGranted(PermissionFlagType.AI_SETTINGS)).toBe(false);
  });

  it('still grants other flags through role-wide access', () => {
    expect(isGranted(PermissionFlagType.WORKSPACE)).toBe(true);
    expect(isGranted(PermissionFlagType.UPLOAD_FILE)).toBe(true);
  });
});
