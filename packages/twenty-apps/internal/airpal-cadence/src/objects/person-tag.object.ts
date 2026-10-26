import { defineObject } from 'twenty-sdk/define';

import { PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/tags-identifiers';

// `person` and `tag` are relation fields defined in src/fields/.
export default defineObject({
  universalIdentifier: PERSON_TAG_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'personTag',
  namePlural: 'personTags',
  labelSingular: 'Contact tag',
  labelPlural: 'Contact tags',
  description:
    'Which tags a contact has: one record per contact and tag, with personId and tagId. To tag a contact, create one; to untag, delete it.',
  icon: 'IconTag',
  isSearchable: false,
  fields: [],
});
