import { FieldMetadataType } from 'twenty-shared/types';

import { isEffectivelyActiveFlatFieldMetadata } from 'src/engine/core-modules/tool-provider/utils/is-effectively-active-flat-field-metadata.util';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';

const STANDARD_APP = '20202020-bbbb-4bbb-8bbb-000000000002';
const WORKSPACE_CUSTOM_APP = '20202020-aaaa-4aaa-8aaa-000000000001';

const buildField = (
  overrides: Partial<Parameters<typeof getFlatFieldMetadataMock>[0]> = {},
) =>
  getFlatFieldMetadataMock({
    universalIdentifier: 'assignee-field',
    objectMetadataId: 'task-object',
    type: FieldMetadataType.RELATION,
    applicationUniversalIdentifier: STANDARD_APP,
    ...overrides,
  });

describe('isEffectivelyActiveFlatFieldMetadata', () => {
  it('should treat a field as active when nothing deactivated it', () => {
    expect(isEffectivelyActiveFlatFieldMetadata(buildField())).toBe(true);
  });

  it('should treat a standard field deactivated through an override as inactive', () => {
    expect(
      isEffectivelyActiveFlatFieldMetadata(
        buildField({
          isActive: true,
          overrides: { [WORKSPACE_CUSTOM_APP]: { isActive: false } },
        }),
      ),
    ).toBe(false);
  });

  it('should treat a field deactivated on its own column as inactive', () => {
    expect(
      isEffectivelyActiveFlatFieldMetadata(buildField({ isActive: false })),
    ).toBe(false);
  });
});
