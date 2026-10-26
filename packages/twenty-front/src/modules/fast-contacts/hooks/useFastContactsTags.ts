import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { useListenToObjectRecordOperationBrowserEvent } from '@/browser-event/hooks/useListenToObjectRecordOperationBrowserEvent';
import { FIND_FAST_CONTACTS_TAGS_QUERY } from '@/fast-contacts/graphql/queries/FindFastContactsTagsQuery';
import { type FastContactsTag } from '@/fast-contacts/types/FastContactsPerson';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';

// Every tag, for the Tags picker, paste matching and the Tags filter.
export const useFastContactsTags = () => {
  const apolloCoreClient = useApolloCoreClient();
  const { objectMetadataItems } = useObjectMetadataItems();
  const tagObjectMetadataItemId = objectMetadataItems.find(
    (objectMetadataItem) => objectMetadataItem.nameSingular === 'tag',
  )?.id;
  const [tags, setTags] = useState<FastContactsTag[]>([]);

  // A failed load keeps the previous list; paste and the picker then report unknown tags.
  const reloadTags = useCallback(() => {
    void apolloCoreClient
      .query<{ tags: { edges: { node: FastContactsTag }[] } }>({
        query: FIND_FAST_CONTACTS_TAGS_QUERY,
        fetchPolicy: 'no-cache',
      })
      .then(({ data }) => {
        if (isDefined(data)) {
          setTags(data.tags.edges.map((edge) => edge.node));
        }
      })
      .catch(() => undefined);
  }, [apolloCoreClient]);

  useEffect(() => {
    reloadTags();
  }, [reloadTags]);

  useListenToObjectRecordOperationBrowserEvent({
    objectMetadataItemId: tagObjectMetadataItemId,
    onObjectRecordOperationBrowserEvent: reloadTags,
    enabled: isDefined(tagObjectMetadataItemId),
  });

  const addTagLocally = useCallback(
    (tag: FastContactsTag) =>
      setTags((currentTags) =>
        currentTags.some((currentTag) => currentTag.id === tag.id)
          ? currentTags
          : [...currentTags, tag],
      ),
    [],
  );

  return { tags, addTagLocally };
};
