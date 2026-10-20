import { toggleAllPickableMorphItems } from '@/object-record/record-picker/multiple-record-picker/utils/toggleAllPickableMorphItems';
import { type RecordPickerPickableMorphItem } from '@/object-record/record-picker/types/RecordPickerPickableMorphItem';

const morphItem = (
  recordId: string,
  isSelected: boolean,
): RecordPickerPickableMorphItem => ({
  recordId,
  objectMetadataId: 'member-object-id',
  isSelected,
  isMatchingSearchFilter: true,
});

describe('toggleAllPickableMorphItems', () => {
  it('should select everyone not yet selected', () => {
    const { nextPickableMorphItems, changedMorphItems } =
      toggleAllPickableMorphItems({
        pickableMorphItems: [
          morphItem('romy', true),
          morphItem('ilesh', false),
        ],
        recordIds: ['romy', 'ilesh', 'ming'],
        objectMetadataId: 'member-object-id',
      });

    expect(changedMorphItems).toEqual([
      morphItem('ilesh', true),
      morphItem('ming', true),
    ]);
    expect(nextPickableMorphItems).toEqual([
      morphItem('romy', true),
      morphItem('ilesh', true),
      morphItem('ming', true),
    ]);
  });

  it('should clear everyone once everyone is selected', () => {
    const { nextPickableMorphItems, changedMorphItems } =
      toggleAllPickableMorphItems({
        pickableMorphItems: [morphItem('romy', true), morphItem('ilesh', true)],
        recordIds: ['romy', 'ilesh'],
        objectMetadataId: 'member-object-id',
      });

    expect(changedMorphItems).toEqual([
      morphItem('romy', false),
      morphItem('ilesh', false),
    ]);
    expect(nextPickableMorphItems).toEqual([
      morphItem('romy', false),
      morphItem('ilesh', false),
    ]);
  });
});
