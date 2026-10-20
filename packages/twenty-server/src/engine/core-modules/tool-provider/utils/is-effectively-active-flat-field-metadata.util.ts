import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { resolveEffectiveFlatEntityProperty } from 'src/engine/metadata-modules/overrides/utils/resolve-effective-flat-entity-property.util';

// Deactivating a standard field writes an override, so the column alone still
// reads as active
export const isEffectivelyActiveFlatFieldMetadata = (
  flatFieldMetadata: FlatFieldMetadata,
): boolean =>
  resolveEffectiveFlatEntityProperty({
    metadataName: 'fieldMetadata',
    flatEntity: flatFieldMetadata,
    property: 'isActive',
  });
