import { isDefined } from 'twenty-shared/utils';

import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { type FastContactsPersonNode } from '@/fast-contacts/types/FastContactsPersonNode';

const COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base' });

export const toFastContactsPerson = (
  node: FastContactsPersonNode,
): FastContactsPerson => ({
  ...node,
  tags: (node.tags?.edges ?? [])
    .map((edge) => edge.node.tag)
    .filter(isDefined)
    .sort((firstTag, secondTag) =>
      COLLATOR.compare(firstTag.name ?? '', secondTag.name ?? ''),
    ),
});
