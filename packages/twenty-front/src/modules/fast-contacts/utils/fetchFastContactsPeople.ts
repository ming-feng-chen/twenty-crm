import { type ApolloClient } from '@apollo/client';
import { QUERY_MAX_RECORDS } from 'twenty-shared/constants';
import { doNotTranslate } from 'twenty-shared/i18n';
import { isDefined } from 'twenty-shared/utils';

import { FIND_FAST_CONTACTS_PEOPLE_QUERY } from '@/fast-contacts/graphql/queries/FindFastContactsPeopleQuery';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';

type FindFastContactsPeopleResult = {
  people: {
    edges: { node: FastContactsPerson }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export const fetchFastContactsPeople = async ({
  apolloCoreClient,
  filter,
}: {
  apolloCoreClient: ApolloClient;
  filter?: Record<string, unknown>;
}): Promise<FastContactsPerson[]> => {
  const people: FastContactsPerson[] = [];
  let after: string | null = null;

  do {
    const { data }: { data?: FindFastContactsPeopleResult } =
      await apolloCoreClient.query<FindFastContactsPeopleResult>({
        query: FIND_FAST_CONTACTS_PEOPLE_QUERY,
        variables: { filter, first: QUERY_MAX_RECORDS, after },
        fetchPolicy: 'no-cache',
      });

    if (!isDefined(data)) {
      throw new Error(doNotTranslate('No data returned for people'));
    }

    people.push(...data.people.edges.map((edge) => edge.node));

    after = data.people.pageInfo.hasNextPage
      ? data.people.pageInfo.endCursor
      : null;
  } while (isDefined(after));

  return people;
};
