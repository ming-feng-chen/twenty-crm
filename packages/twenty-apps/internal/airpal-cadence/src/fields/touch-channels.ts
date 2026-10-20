import { defineField, FieldType } from 'twenty-sdk/define';
import { CADENCE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: '996f5aec-ac3a-49a3-ac45-6432829f7c45',
  name: 'touchChannels',
  label: 'Outreach channels',
  type: FieldType.RAW_JSON,
  objectUniversalIdentifier: CADENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  description: 'Channel values and labels managed in the Cadence rules page.',
  isNullable: true,
  isUIEditable: false,
});
