// Twenty resets SELECT options to these on every app deploy, so new groups or
// categories are added here, not in the data model settings.
export const COMPANY_GROUP_OPTIONS = [
  { value: 'PARTNER', label: 'Partner', color: 'blue', position: 0 },
  { value: 'AIRPORT', label: 'Airport', color: 'green', position: 1 },
] as const;

export const COMPANY_CATEGORY_OPTIONS = [
  { value: 'DUTY_FREE', label: 'Duty free', color: 'purple', position: 0 },
  { value: 'LOUNGE_OPERATOR', label: 'Lounge operator', color: 'orange', position: 1 },
  { value: 'LOUNGE_NETWORK', label: 'Lounge network', color: 'yellow', position: 2 },
  { value: 'F_AND_B', label: 'F&B', color: 'red', position: 3 },
] as const;

export type CompanyGroupValue = (typeof COMPANY_GROUP_OPTIONS)[number]['value'];
export type CompanyCategoryValue =
  (typeof COMPANY_CATEGORY_OPTIONS)[number]['value'];
