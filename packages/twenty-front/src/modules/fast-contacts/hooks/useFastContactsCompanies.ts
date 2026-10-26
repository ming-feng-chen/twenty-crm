import { useCallback, useEffect, useState } from 'react';
import { QUERY_MAX_RECORDS } from 'twenty-shared/constants';
import { doNotTranslate } from 'twenty-shared/i18n';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { useListenToObjectRecordOperationBrowserEvent } from '@/browser-event/hooks/useListenToObjectRecordOperationBrowserEvent';
import { FIND_FAST_CONTACTS_COMPANIES_QUERY } from '@/fast-contacts/graphql/queries/FindFastContactsCompaniesQuery';
import { type FastContactsCompany } from '@/fast-contacts/types/FastContactsPerson';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';

type FindFastContactsCompaniesResult = {
  companies: {
    edges: { node: FastContactsCompany }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

// Every company, for the Company picker, paste matching and the Company filter.
export const useFastContactsCompanies = () => {
  const apolloCoreClient = useApolloCoreClient();
  const { objectMetadataItem: companyObjectMetadataItem } =
    useObjectMetadataItem({
      objectNameSingular: CoreObjectNameSingular.Company,
    });
  const [companies, setCompanies] = useState<FastContactsCompany[]>([]);

  const loadCompanies = useCallback(async () => {
    const loadedCompanies: FastContactsCompany[] = [];
    let after: string | null = null;

    do {
      const { data }: { data?: FindFastContactsCompaniesResult } =
        await apolloCoreClient.query<FindFastContactsCompaniesResult>({
          query: FIND_FAST_CONTACTS_COMPANIES_QUERY,
          variables: { first: QUERY_MAX_RECORDS, after },
          fetchPolicy: 'no-cache',
        });

      if (!isDefined(data)) {
        throw new Error(doNotTranslate('No data returned for companies'));
      }

      loadedCompanies.push(...data.companies.edges.map((edge) => edge.node));
      after = data.companies.pageInfo.hasNextPage
        ? data.companies.pageInfo.endCursor
        : null;
    } while (isDefined(after));

    setCompanies(loadedCompanies);
  }, [apolloCoreClient]);

  // A failed load keeps the previous list; paste and the picker then report unknown companies.
  const reloadCompanies = useCallback(() => {
    void loadCompanies().catch(() => undefined);
  }, [loadCompanies]);

  useEffect(() => {
    reloadCompanies();
  }, [reloadCompanies]);

  useListenToObjectRecordOperationBrowserEvent({
    objectMetadataItemId: companyObjectMetadataItem.id,
    onObjectRecordOperationBrowserEvent: reloadCompanies,
  });

  const addCompanyLocally = useCallback(
    (company: FastContactsCompany) =>
      setCompanies((currentCompanies) => [...currentCompanies, company]),
    [],
  );

  return { companies, addCompanyLocally };
};
