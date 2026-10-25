import { type PermissionFlagType } from 'twenty-shared/constants';

import { type FlatRolePermissionFlagMaps } from 'src/engine/metadata-modules/flat-role-permission-flag/types/flat-role-permission-flag-maps.type';
import { type FlatRole } from 'src/engine/metadata-modules/flat-role/types/flat-role.type';
import { flatRoleHasPermissionFlag } from 'src/engine/metadata-modules/flat-role/utils/flat-role-has-permission-flag.util';
import { AIRPAL_DISABLED_PERMISSION_FLAGS } from 'src/engine/metadata-modules/permissions/constants/airpal-disabled-permission-flags.constant';
import { hasRoleWideAccessToPermissionFlag } from 'src/engine/metadata-modules/permissions/utils/has-role-wide-access-to-permission-flag.util';

export const isPermissionFlagGrantedToFlatRole = ({
  flatRole,
  permissionFlag,
  flatRolePermissionFlagMaps,
}: {
  flatRole: FlatRole;
  permissionFlag: PermissionFlagType;
  flatRolePermissionFlagMaps: FlatRolePermissionFlagMaps;
}): boolean =>
  !AIRPAL_DISABLED_PERMISSION_FLAGS.includes(permissionFlag) &&
  (hasRoleWideAccessToPermissionFlag({ role: flatRole, permissionFlag }) ||
    flatRoleHasPermissionFlag({
      flatRole,
      permissionFlag,
      flatRolePermissionFlagMaps,
    }));
