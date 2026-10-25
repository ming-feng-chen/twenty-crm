import { PermissionFlagType } from 'twenty-shared/constants';

// AirPal: the owner removed every AI feature, so no role can hold these flags.
// MCP never checks them, so Grok's /mcp access is unaffected.
export const AIRPAL_DISABLED_PERMISSION_FLAGS: PermissionFlagType[] = [
  PermissionFlagType.AI,
  PermissionFlagType.AI_SETTINGS,
];
