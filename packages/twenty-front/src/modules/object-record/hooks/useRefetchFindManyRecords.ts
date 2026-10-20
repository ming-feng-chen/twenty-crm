import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { capitalize } from 'twenty-shared/utils';

export const useRefetchFindManyRecords = ({
  objectMetadataNamePlural,
}: {
  objectMetadataNamePlural: string;
}) => {
  const apolloCoreClient = useApolloCoreClient();

  const refetchFindManyRecords = async () => {
    const findManyRecordsQueryName = `FindMany${capitalize(
      objectMetadataNamePlural,
    )}`;

    await apolloCoreClient.refetchQueries({
      include: [findManyRecordsQueryName],
      // Matching by name also picks up skipped (standby) queries, such as a
      // lookup by ids with nothing selected, which the server rejects
      onQueryUpdated: (observableQuery) =>
        observableQuery.options.fetchPolicy !== 'standby',
    });
  };

  return {
    refetchFindManyRecords,
  };
};
